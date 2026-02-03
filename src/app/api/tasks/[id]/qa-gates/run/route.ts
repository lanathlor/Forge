import { NextResponse } from 'next/server';
import { runTaskQAGates } from '@/lib/qa-gates/task-qa-service';

/**
 * POST /api/tasks/:id/qa-gates/run
 * Manually run QA gates for a task
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await runTaskQAGates(id);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to run QA gates';

    if (errorMessage === 'Task not found') {
      return NextResponse.json({ error: errorMessage }, { status: 404 });
    }

    console.error('Error running QA gates:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
