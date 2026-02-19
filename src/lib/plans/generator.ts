/* eslint-disable max-lines-per-function, complexity */
import { db } from '@/db';
import { plans, phases, planTasks, planIterations } from '@/db/schema';
import { repositories } from '@/db/schema/repositories';
import { eq } from 'drizzle-orm';
import { claudeWrapper } from '@/lib/claude/wrapper';
import { getContainerPath } from '@/lib/qa-gates/command-executor';

export interface GeneratedPlanStructure {
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

export type PlanWarningCode =
  | 'CIRCULAR_DEPENDENCY'
  | 'INVALID_DEPENDENCY'
  | 'EMPTY_PHASE'
  | 'LARGE_PLAN'
  | 'MANY_PHASES'
  | 'MANY_TASKS';

export interface PlanWarning {
  code: PlanWarningCode;
  message: string;
  severity: 'warning' | 'info';
  phaseIndex?: number;
  taskIndex?: number;
}

/**
 * Error codes for structured error events emitted during plan generation.
 *
 * - TIMEOUT      – the LLM call exceeded its time budget; `detail` contains elapsed ms.
 * - PARSE_ERROR  – the LLM response could not be parsed as valid JSON; `detail`
 *                  contains a truncated snippet of the raw output for debugging.
 * - LLM_ERROR    – the AI provider returned an error or produced an empty response.
 * - ABORTED      – the request was cancelled by the client (AbortController).
 */
export type GenerationErrorCode = 'TIMEOUT' | 'PARSE_ERROR' | 'LLM_ERROR' | 'ABORTED';

export type GenerationProgressEvent =
  | { type: 'status'; message: string }
  | { type: 'progress'; percent: number }
  | { type: 'chunk'; content: string }
  | { type: 'done'; planId: string; warnings?: PlanWarning[] }
  | { type: 'error'; code: GenerationErrorCode; message: string; detail?: string };

export type ProgressCallback = (event: GenerationProgressEvent) => void;

/**
 * Generate a plan structure using Claude Code CLI
 */
export async function generatePlanFromDescription(
  repositoryId: string,
  title: string,
  description: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<string> {
  const emit = (event: GenerationProgressEvent) => onProgress?.(event);

  // Get repository info
  emit({ type: 'status', message: 'Analyzing repository...' });

  const repository = await db.query.repositories.findFirst({
    where: eq(repositories.id, repositoryId),
  });

  if (!repository) {
    throw new Error(`Repository not found: ${repositoryId}`);
  }

  emit({ type: 'progress', percent: 10 });

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

  const generationStartMs = Date.now();

  try {
    // Build prompt for Claude
    emit({ type: 'status', message: 'Building generation prompt...' });
    const prompt = buildGenerationPrompt(title, description, repository.path);

    emit({ type: 'progress', percent: 20 });
    emit({ type: 'status', message: 'Calling LLM...' });

    // Call Claude to generate plan structure
    const workingDir = getContainerPath(repository.path);

    let response = '';
    let tokenCount = 0;
    try {
      response = await claudeWrapper.executeWithStream(
        prompt,
        workingDir,
        (chunk: string) => {
          // Stream token-level updates to the client
          emit({ type: 'chunk', content: chunk });
          tokenCount += chunk.length;

          // Update progress gradually as tokens arrive
          // Start at 20%, reserve 70% for LLM generation (up to 90%)
          const estimatedProgress = Math.min(
            20 + Math.floor((tokenCount / 50) * 0.7), // Rough estimate: 50 chars ≈ 1% progress
            90
          );
          if (estimatedProgress > 20) {
            emit({ type: 'progress', percent: estimatedProgress });
          }
        },
        300000, // 5 minute timeout - plan generation can take time
        signal
      );
    } catch (llmError) {
      const isAbort =
        llmError instanceof DOMException && llmError.name === 'AbortError';
      if (isAbort) {
        console.log(
          `[PlanGenerator] Request aborted – deleting orphaned draft plan ${planId}`
        );
        await db.delete(plans).where(eq(plans.id, planId));
        throw llmError; // re-throw so the SSE handler emits ABORTED and closes cleanly
      }

      const elapsedMs = Date.now() - generationStartMs;
      const llmMessage =
        llmError instanceof Error ? llmError.message : 'Unknown LLM error';
      const isTimeout =
        llmMessage.toLowerCase().includes('timeout') ||
        llmMessage.toLowerCase().includes('timed out') ||
        elapsedMs >= 300000;

      await db
        .update(plans)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(plans.id, planId));

      if (isTimeout) {
        emit({
          type: 'error',
          code: 'TIMEOUT',
          message: 'Plan generation timed out',
          detail: `Elapsed: ${Math.round(elapsedMs / 1000)}s`,
        });
      } else {
        emit({
          type: 'error',
          code: 'LLM_ERROR',
          message: `LLM call failed: ${llmMessage}`,
        });
      }

      throw new Error(`LLM call failed: ${llmMessage}`);
    }

    if (!response || response.trim().length === 0) {
      const elapsedMs = Date.now() - generationStartMs;
      await db
        .update(plans)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(plans.id, planId));
      emit({
        type: 'error',
        code: 'LLM_ERROR',
        message: 'LLM returned an empty response',
        detail: `Elapsed: ${Math.round(elapsedMs / 1000)}s`,
      });
      throw new Error('LLM returned an empty response');
    }

    console.log(`[PlanGenerator] Claude response received (${response.length} chars)`);

    emit({ type: 'progress', percent: 70 });
    emit({ type: 'status', message: 'Parsing plan structure...' });

    // Parse response as JSON
    let planStructure: GeneratedPlanStructure;
    try {
      planStructure = parseClaudeResponse(response);
    } catch (parseError) {
      await db
        .update(plans)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(plans.id, planId));

      const parseMessage =
        parseError instanceof Error ? parseError.message : 'Unknown parse error';
      // Provide a truncated raw snippet to aid debugging
      const rawSnippet = response.trim().substring(0, 300);

      emit({
        type: 'error',
        code: 'PARSE_ERROR',
        message: `Failed to parse LLM response: ${parseMessage}`,
        detail: rawSnippet,
      });

      throw parseError;
    }

