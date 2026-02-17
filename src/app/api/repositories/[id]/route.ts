import { handleGetRepository } from '@/features/repositories/api/handlers';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleGetRepository(id);
}
