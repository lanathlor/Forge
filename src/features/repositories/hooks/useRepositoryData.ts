import { useMemo } from 'react';
import {
  useGetRepositoriesQuery,
  useRescanRepositoriesMutation,
} from '../store/repositoriesApi';
import type { Repository } from '@/db/schema';
import { buildRepositoryTree, countRepositories } from '../lib/tree';
import { useRepositorySelection } from './useRepositorySelection';

export function useRepositoryData(onSelect?: (repository: Repository) => void) {
  const { data, isLoading, error } = useGetRepositoriesQuery(undefined);
  const [rescan, { isLoading: isRescanning }] = useRescanRepositoriesMutation();

  const repositories = data?.repositories || [];

  const tree = useMemo(() => {
    if (!data?.repositories || data.repositories.length === 0) return null;
    return buildRepositoryTree(data.repositories);
  }, [data?.repositories]);

  const repoCount = tree ? countRepositories(tree) : 0;

  const { selected, handleSelect } = useRepositorySelection(
    repositories,
    onSelect
  );

  const handleRescan = async () => {
    try {
      await rescan(undefined).unwrap();
    } catch (error) {
      console.error('Failed to rescan repositories:', error);
    }
  };

  return {
    repositories,
    tree,
    repoCount,
    selected,
    isLoading,
    error,
    isRescanning,
    handleSelect,
    handleRescan,
  };
}
