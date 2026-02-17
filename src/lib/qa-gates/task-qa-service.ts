import { db } from '@/db';
import { tasks, qaGateResults, planTasks, plans } from '@/db/schema';
import type { QAGateStatus } from '@/db/schema/qa-gates';
import { eq } from 'drizzle-orm';
import { runQAGates } from '@/lib/qa-gates/runner';
import { taskEvents } from '@/lib/events/task-events';
import { generateCommitMessage } from '@/lib/claude/commit-message';
import { commitTaskChanges } from '@/lib/git/commit';

interface GateResult {
  gateName: string;
  status: QAGateStatus;
  output: string;
  errors?: string[];
  duration: number;
}

/**
 * Get task with repository information
 */
export async function getTaskWithRepo(taskId: string) {
  return await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: {
      session: {
        with: {
          repository: true,
        },
      },
    },
  });
}

/**
 * Clear old QA gate results for a task
 */
export async function clearOldResults(taskId: string) {
  await db.delete(qaGateResults).where(eq(qaGateResults.taskId, taskId));
}

/**
 * Check if a task belongs to a plan (should be auto-approved)
 */
async function isPlanTask(taskId: string): Promise<boolean> {
  const planTask = await db.query.planTasks.findFirst({
    where: eq(planTasks.taskId, taskId),
  });
  return !!planTask;
}

/**
 * Auto-resume a plan if it was paused/failed due to this task
 */
async function autoResumePlanIfNeeded(planTaskId: string) {
  const planTask = await db.query.planTasks.findFirst({
    where: eq(planTasks.id, planTaskId),
    with: {
      plan: true,
    },
  });

  if (!planTask || !planTask.plan) {
    return;
  }

  const plan = planTask.plan;

  // Check if plan is paused/failed and this was the blocking task
  if (
    (plan.status === 'paused' || plan.status === 'failed') &&
    plan.currentTaskId === planTaskId
  ) {
    console.log(
      `[AutoResume] Plan ${plan.id} was ${plan.status} on task ${planTaskId}, resuming...`
    );

    // IMPORTANT: Change plan status from failed → running BEFORE resuming
    await db
      .update(plans)
      .set({
        status: 'running',
        updatedAt: new Date(),
      })
      .where(eq(plans.id, plan.id));

    console.log(
      `[AutoResume] Changed plan ${plan.id} status from '${plan.status}' to 'running'`
    );

    // Import dynamically to avoid circular dependency
    const { PlanExecutor } = await import('@/lib/plans/executor');
    const executor = new PlanExecutor();

    // Resume the plan (will continue from next task)
    await executor.resumePlan(plan.id);
  }
}

/**
 * Mark task as completed without changes
 */
