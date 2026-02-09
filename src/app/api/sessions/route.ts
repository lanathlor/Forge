import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sessions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/sessions?repositoryId=xxx
 * Get or create active session for a repository
 */
/* eslint-disable max-lines-per-function */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repositoryId = searchParams.get('repositoryId');

  if (!repositoryId) {
    return NextResponse.json(
      { error: 'Missing repositoryId' },
      { status: 400 }
    );
  }

  try {
    // Check for existing active session
    const activeSession = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.repositoryId, repositoryId),
        eq(sessions.status, 'active')
      ),
    });

    if (activeSession) {
      // Update last activity
      await db
        .update(sessions)
        .set({
          lastActivity: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, activeSession.id));

      return NextResponse.json({ session: activeSession });
    }

    // Create new session if none exists
    const [newSession] = await db
      .insert(sessions)
      .values({
        repositoryId,
        status: 'active',
      })
      .returning();

    return NextResponse.json({ session: newSession });
  } catch (error) {
    console.error('Error in sessions API:', error);
    return NextResponse.json(
      { error: 'Failed to get or create session' },
      { status: 500 }
    );
  }
}
