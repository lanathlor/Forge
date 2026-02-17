import {
  handleGetPlans,
  handleCreatePlan,
} from '@/features/plans/api/handlers';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const repositoryId = searchParams.get('repositoryId');
  return handleGetPlans(repositoryId || undefined);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return handleCreatePlan(body);
}
