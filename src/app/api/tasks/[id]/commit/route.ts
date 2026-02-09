import { commitTaskChanges } from '@/lib/git/commit';
import { taskEvents } from '@/lib/events/task-events';
import { db } from '@/db';
import { tasks } from '@/db/schema/tasks';
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
    return { error: `Task status is ${task.status}, expected waiting_approval`, status: 400 };
  }
  if (!task.filesChanged || task.filesChanged.length === 0) {
    return { error: 'No files changed to commit', status: 400 };
  }
  const finalMessage = userCommitMessage || task.commitMessage;
  if (!finalMessage) {
    return { error: 'No commit message provided. Please approve the task first to generate a message.', status: 400 };
  }
  return null;
}

async function updateTaskStatus(id: string, sha: string, commitMessage: string, sessionId: string) {
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

  taskEvents.emit('task:update', { sessionId, taskId: id, status: 'approved' });
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

    const task = await getTaskWithRepository(id);
    const validationError = validateTaskForCommit(task, userCommitMessage);
    if (validationError) {
      return Response.json({ error: validationError.error }, { status: validationError.status });
    }

    const finalCommitMessage = userCommitMessage || task!.commitMessage;
    const repoPath = task!.session.repository.path;

    console.log(`[Commit API] Committing ${task!.filesChanged!.length} files`);

    const result = await commitTaskChanges(repoPath, task!.filesChanged!, finalCommitMessage!);
    await updateTaskStatus(id, result.sha, finalCommitMessage!, task!.sessionId);

    console.log(`[Commit API] Task committed successfully:`, { sha: result.sha });

    return Response.json({
      success: true,
      commitSha: result.sha,
      commitMessage: finalCommitMessage,
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
