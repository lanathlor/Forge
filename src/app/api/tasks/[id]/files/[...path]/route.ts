import { db } from '@/db';
import { tasks } from '@/db/schema/tasks';
import { eq } from 'drizzle-orm';
import { getFileContentBeforeAndAfter } from '@/lib/git/content';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  try {
    const { id, path: pathParts } = await params;
    const filePath = pathParts.join('/');

    console.log(`[Files API] Fetching file content for task ${id}, file: ${filePath}`);

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
      console.error(`[Files API] Task not found: ${id}`);
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    if (!task.startingCommit) {
      console.error(`[Files API] Task ${id} has no starting commit`);
      return Response.json(
        { error: 'Task has no starting commit' },
        { status: 400 }
      );
    }

    const repoPath = task.session.repository.path;
    console.log(`[Files API] Getting file content from ${task.startingCommit} to HEAD for ${filePath}`);

    const content = await getFileContentBeforeAndAfter(
      repoPath,
      filePath,
      task.startingCommit
    );

    console.log(`[Files API] Successfully retrieved file content for ${filePath}:`, {
      beforeLength: content.before?.length || 0,
      afterLength: content.after?.length || 0,
    });

    return Response.json(content);
  } catch (error) {
    console.error('[Files API] Error fetching file content:', error);
    return Response.json(
      {
        error: 'Failed to fetch file content',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
