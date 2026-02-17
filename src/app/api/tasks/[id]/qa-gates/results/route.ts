import { NextResponse } from 'next/server';
import { db } from '@/db';
import { qaGateResults } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';

/**
 * GET /api/tasks/:id/qa-gates/results
 * Get QA gate results for a task
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const results = await db
      .select()
      .from(qaGateResults)
      .where(eq(qaGateResults.taskId, id))
      .orderBy(asc(qaGateResults.createdAt));

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error fetching QA gate results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch QA gate results' },
      { status: 500 }
    );
  }
}
