/* eslint-disable max-lines-per-function, complexity */
import { db } from '@/db';
import { plans, phases, planTasks, type PlanTask } from '@/db/schema';
import { repositories } from '@/db/schema/repositories';
import { tasks as sessionTasks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getOrCreateActiveSession } from '@/lib/sessions/manager';
import { executeTask } from '@/lib/tasks/orchestrator';

const _MAX_RETRIES = 3;

export class PlanExecutor {
  /**
   * Execute a plan from start or resume from where it left off
   */
  async executePlan(planId: string): Promise<void> {
    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);

    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    // Update plan status to running
    await db
      .update(plans)
      .set({
        status: 'running',
        startedAt: plan.startedAt || new Date(),
        updatedAt: new Date(),
      })
      .where(eq(plans.id, planId));

    try {
      // Get phases in order
      const planPhases = await db
        .select()
        .from(phases)
        .where(eq(phases.planId, planId))
        .orderBy(phases.order);

      // Execute phases in order
      for (const phase of planPhases) {
        // Skip completed phases
        if (phase.status === 'completed') {
          continue;
        }

        await this.executePhase(planId, phase.id);

        // Check if should pause after this phase
        if (phase.pauseAfter) {
          await this.pausePlan(planId, 'phase_complete');
          return; // Wait for user to resume
        }
      }

      // All phases complete
      await db
        .update(plans)
        .set({
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(plans.id, planId));

      console.log(`[PlanExecutor] Plan ${planId} completed successfully`);
    } catch (error) {
      console.error(`[PlanExecutor] Plan ${planId} failed:`, error);

      await db
        .update(plans)
        .set({
          status: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(plans.id, planId));

      throw error;
    }
  }

  /**
   * Execute a single phase
   */
  private async executePhase(planId: string, phaseId: string): Promise<void> {
    const [phase] = await db
      .select()
      .from(phases)
      .where(eq(phases.id, phaseId))
      .limit(1);

    if (!phase) {
      throw new Error(`Phase not found: ${phaseId}`);
    }

    console.log(
      `[PlanExecutor] Executing phase ${phase.order}: ${phase.title} (${phase.executionMode})`
    );

    // Update phase status
    await db
      .update(phases)
      .set({
        status: 'running',
        startedAt: phase.startedAt || new Date(),
        updatedAt: new Date(),
      })
      .where(eq(phases.id, phaseId));

    // Update plan current phase
    await db
      .update(plans)
      .set({
        currentPhaseId: phaseId,
        updatedAt: new Date(),
      })
      .where(eq(plans.id, planId));

    try {
      // Get tasks for this phase
      const phaseTasks = await db
        .select()
        .from(planTasks)
        .where(eq(planTasks.phaseId, phaseId))
        .orderBy(planTasks.order);

      // Execute based on execution mode
      switch (phase.executionMode) {
        case 'sequential':
          await this.executeTasksSequentially(phaseTasks);
          break;

        case 'parallel':
          await this.executeTasksInParallel(phaseTasks);
          break;

        case 'manual':
          await this.executeTasksManually(phaseTasks);
          break;

        default:
          throw new Error(`Unknown execution mode: ${phase.executionMode}`);
      }

      // Mark phase complete
      await db
        .update(phases)
        .set({
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(phases.id, phaseId));

      // Update plan stats
      await this.updatePlanCompletedPhases(planId);

      console.log(`[PlanExecutor] Phase ${phase.order} completed`);
    } catch (error) {
      console.error(`[PlanExecutor] Phase ${phase.order} failed:`, error);

      await db
        .update(phases)
        .set({
          status: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(phases.id, phaseId));

      throw error;
    }
  }

  /**
   * Execute tasks one by one
   */
  private async executeTasksSequentially(tasks: PlanTask[]): Promise<void> {
    for (const task of tasks) {
      // Skip completed or skipped tasks
      if (task.status === 'completed' || task.status === 'skipped') {
        continue;
      }

      await this.executeTask(task.id);
    }
  }

  /**
   * Execute tasks in parallel respecting dependencies
   */
  private async executeTasksInParallel(tasks: PlanTask[]): Promise<void> {
    const completed = new Set<string>();

    while (completed.size < tasks.length) {
      // Skip already completed/skipped tasks
      tasks.forEach((task) => {
        if (task.status === 'completed' || task.status === 'skipped') {
          completed.add(task.id);
        }
      });

      // Find tasks ready to run
      const ready = tasks.filter((task) => {
        if (completed.has(task.id)) return false;

        // Check dependencies
        const deps = task.dependsOn
          ? (typeof task.dependsOn === 'string' ? JSON.parse(task.dependsOn) : task.dependsOn)
          : [];
        return deps.every((depId: string) => completed.has(depId));
      });

      if (ready.length === 0) {
        break; // All tasks complete or stuck
      }

      // Separate parallel and sequential tasks
      const parallelTasks = ready.filter((task) => task.canRunInParallel);
      const sequentialTasks = ready.filter((task) => !task.canRunInParallel);

      // Run parallel tasks concurrently
      if (parallelTasks.length > 0) {
        await Promise.all(
          parallelTasks.map((task) =>
            this.executeTask(task.id).then(() => completed.add(task.id))
          )
        );
      }

      // Run sequential tasks one by one
      for (const task of sequentialTasks) {
        await this.executeTask(task.id);
        completed.add(task.id);
      }
    }
  }

  /**
   * Execute tasks with manual approval between each
   */
  private async executeTasksManually(tasks: PlanTask[]): Promise<void> {
    for (const task of tasks) {
      // Skip completed or skipped tasks
      if (task.status === 'completed' || task.status === 'skipped') {
        continue;
      }

      // Pause for manual approval
      await this.pausePlan(task.planId, 'manual_approval_required', task.id);
      return; // Wait for user to approve and resume
    }
  }

  /**
   * Execute a single task with Claude
   */
  private async executeTask(taskId: string): Promise<void> {
    const [task] = await db
      .select()
      .from(planTasks)
      .where(eq(planTasks.id, taskId))
      .limit(1);

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, task.planId))
      .limit(1);

    if (!plan) {
      throw new Error(`Plan not found: ${task.planId}`);
    }

    const repository = await db.query.repositories.findFirst({
      where: eq(repositories.id, plan.repositoryId),
    });

    if (!repository) {
      throw new Error(`Repository not found: ${plan.repositoryId}`);
    }

    console.log(`[PlanExecutor] Executing task: ${task.title}`);

    // Get or create a session for this repository
    const session = await getOrCreateActiveSession(plan.repositoryId);

    // Build prompt for plan task execution
    let prompt = `${task.description}`;

    // Add plan context
    const planContext = `Plan: ${plan.title}${plan.description ? '\n' + plan.description : ''}`;

    prompt = `${planContext}

Task: ${task.title}
${prompt}

IMPORTANT: Make the code changes but DO NOT commit them. The system will automatically commit your changes after running QA gates.`;

    // Add retry context if needed
    if (task.attempts > 0 && task.lastError) {
      prompt = `Previous attempt failed. Error:\n${task.lastError}\n\nPlease fix and try again.\n\n${prompt}`;
    }

    // Create a task in the sessions/tasks system
    const [sessionTask] = await db
      .insert(sessionTasks)
      .values({
        sessionId: session.id,
        prompt,
        status: 'pending',
      })
      .returning();

    if (!sessionTask) {
      throw new Error('Failed to create session task');
    }

    console.log(`[PlanExecutor] Created session task ${sessionTask.id} for plan task ${task.title}`);

    // Update plan task with session and task IDs
    await db
      .update(planTasks)
      .set({
        sessionId: session.id,
        taskId: sessionTask.id,
        status: 'running',
        startedAt: task.startedAt || new Date(),
        attempts: task.attempts + 1,
        updatedAt: new Date(),
      })
      .where(eq(planTasks.id, taskId));

    // Update plan current task
    await db
      .update(plans)
      .set({
        currentTaskId: taskId,
        updatedAt: new Date(),
      })
      .where(eq(plans.id, task.planId));

    // Execute the task asynchronously (fire and forget)
    // This prevents timeout issues and allows the UI to track progress
    executeTask(sessionTask.id).catch((error) => {
      console.error(`[PlanExecutor] Task ${sessionTask.id} execution failed:`, error);
    });

    console.log(`[PlanExecutor] Started async execution of task ${sessionTask.id}`);

    // Poll for task completion
    const maxPolls = 120; // 10 minutes with 5-second intervals
    let polls = 0;

    while (polls < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      polls++;

      const [completedSessionTask] = await db
        .select()
        .from(sessionTasks)
        .where(eq(sessionTasks.id, sessionTask.id))
        .limit(1);

      if (!completedSessionTask) {
        throw new Error('Session task not found during polling');
      }

      console.log(`[PlanExecutor] Poll ${polls}: Task status = ${completedSessionTask.status}`);

      // Check if task is in a terminal state
      if (completedSessionTask.status === 'completed') {
        await db
          .update(planTasks)
          .set({
            status: 'completed',
            completedAt: new Date(),
            commitSha: completedSessionTask.committedSha || undefined,
            updatedAt: new Date(),
          })
          .where(eq(planTasks.id, taskId));

        await this.updatePlanCompletedTasks(task.planId);
        console.log(`[PlanExecutor] Task completed: ${task.title}`);
        return;
      } else if (completedSessionTask.status === 'failed' || completedSessionTask.status === 'qa_failed') {
        const errorMsg = `Task execution failed with status: ${completedSessionTask.status}`;

        await db
          .update(planTasks)
          .set({
            status: 'failed',
            lastError: errorMsg,
            updatedAt: new Date(),
          })
          .where(eq(planTasks.id, taskId));

        await this.pausePlan(task.planId, 'task_failed', taskId);
        throw new Error(errorMsg);
      } else if (completedSessionTask.status === 'rejected') {
        await db
          .update(planTasks)
          .set({
            status: 'skipped',
            updatedAt: new Date(),
          })
          .where(eq(planTasks.id, taskId));

        console.log(`[PlanExecutor] Task rejected/skipped: ${task.title}`);
        return;
      } else if (completedSessionTask.status === 'waiting_approval') {
        // Task is waiting for user approval - pause the plan
        console.log(`[PlanExecutor] Task waiting for approval, pausing plan`);
        await this.pausePlan(task.planId, 'waiting_approval', taskId);
        return;
      }

      // Continue polling if status is: pending, pre_flight, running, waiting_qa, qa_running
    }

    // Timeout reached
    const errorMsg = 'Task execution timed out after 10 minutes';
    await db
      .update(planTasks)
      .set({
        status: 'failed',
        lastError: errorMsg,
        updatedAt: new Date(),
      })
      .where(eq(planTasks.id, taskId));

    await this.pausePlan(task.planId, 'task_timeout', taskId);
    throw new Error(errorMsg);
  }

  /**
   * Pause plan execution
   */
  private async pausePlan(
    planId: string,
    reason: string,
    contextTaskId?: string
  ): Promise<void> {
    console.log(`[PlanExecutor] Pausing plan ${planId}: ${reason}`);

    await db
      .update(plans)
      .set({
        status: 'paused',
        currentTaskId: contextTaskId || null,
        updatedAt: new Date(),
      })
      .where(eq(plans.id, planId));

    // TODO: Emit event for UI
  }

  /**
   * Resume plan execution
   */
  async resumePlan(planId: string): Promise<void> {
    console.log(`[PlanExecutor] Resuming plan ${planId}`);

    await db
      .update(plans)
      .set({
        status: 'running',
        updatedAt: new Date(),
      })
      .where(eq(plans.id, planId));

    // Continue execution
    await this.executePlan(planId);
  }

  /**
   * Cancel plan execution
   */
  async cancelPlan(planId: string): Promise<void> {
    console.log(`[PlanExecutor] Cancelling plan ${planId}`);

    await db
      .update(plans)
      .set({
        status: 'failed',
        updatedAt: new Date(),
      })
      .where(eq(plans.id, planId));
  }

  /**
   * Update plan's completed phases count
   */
  private async updatePlanCompletedPhases(planId: string): Promise<void> {
    const allPhases = await db
      .select()
      .from(phases)
      .where(eq(phases.planId, planId));

    const completedCount = allPhases.filter(
      (p) => p.status === 'completed'
    ).length;

    await db
      .update(plans)
      .set({
        completedPhases: completedCount,
        updatedAt: new Date(),
      })
      .where(eq(plans.id, planId));
  }

  /**
   * Update plan's completed tasks count
   */
  private async updatePlanCompletedTasks(planId: string): Promise<void> {
    const allTasks = await db
      .select()
      .from(planTasks)
      .where(eq(planTasks.planId, planId));

    const completedCount = allTasks.filter(
      (t) => t.status === 'completed'
    ).length;

    await db
      .update(plans)
      .set({
        completedTasks: completedCount,
        updatedAt: new Date(),
      })
      .where(eq(plans.id, planId));
  }
}

// Singleton instance
export const planExecutor = new PlanExecutor();
