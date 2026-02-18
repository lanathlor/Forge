import { generateCommitMessage } from '@/lib/claude/commit-message';
import { getDiffForFiles } from '@/lib/git/diff';
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
    return {
      error: `Task status is ${task.status}, expected waiting_approval`,
      status: 400,
    };
  }
  return null;
}

type Task = NonNullable<Awaited<ReturnType<typeof getTaskWithRepository>>>;

async function approveWithoutChanges(task: Task, id: string) {
  console.log(
    `[Approve API] No file changes, marking task as approved without commit`
  );
  await db
    .update(tasks)
    .set({ status: 'approved', completedAt: new Date(), updatedAt: new Date() })
    .where(eq(tasks.id, id));
  taskEvents.emit('task:update', {
    sessionId: task.sessionId,
    taskId: id,
    status: 'approved',
  });
  return Response.json({ success: true, noChanges: true });
}

async function ensureDiffContent(
  task: Task,
  id: string,
  filesChanged: NonNullable<Task['filesChanged']>
): Promise<string | null> {
  if (task.diffContent) return task.diffContent;
  if (!task.startingCommit) return null;

  console.warn(
    `[Approve API] diffContent is empty for task ${id}, regenerating from repo...`
  );
  try {
    const repoPath = task.session.repository.path;
    const diffContent = await getDiffForFiles(repoPath, task.startingCommit, filesChanged);
    if (diffContent) {
      await db
        .update(tasks)
        .set({ diffContent, updatedAt: new Date() })
        .where(eq(tasks.id, id));
      console.log(`[Approve API] Regenerated diff successfully`);
    }
    return diffContent;
  } catch (err) {
    console.error(`[Approve API] Failed to regenerate diff:`, err);
    return null;
  }
}

async function approveWithChanges(task: Task, id: string) {
  const repoPath = task.session.repository.path;
  const filesChanged = task.filesChanged!;
  const diffContent = await ensureDiffContent(task, id, filesChanged);
  let commitMessage: string;

  if (!diffContent) {
    console.warn(
      `[Approve API] Could not obtain diff content for task ${id}, using placeholder commit message`
    );
    const fileList = filesChanged.map((f) => f.path).join(', ');
    commitMessage = `chore: update ${filesChanged.length} file(s)\n\n${fileList}`;
  } else {
    console.log(
      `[Approve API] Calling Claude Code to generate commit message...`
    );
    commitMessage = await generateCommitMessage(
      task.prompt, filesChanged, diffContent, repoPath
    );
  }
  await db
    .update(tasks)
    .set({ commitMessage, updatedAt: new Date() })
    .where(eq(tasks.id, id));
  console.log(`[Approve API] Commit message generated successfully`);
  return Response.json({
    success: true,
    commitMessage,
    stats: {
      filesCount: filesChanged.length,
      insertions: filesChanged.reduce((sum, f) => sum + f.additions, 0),
      deletions: filesChanged.reduce((sum, f) => sum + f.deletions, 0),
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
      return Response.json(
        { error: validationError.error },
        { status: validationError.status }
      );
    }
    const hasChanges = task!.filesChanged && task!.filesChanged.length > 0;
    return await (hasChanges
      ? approveWithChanges(task!, id)
      : approveWithoutChanges(task!, id));
  } catch (error) {
    console.error('[Approve API] Error:', error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to generate commit message',
      },
      { status: 500 }
    );
  }
}