    emit({ type: 'progress', percent: 75 });
    emit({ type: 'status', message: 'Validating plan structure...' });

    // Validate plan structure and collect warnings
    const warnings = validatePlanStructure(planStructure);
    if (warnings.length > 0) {
      console.log(`[PlanGenerator] Validation found ${warnings.length} warning(s):`, warnings);
    }

    emit({ type: 'progress', percent: 80 });
    emit({ type: 'status', message: 'Saving phases and tasks...' });

    // Save phases and tasks to database
    await savePlanStructure(planId, planStructure, prompt, warnings);

    emit({ type: 'progress', percent: 95 });

    // Update plan stats
    await updatePlanStats(planId);

    emit({ type: 'progress', percent: 100 });
    emit({ type: 'done', planId, warnings: warnings.length > 0 ? warnings : undefined });

    return planId;
  } catch (error) {
    // Abort errors and errors already handled by inner try/catch blocks
    // (LLM_ERROR, PARSE_ERROR) are re-thrown without additional logging or
    // DB updates because those paths already took care of cleanup and emitting.
    const isAbort =
      error instanceof DOMException && error.name === 'AbortError';
    const alreadyHandled =
      isAbort ||
      (error instanceof Error &&
        (error.message.startsWith('LLM call failed:') ||
          error.message === 'LLM returned an empty response' ||
          error.message.startsWith('Failed to parse plan structure:') ||
          error.message.startsWith('Invalid plan structure:')));

    if (alreadyHandled) {
      throw error;
    }

    // Truly unexpected error: log, mark plan as failed (best-effort), and re-throw.
    console.error('[PlanGenerator] Unexpected error:', error);
    try {
      await db
        .update(plans)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(plans.id, planId));
    } catch {
      // ignore secondary DB failure
    }

    // Re-throw – the SSE handler in the route will emit a final error event.
    throw error;
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
    console.error(
      '[PlanGenerator] Cleaned response:',
      cleaned.substring(0, 500)
    );
    console.error(
      '[PlanGenerator] Full response:',
      response.substring(0, 1000)
    );
    throw new Error(
      `Failed to parse plan structure: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validates the structure of a generated plan and returns warnings for potential issues.
 *
 * Checks for:
 * - Circular dependencies within phases (using topological sort)
 * - Tasks that reference non-existent sibling indices in dependsOn
 * - Phases with zero tasks
 * - Suspiciously large plans (>10 phases or >50 tasks total)
 *
 * @param planStructure - The parsed plan structure to validate
 * @returns Array of warnings found during validation
 */
export function validatePlanStructure(planStructure: GeneratedPlanStructure): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  let totalTasks = 0;

  // Check overall plan size
  if (planStructure.phases.length > 10) {
    warnings.push({
      code: 'MANY_PHASES',
      severity: 'warning',
      message: `Plan has ${planStructure.phases.length} phases, which may be difficult to manage. Consider breaking it into multiple plans.`,
    });
  }

  // Validate each phase
  for (let phaseIdx = 0; phaseIdx < planStructure.phases.length; phaseIdx++) {
    const phase = planStructure.phases[phaseIdx];
    if (!phase) continue;

    const tasks = phase.tasks;
    totalTasks += tasks.length;

    // Check for empty phases
    if (tasks.length === 0) {
      warnings.push({
        code: 'EMPTY_PHASE',
        severity: 'warning',
        message: `Phase ${phaseIdx + 1} "${phase.title}" has no tasks.`,
        phaseIndex: phaseIdx,
      });
      continue;
    }

    // Build dependency graph for topological sort
    const adjacencyList = new Map<number, number[]>();
    const inDegree = new Map<number, number>();

    // Initialize all tasks with in-degree 0
    for (let i = 0; i < tasks.length; i++) {
      adjacencyList.set(i, []);
      inDegree.set(i, 0);
    }

    // Build the graph and check for invalid dependencies
    for (let taskIdx = 0; taskIdx < tasks.length; taskIdx++) {
      const task = tasks[taskIdx];
      if (!task) continue;

      for (const depIdx of task.dependsOn) {
        // Check if dependency index is valid
        if (depIdx < 0 || depIdx >= tasks.length) {
          warnings.push({
            code: 'INVALID_DEPENDENCY',
            severity: 'warning',
            message: `Task ${taskIdx + 1} in phase ${phaseIdx + 1} references non-existent task index ${depIdx}.`,
            phaseIndex: phaseIdx,
            taskIndex: taskIdx,
          });
          continue;
        }

        // Check for self-dependency
        if (depIdx === taskIdx) {
          warnings.push({
            code: 'CIRCULAR_DEPENDENCY',
            severity: 'warning',
            message: `Task ${taskIdx + 1} in phase ${phaseIdx + 1} depends on itself.`,
            phaseIndex: phaseIdx,
            taskIndex: taskIdx,
          });
          continue;
        }

        // Add edge: depIdx -> taskIdx (taskIdx depends on depIdx)
        const neighbors = adjacencyList.get(depIdx);
        if (neighbors) {
          neighbors.push(taskIdx);
        }
        inDegree.set(taskIdx, (inDegree.get(taskIdx) ?? 0) + 1);
      }
    }

    // Topological sort using Kahn's algorithm to detect circular dependencies
    const queue: number[] = [];
    const sorted: number[] = [];

    // Start with all nodes that have in-degree 0
    for (let i = 0; i < tasks.length; i++) {
      if (inDegree.get(i) === 0) {
        queue.push(i);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;

      sorted.push(current);

      const neighbors = adjacencyList.get(current) ?? [];
      for (const neighbor of neighbors) {
        const newInDegree = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, newInDegree);
        if (newInDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // If we couldn't sort all tasks, there's a cycle
    if (sorted.length < tasks.length) {
      // Find which tasks are part of the cycle
      const cycleNodes: number[] = [];
      for (let i = 0; i < tasks.length; i++) {
        if ((inDegree.get(i) ?? 0) > 0) {
          cycleNodes.push(i);
        }
      }

      warnings.push({
        code: 'CIRCULAR_DEPENDENCY',
        severity: 'warning',
        message: `Phase ${phaseIdx + 1} "${phase.title}" has circular dependencies among tasks: ${cycleNodes.map((i) => i + 1).join(', ')}.`,
        phaseIndex: phaseIdx,
      });
    }
  }

  // Check total task count
  if (totalTasks > 50) {
    warnings.push({
      code: 'MANY_TASKS',
      severity: 'warning',
      message: `Plan has ${totalTasks} total tasks, which may be difficult to track. Consider simplifying or breaking into multiple plans.`,
    });
  } else if (totalTasks > 30) {
    warnings.push({
      code: 'LARGE_PLAN',
      severity: 'info',
      message: `Plan has ${totalTasks} total tasks. This is a substantial plan that may take significant time to complete.`,
    });
  }

  return warnings;
}

async function savePlanStructure(
  planId: string,
  planStructure: GeneratedPlanStructure,
  prompt: string,
  warnings: PlanWarning[]
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
        const dependencyIds = taskData.dependsOn
          .map((idx) => taskIdMap[idx])
          .filter((id): id is string => id !== undefined);
        const taskId = taskIdMap[taskIdx];
        if (!taskId || dependencyIds.length === 0) continue;

        await db
          .update(planTasks)
          .set({ dependsOn: dependencyIds })
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

  // Persist warnings to the plan
  if (warnings.length > 0) {
    await db
      .update(plans)
      .set({ warnings: JSON.stringify(warnings) })
      .where(eq(plans.id, planId));
  }
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
