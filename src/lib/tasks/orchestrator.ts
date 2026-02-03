import { claudeWrapper } from '@/lib/claude/wrapper';
import { runPreFlightChecks } from '@/lib/git/pre-flight';
import { captureDiff } from '@/lib/git/diff';
import { runTaskQAGates } from '@/lib/qa-gates/task-qa-service';
import { db } from '@/db';
import { tasks } from '@/db/schema/tasks';
import { eq } from 'drizzle-orm';

/* eslint-disable max-lines-per-function */
export async function executeTask(taskId: string): Promise<void> {
  try {
    // 1. Get task from database with related data
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: {
        session: {
          with: {
            repository: true,
          },
        },
      },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    const repoPath = task.session.repository.path;

    // 2. Run pre-flight checks
    await db
      .update(tasks)
      .set({ status: 'pre_flight', updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    const preFlightResult = await runPreFlightChecks(repoPath);

    if (!preFlightResult.passed) {
      await db
        .update(tasks)
        .set({
          status: 'failed',
          claudeOutput: `Pre-flight check failed: ${preFlightResult.error}`,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId));
      return;
    }

    // 3. Capture starting state
    await db
      .update(tasks)
      .set({
        startingCommit: preFlightResult.currentCommit,
        startingBranch: preFlightResult.currentBranch,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    // 4. Execute Claude Code
    await db
      .update(tasks)
      .set({
        status: 'running',
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    await claudeWrapper.executeTask({
      workingDirectory: repoPath,
      prompt: task.prompt,
      taskId: task.id,
    });

    // 5. Capture diff
    const diff = await captureDiff(repoPath, task.startingCommit!);

    await db
      .update(tasks)
      .set({
        diffContent: diff.fullDiff,
        filesChanged: diff.changedFiles,
        status: 'waiting_qa',
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    // 6. Run QA gates
    await runTaskQAGates(taskId);
  } catch (error) {
    await db
      .update(tasks)
      .set({
        status: 'failed',
        claudeOutput:
          error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));
  }
}
