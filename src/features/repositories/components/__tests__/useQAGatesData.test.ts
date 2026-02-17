import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useQAGatesData } from '../useQAGatesData';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useQAGatesData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('returns initial loading state', () => {
      mockFetch.mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          })
      );

      const { result } = renderHook(() => useQAGatesData('repo-1'));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.config).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.runStatus).toBeNull();
      expect(result.current.isRunning).toBe(false);
    });
  });

  describe('Config Loading', () => {
    it('fetches config on mount', async () => {
      const mockConfig = {
        repository: {
          id: 'repo-1',
          name: 'test-repo',
          path: '/path',
          isClean: true,
          currentBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        config: {
          version: '1.0.0',
          maxRetries: 2,
          qaGates: [],
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockConfig,
      });

      const { result } = renderHook(() => useQAGatesData('repo-1'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/repositories/repo-1/qa-gates'
      );
      expect(result.current.config).toEqual(mockConfig);
      expect(result.current.error).toBeNull();
    });

    it('handles config fetch errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const { result } = renderHook(() => useQAGatesData('repo-1'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe(
        'Failed to fetch QA gates configuration'
      );
      expect(result.current.config).toBeNull();
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useQAGatesData('repo-1'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.config).toBeNull();
    });

    it('handles non-Error exceptions', async () => {
      mockFetch.mockRejectedValue('String error');

      const { result } = renderHook(() => useQAGatesData('repo-1'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Unknown error');
    });
  });

  describe('Status Fetching', () => {
    it('fetches status after config is loaded', async () => {
      const mockConfig = {
        repository: {
          id: 'repo-1',
          name: 'test-repo',
          path: '/path',
          isClean: true,
          currentBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        config: {
          version: '1.0.0',
          maxRetries: 2,
          qaGates: [],
        },
      };

      const mockStatus = {
        run: {
          id: 'run-1',
          repositoryId: 'repo-1',
          status: 'passed' as const,
          startedAt: new Date(),
          createdAt: new Date(),
        },
        gates: [],
        hasRun: true,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfig,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStatus,
        });

      const { result } = renderHook(() => useQAGatesData('repo-1'));

      await waitFor(() => {
        expect(result.current.config).not.toBeNull();
      });

      await waitFor(() => {
        expect(result.current.runStatus).not.toBeNull();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/repositories/repo-1/qa-gates/status',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(result.current.runStatus).toEqual(mockStatus);
    });

    it('does not fetch status before config is loaded', async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          })
      );

      renderHook(() => useQAGatesData('repo-1'));

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should only have called config endpoint
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/repositories/repo-1/qa-gates'
      );
    });

    it('handles status fetch errors silently', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const mockConfig = {
        repository: {
          id: 'repo-1',
          name: 'test-repo',
          path: '/path',
          isClean: true,
          currentBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        config: {
          version: '1.0.0',
          maxRetries: 2,
          qaGates: [],
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfig,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

      const { result } = renderHook(() => useQAGatesData('repo-1'));

      await waitFor(() => {
        expect(result.current.config).not.toBeNull();
      });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[QAGatesStatus] Error fetching status:',
          expect.any(Error)
        );
      });

      // Error should not propagate to main error state
      expect(result.current.error).toBeNull();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Running Status Polling', () => {
    it('sets isRunning to true when status is running', async () => {
      const mockConfig = {
        repository: {
          id: 'repo-1',
          name: 'test-repo',
          path: '/path',
          isClean: true,
          currentBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        config: {
          version: '1.0.0',
          maxRetries: 2,
          qaGates: [],
        },
      };

      const mockRunningStatus = {
        run: {
          id: 'run-1',
          repositoryId: 'repo-1',
          status: 'running' as const,
          startedAt: new Date(),
          createdAt: new Date(),
        },
        gates: [],
        hasRun: true,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfig,
        })
        .mockResolvedValue({
          ok: true,
          json: async () => mockRunningStatus,
        });

      const { result } = renderHook(() => useQAGatesData('repo-1'));

      await waitFor(() => {
        expect(result.current.runStatus?.run?.status).toBe('running');
      });

      expect(result.current.isRunning).toBe(true);
    });

    it('sets isRunning to false when status is not running', async () => {
      const mockConfig = {
        repository: {
          id: 'repo-1',
          name: 'test-repo',
          path: '/path',
          isClean: true,
          currentBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        config: {
          version: '1.0.0',
          maxRetries: 2,
          qaGates: [],
        },
      };

      const mockCompletedStatus = {
        run: {
          id: 'run-1',
          repositoryId: 'repo-1',
          status: 'passed' as const,
          startedAt: new Date(),
          createdAt: new Date(),
        },
        gates: [],
        hasRun: true,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfig,
        })
        .mockResolvedValue({
          ok: true,
          json: async () => mockCompletedStatus,
        });

      const { result } = renderHook(() => useQAGatesData('repo-1'));

      await waitFor(() => {
        expect(result.current.runStatus?.run?.status).toBe('passed');
      });

      expect(result.current.isRunning).toBe(false);
    });
  });

  describe('Run QA Gates', () => {
    it('starts QA gates run', async () => {
      const mockConfig = {
        repository: {
          id: 'repo-1',
          name: 'test-repo',
          path: '/path',
          isClean: true,
          currentBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        config: {
          version: '1.0.0',
          maxRetries: 2,
          qaGates: [],
        },
      };

      const mockStatus = {
        run: {
          id: 'run-1',
          repositoryId: 'repo-1',
          status: 'passed' as const,
          startedAt: new Date(),
          createdAt: new Date(),
        },
        gates: [],
        hasRun: false,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfig,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStatus,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStatus,
        });

      const { result } = renderHook(() => useQAGatesData('repo-1'));

      await waitFor(() => {
        expect(result.current.config).not.toBeNull();
      });

      await act(async () => {
        await result.current.runQAGates();
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/repositories/repo-1/qa-gates/run',
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('handles run QA gates errors', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const mockConfig = {
        repository: {
          id: 'repo-1',
          name: 'test-repo',
          path: '/path',
          isClean: true,
          currentBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        config: {
          version: '1.0.0',
          maxRetries: 2,
          qaGates: [],
        },
      };

      const mockStatus = {
        run: null,
        gates: [],
        hasRun: false,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfig,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStatus,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

      const { result } = renderHook(() => useQAGatesData('repo-1'));

      await waitFor(() => {
        expect(result.current.config).not.toBeNull();
      });

      await result.current.runQAGates();

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to start QA gates run');
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error running QA gates:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('handles non-Error exceptions in runQAGates', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const mockConfig = {
        repository: {
          id: 'repo-1',
          name: 'test-repo',
          path: '/path',
          isClean: true,
          currentBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        config: {
          version: '1.0.0',
          maxRetries: 2,
          qaGates: [],
        },
      };

      const mockStatus = {
        run: null,
        gates: [],
        hasRun: false,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfig,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStatus,
        })
        .mockRejectedValueOnce('String error');

      const { result } = renderHook(() => useQAGatesData('repo-1'));

      await waitFor(() => {
        expect(result.current.config).not.toBeNull();
      });

      await result.current.runQAGates();

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to start QA gates');
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Fetch Status Function', () => {
    it('exposes fetchStatus function', async () => {
      const mockConfig = {
        repository: {
          id: 'repo-1',
          name: 'test-repo',
          path: '/path',
          isClean: true,
          currentBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        config: {
          version: '1.0.0',
          maxRetries: 2,
          qaGates: [],
        },
      };

      const mockStatus = {
        run: null,
        gates: [],
        hasRun: false,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfig,
        })
        .mockResolvedValue({
          ok: true,
          json: async () => mockStatus,
        });

      const { result } = renderHook(() => useQAGatesData('repo-1'));

      await waitFor(() => {
        expect(result.current.config).not.toBeNull();
      });

      expect(typeof result.current.fetchStatus).toBe('function');

      mockFetch.mockClear();

      await act(async () => {
        await result.current.fetchStatus();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/repositories/repo-1/qa-gates/status',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });

  describe('Error Prioritization', () => {
    it('prioritizes config error over run error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const { result } = renderHook(() => useQAGatesData('repo-1'));

      await waitFor(() => {
        expect(result.current.error).toBe(
          'Failed to fetch QA gates configuration'
        );
      });
    });
  });

  describe('Gate Mutations', () => {
    it('reorders gates correctly', async () => {
      const mockConfig = {
        repository: {
          id: 'repo-1',
          name: 'test-repo',
          path: '/path',
          isClean: true,
          currentBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        config: {
          version: '1.0.0',
          maxRetries: 2,
          qaGates: [
            {
              name: 'gate1',
              command: 'test1',
              timeout: 1000,
              enabled: true,
              failOnError: true,
              order: 1,
            },
            {
              name: 'gate2',
              command: 'test2',
              timeout: 1000,
              enabled: true,
              failOnError: true,
              order: 2,
            },
            {
              name: 'gate3',
              command: 'test3',
              timeout: 1000,
              enabled: true,
              failOnError: true,
              order: 3,
            },
          ],
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfig,
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ run: null, gates: [], hasRun: false }),
        });

      const { result } = renderHook(() => useQAGatesData('repo-1'));

      await waitFor(() => {
        expect(result.current.config).not.toBeNull();
      });

      act(() => {
        result.current.reorderGates(0, 2); // Move first to last
      });

      expect(result.current.gates?.[0]?.name).toBe('gate2');
      expect(result.current.gates?.[1]?.name).toBe('gate3');
      expect(result.current.gates?.[2]?.name).toBe('gate1');
    });

    it('handles saveConfig when config is null', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const { result } = renderHook(() => useQAGatesData('repo-1'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Config is null, saveConfig should return early
      await act(async () => {
        await result.current.saveConfig();
      });

      // Should not have made any save requests
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/qa-gates/save'),
        expect.anything()
      );
    });
  });

  describe('Timeout Handling', () => {
    it('handles AbortError in runQAGates', async () => {
      const mockConfig = {
        repository: {
          id: 'repo-1',
          name: 'test-repo',
          path: '/path',
          isClean: true,
          currentBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        config: {
          version: '1.0.0',
          maxRetries: 2,
          qaGates: [],
        },
      };

      const mockStatus = {
        run: null,
        gates: [],
        hasRun: false,
      };

      const abortError = new Error('The user aborted a request.');
      abortError.name = 'AbortError';

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfig,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStatus,
        })
        .mockRejectedValueOnce(abortError);

      const { result } = renderHook(() => useQAGatesData('repo-1'));

      await waitFor(() => {
        expect(result.current.config).not.toBeNull();
      });

      await result.current.runQAGates();

      await waitFor(() => {
        expect(result.current.error).toBe(
          'Request timed out - please try again'
        );
      });
    });
  });

  describe('Repository ID Changes', () => {
    it('refetches config when repository ID changes', async () => {
      const mockConfig1 = {
        repository: {
          id: 'repo-1',
          name: 'test-repo-1',
          path: '/path1',
          isClean: true,
          currentBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        config: {
          version: '1.0.0',
          maxRetries: 2,
          qaGates: [],
        },
      };

      const mockConfig2 = {
        repository: {
          id: 'repo-2',
          name: 'test-repo-2',
          path: '/path2',
          isClean: true,
          currentBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        config: {
          version: '1.0.0',
          maxRetries: 2,
          qaGates: [],
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfig1,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ run: null, gates: [], hasRun: false }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfig2,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ run: null, gates: [], hasRun: false }),
        });

      const { result, rerender } = renderHook(
        ({ repoId }) => useQAGatesData(repoId),
        { initialProps: { repoId: 'repo-1' } }
      );

      await waitFor(() => {
        expect(result.current.config?.repository.id).toBe('repo-1');
      });

      rerender({ repoId: 'repo-2' });

      await waitFor(() => {
        expect(result.current.config?.repository.id).toBe('repo-2');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/repositories/repo-2/qa-gates'
      );
    });
  });
});
