import { handleCreateTask } from '@/features/plans/api/handlers';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  return handleCreateTask(body);
}
