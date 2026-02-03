import { db } from '@/db';
import { qaGateResults, tasks } from '@/db/schema';
import type { QAGateStatus } from '@/db/schema/qa-gates';
import { eq } from 'drizzle-orm';
import { loadRepositoryConfig, type QAGateConfig } from './config-loader';
import { execAsync } from './command-executor';

interface GateResult {
  gateName: string;
  status: QAGateStatus;
  output: string;
  errors?: string[];
  duration: number;
}

async function updateTaskAttempt(taskId: string, attempt: number) {
  await db
    .update(tasks)
    .set({
      status: 'qa_running',
      currentQAAttempt: attempt,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));
}

async function updateTaskSuccess(taskId: string) {
  await db
    .update(tasks)
    .set({ status: 'waiting_approval', updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
}

async function updateTaskFailure(taskId: string) {
  await db
    .update(tasks)
    .set({ status: 'qa_failed', updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
}

async function handleRetryFeedback(
  taskId: string,
  results: GateResult[],
  attempt: number,
  maxRetries: number
) {
  const failedGates = results.filter((r) => r.status === 'failed');
  const errorFeedback = formatErrorFeedback(failedGates);

  // NOTE: Claude re-invocation would happen here in a real implementation
  console.log(`QA Retry ${attempt}/${maxRetries} for task ${taskId}`);
  console.log('Error feedback that would be sent to Claude:');
  console.log(errorFeedback);
}

/**
 * Run QA gates with automatic retry logic.
 * If gates fail, Claude is re-invoked with error feedback up to 3 times.
 */
export async function runQAGatesWithRetry(
  taskId: string,
  repoPath: string
): Promise<{ passed: boolean; attempt: number }> {
  const config = await loadRepositoryConfig(repoPath);
  const MAX_QA_RETRIES = config.maxRetries || 3;

  let attempt = 0;

  while (attempt < MAX_QA_RETRIES) {
    attempt++;
    await updateTaskAttempt(taskId, attempt);

    const results = await runQAGates(taskId, repoPath);
    const allPassed = results.every(
      (r) => r.status === 'passed' || r.status === 'skipped'
    );

    if (allPassed) {
      await updateTaskSuccess(taskId);
      return { passed: true, attempt };
    }

    if (attempt >= MAX_QA_RETRIES) {
      await updateTaskFailure(taskId);
      return { passed: false, attempt };
    }

    await handleRetryFeedback(taskId, results, attempt, MAX_QA_RETRIES);
  }

  return { passed: false, attempt: MAX_QA_RETRIES };
}

async function handleSkippedGate(taskId: string, gate: QAGateConfig) {
  const skipResult: GateResult = {
    gateName: gate.name,
    status: 'skipped',
    output: 'Skipped due to previous gate failure',
    duration: 0,
  };

  await createGateResult({
    taskId,
    gateName: gate.name,
    status: 'skipped',
    output: '',
    duration: 0,
  });

  return skipResult;
}

async function executeAndStoreGate(
  taskId: string,
  gate: QAGateConfig,
  repoPath: string
) {
  const result = await runSingleGate(gate, repoPath);

  await createGateResult({
    taskId,
    gateName: result.gateName,
    status: result.status,
    output: result.output,
    duration: result.duration,
    errors: result.errors,
  });

  return result;
}

/**
 * Run all enabled QA gates sequentially
 */
export async function runQAGates(
  taskId: string,
  repoPath: string
): Promise<GateResult[]> {
  const config = await loadRepositoryConfig(repoPath);
  const gates = config.qaGates.filter((gate) => gate.enabled);

  const results: GateResult[] = [];
  let shouldStop = false;

  for (const gate of gates) {
    if (shouldStop) {
      const skipResult = await handleSkippedGate(taskId, gate);
      results.push(skipResult);
      continue;
    }

    const result = await executeAndStoreGate(taskId, gate, repoPath);
    results.push(result);

    if (result.status === 'failed' && gate.failOnError) {
      shouldStop = true;
    }
  }

  return results;
}

/**
 * Run a single QA gate
 */
async function runSingleGate(
  gate: QAGateConfig,
  repoPath: string
): Promise<GateResult> {
  const startTime = Date.now();

  try {
    const { stdout } = await execAsync(gate.command, {
      cwd: repoPath,
      timeout: gate.timeout || 60000,
    });

    const duration = Date.now() - startTime;

    // Success (exit code 0)
    return {
      gateName: gate.name,
      status: 'passed',
      output: stdout || 'No output',
      duration,
    };
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const err = error as { stdout?: string; stderr?: string; message?: string };

    // Failed (non-zero exit code or timeout)
    return {
      gateName: gate.name,
      status: 'failed',
      output: err.stdout || '',
      errors: parseErrors(err.stderr || err.stdout || err.message || ''),
      duration,
    };
  }
}

/**
 * Parse error output into structured array
 */
function parseErrors(output: string): string[] {
  const lines = output.split('\n').filter((line) => line.trim());
  return lines;
}

/**
 * Format error feedback for Claude retry prompt
 */
function formatErrorFeedback(failedGates: GateResult[]): string {
  return failedGates
    .map((gate) => {
      const errors = gate.errors || [gate.output];
      return `${gate.gateName} errors:\n${errors.join('\n')}`;
    })
    .join('\n\n');
}

interface CreateGateResultParams {
  taskId: string;
  gateName: string;
  status: QAGateStatus;
  output: string;
  duration: number;
  errors?: string[];
}

/**
 * Create QA gate result in database
 */
async function createGateResult(params: CreateGateResultParams): Promise<void> {
  await db.insert(qaGateResults).values({
    taskId: params.taskId,
    gateName: params.gateName,
    status: params.status,
    output: params.output,
    errors: params.errors || [],
    duration: params.duration,
    completedAt: new Date(),
  });
}
