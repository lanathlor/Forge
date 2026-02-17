import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sessions, tasks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  getSessionSummary,
  getEnhancedSessionSummary,
  endSession,
  pauseSession,
  resumeSession,
  deleteSession,
} from '@/lib/sessions';

async function handleSummaryRequest(id: string, enhanced: boolean) {
  if (enhanced) {
    return NextResponse.json(await getEnhancedSessionSummary(id));
  }
  return NextResponse.json(await getSessionSummary(id));
}

async function handleDetailRequest(id: string) {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, id),
    with: { repository: true },
  });

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const sessionTasks = await db.query.tasks.findMany({
    where: eq(tasks.sessionId, id),
    orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
  });

  return NextResponse.json({ session: { ...session, tasks: sessionTasks } });
}

/**
 * GET /api/sessions/:id
 * Get session with all tasks
 *
 * GET /api/sessions/:id?summary=true
 * Get session summary with stats
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const includeSummary = searchParams.get('summary') === 'true';
    const enhanced = searchParams.get('enhanced') === 'true';

    if (includeSummary) {
      return handleSummaryRequest(id, enhanced);
    }

    return handleDetailRequest(id);
  } catch (error) {
    console.error('Error in session detail API:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sessions/:id
 * Update session status (end, pause, resume)
 *
 * Body: { action: 'end' | 'pause' | 'resume' }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    let session;

    switch (action) {
      case 'end':
        session = await endSession(id);
        break;
      case 'pause':
        session = await pauseSession(id);
        break;
      case 'resume':
        session = await resumeSession(id);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be: end, pause, or resume' },
          { status: 400 }
        );
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error updating session:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to update session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/sessions/:id
 * Delete a session and all its tasks
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await deleteSession(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to delete session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
