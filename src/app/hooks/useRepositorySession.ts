import { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from '@/shared/hooks';
import { setCurrentRepository } from '@/features/sessions/store/sessionSlice';
import { useGetRepositoriesQuery } from '@/features/repositories/store/repositoriesApi';
import type { Repository } from '@/db/schema';

export function useRepositorySession() {
  const dispatch = useAppDispatch();
  const currentRepositoryId = useAppSelector(state => state.session.currentRepositoryId);
  const isSidebarCollapsed = useAppSelector(state => state.session.isSidebarCollapsed);
  const { data } = useGetRepositoriesQuery(undefined);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);

  // Find and restore the selected repository from Redux state
  useEffect(() => {
    if (data?.repositories && currentRepositoryId) {
      const repo = data.repositories.find((r: Repository) => r.id === currentRepositoryId);
      if (repo) {
        setSelectedRepo(repo);
      }
    }
  }, [data, currentRepositoryId]);

  // Persist session state to localStorage whenever it changes
  useEffect(() => {
    const sessionState = {
      currentRepositoryId,
      isSidebarCollapsed,
    };
    // Use dynamic import to avoid SSR issues
    import('@/shared/lib/localStorage').then(({ storage, STORAGE_KEYS }) => {
      storage.set(STORAGE_KEYS.SESSION, sessionState);
    });
  }, [currentRepositoryId, isSidebarCollapsed]);

  const handleSelectRepository = (repo: Repository) => {
    setSelectedRepo(repo);
    dispatch(setCurrentRepository(repo.id));
  };

  return {
    selectedRepo,
    handleSelectRepository,
  };
}
