import { NextResponse } from 'next/server';
import { db } from '@/db';
import { repositories, qaRuns } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { loadRepositoryConfig } from '@/lib/qa-gates/config-loader';
import { orchestrateQAGates } from '@/lib/qa-gates/run-orchestrator';

async function getRepository(id: string) {
  return (
    await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, id))
      .limit(1)
  )[0];
}

async function createQARun(repositoryId: string) {
  return (
    await db
      .insert(qaRuns)
      .values({ repositoryId, status: 'running' })
      .returning()
  )[0];
}

async function startRun(id: string) {
  const repo = await getRepository(id);
  if (!repo) return { error: 'Repository not found', status: 404 } as const;

  const config = await loadRepositoryConfig(repo.path);
  if (!config || config.qaGates.length === 0) {
    return { error: 'No QA gates configured', status: 400 } as const;
  }

  const run = await createQARun(id);
  if (!run) return { error: 'Failed to create QA run', status: 500 } as const;

  orchestrateQAGates({ runId: run.id, repoPath: repo.path, gates: config.qaGates });
  return { runId: run.id };
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await startRun(id);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      runId: result.runId,
      status: 'running',
      message: 'QA gates execution started',
    });
  } catch (error) {
    console.error('Error starting QA gate run:', error);
    return NextResponse.json(
      { error: 'Failed to start QA gate run' },
      { status: 500 }
    );
  }
}
