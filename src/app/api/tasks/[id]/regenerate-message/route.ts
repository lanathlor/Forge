import { generateCommitMessage } from '@/lib/claude/commit-message';
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
  if (!task.filesChanged || task.filesChanged.length === 0) {
    return { error: 'No files changed to commit', status: 400 };
  }
  if (!task.diffContent) {
    return { error: 'No diff content available', status: 400 };
  }
  return null;
}

async function regenerateForTask(id: string) {
  const task = await getTaskWithRepository(id);
  const validationError = validateTask(task);
  if (validationError) return { validationError };

  const repoPath = task!.session.repository.path;
  console.log(`[Regenerate Message API] Calling Claude Code to regenerate commit message...`);
  const commitMessage = await generateCommitMessage(task!.prompt, task!.filesChanged!, task!.diffContent!, repoPath);
  await db.update(tasks).set({ commitMessage, updatedAt: new Date() }).where(eq(tasks.id, id));
  return { commitMessage };
}

/**
 * POST /api/tasks/[id]/regenerate-message
 *
 * Regenerates the commit message for a task using Claude AI.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`[Regenerate Message API] Regenerating commit message for task: ${id}`);

    const result = await regenerateForTask(id);
    if ('validationError' in result && result.validationError) {
      return Response.json(
        { error: result.validationError.error },
        { status: result.validationError.status }
      );
    }

    const { commitMessage } = result as { commitMessage: string };
    console.log(`[Regenerate Message API] Commit message regenerated successfully`);
    return Response.json({ success: true, commitMessage });
  } catch (error) {
    console.error('[Regenerate Message API] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to regenerate commit message' },
      { status: 500 }
    );
  }
}
