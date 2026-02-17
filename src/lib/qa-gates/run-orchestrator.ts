import { db } from '@/db';
import { qaRuns } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { QAGateConfig } from './config-loader';
import { executeGate } from './gate-executor';

interface OrchestrateParams {
  runId: string;
  repoPath: string;
  gates: QAGateConfig[];
}

/**
 * Update QA run status to completed
 */
async function updateRunComplete(
  runId: string,
  status: 'passed' | 'failed',
  duration: number
) {
  await db
    .update(qaRuns)
    .set({
      status,
      duration,
      completedAt: new Date(),
    })
    .where(eq(qaRuns.id, runId));
}

/**
 * Execute all QA gates in order and update run status
 * Returns immediately - execution happens asynchronously
 */
export async function orchestrateQAGates({
  runId,
  repoPath,
  gates,
}: OrchestrateParams): Promise<void> {
  const startTime = Date.now();
  let runStatus: 'passed' | 'failed' = 'passed';

  try {
    const enabledGates = gates.filter((g) => g.enabled);

    for (const gate of enabledGates) {
      const result = await executeGate({ runId, gate, repoPath });

      // If gate failed and should fail on error, stop execution
      if (result.status === 'failed' && gate.failOnError) {
        runStatus = 'failed';
        break;
      }
    }

    const duration = Date.now() - startTime;
    await updateRunComplete(runId, runStatus, duration);
  } catch (error) {
    console.error('Error executing QA gates:', error);
    const duration = Date.now() - startTime;
    await updateRunComplete(runId, 'failed', duration);
  }
}
