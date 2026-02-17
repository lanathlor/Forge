import { Button } from '@/shared/components/ui/button';
import { RefreshCw, PanelLeftClose } from 'lucide-react';

interface RepositoryHeaderProps {
  repoCount: number;
  onToggleCollapse?: () => void;
  onRescan: () => void;
  isRescanning: boolean;
}

export function RepositoryHeader({
  repoCount,
  onToggleCollapse,
  onRescan,
  isRescanning,
}: RepositoryHeaderProps) {
  return (
    <div className="space-y-3 border-b p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Repositories ({repoCount})</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onRescan}
            disabled={isRescanning}
            title="Rescan repositories"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRescanning ? 'animate-spin' : ''}`}
            />
          </Button>
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              title="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
