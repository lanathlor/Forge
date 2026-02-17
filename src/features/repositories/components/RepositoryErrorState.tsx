import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';

interface RepositoryErrorStateProps {
  onRescan: () => void;
  isRescanning: boolean;
}

export function RepositoryErrorState({
  onRescan,
  isRescanning,
}: RepositoryErrorStateProps) {
  return (
    <Card className="p-6">
      <p className="mb-4 text-destructive">Failed to load repositories</p>
      <Button variant="outline" onClick={onRescan} disabled={isRescanning}>
        {isRescanning ? 'Rescanning...' : 'Try Again'}
      </Button>
    </Card>
  );
}
