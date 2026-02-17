import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tasks, type FileChange } from '@/db/schema/tasks';
import { eq } from 'drizzle-orm';
import { captureDiff } from '@/lib/git/diff';
import { runTaskQAGates } from '@/lib/qa-gates/task-qa-service';
import { taskEvents } from '@/lib/events/task-events';

async function getTaskWithRelations(taskId: string) {
  return db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: {
      session: {
        with: {
          repository: true,
        },
      },
    },
  });
}

async function updateTaskToWaitingQA(taskId: string, diff: { fullDiff: string; changedFiles: FileChange[] }) {
  return db
    .update(tasks)
    .set({
      diffContent: diff.fullDiff,
      filesChanged: diff.changedFiles,
      status: 'waiting_qa',
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));
}

async function processTaskCompletion(taskId: string, task: NonNullable<Awaited<ReturnType<typeof getTaskWithRelations>>>) {
  const repoPath = task.session.repository.path;
  const sessionId = task.sessionId;
  const startingCommit = task.startingCommit!;

  console.log(`[Debug] Completing task ${taskId} manually`);
  console.log(`[Debug] Capturing diff from commit: ${startingCommit}`);

  // 1. Capture diff
  const diff = await captureDiff(repoPath, startingCommit);

  // 2. Update task to waiting_qa
  await updateTaskToWaitingQA(taskId, diff);

  // 3. Emit status update
  taskEvents.emit('task:update', { sessionId, taskId, status: 'waiting_qa' });

  console.log(`[Debug] Task ${taskId} updated to waiting_qa, starting QA gates`);

  // 4. Run QA gates in background
  runTaskQAGates(taskId).catch((error) => {
    console.error(`QA gates failed for task ${taskId}:`, error);
  });

  return { fileCount: diff.changedFiles.length, hasChanges: diff.fullDiff.length > 0 };
}

/**
 * POST /api/debug/complete-task - Complete a stuck task manually
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const task = await getTaskWithRelations(taskId);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.status !== 'running') {
      return NextResponse.json(
        { error: `Task is not in running state (current: ${task.status})` },
        { status: 400 }
      );
    }

    if (!task.startingCommit) {
      return NextResponse.json({ error: 'Task missing starting commit' }, { status: 400 });
    }

    const diff = await processTaskCompletion(taskId, task);

    return NextResponse.json({
      success: true,
      message: 'Task completion workflow started',
      diff,
    });
  } catch (error) {
    console.error('Error completing task:', error);
    return NextResponse.json({ error: 'Failed to complete task' }, { status: 500 });
  }
}