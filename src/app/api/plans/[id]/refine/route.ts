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

interface RefinementUpdate {
  action: 'update_phase' | 'update_task' | 'create_task' | 'create_phase' | 'delete_task';
  phaseOrder?: number;
  taskOrder?: number;
  updates?: Record<string, string>;
  task?: { title: string; description: string };
  phase?: { title: string; description: string };
  label: string;
}

/**
 * POST /api/plans/[id]/refine
 *
 * Streams a refinement chat response. Unlike /iterate, this route returns
 * proposed changes as a structured diff that the client can accept/reject
 * individually, OR auto-apply all at once.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params;
  const body = await request.json();
  const { message, conversationHistory, autoApply } = body as {
    message: string;
    conversationHistory: Message[];
    autoApply?: boolean;
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
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
          send({ type: 'error', message: 'Plan not found' });
          controller.close();
          return;
        }

        const repository = await db.query.repositories.findFirst({
          where: eq(repositories.id, plan.repositoryId),
        });

        if (!repository) {
          send({ type: 'error', message: 'Repository not found' });
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
          plan: { title: plan.title, description: plan.description, status: plan.status },
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

        const conversationContext = conversationHistory
          .slice(-6)
          .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
          .join('\n\n');

        const fullPrompt = `You are helping refine a development plan. Current plan structure:

${JSON.stringify(planContext, null, 2)}

${conversationContext ? `Previous conversation:\n${conversationContext}\n\n` : ''}User request: "${message}"

IMPORTANT: Respond in TWO parts:

1. First, write a brief explanation of what you're changing and why (2-3 sentences max). Be specific.

2. Then include an <UPDATES> section. Each update MUST have a "label" field (short human-readable summary of the change).

REQUIRED FORMAT:
[Your brief explanation here]

<UPDATES>
[
  {"action": "update_phase", "phaseOrder": 1, "updates": {"title": "New Title", "description": "New Description"}, "label": "Rename Phase 1"},
  {"action": "update_task", "phaseOrder": 1, "taskOrder": 2, "updates": {"title": "New Title", "description": "New Description"}, "label": "Clarify task description"},
  {"action": "create_task", "phaseOrder": 1, "task": {"title": "Task Title", "description": "Detailed description"}, "label": "Add error handling task"},
  {"action": "create_phase", "phase": {"title": "Phase Title", "description": "Phase description"}, "label": "Add testing phase"},
  {"action": "delete_task", "phaseOrder": 1, "taskOrder": 3, "label": "Remove redundant validation task"}
]
</UPDATES>

CRITICAL: Always include <UPDATES> when the user asks for changes. Each update needs a "label" field. Use phaseOrder (1, 2, 3...) and taskOrder (1, 2, 3...) to reference items.`;

        send({ type: 'status', message: 'Analyzing plan...' });

        const workingDir = getContainerPath(repository.path);

        let response: string;
        try {
          response = await claudeWrapper.executeWithStream(
            fullPrompt,
            workingDir,
            (chunk) => {
              send({ type: 'chunk', content: chunk });
            },
            120000
          );
        } catch (error) {
          send({
            type: 'error',
            message: error instanceof Error ? error.message : 'Failed to call Claude',
          });
          controller.close();
          return;
        }

        // Parse updates
        const updatesMatch = response.match(/<UPDATES>([\s\S]*?)<\/UPDATES>/);

        if (updatesMatch && updatesMatch[1]) {
          try {
            const updates: RefinementUpdate[] = JSON.parse(updatesMatch[1]);

            if (autoApply) {
              // Auto-apply mode: apply all changes immediately (like the old /iterate)
              send({ type: 'status', message: 'Applying changes...' });
              let applied = 0;

              for (const update of updates) {
                const success = await applyUpdate(update, planPhases, tasks, planId);
                if (success) applied++;
              }

              if (applied > 0) {
                await db.insert(planIterations).values({
                  planId,
                  iterationType: 'refine',
                  prompt: message,
                  changes: JSON.stringify(updates),
                  changedBy: 'claude',
                });

                send({
                  type: 'applied',
                  count: applied,
                  total: updates.length,
                });
              }
            } else {
              // Diff mode: send proposed changes for user review
              const proposals = updates.map((update, idx) => ({
                id: idx,
                ...update,
                // Add before/after context for display
                before: getBeforeContext(update, planPhases, tasks),
              }));

              send({ type: 'proposals', changes: proposals });
            }
          } catch (error) {
            console.error('Failed to parse updates:', error);
            send({ type: 'error', message: 'Failed to parse suggested changes' });
          }
        }

        send({ type: 'done' });
        controller.close();
      } catch (error) {
        console.error('Error in plan refinement:', error);
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
      Connection: 'keep-alive',
    },
  });
}

// Helper: Get the "before" state for displaying diffs
function getBeforeContext(
  update: RefinementUpdate,
  planPhases: { id: string; order: number; title: string; description: string | null }[],
  tasks: { id: string; phaseId: string; order: number; title: string; description: string }[]
) {
  if (update.action === 'update_phase' && update.phaseOrder) {
    const phase = planPhases.find((p) => p.order === update.phaseOrder);
    if (phase) {
      return { title: phase.title, description: phase.description || '' };
    }
  } else if (update.action === 'update_task' && update.phaseOrder && update.taskOrder) {
    const phase = planPhases.find((p) => p.order === update.phaseOrder);
    if (phase) {
      const phaseTasks = tasks.filter((t) => t.phaseId === phase.id).sort((a, b) => a.order - b.order);
      const task = phaseTasks[update.taskOrder - 1];
      if (task) {
        return { title: task.title, description: task.description };
      }
    }
  } else if (update.action === 'delete_task' && update.phaseOrder && update.taskOrder) {
    const phase = planPhases.find((p) => p.order === update.phaseOrder);
    if (phase) {
      const phaseTasks = tasks.filter((t) => t.phaseId === phase.id).sort((a, b) => a.order - b.order);
      const task = phaseTasks[update.taskOrder - 1];
      if (task) {
        return { title: task.title, description: task.description };
      }
    }
  }
  return null;
}

// Helper: Apply a single update to the database
async function applyUpdate(
  update: RefinementUpdate,
  planPhases: { id: string; order: number; title: string; description: string | null }[],
  tasks: { id: string; phaseId: string; order: number; title: string; description: string }[],
  planId: string
): Promise<boolean> {
  try {
    if (update.action === 'update_phase' && update.phaseOrder) {
      const targetPhase = planPhases.find((p) => p.order === update.phaseOrder);
      if (targetPhase && update.updates) {
        await db
          .update(phases)
          .set({ ...update.updates, updatedAt: new Date() })
          .where(eq(phases.id, targetPhase.id));
        return true;
      }
    } else if (update.action === 'update_task' && update.phaseOrder && update.taskOrder) {
      const targetPhase = planPhases.find((p) => p.order === update.phaseOrder);
      if (targetPhase && update.updates) {
        const phaseTasks = tasks
          .filter((t) => t.phaseId === targetPhase.id)
          .sort((a, b) => a.order - b.order);
        const targetTask = phaseTasks[update.taskOrder - 1];
        if (targetTask) {
          await db
            .update(planTasks)
            .set({ ...update.updates, updatedAt: new Date() })
            .where(eq(planTasks.id, targetTask.id));
          return true;
        }
      }
    } else if (update.action === 'create_task' && update.phaseOrder && update.task) {
      const targetPhase = planPhases.find((p) => p.order === update.phaseOrder);
      if (targetPhase) {
        const phaseTasks = tasks.filter((t) => t.phaseId === targetPhase.id);
        const maxOrder = Math.max(...phaseTasks.map((t) => t.order), 0);
        await db.insert(planTasks).values({
          phaseId: targetPhase.id,
          planId,
          ...update.task,
          order: maxOrder + 1,
        });
        return true;
      }
    } else if (update.action === 'create_phase' && update.phase) {
      const maxOrder = Math.max(...planPhases.map((p) => p.order), 0);
      await db.insert(phases).values({
        planId,
        ...update.phase,
        order: maxOrder + 1,
        executionMode: 'sequential',
        pauseAfter: false,
      });
      return true;
    } else if (update.action === 'delete_task' && update.phaseOrder && update.taskOrder) {
      const targetPhase = planPhases.find((p) => p.order === update.phaseOrder);
      if (targetPhase) {
        const phaseTasks = tasks
          .filter((t) => t.phaseId === targetPhase.id)
          .sort((a, b) => a.order - b.order);
        const targetTask = phaseTasks[update.taskOrder - 1];
        if (targetTask) {
          await db.delete(planTasks).where(eq(planTasks.id, targetTask.id));
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    console.error('Failed to apply update:', error);
    return false;
  }
}
