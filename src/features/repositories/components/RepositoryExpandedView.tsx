import { Card } from '@/shared/components/ui/card';
import type { Repository } from '@/db/schema';
import type { TreeNode } from '../lib/tree';
import { RepositoryTree } from './RepositoryTree';
import { RepositoryHeader } from './RepositoryHeader';

interface RepositoryExpandedViewProps {
  tree: TreeNode;
  selectedId: string | null;
  repoCount: number;
  onSelect: (repository: Repository) => void;
  onToggleCollapse?: () => void;
  onRescan: () => void;
  isRescanning: boolean;
}

export function RepositoryExpandedView({
  tree,
  selectedId,
  repoCount,
  onSelect,
  onToggleCollapse,
  onRescan,
  isRescanning,
}: RepositoryExpandedViewProps) {
  return (
    <Card className="flex h-full flex-col">
      <RepositoryHeader
        repoCount={repoCount}
        onToggleCollapse={onToggleCollapse}
        onRescan={onRescan}
        isRescanning={isRescanning}
      />
      <div className="flex-1 overflow-y-auto p-2">
        <RepositoryTree
          node={tree}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </div>
    </Card>
  );
}
