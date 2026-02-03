import { db } from '@/db';
import { tasks } from '@/db/schema/tasks';
import { eq } from 'drizzle-orm';
import { captureDiff } from '@/lib/git/diff';

/* eslint-disable max-lines-per-function */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
    with: {
      session: {
        with: {
          repository: true,
        },
      },
    },
  });

  if (!task) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  // Return cached diff if available
  if (task.diffContent && task.filesChanged) {
    return Response.json({
      fullDiff: task.diffContent,
      changedFiles: task.filesChanged,
    });
  }

  // Check if we have a starting commit
  if (!task.startingCommit) {
    return Response.json(
      { error: 'Task has no starting commit' },
      { status: 400 }
    );
  }

  // Otherwise generate fresh
  const repoPath = task.session.repository.path;
  const diff = await captureDiff(repoPath, task.startingCommit);

  // Cache in database
  await db
    .update(tasks)
    .set({
      diffContent: diff.fullDiff,
      filesChanged: diff.changedFiles,
    })
    .where(eq(tasks.id, task.id));

  return Response.json(diff);
}
