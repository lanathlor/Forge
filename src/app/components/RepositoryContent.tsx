import type { Repository } from '@/db/schema';
import { QAGatesConfig } from '@/features/repositories/components/QAGatesConfig';
import { RepositoryInfoCard } from './RepositoryInfoCard';

interface RepositoryContentProps {
  repository: Repository;
}

export function RepositoryContent({ repository }: RepositoryContentProps) {
  return (
    <div className="h-full overflow-auto">
      <RepositoryInfoCard repository={repository} />
      <QAGatesConfig repositoryId={repository.id} />
    </div>
  );
}
