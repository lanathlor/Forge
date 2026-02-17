import { NextResponse } from 'next/server';
import { db } from '@/db';
import { repositories } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { writeFile } from 'fs/promises';
import { join } from 'path';

interface QAGateInput {
  name: string;
  enabled?: boolean;
  command: string;
  timeout?: number;
  failOnError?: boolean;
  order?: number;
}

async function getRepository(id: string) {
  return db
    .select()
    .from(repositories)
    .where(eq(repositories.id, id))
    .limit(1)
    .get();
}

function normalizeGate(gate: QAGateInput) {
  return {
    name: gate.name,
    enabled: gate.enabled ?? true,
    command: gate.command,
    timeout: gate.timeout ?? 60000,
    failOnError: gate.failOnError ?? true,
    order: gate.order ?? 1,
  };
}

async function writeConfig(path: string, config: object) {
  await writeFile(path, JSON.stringify(config, null, 2), 'utf-8');
}

async function saveGatesConfig(
  id: string,
  body: { version: unknown; maxRetries?: number; qaGates: QAGateInput[] }
) {
  const { version, maxRetries, qaGates } = body;
  const repo = await getRepository(id);
  if (!repo) return { error: 'Repository not found', status: 404 };

  const config = {
    version,
    maxRetries: maxRetries ?? 3,
    qaGates: qaGates.map(normalizeGate),
  };
  const configPath = join(repo.path, '.autobot.json');
  await writeConfig(configPath, config);
  return { repoName: repo.name, configPath };
}

/**
 * POST /api/repositories/:id/qa-gates/save
 * Save QA gates configuration to .autobot.json
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    const { id } = await params;
    const body = await request.json();
    const { version, maxRetries, qaGates } = body;

    if (!version || !Array.isArray(qaGates)) {
      return NextResponse.json(
        { error: 'Invalid configuration format' },
        { status: 400 }
      );
    }

    const result = await saveGatesConfig(id, { version, maxRetries, qaGates });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const duration = Date.now() - startTime;
    console.log(`[QA Gates Save] Saved configuration for ${result.repoName} in ${duration}ms`);
    return NextResponse.json({ success: true, path: result.configPath, duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[QA Gates Save] Error after ${duration}ms:`, error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to save configuration',
        duration,
      },
      { status: 500 }
    );
  }
}
