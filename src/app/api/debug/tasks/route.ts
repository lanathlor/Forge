import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tasks, type TaskStatus } from '@/db/schema/tasks';
import { eq, desc } from 'drizzle-orm';

const VALID_STATUSES = [
  'pending',
  'pre_flight',
  'running',
  'waiting_qa',
  'qa_running',
  'qa_failed',
  'waiting_approval',
  'approved',
  'completed',
  'rejected',
  'failed',
  'cancelled',
];

function validateStatus(status: string): boolean {
  return VALID_STATUSES.includes(status);
}

async function updateTaskStatus(taskId: string, status: TaskStatus) {
  return db
    .update(tasks)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId))
    .returning();
}

/**
 * GET /api/debug/tasks - Get recent tasks for debugging
 * POST /api/debug/tasks - Update task statuses
 */

export async function GET() {
  try {
    // Get recent tasks
    const recentTasks = await db
      .select({
        id: tasks.id,
        prompt: tasks.prompt,
        status: tasks.status,
        claudeOutput: tasks.claudeOutput,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
      })
      .from(tasks)
      .orderBy(desc(tasks.createdAt))
      .limit(10);

    // Get status counts
    const statusCounts = await db.select().from(tasks);

    const counts = statusCounts.reduce(
      (acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      recentTasks: recentTasks.map((task) => ({
        id: task.id,
        idShort: task.id.substring(0, 8),
        promptPreview:
          task.prompt?.substring(0, 60) +
          (task.prompt?.length > 60 ? '...' : ''),
        status: task.status,
        hasOutput: !!task.claudeOutput,
        outputLength: task.claudeOutput?.length || 0,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      })),
      statusCounts: counts,
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { taskId, status } = body;

    if (!taskId || !status) {
      return NextResponse.json(
        { error: 'taskId and status are required' },
        { status: 400 }
      );
    }

    if (!validateStatus(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Update task status
    const result = await updateTaskStatus(taskId, status as TaskStatus);

    if (result.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      task: result[0],
    });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}
