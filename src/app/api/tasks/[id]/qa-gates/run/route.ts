import { NextResponse } from 'next/server';
import { manualQARetry } from '@/lib/tasks/orchestrator';
import { db } from '@/db';
import { tasks } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/tasks/:id/qa-gates/run
 * Manually run QA gates for a task and invoke Claude to fix failures
 * This starts the process in the background and returns immediately
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify task exists
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Start the retry process in the background (don't await)
    // This allows the HTTP response to return immediately
    // Progress will be shown via task events
    manualQARetry(id).catch(error => {
      console.error(`[QA Retry] Error for task ${id}:`, error);
    });

    return NextResponse.json({
      success: true,
      message: 'QA retry started in background'
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to start QA retry';

    console.error('Error starting QA retry:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
