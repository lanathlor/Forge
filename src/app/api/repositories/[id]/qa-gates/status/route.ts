import { NextResponse } from 'next/server';
import { getRepository, getQAGateStatus } from '@/lib/qa-gates/status-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get repository
    const repo = await getRepository(id);
    if (!repo) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      );
    }

    // Get QA gate status
    const status = await getQAGateStatus(id);
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error fetching QA gate status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch QA gate status' },
      { status: 500 }
    );
  }
}
