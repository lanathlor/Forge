import { claudeWrapper } from '@/lib/claude/wrapper';
import { runPreFlightChecks } from '@/lib/git/pre-flight';
import { captureDiff } from '@/lib/git/diff';
import { runTaskQAGates } from '@/lib/qa-gates/task-qa-service';
import { getContainerPath } from '@/lib/qa-gates/command-executor';
import { db } from '@/db';
import { tasks } from '@/db/schema/tasks';
import { eq } from 'drizzle-orm';
import { taskEvents } from '@/lib/events/task-events';

const MAX_QA_ATTEMPTS = 3;

/* eslint-disable max-lines-per-function */
/**
 * Run QA gates with automatic retry on failure
 * If QA gates fail, invoke Claude with error details to fix issues
 */
async function runQAGatesWithRetry(
  taskId: string,
  repoPath: string,
  containerPath: string,
  sessionId: string,
  originalPrompt: string
): Promise<void> {
  let attempt = 1;

  while (attempt <= MAX_QA_ATTEMPTS) {
    console.log(`[Task ${taskId}] QA attempt ${attempt}/${MAX_QA_ATTEMPTS}`);

    // Update attempt counter
    await db
      .update(tasks)
      .set({ currentQAAttempt: attempt, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    // Run QA gates
    const { results, passed } = await runTaskQAGates(taskId);

    if (passed) {
      console.log(`[Task ${taskId}] QA gates passed on attempt ${attempt}`);
      return; // Success!
    }

    console.log(`[Task ${taskId}] QA gates failed on attempt ${attempt}`);

    // If this was the last attempt, give up
    if (attempt >= MAX_QA_ATTEMPTS) {
      console.log(`[Task ${taskId}] Max QA attempts reached, task failed`);
      return;
    }

    // Build retry prompt with failure details
    const failedGates = results.filter((r) => r.status === 'failed');
    const retryPrompt = buildRetryPrompt(originalPrompt, failedGates, attempt);

    console.log(`[Task ${taskId}] Invoking Claude to fix QA failures (attempt ${attempt + 1})`);

    // Update status to show we're retrying
    await db
      .update(tasks)
      .set({
        status: 'running',
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    taskEvents.emit('task:update', {
      sessionId,
      taskId,
      status: 'running',
    });

    // Invoke Claude to fix the issues
    const outputHandler = (data: { taskId: string; output?: string; data?: string }) => {
      if (data.taskId === taskId) {
        const output = data.output || data.data || '';
        taskEvents.emit('task:output', {
          sessionId,
          taskId,
          output,
        });
      }
    };

    claudeWrapper.on('output', outputHandler);

    console.log(`[Task ${taskId}] Invoking Claude for retry with prompt length: ${retryPrompt.length} chars`);

    try {
      await claudeWrapper.executeTask({
        workingDirectory: containerPath,
        prompt: retryPrompt,
        taskId,
      });
      console.log(`[Task ${taskId}] Claude retry execution completed`);
    } finally {
      claudeWrapper.off('output', outputHandler);
    }

    // Capture new diff
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    if (!task) {
      throw new Error('Task not found after retry');
    }

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

    taskEvents.emit('task:update', {
      sessionId,
      taskId,
      status: 'waiting_qa',
    });

    // Increment attempt and loop
    attempt++;
  }
}

/**
 * Build a retry prompt with QA gate failure details
 */
function buildRetryPrompt(
  originalPrompt: string,
  failedGates: Array<{ gateName: string; output: string; errors?: string[] }>,
  attemptNumber: number
): string {
  const failureDetails = failedGates
    .map((gate) => {
      const errors = gate.errors?.join('\n') || gate.output;
      return `### ${gate.gateName} Failed:\n\`\`\`\n${errors}\n\`\`\``;
    })
    .join('\n\n');

  return `# QA Gate Retry (Attempt ${attemptNumber + 1}/${MAX_QA_ATTEMPTS})

Your previous changes for the following task had QA gate failures:

**Original Task:** ${originalPrompt}

## Failed QA Gates:

${failureDetails}

## Instructions:

Please fix ONLY the issues reported by the failed QA gates above. Do not make any other changes.

Focus on:
1. Reading the error messages carefully
2. Identifying the exact files and lines that need to be fixed
3. Making minimal, targeted changes to resolve the failures
4. Ensuring your fixes don't break other parts of the code

The QA gates will run again automatically after you make your changes.`;
}

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
    const sessionId = task.sessionId;

    // Convert host path to container path for Claude execution
    const containerPath = getContainerPath(repoPath);

    // 2. Run pre-flight checks
    await db
      .update(tasks)
      .set({ status: 'pre_flight', updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    // Emit status update
    taskEvents.emit('task:update', {
      sessionId,
      taskId,
      status: 'pre_flight',
    });

    console.log(`[Task ${taskId}] Running pre-flight checks for path: ${repoPath}`);
    console.log(`[Task ${taskId}] Container path: ${containerPath}`);

    const preFlightResult = await runPreFlightChecks(repoPath);

    if (!preFlightResult.passed) {
      console.error(`[Task ${taskId}] Pre-flight check failed:`, preFlightResult.error);

      await db
        .update(tasks)
        .set({
          status: 'failed',
          claudeOutput: `Pre-flight check failed: ${preFlightResult.error}`,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId));

      taskEvents.emit('task:update', {
        sessionId,
        taskId,
        status: 'failed',
      });
      return;
    }

    console.log(`[Task ${taskId}] Pre-flight checks passed. Commit: ${preFlightResult.currentCommit}, Branch: ${preFlightResult.currentBranch}`);

    // Store these values as we'll need them later
    const startingCommit = preFlightResult.currentCommit!;
    const startingBranch = preFlightResult.currentBranch!;

    // 3. Capture starting state
    await db
      .update(tasks)
      .set({
        startingCommit,
        startingBranch,
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

    taskEvents.emit('task:update', {
      sessionId,
      taskId,
      status: 'running',
    });

    // Forward Claude output events to task events
    const outputHandler = (data: { taskId: string; output?: string; data?: string }) => {
      if (data.taskId === taskId) {
        const output = data.output || data.data || '';
        taskEvents.emit('task:output', {
          sessionId,
          taskId,
          output,
        });
      }
    };

    claudeWrapper.on('output', outputHandler);

    console.log(`[Task ${taskId}] Invoking Claude with prompt: "${task.prompt.substring(0, 100)}..."`);

    try {
      await claudeWrapper.executeTask({
        workingDirectory: containerPath,
        prompt: task.prompt,
        taskId: task.id,
      });
      console.log(`[Task ${taskId}] Claude execution completed`);
    } finally {
      claudeWrapper.off('output', outputHandler);
    }

    // 5. Capture diff
    console.log(`[Task ${taskId}] Capturing diff from commit: ${startingCommit}`);
    const diff = await captureDiff(repoPath, startingCommit);

    await db
      .update(tasks)
      .set({
        diffContent: diff.fullDiff,
        filesChanged: diff.changedFiles,
        status: 'waiting_qa',
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    taskEvents.emit('task:update', {
      sessionId,
      taskId,
      status: 'waiting_qa',
    });

    // 6. Run QA gates with retry loop
    await runQAGatesWithRetry(taskId, repoPath, containerPath, sessionId, task.prompt);
  } catch (error) {
    // Get sessionId from task if possible
    const failedTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    await db
      .update(tasks)
      .set({
        status: 'failed',
        claudeOutput:
          error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    if (failedTask) {
      taskEvents.emit('task:update', {
        sessionId: failedTask.sessionId,
        taskId,
        status: 'failed',
      });
    }
  }
}
