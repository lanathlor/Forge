import { db } from '@/db';
import { plans, phases, planTasks, planIterations } from '@/db/schema';
import { repositories } from '@/db/schema/repositories';
import { eq } from 'drizzle-orm';
import { claudeWrapper } from '@/lib/claude/wrapper';
import { getContainerPath } from '@/lib/qa-gates/command-executor';

interface GeneratedPlanStructure {
  phases: {
    title: string;
    description?: string;
    executionMode: 'sequential' | 'parallel' | 'manual';
    pauseAfter: boolean;
    tasks: {
      title: string;
      description: string;
      dependsOn: number[]; // task indices in THIS phase
      canRunInParallel: boolean;
    }[];
  }[];
}

/**
 * Generate a plan structure using Claude Code CLI
 */
export async function generatePlanFromDescription(
  repositoryId: string,
  title: string,
  description: string
): Promise<string> {
  // Get repository info
  const repository = await db.query.repositories.findFirst({
    where: eq(repositories.id, repositoryId),
  });

  if (!repository) {
    throw new Error(`Repository not found: ${repositoryId}`);
  }

  // Create draft plan
  const [plan] = await db
    .insert(plans)
    .values({
      repositoryId,
      title,
      description,
      status: 'draft',
      createdBy: 'claude',
    })
    .returning();

  if (!plan) {
    throw new Error('Failed to create plan');
  }

  const planId = plan.id;

  try {
    // Build prompt for Claude
    const prompt = buildGenerationPrompt(title, description, repository.path);

    // Call Claude to generate plan structure
    const workingDir = getContainerPath(repository.path);
    const response = await claudeWrapper.executeOneShot(
      prompt,
      workingDir,
      300000 // 5 minute timeout - plan generation can take time
    );

    console.log(`[PlanGenerator] Claude response:`, response);

    // Parse response as JSON
    const planStructure = parseClaudeResponse(response);

    // Save phases and tasks to database
    await savePlanStructure(planId, planStructure, prompt);

    // Update plan stats
    await updatePlanStats(planId);

    return planId;
  } catch (error) {
    console.error('[PlanGenerator] Error generating plan:', error);

    // Mark plan as failed
    await db
      .update(plans)
      .set({
        status: 'failed',
        updatedAt: new Date(),
      })
      .where(eq(plans.id, planId));

    // Provide a more helpful error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to generate plan: ${errorMessage}`);
  }
}

function buildGenerationPrompt(
  title: string,
  description: string,
  repositoryPath: string
): string {
  return `Generate a structured implementation plan for the following feature.

Feature: ${title}
Description: ${description}
Repository: ${repositoryPath}

Create a plan with:
1. **Phases**: Logical groups of related work (e.g., "Database Setup", "API Implementation")
2. **Tasks**: Specific, atomic units of work within each phase

For each phase:
- Title and description
- Execution mode: "sequential", "parallel", or "manual"
- pauseAfter: true/false (whether to pause for review)

For each task:
- Title and detailed description
- dependsOn: array of task indices in same phase
- canRunInParallel: true/false

CRITICAL: You MUST return ONLY valid JSON with no explanatory text, no markdown formatting, no code blocks.
Start your response with { and end with }. Nothing else.

Expected JSON format:
{
  "phases": [
    {
      "title": "string",
      "description": "string",
      "executionMode": "sequential" | "parallel" | "manual",
      "pauseAfter": boolean,
      "tasks": [
        {
          "title": "string",
          "description": "string",
          "dependsOn": number[],
          "canRunInParallel": boolean
        }
      ]
    }
  ]
}`;
}

function parseClaudeResponse(response: string): GeneratedPlanStructure {
  let cleaned = response.trim();

  // Try to extract JSON from markdown code blocks first
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1];
  } else {
    // Try to find JSON object in the response (look for the outermost braces)
    const jsonMatch = cleaned.match(/\{[\s\S]*"phases"[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
  }

  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned) as GeneratedPlanStructure;

    // Validate structure
    if (!parsed.phases || !Array.isArray(parsed.phases)) {
      throw new Error('Invalid plan structure: missing phases array');
    }

    return parsed;
  } catch (error) {
    console.error('[PlanGenerator] Failed to parse Claude response.');
    console.error('[PlanGenerator] Cleaned response:', cleaned.substring(0, 500));
    console.error('[PlanGenerator] Full response:', response.substring(0, 1000));
    throw new Error(`Failed to parse plan structure: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function savePlanStructure(
  planId: string,
  planStructure: GeneratedPlanStructure,
  prompt: string
): Promise<void> {
  for (let phaseIdx = 0; phaseIdx < planStructure.phases.length; phaseIdx++) {
    const phaseData = planStructure.phases[phaseIdx];
    if (!phaseData) continue;

    // Insert phase
    const [phase] = await db
      .insert(phases)
      .values({
        planId,
        order: phaseIdx + 1,
        title: phaseData.title,
        description: phaseData.description,
        executionMode: phaseData.executionMode,
        pauseAfter: phaseData.pauseAfter,
        status: 'pending',
      })
      .returning();

    if (!phase) {
      throw new Error('Failed to create phase');
    }

    const phaseId = phase.id;
    const taskIdMap: Record<number, string> = {};

    // Insert tasks
    for (let taskIdx = 0; taskIdx < phaseData.tasks.length; taskIdx++) {
      const taskData = phaseData.tasks[taskIdx];
      if (!taskData) continue;

      const [task] = await db
        .insert(planTasks)
        .values({
          phaseId,
          planId,
          order: taskIdx + 1,
          title: taskData.title,
          description: taskData.description,
          canRunInParallel: taskData.canRunInParallel,
          dependsOn: null, // will update after all tasks created
          status: 'pending',
          attempts: 0,
        })
        .returning();

      if (!task) {
        throw new Error('Failed to create task');
      }

      taskIdMap[taskIdx] = task.id;
    }

    // Update task dependencies with actual IDs
    for (let taskIdx = 0; taskIdx < phaseData.tasks.length; taskIdx++) {
      const taskData = phaseData.tasks[taskIdx];
      if (!taskData) continue;

      if (taskData.dependsOn && taskData.dependsOn.length > 0) {
        const dependencyIds = taskData.dependsOn.map((idx) => taskIdMap[idx]);
        const taskId = taskIdMap[taskIdx];
        if (!taskId) continue;

        await db
          .update(planTasks)
          .set({ dependsOn: JSON.stringify(dependencyIds) as any })
          .where(eq(planTasks.id, taskId));
      }
    }
  }

  // Record generation in iterations
  await db.insert(planIterations).values({
    planId,
    iterationType: 'generation',
    prompt,
    changes: JSON.stringify(planStructure),
    changedBy: 'claude',
  });
}

async function updatePlanStats(planId: string): Promise<void> {
  const planPhases = await db
    .select()
    .from(phases)
    .where(eq(phases.planId, planId));

  const tasks = await db
    .select()
    .from(planTasks)
    .where(eq(planTasks.planId, planId));

  await db
    .update(plans)
    .set({
      totalPhases: planPhases.length,
      totalTasks: tasks.length,
      updatedAt: new Date(),
    })
    .where(eq(plans.id, planId));
}
