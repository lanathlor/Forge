import { db } from '@/db';
import { tasks } from '@/db/schema/tasks';
import { executeTask } from '@/lib/tasks/orchestrator';
import { eq } from 'drizzle-orm';

// POST /api/tasks - Create and execute a new task
export async function POST(request: Request) {
  try {
    const { sessionId, prompt } = await request.json();

    // Validate
    if (!prompt || !sessionId) {
      return Response.json(
        { error: 'Missing required fields: sessionId and prompt' },
        { status: 400 }
      );
    }

    // Create task
    const [task] = await db
      .insert(tasks)
      .values({
        sessionId,
        prompt,
        status: 'pending',
      })
      .returning();

    if (!task) {
      return Response.json(
        { error: 'Failed to create task' },
        { status: 500 }
      );
    }

    // Start execution (async, don't await)
    executeTask(task.id).catch((error) => {
      console.error(`Task ${task.id} execution failed:`, error);
    });

    return Response.json({ task });
  } catch (error) {
    console.error('Failed to create task:', error);
    return Response.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}

// GET /api/tasks - Get all tasks (optionally filtered by sessionId)
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    let tasksList;

    if (sessionId) {
      tasksList = await db.query.tasks.findMany({
        where: eq(tasks.sessionId, sessionId),
        orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
        with: {
          session: {
            with: {
              repository: true,
            },
          },
        },
      });
    } else {
      tasksList = await db.query.tasks.findMany({
        orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
        limit: 50,
        with: {
          session: {
            with: {
              repository: true,
            },
          },
        },
      });
    }

    return Response.json({ tasks: tasksList });
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return Response.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}
