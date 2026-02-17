import { db } from '@/db';
import { tasks } from '@/db/schema/tasks';
import { eq } from 'drizzle-orm';
import { claudeWrapper } from '@/lib/claude/wrapper';

// GET /api/tasks/:id - Get task by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    return Response.json({ task });
  } catch (error) {
    console.error('Failed to fetch task:', error);
    return Response.json({ error: 'Failed to fetch task' }, { status: 500 });
  }
}

// DELETE /api/tasks/:id/cancel - Cancel a running task
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await claudeWrapper.cancel(id);

    await db
      .update(tasks)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(tasks.id, id));

    return Response.json({ success: true });
  } catch (error) {
    console.error('Failed to cancel task:', error);
    return Response.json({ error: 'Failed to cancel task' }, { status: 500 });
  }
}
