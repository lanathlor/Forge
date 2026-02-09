import { db } from '@/db';
import { tasks } from '@/db/schema/tasks';
import { eq } from 'drizzle-orm';
import { captureDiff } from '@/lib/git/diff';

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

function hasCachedDiff(task: NonNullable<Awaited<ReturnType<typeof getTaskWithRepository>>>) {
  return task.diffContent && task.filesChanged && Array.isArray(task.filesChanged) && task.filesChanged.length > 0;
}

function buildCachedResponse(task: NonNullable<Awaited<ReturnType<typeof getTaskWithRepository>>>) {
  return {
    fullDiff: task.diffContent,
    changedFiles: task.filesChanged,
    stats: {
      filesChanged: task.filesChanged!.length,
      insertions: task.filesChanged!.reduce((sum, f) => sum + f.additions, 0),
      deletions: task.filesChanged!.reduce((sum, f) => sum + f.deletions, 0),
    },
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await getTaskWithRepository(id);

    if (!task) {
      console.error(`[Diff API] Task not found: ${id}`);
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    console.log(`[Diff API] Task ${id} status: ${task.status}, startingCommit: ${task.startingCommit}`);

    if (hasCachedDiff(task)) {
      console.log(`[Diff API] Returning cached diff for task ${id} with ${task.filesChanged!.length} files`);
      return Response.json(buildCachedResponse(task));
    }

    if (!task.startingCommit) {
      console.error(`[Diff API] Task ${id} has no starting commit`);
      return Response.json({ error: 'Task has no starting commit' }, { status: 400 });
    }

    console.log(`[Diff API] Generating fresh diff for task ${id} from commit ${task.startingCommit}`);
    const repoPath = task.session.repository.path;
    const diff = await captureDiff(repoPath, task.startingCommit);

    console.log(`[Diff API] Generated diff with ${diff.changedFiles.length} changed files`);

    await db
      .update(tasks)
      .set({ diffContent: diff.fullDiff, filesChanged: diff.changedFiles })
      .where(eq(tasks.id, task.id));

    return Response.json(diff);
  } catch (error) {
    console.error('[Diff API] Error generating diff:', error);
    return Response.json(
      { error: 'Failed to generate diff', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
