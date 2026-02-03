import { Card } from '@/shared/components/ui/card';

export function RepositoryLoadingState() {
  return (
    <Card className="p-6">
      <p className="text-muted-foreground">Scanning workspace...</p>
    </Card>
  );
}
