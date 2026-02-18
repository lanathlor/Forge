import { db } from '@/db';
import { qaGateExecutions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { QAGateConfig } from './config-loader';
import {
  execAsync,
  getContainerPath,
  type CommandError,
} from './command-executor';

export interface GateExecutionResult {
  id: string;
  gateName: string;
  status: 'passed' | 'failed';
  duration: number;
}

interface ExecuteGateParams {
  runId: string;
  gate: QAGateConfig;
  repoPath: string;
}

/**
 * Create a gate execution record in the database
 */
async function createGateExecution(runId: string, gate: QAGateConfig) {
  return (
    await db
      .insert(qaGateExecutions)
      .values({
        runId,
        gateName: gate.name,
        command: gate.command,
        status: 'running',
        order: gate.order || 0,
      })
      .returning()
  )[0];
}

/**
 * Update gate execution with success status
 */
async function updateGateSuccess(
  executionId: string,
  stdout: string,
  stderr: string,
  duration: number
) {
  await db
    .update(qaGateExecutions)
    .set({
      status: 'passed',
      output: stdout,
      error: stderr || null,
      exitCode: 0,
      duration,
      completedAt: new Date(),
    })
    .where(eq(qaGateExecutions.id, executionId));
}

/**
 * Update gate execution with failure status
 */
async function updateGateFailure(
  executionId: string,
  error: CommandError,
  duration: number
) {
  await db
    .update(qaGateExecutions)
    .set({
      status: 'failed',
      output: error.stdout || null,
      error: error.stderr || error.message,
      exitCode: error.code || 1,
      duration,
      completedAt: new Date(),
    })
    .where(eq(qaGateExecutions.id, executionId));
}

/**
 * Execute a single QA gate
 */
export async function executeGate({
  runId,
  gate,
  repoPath,
}: ExecuteGateParams): Promise<GateExecutionResult> {
  const gateStartTime = Date.now();
  const execPath = getContainerPath(repoPath);

  // Create gate execution record
  const execution = await createGateExecution(runId, gate);

  if (!execution) {
    throw new Error(`Failed to create gate execution record for gate "${gate.name}"`);
  }

  try {
    // Execute command with timeout using container path
    const { stdout, stderr } = await execAsync(gate.command, {
      cwd: execPath,
      timeout: gate.timeout,
    });

    const duration = Date.now() - gateStartTime;
    await updateGateSuccess(execution.id, stdout, stderr, duration);

    return {
      id: execution.id,
      gateName: gate.name,
      status: 'passed',
      duration,
    };
  } catch (error) {
    const duration = Date.now() - gateStartTime;
    const commandError = error as CommandError;
    await updateGateFailure(execution.id, commandError, duration);

    return {
      id: execution.id,
      gateName: gate.name,
      status: 'failed',
      duration,
    };
  }
}
