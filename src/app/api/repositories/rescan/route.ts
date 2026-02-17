import { handleRescanRepositories } from '@/features/repositories/api/handlers';

export async function POST() {
  return handleRescanRepositories();
}
