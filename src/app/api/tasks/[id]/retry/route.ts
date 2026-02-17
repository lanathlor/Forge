import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tasks } from '@/db/schema/tasks';
import { eq } from 'drizzle-orm';
import { executeTask } from '@/lib/tasks/orchestrator';

const RETRYABLE_STATUSES = ['failed', 'qa_failed', 'rejected'];

async function getTaskWithRelations(id: string) {
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

async function resetTaskForRetry(id: string) {
  return db
    .update(tasks)
    .set({
      status: 'pending',
      claudeOutput: null,
      diffContent: null,
      filesChanged: null,
      commitMessage: null,
      currentQAAttempt: 1,
      rejectedAt: null,
      rejectionReason: null,
      startedAt: null,
      completedAt: null,
      startingCommit: null,
      startingBranch: null,
      committedSha: null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id));
}

async function validateRetry(task: Awaited<ReturnType<typeof getTaskWithRelations>>) {
  if (!task) {
    return { error: 'Task not found', status: 404 };
  }

  if (!RETRYABLE_STATUSES.includes(task.status)) {
    return { error: 'Task is not in a retryable state', status: 400 };
  }

  if (!task.prompt || task.prompt.trim() === '') {
    return { error: 'Task has no prompt to retry', status: 400 };
  }

  return null;
}

/**
 * POST /api/tasks/:id/retry
 * Retry a failed task
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await getTaskWithRelations(id);
    const validationError = await validateRetry(task);

    if (validationError) {
      return NextResponse.json({ error: validationError.error }, { status: validationError.status });
    }

    await resetTaskForRetry(id);

    console.log(`[Retry] Starting fresh task execution for ${id}`);
    executeTask(id).catch((error) => {
      console.error(`Background task execution failed for ${id}:`, error);
    });

    return NextResponse.json({ success: true, message: 'Task retry initiated' });
  } catch (error) {
    console.error('Error retrying task:', error);
    return NextResponse.json({ error: 'Failed to retry task' }, { status: 500 });
  }
}