import { db } from '@/db';
import { tasks, qaGateResults } from '@/db/schema';
import type { QAGateStatus } from '@/db/schema/qa-gates';
import { eq } from 'drizzle-orm';
import { runQAGates } from '@/lib/qa-gates/runner';

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
  allPassed: boolean
) {
  await db
    .update(tasks)
    .set({
      status: allPassed ? 'waiting_approval' : 'qa_failed',
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));
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

  // Clear old results
  await clearOldResults(taskId);

  // Run gates
  const results: GateResult[] = await runQAGates(taskId, repoPath);

  // Update task status based on results
  const allPassed = results.every(
    (r) => r.status === 'passed' || r.status === 'skipped'
  );

  await updateTaskStatus(taskId, allPassed);

  return { results, passed: allPassed };
}
