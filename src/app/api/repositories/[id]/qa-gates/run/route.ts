import { NextResponse } from 'next/server';
import { db } from '@/db';
import { repositories, qaRuns } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { loadRepositoryConfig } from '@/lib/qa-gates/config-loader';
import { orchestrateQAGates } from '@/lib/qa-gates/run-orchestrator';

async function getRepository(id: string) {
  return await db
    .select()
    .from(repositories)
    .where(eq(repositories.id, id))
    .limit(1)
    .get();
}

async function createQARun(repositoryId: string) {
  return await db
    .insert(qaRuns)
    .values({
      repositoryId,
      status: 'running',
    })
    .returning()
    .get();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get repository
    const repo = await getRepository(id);
    if (!repo) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      );
    }

    // Load QA gates configuration
    const config = await loadRepositoryConfig(repo.path);
    if (!config || config.qaGates.length === 0) {
      return NextResponse.json(
        { error: 'No QA gates configured' },
        { status: 400 }
      );
    }

    // Create QA run
    const run = await createQARun(id);

    // Execute gates asynchronously
    orchestrateQAGates({
      runId: run.id,
      repoPath: repo.path,
      gates: config.qaGates,
    });

    return NextResponse.json({
      runId: run.id,
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
