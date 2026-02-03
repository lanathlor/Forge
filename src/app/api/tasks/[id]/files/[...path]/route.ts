import { db } from '@/db';
import { tasks } from '@/db/schema/tasks';
import { eq } from 'drizzle-orm';
import { getFileContentBeforeAndAfter } from '@/lib/git/content';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  const { id, path: pathParts } = await params;

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

  if (!task.startingCommit) {
    return Response.json(
      { error: 'Task has no starting commit' },
      { status: 400 }
    );
  }

  const repoPath = task.session.repository.path;
  const filePath = pathParts.join('/');

  const content = await getFileContentBeforeAndAfter(
    repoPath,
    filePath,
    task.startingCommit
  );

  return Response.json(content);
}
