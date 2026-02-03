import type { Repository } from '@/db/schema';
import { RepositorySelector } from '@/features/repositories/components/RepositorySelector';

interface CollapsibleSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelectRepository: (repo: Repository) => void;
}

export function CollapsibleSidebar({
  isCollapsed,
  onToggleCollapse,
  onSelectRepository,
}: CollapsibleSidebarProps) {
  return (
    <div
      className={`transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-16' : 'w-80'
      }`}
    >
      <RepositorySelector
        onSelect={onSelectRepository}
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
      />
    </div>
  );
}
