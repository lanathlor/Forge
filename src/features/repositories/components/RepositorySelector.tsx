'use client';

import type { Repository } from '@/db/schema';
import { useRepositoryData } from '../hooks/useRepositoryData';
import { RepositoryLoadingState } from './RepositoryLoadingState';
import { RepositoryErrorState } from './RepositoryErrorState';
import { RepositoryEmptyState } from './RepositoryEmptyState';
import { RepositoryCollapsedView } from './RepositoryCollapsedView';
import { RepositoryExpandedView } from './RepositoryExpandedView';

interface RepositorySelectorProps {
  onSelect?: (repository: Repository) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function RepositorySelector({
  onSelect,
  isCollapsed = false,
  onToggleCollapse,
}: RepositorySelectorProps) {
  const data = useRepositoryData(onSelect);

  if (data.isLoading || !data.tree) return <RepositoryLoadingState />;
  if (data.error) {
    return (
      <RepositoryErrorState
        onRescan={data.handleRescan}
        isRescanning={data.isRescanning}
      />
    );
  }
  if (data.repositories.length === 0) {
    return (
      <RepositoryEmptyState
        onRescan={data.handleRescan}
        isRescanning={data.isRescanning}
      />
    );
  }
  if (isCollapsed) {
    return (
      <RepositoryCollapsedView
        repoCount={data.repoCount}
        onToggleCollapse={onToggleCollapse}
        onRescan={data.handleRescan}
        isRescanning={data.isRescanning}
      />
    );
  }

  return (
    <RepositoryExpandedView
      tree={data.tree}
      selectedId={data.selected?.id ?? null}
      repoCount={data.repoCount}
      onSelect={data.handleSelect}
      onToggleCollapse={onToggleCollapse}
      onRescan={data.handleRescan}
      isRescanning={data.isRescanning}
    />
  );
}
