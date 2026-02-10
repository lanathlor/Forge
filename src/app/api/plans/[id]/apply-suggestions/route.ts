import { handleApplySuggestions } from '@/features/plans/api/handlers';
import type { NextRequest } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  return handleApplySuggestions({ planId: id, ...body });
}
