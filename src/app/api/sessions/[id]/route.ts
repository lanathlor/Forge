import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sessions } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/sessions/:id
 * Get session with all tasks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, id),
      with: {
        repository: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Get tasks for this session (need to query separately since relation isn't set up yet)
    const tasksResponse = await fetch(
      `${request.nextUrl.origin}/api/tasks?sessionId=${id}`
    );
    const tasksData = await tasksResponse.json();

    return NextResponse.json({
      session: {
        ...session,
        tasks: tasksData.tasks || [],
      },
    });
  } catch (error) {
    console.error('Error in session detail API:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}
