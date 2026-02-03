import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRepositoryData } from '../useRepositoryData';
import type { Repository } from '@/db/schema';
import * as tree from '../../lib/tree';
import * as repositorySelection from '../useRepositorySelection';
import * as repositoriesApi from '../../store/repositoriesApi';

// Mock the tree utilities
vi.mock('../../lib/tree', () => ({
  buildRepositoryTree: vi.fn(),
  countRepositories: vi.fn(),
}));

// Mock the useRepositorySelection hook
vi.mock('../useRepositorySelection', () => ({
  useRepositorySelection: vi.fn(),
}));

// Mock the RTK Query hooks
vi.mock('../../store/repositoriesApi', () => ({
  useGetRepositoriesQuery: vi.fn(),
  useRescanRepositoriesMutation: vi.fn(),
}));

// Mock the storage module
vi.mock('@/shared/lib/localStorage', () => ({
  storage: {
    get: vi.fn(),
    set: vi.fn(),
  },
  STORAGE_KEYS: {
    SESSION: 'autobot_session',
  },
}));

describe('useRepositoryData', () => {
  const mockRepo1: Repository = {
    id: 'repo-1',
    name: 'test-repo-1',
    path: '/path/to/repo1',
    isClean: true,
    currentBranch: 'main',
    lastCommitSha: null,
    lastCommitMsg: null,
    lastCommitAuthor: null,
    lastCommitTimestamp: null,
    uncommittedFiles: null,
    lastScanned: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockRepo2: Repository = {
    id: 'repo-2',
    name: 'test-repo-2',
    path: '/path/to/repo2',
    isClean: false,
    currentBranch: 'develop',
    lastCommitSha: null,
    lastCommitMsg: null,
    lastCommitAuthor: null,
    lastCommitTimestamp: null,
    uncommittedFiles: null,
    lastScanned: new Date('2024-01-02'),
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  };

  const mockTreeNode = {
    id: 'root',
    name: 'root',
    path: '/',
    type: 'folder' as const,
    children: [],
  };

  const mockHandleSelect = vi.fn();
  const mockRescan = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(tree.buildRepositoryTree).mockReturnValue(mockTreeNode);
    vi.mocked(tree.countRepositories).mockReturnValue(0);
    vi.mocked(repositorySelection.useRepositorySelection).mockReturnValue({
      selected: null,
      handleSelect: mockHandleSelect,
    });
    vi.mocked(repositoriesApi.useGetRepositoriesQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: undefined,
    } as any);
    vi.mocked(repositoriesApi.useRescanRepositoriesMutation).mockReturnValue([
      mockRescan,
      { isLoading: false },
    ] as any);
  });

  describe('Initial State', () => {
    it('should return initial loading state', () => {
      const { result } = renderHook(() => useRepositoryData());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.repositories).toEqual([]);
      expect(result.current.tree).toBeNull();
      expect(result.current.repoCount).toBe(0);
      expect(result.current.selected).toBeNull();
      expect(result.current.error).toBeUndefined();
      expect(result.current.isRescanning).toBe(false);
    });
  });

  describe('Fetching Repositories', () => {
    it('should fetch and display repositories', () => {
      vi.mocked(repositoriesApi.useGetRepositoriesQuery).mockReturnValue({
        data: { repositories: [mockRepo1, mockRepo2] },
        isLoading: false,
        error: undefined,
      } as any);

      vi.mocked(tree.countRepositories).mockReturnValue(2);

      const { result } = renderHook(() => useRepositoryData());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.repositories).toEqual([mockRepo1, mockRepo2]);
      expect(result.current.repoCount).toBe(2);
    });

    it('should handle fetch errors', () => {
      const mockError = { status: 500, data: 'Server error' };
      vi.mocked(repositoriesApi.useGetRepositoriesQuery).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: mockError,
      } as any);

      const { result } = renderHook(() => useRepositoryData());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toEqual(mockError);
      expect(result.current.repositories).toEqual([]);
    });

    it('should handle empty repository list', () => {
      vi.mocked(repositoriesApi.useGetRepositoriesQuery).mockReturnValue({
        data: { repositories: [] },
        isLoading: false,
        error: undefined,
      } as any);

      const { result } = renderHook(() => useRepositoryData());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.repositories).toEqual([]);
      expect(result.current.tree).toBeNull();
      expect(result.current.repoCount).toBe(0);
    });

    it('should handle undefined repositories data', () => {
      vi.mocked(repositoriesApi.useGetRepositoriesQuery).mockReturnValue({
        data: {},
        isLoading: false,
        error: undefined,
      } as any);

      const { result } = renderHook(() => useRepositoryData());

      expect(result.current.repositories).toEqual([]);
      expect(result.current.tree).toBeNull();
    });

    it('should handle null repositories data', () => {
      vi.mocked(repositoriesApi.useGetRepositoriesQuery).mockReturnValue({
        data: { repositories: null },
        isLoading: false,
        error: undefined,
      } as any);

      const { result } = renderHook(() => useRepositoryData());

      expect(result.current.repositories).toEqual([]);
    });
  });

  describe('Repository Tree Building', () => {
    it('should build repository tree when data is available', () => {
      vi.mocked(repositoriesApi.useGetRepositoriesQuery).mockReturnValue({
        data: { repositories: [mockRepo1, mockRepo2] },
        isLoading: false,
        error: undefined,
      } as any);

      vi.mocked(tree.buildRepositoryTree).mockReturnValue(mockTreeNode);
      vi.mocked(tree.countRepositories).mockReturnValue(2);

      const { result } = renderHook(() => useRepositoryData());

      expect(tree.buildRepositoryTree).toHaveBeenCalledWith([
        mockRepo1,
        mockRepo2,
      ]);
      expect(result.current.tree).toEqual(mockTreeNode);
    });

    it('should return null tree when no repositories', () => {
      vi.mocked(repositoriesApi.useGetRepositoriesQuery).mockReturnValue({
        data: { repositories: [] },
        isLoading: false,
        error: undefined,
      } as any);

      const { result } = renderHook(() => useRepositoryData());

      expect(result.current.tree).toBeNull();
      expect(tree.buildRepositoryTree).not.toHaveBeenCalled();
    });
  });

  describe('Repository Count', () => {
    it('should count repositories correctly', () => {
      vi.mocked(repositoriesApi.useGetRepositoriesQuery).mockReturnValue({
        data: { repositories: [mockRepo1, mockRepo2] },
        isLoading: false,
        error: undefined,
      } as any);

      vi.mocked(tree.countRepositories).mockReturnValue(2);

      const { result } = renderHook(() => useRepositoryData());

      expect(tree.countRepositories).toHaveBeenCalledWith(mockTreeNode);
      expect(result.current.repoCount).toBe(2);
    });

    it('should return 0 count when tree is null', () => {
      vi.mocked(repositoriesApi.useGetRepositoriesQuery).mockReturnValue({
        data: { repositories: [] },
        isLoading: false,
        error: undefined,
      } as any);

      const { result } = renderHook(() => useRepositoryData());

      expect(result.current.repoCount).toBe(0);
      expect(tree.countRepositories).not.toHaveBeenCalled();
    });
  });

  describe('Repository Selection', () => {
    it('should integrate with useRepositorySelection', () => {
      vi.mocked(repositoriesApi.useGetRepositoriesQuery).mockReturnValue({
        data: { repositories: [mockRepo1, mockRepo2] },
        isLoading: false,
        error: undefined,
      } as any);

      vi.mocked(repositorySelection.useRepositorySelection).mockReturnValue({
        selected: mockRepo1,
        handleSelect: mockHandleSelect,
      });

      const { result } = renderHook(() => useRepositoryData());

      expect(repositorySelection.useRepositorySelection).toHaveBeenCalledWith(
        [mockRepo1, mockRepo2],
        undefined
      );
      expect(result.current.selected).toEqual(mockRepo1);
      expect(result.current.handleSelect).toBe(mockHandleSelect);
    });

    it('should pass onSelect callback to useRepositorySelection', () => {
      vi.mocked(repositoriesApi.useGetRepositoriesQuery).mockReturnValue({
        data: { repositories: [mockRepo1] },
        isLoading: false,
        error: undefined,
      } as any);

      const onSelect = vi.fn();
      renderHook(() => useRepositoryData(onSelect));

      expect(repositorySelection.useRepositorySelection).toHaveBeenCalledWith(
        [mockRepo1],
        onSelect
      );
    });
  });

  describe('Rescanning Repositories', () => {
    it('should expose rescan mutation', () => {
      vi.mocked(repositoriesApi.useGetRepositoriesQuery).mockReturnValue({
        data: { repositories: [mockRepo1] },
        isLoading: false,
        error: undefined,
      } as any);

      const { result } = renderHook(() => useRepositoryData());

      expect(typeof result.current.handleRescan).toBe('function');
    });

    it('should handle rescan successfully', async () => {
      vi.mocked(repositoriesApi.useGetRepositoriesQuery).mockReturnValue({
        data: { repositories: [mockRepo1] },
        isLoading: false,
        error: undefined,
      } as any);

      mockRescan.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ data: {} }),
      });

      const { result } = renderHook(() => useRepositoryData());

      await result.current.handleRescan();

      expect(mockRescan).toHaveBeenCalledWith(undefined);
    });

    it('should handle rescan errors', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      vi.mocked(repositoriesApi.useGetRepositoriesQuery).mockReturnValue({
        data: { repositories: [mockRepo1] },
        isLoading: false,
        error: undefined,
      } as any);

      const error = new Error('Rescan failed');
      mockRescan.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(error),
      });

      const { result } = renderHook(() => useRepositoryData());

      await result.current.handleRescan();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to rescan repositories:',
        error
      );

      consoleErrorSpy.mockRestore();
    });

    it('should track isRescanning state', () => {
      vi.mocked(repositoriesApi.useGetRepositoriesQuery).mockReturnValue({
        data: { repositories: [mockRepo1] },
        isLoading: false,
        error: undefined,
      } as any);

      vi.mocked(repositoriesApi.useRescanRepositoriesMutation).mockReturnValue([
        mockRescan,
        { isLoading: true },
      ] as any);

      const { result } = renderHook(() => useRepositoryData());

      expect(result.current.isRescanning).toBe(true);
    });
  });

  describe('Return Values', () => {
    it('should return all expected properties', () => {
      vi.mocked(repositoriesApi.useGetRepositoriesQuery).mockReturnValue({
        data: { repositories: [mockRepo1] },
        isLoading: false,
        error: undefined,
      } as any);

      vi.mocked(repositorySelection.useRepositorySelection).mockReturnValue({
        selected: mockRepo1,
        handleSelect: mockHandleSelect,
      });

      const { result } = renderHook(() => useRepositoryData());

      expect(result.current).toHaveProperty('repositories');
      expect(result.current).toHaveProperty('tree');
      expect(result.current).toHaveProperty('repoCount');
      expect(result.current).toHaveProperty('selected');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('isRescanning');
      expect(result.current).toHaveProperty('handleSelect');
      expect(result.current).toHaveProperty('handleRescan');
    });

    it('should have correct function types', () => {
      vi.mocked(repositoriesApi.useGetRepositoriesQuery).mockReturnValue({
        data: { repositories: [mockRepo1] },
        isLoading: false,
        error: undefined,
      } as any);

      const { result } = renderHook(() => useRepositoryData());

      expect(typeof result.current.handleSelect).toBe('function');
      expect(typeof result.current.handleRescan).toBe('function');
    });
  });

  describe('Integration', () => {
    it('should coordinate all hooks and utilities', () => {
      vi.mocked(repositoriesApi.useGetRepositoriesQuery).mockReturnValue({
        data: { repositories: [mockRepo1, mockRepo2] },
        isLoading: false,
        error: undefined,
      } as any);

      vi.mocked(repositorySelection.useRepositorySelection).mockReturnValue({
        selected: mockRepo1,
        handleSelect: mockHandleSelect,
      });

      vi.mocked(tree.buildRepositoryTree).mockReturnValue(mockTreeNode);
      vi.mocked(tree.countRepositories).mockReturnValue(2);

      const onSelect = vi.fn();
      const { result } = renderHook(() => useRepositoryData(onSelect));

      // Verify all integrations
      expect(result.current.repositories).toEqual([mockRepo1, mockRepo2]);
      expect(tree.buildRepositoryTree).toHaveBeenCalledWith([
        mockRepo1,
        mockRepo2,
      ]);
      expect(tree.countRepositories).toHaveBeenCalledWith(mockTreeNode);
      expect(repositorySelection.useRepositorySelection).toHaveBeenCalledWith(
        [mockRepo1, mockRepo2],
        onSelect
      );
      expect(result.current.selected).toEqual(mockRepo1);
      expect(result.current.tree).toEqual(mockTreeNode);
      expect(result.current.repoCount).toBe(2);
    });
  });
});
