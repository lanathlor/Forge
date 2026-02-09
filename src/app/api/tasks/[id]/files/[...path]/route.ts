import { db } from '@/db';
import { tasks } from '@/db/schema/tasks';
import { eq } from 'drizzle-orm';
import { getFileContentBeforeAndAfter } from '@/lib/git/content';

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

function validateTask(task: Awaited<ReturnType<typeof getTaskWithRepository>>, id: string) {
  if (!task) {
    console.error(`[Files API] Task not found: ${id}`);
    return { error: 'Task not found', status: 404 };
  }
  if (!task.startingCommit) {
    console.error(`[Files API] Task ${id} has no starting commit`);
    return { error: 'Task has no starting commit', status: 400 };
  }
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  try {
    const { id, path: pathParts } = await params;
    const filePath = pathParts.join('/');

    console.log(`[Files API] Fetching file content for task ${id}, file: ${filePath}`);

    const task = await getTaskWithRepository(id);
    const validationError = validateTask(task, id);
    if (validationError) {
      return Response.json({ error: validationError.error }, { status: validationError.status });
    }

    const repoPath = task!.session.repository.path;
    const content = await getFileContentBeforeAndAfter(repoPath, filePath, task!.startingCommit!);

    console.log(`[Files API] Successfully retrieved file content for ${filePath}`);

    return Response.json(content);
  } catch (error) {
    console.error('[Files API] Error fetching file content:', error);
    return Response.json(
      { error: 'Failed to fetch file content', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
