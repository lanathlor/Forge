import { NextResponse } from 'next/server';
import { db } from '@/db';
import { repositories } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { loadRepositoryConfig } from '@/lib/qa-gates/config-loader';

/**
 * GET /api/repositories/:id/qa-gates
 * Get QA gate configuration for a specific repository
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get repository
    const repo = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, id))
      .limit(1)
      .get();

    if (!repo) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      );
    }

    // Load QA gates from repository's .autobot.json
    const config = await loadRepositoryConfig(repo.path);

    return NextResponse.json({
      repository: {
        id: repo.id,
        name: repo.name,
        path: repo.path,
      },
      config: {
        version: config.version,
        maxRetries: config.maxRetries,
        qaGates: config.qaGates,
        hasCustomConfig: config !== null, // Indicates if .autobot.json exists
      },
    });
  } catch (error) {
    console.error('Error loading QA gates for repository:', error);
    return NextResponse.json(
      { error: 'Failed to load QA gates configuration' },
      { status: 500 }
    );
  }
}
