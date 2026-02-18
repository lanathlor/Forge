import { NextResponse } from 'next/server';
import { db } from '@/db';
import { repositories } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { loadRepositoryConfig } from '@/lib/qa-gates/config-loader';

async function fetchRepository(id: string) {
  const repoPromise = db
    .select()
    .from(repositories)
    .where(eq(repositories.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  return Promise.race([
    repoPromise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Database query timeout')), 5000)
    ),
  ]);
}

function handleError(error: unknown, startTime: number, repoId?: string) {
  const duration = Date.now() - startTime;
  console.error(
    `[QA Gates API] Error after ${duration}ms for repository ${repoId}:`,
    error
  );

  if (error instanceof Error && error.message === 'Database query timeout') {
    return NextResponse.json(
      { error: 'Database query timeout - please try again' },
      { status: 504 }
    );
  }

  return NextResponse.json(
    { error: 'Failed to load QA gates configuration' },
    { status: 500 }
  );
}

/**
 * GET /api/repositories/:id/qa-gates
 * Get QA gate configuration for a specific repository
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  let repoId: string | undefined;

  try {
    const { id } = await params;
    repoId = id;

    const repo = await fetchRepository(id);

    if (!repo) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      );
    }

    const config = await loadRepositoryConfig(repo.path);
    console.log(`[QA Gates API] Loaded config in ${Date.now() - startTime}ms`);

    return NextResponse.json({
      repository: { id: repo.id, name: repo.name, path: repo.path },
      config: {
        version: config.version,
        maxRetries: config.maxRetries,
        qaGates: config.qaGates,
        hasCustomConfig: config !== null,
      },
    });
  } catch (error) {
    return handleError(error, startTime, repoId);
  }
}
