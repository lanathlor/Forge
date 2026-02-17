import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRepositorySelection } from '../useRepositorySelection';
import { storage, STORAGE_KEYS } from '@/shared/lib/localStorage';
import type { Repository } from '@/db/schema';

// Mock the storage module
vi.mock('@/shared/lib/localStorage', () => ({
  storage: {
    get: vi.fn(),
    set: vi.fn(),
  },
  STORAGE_KEYS: {
    SESSION: 'forge_session',
  },
}));

describe('useRepositorySelection', () => {
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

  const mockRepo3: Repository = {
    id: 'repo-3',
    name: 'test-repo-3',
    path: '/path/to/repo3',
    isClean: true,
    currentBranch: 'feature',
    lastCommitSha: null,
    lastCommitMsg: null,
    lastCommitAuthor: null,
    lastCommitTimestamp: null,
    uncommittedFiles: null,
    lastScanned: new Date('2024-01-03'),
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with null when no repositories', () => {
      vi.mocked(storage.get).mockReturnValue(null);

      const { result } = renderHook(() =>
        useRepositorySelection([], undefined)
      );

      expect(result.current.selected).toBeNull();
    });

    it('should select first repository when no persisted selection', async () => {
      vi.mocked(storage.get).mockReturnValue(null);

      const { result } = renderHook(() =>
        useRepositorySelection([mockRepo1, mockRepo2], undefined)
      );

      await waitFor(() => {
        expect(result.current.selected).toEqual(mockRepo1);
      });
    });

    it('should select persisted repository from localStorage', async () => {
      vi.mocked(storage.get).mockReturnValue({
        currentRepositoryId: 'repo-2',
      });

      const { result } = renderHook(() =>
        useRepositorySelection([mockRepo1, mockRepo2, mockRepo3], undefined)
      );

      await waitFor(() => {
        expect(result.current.selected).toEqual(mockRepo2);
      });
    });

    it('should fallback to first repository if persisted ID not found', async () => {
      vi.mocked(storage.get).mockReturnValue({
        currentRepositoryId: 'non-existent-id',
      });

      const { result } = renderHook(() =>
        useRepositorySelection([mockRepo1, mockRepo2], undefined)
      );

      await waitFor(() => {
        expect(result.current.selected).toEqual(mockRepo1);
      });
    });

    it('should handle empty session data gracefully', async () => {
      vi.mocked(storage.get).mockReturnValue({});

      const { result } = renderHook(() =>
        useRepositorySelection([mockRepo1], undefined)
      );

      await waitFor(() => {
        expect(result.current.selected).toEqual(mockRepo1);
      });
    });
  });

  describe('onSelect Callback', () => {
    it('should call onSelect callback on initial selection', async () => {
      vi.mocked(storage.get).mockReturnValue(null);
      const onSelect = vi.fn();

      renderHook(() => useRepositorySelection([mockRepo1], onSelect));

      await waitFor(() => {
        expect(onSelect).toHaveBeenCalledWith(mockRepo1);
      });
    });

    it('should call onSelect callback with persisted repository', async () => {
      vi.mocked(storage.get).mockReturnValue({
        currentRepositoryId: 'repo-2',
      });
      const onSelect = vi.fn();

      renderHook(() =>
        useRepositorySelection([mockRepo1, mockRepo2], onSelect)
      );

      await waitFor(() => {
        expect(onSelect).toHaveBeenCalledWith(mockRepo2);
      });
    });

    it('should not call onSelect when no repository is selected', async () => {
      vi.mocked(storage.get).mockReturnValue(null);
      const onSelect = vi.fn();

      renderHook(() => useRepositorySelection([], onSelect));

      await waitFor(() => {
        expect(onSelect).not.toHaveBeenCalled();
      });
    });
  });

  describe('handleSelect', () => {
    it('should update selected repository', async () => {
      vi.mocked(storage.get).mockReturnValue(null);

      const { result } = renderHook(() =>
        useRepositorySelection([mockRepo1, mockRepo2], undefined)
      );

      await waitFor(() => {
        expect(result.current.selected).toEqual(mockRepo1);
      });

      act(() => {
        result.current.handleSelect(mockRepo2);
      });

      expect(result.current.selected).toEqual(mockRepo2);
    });

    it('should call onSelect callback when manually selecting', async () => {
      vi.mocked(storage.get).mockReturnValue(null);
      const onSelect = vi.fn();

      const { result } = renderHook(() =>
        useRepositorySelection([mockRepo1, mockRepo2], onSelect)
      );

      await waitFor(() => {
        expect(result.current.selected).toEqual(mockRepo1);
      });

      onSelect.mockClear();

      act(() => {
        result.current.handleSelect(mockRepo2);
      });

      expect(onSelect).toHaveBeenCalledWith(mockRepo2);
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple selections', async () => {
      vi.mocked(storage.get).mockReturnValue(null);

      const { result } = renderHook(() =>
        useRepositorySelection([mockRepo1, mockRepo2, mockRepo3], undefined)
      );

      await waitFor(() => {
        expect(result.current.selected).toEqual(mockRepo1);
      });

      act(() => {
        result.current.handleSelect(mockRepo2);
      });
      expect(result.current.selected).toEqual(mockRepo2);

      act(() => {
        result.current.handleSelect(mockRepo3);
      });
      expect(result.current.selected).toEqual(mockRepo3);

      act(() => {
        result.current.handleSelect(mockRepo1);
      });
      expect(result.current.selected).toEqual(mockRepo1);
    });

    it('should work without onSelect callback', async () => {
      vi.mocked(storage.get).mockReturnValue(null);

      const { result } = renderHook(() =>
        useRepositorySelection([mockRepo1, mockRepo2], undefined)
      );

      await waitFor(() => {
        expect(result.current.selected).toEqual(mockRepo1);
      });

      expect(() => {
        act(() => {
          result.current.handleSelect(mockRepo2);
        });
      }).not.toThrow();
      expect(result.current.selected).toEqual(mockRepo2);
    });
  });

  describe('Re-initialization Prevention', () => {
    it('should not re-initialize when repositories array changes reference', async () => {
      vi.mocked(storage.get).mockReturnValue(null);
      const onSelect = vi.fn();

      const { result, rerender } = renderHook(
        ({ repos }) => useRepositorySelection(repos, onSelect),
        { initialProps: { repos: [mockRepo1, mockRepo2] } }
      );

      await waitFor(() => {
        expect(result.current.selected).toEqual(mockRepo1);
      });

      expect(onSelect).toHaveBeenCalledTimes(1);

      // Manually select a different repository
      act(() => {
        result.current.handleSelect(mockRepo2);
      });
      expect(result.current.selected).toEqual(mockRepo2);
      expect(onSelect).toHaveBeenCalledTimes(2);

      // Rerender with new array reference but same content
      rerender({ repos: [mockRepo1, mockRepo2] });

      // Should maintain selection and not call onSelect again
      expect(result.current.selected).toEqual(mockRepo2);
      expect(onSelect).toHaveBeenCalledTimes(2);
    });

    it('should not re-initialize when repositories length stays the same', async () => {
      vi.mocked(storage.get).mockReturnValue(null);

      const { result, rerender } = renderHook(
        ({ repos }) => useRepositorySelection(repos, undefined),
        { initialProps: { repos: [mockRepo1] } }
      );

      await waitFor(() => {
        expect(result.current.selected).toEqual(mockRepo1);
      });

      // Rerender with different repository but same length
      rerender({ repos: [mockRepo2] });

      // Should maintain the old selection
      expect(result.current.selected).toEqual(mockRepo1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single repository', async () => {
      vi.mocked(storage.get).mockReturnValue(null);

      const { result } = renderHook(() =>
        useRepositorySelection([mockRepo1], undefined)
      );

      await waitFor(() => {
        expect(result.current.selected).toEqual(mockRepo1);
      });
    });

    it('should handle localStorage returning null', async () => {
      vi.mocked(storage.get).mockReturnValue(null);

      const { result } = renderHook(() =>
        useRepositorySelection([mockRepo1, mockRepo2], undefined)
      );

      await waitFor(() => {
        expect(result.current.selected).toEqual(mockRepo1);
      });
    });

    it('should handle localStorage returning undefined currentRepositoryId', async () => {
      vi.mocked(storage.get).mockReturnValue({
        currentRepositoryId: undefined,
      });

      const { result } = renderHook(() =>
        useRepositorySelection([mockRepo1, mockRepo2], undefined)
      );

      await waitFor(() => {
        expect(result.current.selected).toEqual(mockRepo1);
      });
    });

    it('should handle repository at end of list', async () => {
      vi.mocked(storage.get).mockReturnValue({
        currentRepositoryId: 'repo-3',
      });

      const { result } = renderHook(() =>
        useRepositorySelection([mockRepo1, mockRepo2, mockRepo3], undefined)
      );

      await waitFor(() => {
        expect(result.current.selected).toEqual(mockRepo3);
      });
    });
  });

  describe('Storage Integration', () => {
    it('should call storage.get with correct key', async () => {
      vi.mocked(storage.get).mockReturnValue(null);

      renderHook(() => useRepositorySelection([mockRepo1], undefined));

      await waitFor(() => {
        expect(storage.get).toHaveBeenCalledWith(STORAGE_KEYS.SESSION);
      });
    });

    it('should handle storage.get throwing error', async () => {
      // When storage.get throws, the hook will crash - this is expected behavior
      // as there's no error handling in the current implementation
      vi.mocked(storage.get).mockImplementation(() => {
        throw new Error('Storage error');
      });

      // The hook should throw when storage.get fails
      expect(() => {
        renderHook(() => useRepositorySelection([mockRepo1], undefined));
      }).toThrow('Storage error');
    });
  });

  describe('Type Safety', () => {
    it('should maintain correct repository type', async () => {
      vi.mocked(storage.get).mockReturnValue(null);

      const { result } = renderHook(() =>
        useRepositorySelection([mockRepo1], undefined)
      );

      await waitFor(() => {
        expect(result.current.selected).toBeDefined();
      });

      if (result.current.selected) {
        expect(result.current.selected.id).toBe('repo-1');
        expect(result.current.selected.name).toBe('test-repo-1');
        expect(result.current.selected.path).toBe('/path/to/repo1');
        expect(result.current.selected.isClean).toBe(true);
        expect(result.current.selected.currentBranch).toBe('main');
        expect(result.current.selected.createdAt).toBeInstanceOf(Date);
        expect(result.current.selected.updatedAt).toBeInstanceOf(Date);
      }
    });
  });
});
