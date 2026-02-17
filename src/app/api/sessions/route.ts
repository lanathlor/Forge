import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  getOrCreateActiveSession,
  listSessionsWithStats,
  type ListSessionsOptions,
} from '@/lib/sessions';
import type { SessionStatus } from '@/db/schema/sessions';

/**
 * GET /api/sessions?repositoryId=xxx
 * Get or create active session for a repository
 *
 * GET /api/sessions?repositoryId=xxx&list=true&limit=10&status=completed
 * List sessions for a repository with optional filtering
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repositoryId = searchParams.get('repositoryId');
  const listMode = searchParams.get('list') === 'true';

  if (!repositoryId) {
    return NextResponse.json(
      { error: 'Missing repositoryId' },
      { status: 400 }
    );
  }

  try {
    if (listMode) {
      // List mode: return paginated sessions with stats
      const options: ListSessionsOptions = {
        limit: parseInt(searchParams.get('limit') || '10', 10),
        offset: parseInt(searchParams.get('offset') || '0', 10),
      };

      const status = searchParams.get('status') as SessionStatus | null;
      if (status) {
        options.status = status;
      }

      const sessions = await listSessionsWithStats(repositoryId, options);
      return NextResponse.json({ sessions });
    }

    // Default mode: get or create active session
    const session = await getOrCreateActiveSession(repositoryId);
    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error in sessions API:', error);
    return NextResponse.json(
      { error: 'Failed to get or create session' },
      { status: 500 }
    );
  }
}
