import { db } from '@/db';
import { tasks, qaGateResults } from '@/db/schema';
import type { QAGateStatus } from '@/db/schema/qa-gates';
import { eq } from 'drizzle-orm';
import { runQAGates } from '@/lib/qa-gates/runner';
import { taskEvents } from '@/lib/events/task-events';

interface GateResult {
  gateName: string;
  status: QAGateStatus;
  output: string;
  errors?: string[];
  duration: number;
}

/**
 * Get task with repository information
 */
export async function getTaskWithRepo(taskId: string) {
  return await db.query.tasks.findFirst({
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

/**
 * Clear old QA gate results for a task
 */
export async function clearOldResults(taskId: string) {
  await db.delete(qaGateResults).where(eq(qaGateResults.taskId, taskId));
}

/**
 * Update task status based on QA results
 */
export async function updateTaskStatus(
  taskId: string,
  allPassed: boolean,
  sessionId?: string
) {
  const status = allPassed ? 'waiting_approval' : 'qa_failed';

  await db
    .update(tasks)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  // Emit status update
  if (sessionId) {
    taskEvents.emit('task:update', {
      sessionId,
      taskId,
      status,
    });
  }
}

/**
 * Run QA gates for a task and update status
 */
export async function runTaskQAGates(taskId: string) {
  const task = await getTaskWithRepo(taskId);

  if (!task) {
    throw new Error('Task not found');
  }

  const repoPath = task.session.repository.path;
  const sessionId = task.sessionId;

  // Clear old results
  await clearOldResults(taskId);

  // Emit QA start
  taskEvents.emit('task:update', {
    sessionId,
    taskId,
    status: 'qa_running',
  });

  // Run gates
  const results: GateResult[] = await runQAGates(taskId, repoPath);

  // Emit individual gate results
  for (const result of results) {
    taskEvents.emit('qa:update', {
      sessionId,
      taskId,
      gateName: result.gateName,
      status: result.status,
      output: result.output,
      errors: result.errors,
    });
  }

  // Update task status based on results
  const allPassed = results.every(
    (r) => r.status === 'passed' || r.status === 'skipped'
  );

  await updateTaskStatus(taskId, allPassed, sessionId);

  return { results, passed: allPassed };
}
