import { db } from '@/db';
import { repositories, qaRuns, qaGateExecutions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export interface QAGateStatus {
  hasRun: boolean;
  run: typeof qaRuns.$inferSelect | null;
  gates: (typeof qaGateExecutions.$inferSelect)[];
}

/**
 * Get repository by ID
 */
export async function getRepository(id: string) {
  return (
    await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, id))
      .limit(1)
  )[0];
}

/**
 * Get latest QA run for a repository
 */
export async function getLatestQARun(repositoryId: string) {
  return (
    await db
      .select()
      .from(qaRuns)
      .where(eq(qaRuns.repositoryId, repositoryId))
      .orderBy(desc(qaRuns.startedAt))
      .limit(1)
  )[0];
}

/**
 * Get gate executions for a run
 */
export async function getGateExecutions(runId: string) {
  return await db
    .select()
    .from(qaGateExecutions)
    .where(eq(qaGateExecutions.runId, runId))
    .orderBy(qaGateExecutions.order);
}

/**
 * Get QA gate status for a repository
 */
export async function getQAGateStatus(
  repositoryId: string
): Promise<QAGateStatus> {
  const latestRun = await getLatestQARun(repositoryId);

  if (!latestRun) {
    return {
      hasRun: false,
      run: null,
      gates: [],
    };
  }

  const gates = await getGateExecutions(latestRun.id);

  return {
    hasRun: true,
    run: latestRun,
    gates,
  };
}
