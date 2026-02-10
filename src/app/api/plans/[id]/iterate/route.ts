/* eslint-disable max-lines-per-function, complexity */
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { plans, phases, planTasks, planIterations } from '@/db/schema';
import { repositories } from '@/db/schema/repositories';
import { eq } from 'drizzle-orm';
import { claudeWrapper } from '@/lib/claude/wrapper';
import { getContainerPath } from '@/lib/qa-gates/command-executor';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params;
  const body = await request.json();
  const { message, conversationHistory } = body as {
    message: string;
    conversationHistory: Message[];
  };

  // Create a streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Helper to send data
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        // Load plan with all related data
        const [plan] = await db
          .select()
          .from(plans)
          .where(eq(plans.id, planId))
          .limit(1);

        if (!plan) {
          send({ error: 'Plan not found' });
          controller.close();
          return;
        }

        const repository = await db.query.repositories.findFirst({
          where: eq(repositories.id, plan.repositoryId),
        });

        if (!repository) {
          send({ error: 'Repository not found' });
          controller.close();
          return;
        }

        const planPhases = await db
          .select()
          .from(phases)
          .where(eq(phases.planId, planId))
          .orderBy(phases.order);

        const tasks = await db.select().from(planTasks).where(eq(planTasks.planId, planId));

        // Build context for Claude
        const planContext = {
          plan: {
            title: plan.title,
            description: plan.description,
            status: plan.status,
          },
          phases: planPhases.map((p, idx) => ({
            order: idx + 1,
            title: p.title,
            description: p.description,
            executionMode: p.executionMode,
            tasks: tasks
              .filter((t) => t.phaseId === p.id)
              .sort((a, b) => a.order - b.order)
              .map((t, tIdx) => ({
                order: tIdx + 1,
                title: t.title,
                description: t.description,
              })),
          })),
        };

        // Build prompt for Claude
        const conversationContext = conversationHistory
          .slice(-3)
          .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
          .join('\n\n');

        const fullPrompt = `You are helping refine a development plan. Current plan structure:

${JSON.stringify(planContext, null, 2)}

${conversationContext ? `Previous conversation:\n${conversationContext}\n\n` : ''}User request: "${message}"

IMPORTANT: You MUST make the changes the user is asking for. Respond in TWO parts:

1. First, write a brief explanation of what you're changing (1-2 sentences)

2. Then, ALWAYS include the <UPDATES> section with the exact changes in JSON format.

REQUIRED FORMAT:
[Your brief explanation here]

<UPDATES>
[
  {"action": "update_phase", "phaseOrder": 1, "updates": {"title": "New Title", "description": "New Description"}},
  {"action": "update_task", "phaseOrder": 1, "taskOrder": 2, "updates": {"title": "New Title", "description": "New Description"}},
  {"action": "create_task", "phaseOrder": 1, "task": {"title": "Task Title", "description": "Detailed task description"}}
]
</UPDATES>

EXAMPLES:
User: "Make phase 1 more detailed"
Response: "I'll expand Phase 1 with more specific details.

<UPDATES>
[
  {"action": "update_phase", "phaseOrder": 1, "updates": {"description": "Detailed description here..."}}
]
</UPDATES>"

User: "Add a task for error handling to phase 2"
Response: "I'll add an error handling task to Phase 2.

<UPDATES>
[
  {"action": "create_task", "phaseOrder": 2, "task": {"title": "Implement Error Handling", "description": "Add try-catch blocks and error logging..."}}
]
</UPDATES>"

CRITICAL: You must ALWAYS include <UPDATES> when the user asks for changes. Use phaseOrder (1, 2, 3...) and taskOrder (1, 2, 3...) to reference items.`;

        // Send status update
        send({ type: 'status', message: 'Calling Claude...' });

        // Call Claude with streaming
        const workingDir = getContainerPath(repository.path);
        console.log('[PlanIterate] Calling Claude with working dir:', workingDir);
        console.log('[PlanIterate] SIMULATE_CLAUDE:', process.env.SIMULATE_CLAUDE);

        let response: string;
        try {
          response = await claudeWrapper.executeWithStream(
            fullPrompt,
            workingDir,
            (chunk) => {
              // Stream each chunk to the client as it arrives
              send({ type: 'chunk', content: chunk });
            },
            120000
          );
          console.log('[PlanIterate] Claude complete response received');
        } catch (error) {
          console.error('[PlanIterate] Error calling Claude:', error);
          send({
            type: 'error',
            message: error instanceof Error ? error.message : 'Failed to call Claude'
          });
          controller.close();
          return;
        }

        // Check if Claude included updates
        const updatesMatch = response.match(/<UPDATES>([\s\S]*?)<\/UPDATES>/);
        let updated = false;

        console.log('[PlanIterate] Found updates:', !!updatesMatch);

        if (updatesMatch && updatesMatch[1]) {
          try {
            console.log('[PlanIterate] Parsing updates:', updatesMatch[1]);
            const updates = JSON.parse(updatesMatch[1]);
            console.log('[PlanIterate] Parsed updates:', JSON.stringify(updates, null, 2));

            send({ type: 'status', message: 'Applying updates...' });

            // Apply updates using order-based lookups
            for (const update of updates) {
              console.log('[PlanIterate] Processing update:', JSON.stringify(update));

              if (update.action === 'update_phase') {
                const targetPhase = planPhases.find((p) => p.order === update.phaseOrder);
                console.log('[PlanIterate] Found phase:', targetPhase?.id, 'for order:', update.phaseOrder);
                if (targetPhase) {
                  await db
                    .update(phases)
                    .set({
                      ...update.updates,
                      updatedAt: new Date(),
                    })
                    .where(eq(phases.id, targetPhase.id));
                  console.log('[PlanIterate] Updated phase:', targetPhase.id);
                  updated = true;
                }
              } else if (update.action === 'update_task') {
                const targetPhase = planPhases.find((p) => p.order === update.phaseOrder);
                if (targetPhase) {
                  const phaseTasks = tasks
                    .filter((t) => t.phaseId === targetPhase.id)
                    .sort((a, b) => a.order - b.order);
                  const targetTask = phaseTasks[update.taskOrder - 1];
                  console.log('[PlanIterate] Found task:', targetTask?.id, 'for phase order:', update.phaseOrder, 'task order:', update.taskOrder);
                  if (targetTask) {
                    await db
                      .update(planTasks)
                      .set({
                        ...update.updates,
                        updatedAt: new Date(),
                      })
                      .where(eq(planTasks.id, targetTask.id));
                    console.log('[PlanIterate] Updated task:', targetTask.id);
                    updated = true;
                  }
                }
              } else if (update.action === 'create_task') {
                const targetPhase = planPhases.find((p) => p.order === update.phaseOrder);
                console.log('[PlanIterate] Creating task in phase:', targetPhase?.id);
                if (targetPhase) {
                  const phaseTasks = tasks.filter((t) => t.phaseId === targetPhase.id);
                  const maxOrder = Math.max(...phaseTasks.map((t) => t.order), 0);
                  const newTask = await db.insert(planTasks).values({
                    phaseId: targetPhase.id,
                    planId: planId,
                    ...update.task,
                    order: maxOrder + 1,
                  }).returning();
                  console.log('[PlanIterate] Created task:', newTask[0]?.id);
                  updated = true;
                }
              }
            }

            console.log('[PlanIterate] Total updates applied:', updated);

            // Save iteration if changes were made
            if (updated) {
              await db.insert(planIterations).values({
                planId,
                iterationType: 'refine',
                prompt: message,
                changes: JSON.stringify(updates),
                changedBy: 'claude',
              });

              // Send details about what was updated
              const updateSummary = updates.map((u: { action: string; phaseOrder?: number; taskOrder?: number }) => {
                if (u.action === 'update_phase') {
                  return `Updated Phase ${u.phaseOrder}`;
                } else if (u.action === 'update_task') {
                  return `Updated Phase ${u.phaseOrder}, Task ${u.taskOrder}`;
                } else if (u.action === 'create_task') {
                  return `Added new task to Phase ${u.phaseOrder}`;
                }
                return 'Made changes';
              }).join(', ');

              send({ type: 'updated', value: true, summary: updateSummary, count: updates.length });
            }
          } catch (error) {
            console.error('Failed to parse/apply updates:', error);
            send({ type: 'error', message: 'Failed to apply updates' });
          }
        }

        send({ type: 'done' });
        controller.close();
      } catch (error) {
        console.error('Error in plan iteration:', error);
        const errorDetails = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: errorDetails })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
