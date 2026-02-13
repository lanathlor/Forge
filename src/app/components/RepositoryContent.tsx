import type { Repository } from '@/db/schema';
import { RepositoryDetailView } from './RepositoryDetailView';

interface RepositoryContentProps {
  repository: Repository;
  onBack?: () => void;
  onStartSession?: () => void;
  onSelectSession?: (sessionId: string) => void;
}

export function RepositoryContent({
  repository,
  onBack,
  onStartSession,
  onSelectSession,
}: RepositoryContentProps) {
  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <RepositoryDetailView
        repository={repository}
        onBack={onBack}
        onStartSession={onStartSession}
        onSelectSession={onSelectSession}
      />
    </div>
  );
}
