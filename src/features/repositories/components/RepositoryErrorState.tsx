import { ErrorState } from '@/shared/components/error';

interface RepositoryErrorStateProps {
  onRescan: () => void;
  isRescanning: boolean;
}

export function RepositoryErrorState({
  onRescan,
  isRescanning: _isRescanning,
}: RepositoryErrorStateProps) {
  return (
    <ErrorState
      type="network"
      title="Failed to load repositories"
      onRetry={onRescan}
    />
  );
}