async function markTaskCompleted(taskId: string) {
  await db
    .update(tasks)
    .set({
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  // Sync plan task status
  const planTask = await db.query.planTasks.findFirst({
    where: eq(planTasks.taskId, taskId),
  });

  if (planTask) {
    await db
      .update(planTasks)
      .set({
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(planTasks.id, planTask.id));

    console.log(
      `[TaskComplete] Plan task ${planTask.id} synced to 'completed' status`
    );

    // Auto-resume plan if it was paused on this task
    await autoResumePlanIfNeeded(planTask.id);
  }
}

/**
 * Handle failed auto-commit by falling back to waiting_approval
 */
async function handleCommitFailure(
  taskId: string,
  sessionId: string,
  error: unknown
) {
  console.error(`[AutoApprove] Failed to auto-approve task ${taskId}:`, error);
  await db
    .update(tasks)
    .set({ status: 'waiting_approval', updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
  taskEvents.emit('task:update', {
    sessionId,
    taskId,
    status: 'waiting_approval',
  });
}

async function syncPlanTaskOnCommit(taskId: string, sha: string) {
  const planTask = await db.query.planTasks.findFirst({ where: eq(planTasks.taskId, taskId) });
  if (!planTask) return;
  await db.update(planTasks).set({ status: 'completed', commitSha: sha, completedAt: new Date(), updatedAt: new Date() }).where(eq(planTasks.id, planTask.id));
  console.log(`[AutoApprove] Plan task ${planTask.id} synced to 'completed' status`);
  await autoResumePlanIfNeeded(planTask.id);
}

/**
 * Commit changes and update task/plan records
 */
async function commitAndRecord(
  task: NonNullable<Awaited<ReturnType<typeof getTaskWithRepo>>>,
  taskId: string,
  repoPath: string
) {
  const commitMessage = await generateCommitMessage(task.prompt, task.filesChanged!, task.diffContent || '', repoPath);
  const result = await commitTaskChanges(repoPath, task.filesChanged!, commitMessage);

  await db
    .update(tasks)
    .set({
      status: 'completed',
      committedSha: result.sha,
      commitMessage: result.message,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  await syncPlanTaskOnCommit(taskId, result.sha);
  return result;
}

/**
 * Auto-approve and commit a plan task
 */
async function autoApproveAndCommit(taskId: string, sessionId: string) {
  const task = await getTaskWithRepo(taskId);
  if (!task || !task.filesChanged || task.filesChanged.length === 0) {
    console.log(`[AutoApprove] No changes to commit for task ${taskId}`);
    await markTaskCompleted(taskId);
    return;
  }

  const repoPath = task.session.repository.path;
  console.log(`[AutoApprove] Auto-approving plan task ${taskId}`);

  try {
    const result = await commitAndRecord(task, taskId, repoPath);
    taskEvents.emit('task:update', { sessionId, taskId, status: 'completed' });
    console.log(
      `[AutoApprove] Plan task ${taskId} auto-approved and committed: ${result.sha}`
    );
  } catch (error) {
    await handleCommitFailure(taskId, sessionId, error);
  }
}

/**
 * Update task status based on QA results
 */
export async function updateTaskStatus(
  taskId: string,
  allPassed: boolean,
  sessionId?: string
) {
  if (!allPassed) {
    // QA failed - set status to qa_failed
    await db
      .update(tasks)
      .set({
        status: 'qa_failed',
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    if (sessionId) {
      taskEvents.emit('task:update', {
        sessionId,
        taskId,
        status: 'qa_failed',
      });
    }
    return;
  }

  // QA passed - check if this is a plan task
  const isFromPlan = await isPlanTask(taskId);

  if (isFromPlan && sessionId) {
    // Auto-approve and commit plan tasks
    await autoApproveAndCommit(taskId, sessionId);
  } else {
    // Regular task - wait for manual approval
    await db
      .update(tasks)
      .set({
        status: 'waiting_approval',
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    if (sessionId) {
      taskEvents.emit('task:update', {
        sessionId,
        taskId,
        status: 'waiting_approval',
      });
    }
  }
}

/**
 * Run QA gates for a task and update status
 */
export async function runTaskQAGates(taskId: string) {
  const task = await getTaskWithRepo(taskId);

  if (!task) {
    throw new Error('Task not found');
  }

  const repoPath = task.session.repository.path;
  const sessionId = task.sessionId;

  // Clear old results
  await clearOldResults(taskId);

  // Emit QA start
  taskEvents.emit('task:update', {
    sessionId,
    taskId,
    status: 'qa_running',
  });

  // Run gates
  const results: GateResult[] = await runQAGates(taskId, repoPath);

  // Emit individual gate results
  for (const result of results) {
    taskEvents.emit('qa:update', {
      sessionId,
      taskId,
      gateName: result.gateName,
      status: result.status,
      output: result.output,
      errors: result.errors,
    });
  }

  // Update task status based on results
  const allPassed = results.every(
    (r) => r.status === 'passed' || r.status === 'skipped'
  );

  await updateTaskStatus(taskId, allPassed, sessionId);

  return { results, passed: allPassed };
}
