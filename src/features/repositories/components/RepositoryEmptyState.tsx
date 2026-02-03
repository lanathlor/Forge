import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';

interface RepositoryEmptyStateProps {
  onRescan: () => void;
  isRescanning: boolean;
}

export function RepositoryEmptyState({
  onRescan,
  isRescanning,
}: RepositoryEmptyStateProps) {
  return (
    <Card className="p-6">
      <p className="text-muted-foreground mb-4">
        No git repositories found in workspace
      </p>
      <Button variant="outline" onClick={onRescan} disabled={isRescanning}>
        {isRescanning ? 'Rescanning...' : 'Rescan Workspace'}
      </Button>
    </Card>
  );
}
