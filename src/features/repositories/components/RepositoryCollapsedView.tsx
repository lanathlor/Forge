import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { RefreshCw, PanelLeft } from 'lucide-react';

interface RepositoryCollapsedViewProps {
  repoCount: number;
  onToggleCollapse?: () => void;
  onRescan: () => void;
  isRescanning: boolean;
}

export function RepositoryCollapsedView({
  repoCount,
  onToggleCollapse,
  onRescan,
  isRescanning,
}: RepositoryCollapsedViewProps) {
  return (
    <Card className="h-full flex flex-col">
      <div className="p-3 border-b flex flex-col items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          title="Expand sidebar"
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
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
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-xs text-muted-foreground rotate-90 whitespace-nowrap">
          {repoCount} repos
        </div>
      </div>
    </Card>
  );
}
