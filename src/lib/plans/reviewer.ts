/* eslint-disable max-lines-per-function, complexity, max-params */
import { db } from '@/db';
import { plans, phases, planTasks, planIterations } from '@/db/schema';
import { repositories } from '@/db/schema/repositories';
import { eq } from 'drizzle-orm';
import { claudeWrapper } from '@/lib/claude/wrapper';
import { getContainerPath } from '@/lib/qa-gates/command-executor';

export type ReviewType =
  | 'refine_descriptions'
  | 'add_missing'
  | 'optimize_order'
  | 'break_down';

export interface ReviewSuggestion {
  type:
    | 'add_task'
    | 'modify_task'
    | 'reorder'
    | 'add_phase'
    | 'break_down_task';
  target: string;
  reasoning: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface ReviewResult {
  iterationId: string;
  suggestions: ReviewSuggestion[];
}

/**
 * Review a plan using Claude and provide suggestions for improvement
 */
export async function reviewPlan(
  planId: string,
  reviewType: ReviewType,
  scope: 'all' | 'phase' | 'task' = 'all',
  targetId?: string
): Promise<ReviewResult> {
  // Load plan with all related data
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1);

  if (!plan) {
    throw new Error(`Plan not found: ${planId}`);
  }

  const repository = await db.query.repositories.findFirst({
    where: eq(repositories.id, plan.repositoryId),
  });

  if (!repository) {
    throw new Error(`Repository not found: ${plan.repositoryId}`);
  }

  // Save iteration
  const [iteration] = await db
    .insert(planIterations)
    .values({
      planId,
      iterationType: 'review',
      prompt: '',
      changes: JSON.stringify({ reviewType, suggestions: [] }),
      changedBy: 'claude',
    })
    .returning();

  if (!repository) {
    throw new Error(`Repository not found: ${plan.repositoryId}`);
  }

  const planPhases = await db
    .select()
    .from(phases)
    .where(eq(phases.planId, planId))
    .orderBy(phases.order);

  const tasks = await db
    .select()
    .from(planTasks)
    .where(eq(planTasks.planId, planId))
    .orderBy(planTasks.order);

  // Build prompt for Claude
  const prompt = buildReviewPrompt(
    plan,
    planPhases,
    tasks,
    reviewType,
    scope,
    targetId
  );

  // Call Claude to review
  const workingDir = getContainerPath(repository.path);
  const response = await claudeWrapper.executeOneShot(
    prompt,
    workingDir,
    60000 // 60 second timeout
  );

  console.log(`[PlanReviewer] Claude response:`, response);

  // Parse suggestions
  const suggestions = parseReviewResponse(response);

  if (!iteration) {
    throw new Error('Failed to create iteration');
  }

  // Update iteration with actual suggestions
  await db
    .update(planIterations)
    .set({
      prompt,
      changes: JSON.stringify({ reviewType, suggestions }),
    })
    .where(eq(planIterations.id, iteration.id));

  return {
    iterationId: iteration.id,
    suggestions,
  };
}

interface PlanForReview {
  title: string;
  description: string | null;
}

interface PhaseForReview {
  id: string;
  title: string;
  description: string | null;
  executionMode: string;
  pauseAfter: boolean;
}

interface TaskForReview {
  phaseId: string;
  title: string;
  description: string | null;
  canRunInParallel: boolean;
  dependsOn: string[] | null;
}

function buildReviewPrompt(
  plan: PlanForReview,
  planPhases: PhaseForReview[],
  tasks: TaskForReview[],
  reviewType: ReviewType,
  _scope: string,
  _targetId?: string
): string {
  let contextPrompt = '';

  switch (reviewType) {
    case 'refine_descriptions':
      contextPrompt =
        'Review the task descriptions and make them clearer and more specific. Each task should have enough detail for an AI assistant to execute without ambiguity.';
      break;

    case 'add_missing':
      contextPrompt =
        'Analyze the plan and identify any missing tasks. Consider: error handling, testing, documentation, edge cases, cleanup tasks.';
      break;

    case 'optimize_order':
      contextPrompt =
        'Review the order of phases and tasks. Suggest reorderings that would be more logical or efficient. Consider dependencies and what should come first.';
      break;

    case 'break_down':
      contextPrompt =
        'Identify tasks that are too complex and should be broken down into smaller, more manageable tasks.';
      break;
  }

  // Organize tasks by phase for better readability
  const phasesWithTasks = planPhases.map((phase) => ({
    ...phase,
    tasks: tasks.filter((task) => task.phaseId === phase.id),
  }));

  return `You are reviewing an implementation plan. ${contextPrompt}

Current Plan:
Title: ${plan.title}
Description: ${plan.description}

${phasesWithTasks
  .map(
    (phase, phaseIdx) => `
Phase ${phaseIdx + 1}: ${phase.title}
Description: ${phase.description || 'N/A'}
Execution Mode: ${phase.executionMode}
Pause After: ${phase.pauseAfter}

Tasks:
${phase.tasks
  .map(
    (task: TaskForReview, taskIdx: number) => `
  Task ${taskIdx + 1}: ${task.title}
  Description: ${task.description}
  Can Run in Parallel: ${task.canRunInParallel}
  Depends On: ${task.dependsOn?.length ? task.dependsOn.join(', ') : 'None'}
`
  )
  .join('\n')}
`
  )
  .join('\n')}

IMPORTANT: Return ONLY a JSON array of suggestions, with no additional text before or after. Do not wrap it in markdown code blocks.

Provide suggestions as a JSON array in this exact format:
[
  {
    "type": "add_task" | "modify_task" | "reorder" | "add_phase" | "break_down_task",
    "target": "description of what to change",
    "reasoning": "why this change is beneficial",
    "before": {},
    "after": {}
  }
]

If no improvements are needed, return an empty array: []`;
}

