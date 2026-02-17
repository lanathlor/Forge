import { handleGetRepositories } from '@/features/repositories/api/handlers';

export async function GET() {
  return handleGetRepositories();
}
