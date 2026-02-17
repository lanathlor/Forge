import { generateCommitMessage } from '@/lib/claude/commit-message';
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

function validateTask(task: Awaited<ReturnType<typeof getTaskWithRepository>>) {
  if (!task) {
    return { error: 'Task not found', status: 404 };
  }
  if (task.status !== 'waiting_approval') {
    return { error: `Task status is ${task.status}, expected waiting_approval`, status: 400 };
  }
  return null;
}

type Task = NonNullable<Awaited<ReturnType<typeof getTaskWithRepository>>>;

async function approveWithoutChanges(task: Task, id: string) {
  console.log(`[Approve API] No file changes, marking task as approved without commit`);
  await db
    .update(tasks)
    .set({ status: 'approved', completedAt: new Date(), updatedAt: new Date() })
    .where(eq(tasks.id, id));
  taskEvents.emit('task:update', { sessionId: task.sessionId, taskId: id, status: 'approved' });
  return Response.json({ success: true, noChanges: true });
}

async function approveWithChanges(task: Task, id: string) {
  if (!task.diffContent) {
    return Response.json({ error: 'No diff content available', status: 400 });
  }
  const repoPath = task.session.repository.path;
  console.log(`[Approve API] Calling Claude Code to generate commit message...`);
  const commitMessage = await generateCommitMessage(
    task.prompt,
    task.filesChanged!,
    task.diffContent,
    repoPath
  );
  await db.update(tasks).set({ commitMessage, updatedAt: new Date() }).where(eq(tasks.id, id));
  console.log(`[Approve API] Commit message generated successfully`);
  return Response.json({
    success: true,
    commitMessage,
    stats: {
      filesCount: task.filesChanged!.length,
      insertions: task.filesChanged!.reduce((sum, f) => sum + f.additions, 0),
      deletions: task.filesChanged!.reduce((sum, f) => sum + f.deletions, 0),
    },
  });
}

/**
 * POST /api/tasks/[id]/approve
 *
 * If the task has file changes: generates a commit message using Claude AI.
 * If the task has no file changes: marks the task as approved/completed directly.
 * Actual committing (when there are changes) happens in the /commit endpoint.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`[Approve API] Processing approval for task: ${id}`);
    const task = await getTaskWithRepository(id);
    const validationError = validateTask(task);
    if (validationError) {
      return Response.json({ error: validationError.error }, { status: validationError.status });
    }
    const hasChanges = task!.filesChanged && task!.filesChanged.length > 0;
    return hasChanges ? approveWithChanges(task!, id) : approveWithoutChanges(task!, id);
  } catch (error) {
    console.error('[Approve API] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to generate commit message' },
      { status: 500 }
    );
  }
}