function parseReviewResponse(response: string): ReviewSuggestion[] {
  // Remove markdown code blocks if present
  let cleaned = response.trim();

  // Remove ```json and ``` if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    return parsed as ReviewSuggestion[];
  } catch (error) {
    console.error('[PlanReviewer] Failed to parse Claude response:', cleaned);
    throw new Error(
      `Failed to parse review suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Apply selected suggestions to a plan
 */
export async function applySuggestions(
  planId: string,
  iterationId: string,
  suggestionIndices: number[]
): Promise<void> {
  const [iteration] = await db
    .select()
    .from(planIterations)
    .where(eq(planIterations.id, iterationId))
    .limit(1);

  if (!iteration || !iteration.changes) {
    throw new Error(`Iteration not found: ${iterationId}`);
  }

  const changes = JSON.parse(iteration.changes as string);
  const suggestions = changes.suggestions as ReviewSuggestion[];

  for (const idx of suggestionIndices) {
    if (idx < 0 || idx >= suggestions.length) {
      console.warn(`Invalid suggestion index: ${idx}`);
      continue;
    }

    const suggestion = suggestions[idx];
    if (!suggestion) continue;

    try {
      await applySingleSuggestion(planId, suggestion);
    } catch (error) {
      console.error(`Failed to apply suggestion ${idx}:`, error);
      throw error;
    }
  }

  // Update plan timestamp
  await db
    .update(plans)
    .set({ updatedAt: new Date() })
    .where(eq(plans.id, planId));

  // Record user edit
  await db.insert(planIterations).values({
    planId,
    iterationType: 'user_edit',
    changes: JSON.stringify({
      action: 'apply_suggestions',
      iterationId,
      appliedIndices: suggestionIndices,
    }),
    changedBy: 'user',
  });
}

async function applySingleSuggestion(
  planId: string,
  suggestion: ReviewSuggestion
): Promise<void> {
  switch (suggestion.type) {
    case 'add_task': {
      const taskData = suggestion.after as Record<string, unknown>;
      await db.insert(planTasks).values({
        phaseId: taskData.phaseId as string,
        planId,
        order: (taskData.order as number) ?? 1,
        title: taskData.title as string,
        description: taskData.description as string,
        status: 'pending',
        attempts: 0,
        canRunInParallel: (taskData.canRunInParallel as boolean) ?? false,
        dependsOn: (taskData.dependsOn as string[]) ?? null,
      });
      break;
    }

    case 'modify_task': {
      const taskId = suggestion.after?.id as string | undefined;
      if (!taskId) {
        throw new Error('Missing task ID in modify_task suggestion');
      }
      const updateData = { ...suggestion.after } as Record<string, unknown>;
      delete updateData.id;
      await db
        .update(planTasks)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(planTasks.id, taskId));
      break;
    }

    case 'reorder':
      // Apply reordering updates
      if (
        suggestion.after?.updates &&
        Array.isArray(suggestion.after.updates)
      ) {
        for (const update of suggestion.after.updates as {
          taskId?: string;
          phaseId?: string;
          newOrder: number;
        }[]) {
          if (update.taskId) {
            await db
              .update(planTasks)
              .set({ order: update.newOrder })
              .where(eq(planTasks.id, update.taskId));
          } else if (update.phaseId) {
            await db
              .update(phases)
              .set({ order: update.newOrder })
              .where(eq(phases.id, update.phaseId));
          }
        }
      }
      break;

    case 'add_phase': {
      const phaseData = suggestion.after as Record<string, unknown>;
      await db.insert(phases).values({
        planId,
        order: (phaseData.order as number) ?? 1,
        title: phaseData.title as string,
        description: phaseData.description as string | undefined,
        executionMode:
          (phaseData.executionMode as 'sequential' | 'parallel' | 'manual') ??
          'sequential',
        pauseAfter: (phaseData.pauseAfter as boolean) ?? false,
        status: 'pending',
      });
      break;
    }

    case 'break_down_task': {
      // Remove original task
      const beforeId = suggestion.before?.id as string | undefined;
      if (beforeId) {
        await db.delete(planTasks).where(eq(planTasks.id, beforeId));
      }

      // Add new broken-down tasks
      const tasksData = suggestion.after?.tasks as
        | Record<string, unknown>[]
        | undefined;
      if (tasksData && Array.isArray(tasksData)) {
        const phaseId =
          (suggestion.before?.phaseId as string | undefined) || '';
        for (const newTask of tasksData) {
          await db.insert(planTasks).values({
            phaseId: (newTask.phaseId as string) || phaseId,
            planId,
            order: (newTask.order as number) ?? 1,
            title: newTask.title as string,
            description: newTask.description as string,
            status: 'pending',
            attempts: 0,
            canRunInParallel: (newTask.canRunInParallel as boolean) ?? false,
            dependsOn: (newTask.dependsOn as string[]) ?? null,
          });
        }
      }
      break;
    }

    default:
      console.warn(
        `Unknown suggestion type: ${(suggestion as { type: string }).type}`
      );
  }
}
