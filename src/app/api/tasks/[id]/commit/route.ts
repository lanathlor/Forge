import { commitTaskChanges } from '@/lib/git/commit';
import { taskEvents } from '@/lib/events/task-events';
import { db } from '@/db';
import { tasks, planTasks, plans } from '@/db/schema';
import { eq } from 'drizzle-orm';

async function getTaskWithRepository(id: string) {
  return db.query.tasks.findFirst({
    where: eq(tasks.id, id),
    with: {
      session: {
        with: {
          repository: true,
        },
      },
    },
  });
}

function validateTaskForCommit(
  task: Awaited<ReturnType<typeof getTaskWithRepository>>,
  userCommitMessage?: string
) {
  if (!task) {
    return { error: 'Task not found', status: 404 };
  }
  if (task.status !== 'waiting_approval') {
    return {
      error: `Task status is ${task.status}, expected waiting_approval`,
      status: 400,
    };
  }
  if (!task.filesChanged || task.filesChanged.length === 0) {
    return { error: 'No files changed to commit', status: 400 };
  }
  const finalMessage = userCommitMessage || task.commitMessage;
  if (!finalMessage) {
    return {
      error:
        'No commit message provided. Please approve the task first to generate a message.',
      status: 400,
    };
  }
  return null;
}

async function syncPlanTaskStatus(taskId: string, sha: string) {
  const planTask = await db.query.planTasks.findFirst({
    where: eq(planTasks.taskId, taskId),
    with: { plan: true },
  });

  if (!planTask) return;

  await db
    .update(planTasks)
    .set({
      status: 'completed',
      commitSha: sha,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(planTasks.id, planTask.id));

  console.log(`[Commit] Plan task ${planTask.id} synced to 'completed' status`);

  const shouldResume =
    planTask.plan &&
    (planTask.plan.status === 'paused' || planTask.plan.status === 'failed') &&
    planTask.plan.currentTaskId === planTask.id;

  if (shouldResume) {
    console.log(
      `[Commit] Plan ${planTask.plan!.id} was ${planTask.plan!.status}, auto-resuming after task completion`
    );
    await db
      .update(plans)
      .set({ status: 'running', updatedAt: new Date() })
      .where(eq(plans.id, planTask.plan!.id));
    console.log(
      `[Commit] Changed plan ${planTask.plan!.id} status to 'running'`
    );

    const { PlanExecutor } = await import('@/lib/plans/executor');
    const executor = new PlanExecutor();
    await executor.resumePlan(planTask.plan!.id);
  }
}

async function updateTaskStatus(
  id: string,
  sha: string,
  commitMessage: string,
  sessionId: string
) {
  await db
    .update(tasks)
    .set({
      status: 'approved',
      committedSha: sha,
      commitMessage,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id));

  await syncPlanTaskStatus(id, sha);
  taskEvents.emit('task:update', { sessionId, taskId: id, status: 'approved' });
}

async function performCommit(id: string, userCommitMessage?: string) {
  const task = await getTaskWithRepository(id);
  const validationError = validateTaskForCommit(task, userCommitMessage);
  if (validationError) return { validationError };

  const finalMessage = (userCommitMessage || task!.commitMessage)!;
  const repoPath = task!.session.repository.path;
  console.log(`[Commit API] Committing ${task!.filesChanged!.length} files`);

  const result = await commitTaskChanges(repoPath, task!.filesChanged!, finalMessage);
  await updateTaskStatus(id, result.sha, finalMessage, task!.sessionId);
  return { result, finalMessage };
}

/**
 * POST /api/tasks/[id]/commit
 *
 * Commits the task changes to git with the provided commit message.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { commitMessage: userCommitMessage } = body;
    console.log(`[Commit API] Committing task: ${id}`);

    const outcome = await performCommit(id, userCommitMessage);
    if ('validationError' in outcome && outcome.validationError) {
      return Response.json(
        { error: outcome.validationError.error },
        { status: outcome.validationError.status }
      );
    }

    const { result, finalMessage } = outcome as { result: Awaited<ReturnType<typeof commitTaskChanges>>; finalMessage: string };
    console.log(`[Commit API] Task committed successfully:`, { sha: result.sha });
    return Response.json({
      success: true,
      commitSha: result.sha,
      commitMessage: finalMessage,
      filesCommitted: result.filesCommitted,
      timestamp: result.timestamp,
    });
  } catch (error) {
    console.error('[Commit API] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to commit task' },
      { status: 500 }
    );
  }
}
