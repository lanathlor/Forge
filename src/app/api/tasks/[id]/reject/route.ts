import { rejectAndRevertTask } from '@/lib/git/revert';
import { taskEvents } from '@/lib/events/task-events';
import { db } from '@/db';
import { tasks } from '@/db/schema/tasks';
import { eq } from 'drizzle-orm';

async function emitTaskUpdateEvent(taskId: string) {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });
  if (task) {
    taskEvents.emit('task:update', { sessionId: task.sessionId, taskId, status: 'rejected' });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    console.log(`[Reject API] Rejecting task: ${id}, reason: ${reason || 'No reason provided'}`);

    const result = await rejectAndRevertTask(id, reason);

    if (!result.success) {
      return Response.json(
        {
          error: 'Failed to revert some files',
          details: result.errors,
          filesReverted: result.filesReverted,
          filesDeleted: result.filesDeleted,
        },
        { status: 500 }
      );
    }

    await emitTaskUpdateEvent(id);

    console.log(`[Reject API] Task rejected successfully:`, {
      filesReverted: result.filesReverted.length,
      filesDeleted: result.filesDeleted.length,
    });

    return Response.json({
      success: true,
      filesReverted: result.filesReverted,
      filesDeleted: result.filesDeleted,
    });
  } catch (error) {
    console.error('[Reject API] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to reject task' },
      { status: 400 }
    );
  }
}
