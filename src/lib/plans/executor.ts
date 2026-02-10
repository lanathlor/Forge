import { db } from '@/db';
import { plans, phases, planTasks, type Plan, type Phase, type PlanTask } from '@/db/schema';
import { repositories } from '@/db/schema/repositories';
import { sessions, tasks as sessionTasks } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { claudeWrapper } from '@/lib/claude/wrapper';
import { getContainerPath, execAsync } from '@/lib/qa-gates/command-executor';

const MAX_RETRIES = 3;

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

    // Update task status
    await db
      .update(planTasks)
      .set({
        status: 'running',
        startedAt: task.startedAt || new Date(),
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

    let attempt = task.attempts;

    while (attempt < MAX_RETRIES) {
      attempt++;

      await db
        .update(planTasks)
        .set({
          attempts: attempt,
          updatedAt: new Date(),
        })
        .where(eq(planTasks.id, taskId));

      try {
        // Build prompt
        let prompt = task.description;

        // Add retry context if needed
        if (attempt > 1 && task.lastError) {
          prompt = `Previous attempt failed. Error:\n${task.lastError}\n\nPlease fix and try again.\n\nOriginal task:\n${task.description}`;
        }

        console.log(`[PlanExecutor] Task attempt ${attempt}/${MAX_RETRIES}`);

        // Execute with Claude
        const workingDir = getContainerPath(repository.path);
        const result = await claudeWrapper.executeOneShot(prompt, workingDir, 300000); // 5 min timeout

        console.log(`[PlanExecutor] Claude completed, checking for changes...`);

        // Check if there are changes
        const { stdout: diffOutput } = await execAsync('git diff', {
          cwd: workingDir,
          timeout: 5000,
        });

        if (!diffOutput.trim()) {
          console.log(`[PlanExecutor] No changes detected, marking task complete`);

          // No changes, but task completed successfully
          await db
            .update(planTasks)
            .set({
              status: 'completed',
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(planTasks.id, taskId));

          await this.updatePlanCompletedTasks(task.planId);
          return;
        }

        // Commit changes
        const commitMsg = `${task.title}\n\nPlan: ${plan.title}\n\nGenerated by Autobot Plan Execution`;

        await execAsync(`git add -A && git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, {
          cwd: workingDir,
          timeout: 10000,
        });

        const { stdout: commitSha } = await execAsync('git rev-parse HEAD', {
          cwd: workingDir,
          timeout: 5000,
        });

        console.log(`[PlanExecutor] Changes committed: ${commitSha.trim()}`);

        // Mark task complete
        await db
          .update(planTasks)
          .set({
            status: 'completed',
            completedAt: new Date(),
            commitSha: commitSha.trim(),
            updatedAt: new Date(),
          })
          .where(eq(planTasks.id, taskId));

        await this.updatePlanCompletedTasks(task.planId);

        console.log(`[PlanExecutor] Task completed: ${task.title}`);
        return; // Success!
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';

        console.error(`[PlanExecutor] Task attempt ${attempt} failed:`, errorMsg);

        await db
          .update(planTasks)
          .set({
            lastError: errorMsg,
            updatedAt: new Date(),
          })
          .where(eq(planTasks.id, taskId));

        if (attempt >= MAX_RETRIES) {
          // Max retries reached, mark as failed and pause plan
          await db
            .update(planTasks)
            .set({
              status: 'failed',
              lastError: `Failed after ${MAX_RETRIES} attempts:\n${errorMsg}`,
              updatedAt: new Date(),
            })
            .where(eq(planTasks.id, taskId));

          await this.pausePlan(task.planId, 'task_failed', taskId);

          throw new Error(
            `Task ${taskId} failed after ${MAX_RETRIES} attempts`
          );
        }

        // Will retry
        console.log(`[PlanExecutor] Retrying task (attempt ${attempt + 1}/${MAX_RETRIES})`);
      }
    }
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
