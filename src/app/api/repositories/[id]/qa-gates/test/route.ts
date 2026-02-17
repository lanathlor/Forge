import { NextResponse } from 'next/server';
import { db } from '@/db';
import { repositories } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { execAsync, type CommandError } from '@/lib/qa-gates/command-executor';

async function getRepository(id: string) {
  return db
    .select()
    .from(repositories)
    .where(eq(repositories.id, id))
    .limit(1)
    .get();
}

async function executeGateCommand(command: string, cwd: string) {
  let exitCode = 0;
  let output = '';
  let error: string | null = null;

  try {
    const result = await execAsync(command, { cwd, timeout: 30000 });
    output = result.stdout;
    if (result.stderr) {
      error = result.stderr;
    }
  } catch (err) {
    const cmdError = err as CommandError;
    exitCode = cmdError.code || 1;
    output = cmdError.stdout || '';
    error = cmdError.stderr || cmdError.message || 'Command execution failed';
  }

  return { exitCode, output, error };
}

/**
 * POST /api/repositories/:id/qa-gates/test
 * Test a single QA gate command without persisting results
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    const { id } = await params;
    const body = await request.json();
    const { command, gateName } = body;

    if (!command || typeof command !== 'string') {
      return NextResponse.json(
        { error: 'Command is required and must be a string' },
        { status: 400 }
      );
    }

    const repo = await getRepository(id);
    if (!repo) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    console.log(`[QA Gate Test] Testing gate "${gateName}" for repository ${repo.name}`);

    const { exitCode, output, error } = await executeGateCommand(command, repo.path);
    const duration = Date.now() - startTime;

    return NextResponse.json({
      gateName,
      command,
      exitCode,
      output,
      error,
      duration,
      success: exitCode === 0,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[QA Gate Test] Error after ${duration}ms:`, error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to test gate',
        duration,
      },
      { status: 500 }
    );
  }
}
