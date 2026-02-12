import { useState, useEffect } from 'react';
import type { Repository } from '@/db/schema';
import { storage, STORAGE_KEYS } from '@/shared/lib/localStorage';

function findInitialRepository(repositories: Repository[]): Repository | null {
  if (repositories.length === 0) return null;

  const sessionData = storage.get<{ currentRepositoryId?: string }>(
    STORAGE_KEYS.SESSION
  );
  const persistedRepoId = sessionData?.currentRepositoryId;

  const found = repositories.find((r) => r.id === persistedRepoId);
  return found ?? repositories[0] ?? null;
}

export function useRepositorySelection(
  repositories: Repository[],
  onSelect?: (repository: Repository) => void
) {
  const [selected, setSelected] = useState<Repository | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (repositories.length === 0 || hasInitialized) return;

    const repoToSelect = findInitialRepository(repositories);
    setSelected(repoToSelect);
    if (onSelect && repoToSelect) {
      onSelect(repoToSelect);
    }
    setHasInitialized(true);
  }, [repositories.length, hasInitialized]);

  const handleSelect = (repo: Repository) => {
    setSelected(repo);
    if (onSelect) {
      onSelect(repo);
    }
  };

  return { selected, handleSelect };
}
