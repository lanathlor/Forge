import type { Repository } from '@/db/schema';
import { RepositoryStatusBadge } from './RepositoryStatusBadge';

interface RepositoryInfoCardProps {
  repository: Repository;
}

export function RepositoryInfoCard({ repository }: RepositoryInfoCardProps) {
  return (
    <div className="mb-6 rounded-xl border-2 bg-gradient-to-br from-card to-card/50 p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="mb-1 text-2xl font-bold">{repository.name}</h2>
          <p className="font-mono text-sm text-muted-foreground">
            {repository.path}
          </p>
        </div>
        <RepositoryStatusBadge isClean={repository.isClean} />
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
            />
          </svg>
          <span className="font-medium text-muted-foreground">Branch:</span>
          <code className="rounded-md border bg-muted/60 px-3 py-1.5 font-mono text-xs font-semibold text-foreground shadow-sm">
            {repository.currentBranch}
          </code>
        </div>
      </div>
    </div>
  );
}
