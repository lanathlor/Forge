import { NextResponse } from 'next/server';
import { manualQARetry } from '@/lib/tasks/orchestrator';

/**
 * POST /api/tasks/:id/qa-gates/run
 * Manually run QA gates for a task and invoke Claude to fix failures
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Run QA gates and invoke Claude to fix failures if needed
    await manualQARetry(id);

    return NextResponse.json({ success: true });
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
