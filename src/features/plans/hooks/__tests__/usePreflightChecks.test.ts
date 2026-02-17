import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePreflightChecks } from '../usePreflightChecks';

// Mock the RTK Query hook
const mockUseGetRepositoryQuery = vi.fn();
vi.mock('@/features/repositories/store/repositoriesApi', () => ({
  useGetRepositoryQuery: (...args: unknown[]) =>
    mockUseGetRepositoryQuery(...args),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('usePreflightChecks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetRepositoryQuery.mockReturnValue({ data: undefined });
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  });

  it('should initialize with empty checks when disabled', () => {
    const { result } = renderHook(() =>
      usePreflightChecks({
        repositoryId: 'repo-1',
        planId: 'plan-1',
        enabled: false,
      })
    );

    expect(result.current.checks).toEqual([]);
    expect(result.current.isReady).toBe(false);
    expect(result.current.isChecking).toBe(false);
  });

  it('should run checks when enabled and repo data is available', async () => {
    mockUseGetRepositoryQuery.mockReturnValue({
      data: { repository: { name: 'my-repo', isClean: true } },
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/qa-gates')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ config: { qaGates: [{ name: 'test' }] } }),
        });
      }
      if (url.includes('/api/plans/')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              plan: { status: 'ready', totalTasks: 5, totalPhases: 2 },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const { result } = renderHook(() =>
      usePreflightChecks({
        repositoryId: 'repo-1',
        planId: 'plan-1',
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.checks).toHaveLength(4);
    expect(result.current.checks[0]!.status).toBe('pass'); // repo
    expect(result.current.checks[1]!.status).toBe('pass'); // clean
    expect(result.current.checks[2]!.status).toBe('pass'); // gates
    expect(result.current.checks[3]!.status).toBe('pass'); // plan
    expect(result.current.isReady).toBe(true);
  });

  it('should fail repo check when repo not found', async () => {
    mockUseGetRepositoryQuery.mockReturnValue({
      data: { repository: undefined },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          config: { qaGates: [] },
          plan: { status: 'ready', totalTasks: 1, totalPhases: 1 },
        }),
    });

    const { result } = renderHook(() =>
      usePreflightChecks({
        repositoryId: 'repo-1',
        planId: 'plan-1',
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.checks[0]!.status).toBe('fail');
    expect(result.current.checks[0]!.detail).toBe('Repository not found');
    expect(result.current.checks[1]!.status).toBe('fail');
    expect(result.current.checks[1]!.detail).toBe(
      'Cannot check - repo not found'
    );
    expect(result.current.isReady).toBe(false);
  });

  it('should warn when repo is not clean', async () => {
    mockUseGetRepositoryQuery.mockReturnValue({
      data: { repository: { name: 'my-repo', isClean: false } },
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/qa-gates')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ config: { qaGates: [{ name: 'test' }] } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            plan: { status: 'ready', totalTasks: 1, totalPhases: 1 },
          }),
      });
    });

    const { result } = renderHook(() =>
      usePreflightChecks({
        repositoryId: 'repo-1',
        planId: 'plan-1',
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.checks[1]!.status).toBe('warn');
    expect(result.current.checks[1]!.detail).toBe(
      'Uncommitted changes detected'
    );
    // warn is still considered ready
    expect(result.current.isReady).toBe(true);
  });

  it('should warn when no QA gates configured', async () => {
    mockUseGetRepositoryQuery.mockReturnValue({
      data: { repository: { name: 'my-repo', isClean: true } },
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/qa-gates')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ config: { qaGates: [] } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            plan: { status: 'ready', totalTasks: 1, totalPhases: 1 },
          }),
      });
    });

    const { result } = renderHook(() =>
      usePreflightChecks({
        repositoryId: 'repo-1',
        planId: 'plan-1',
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.checks[2]!.status).toBe('warn');
    expect(result.current.checks[2]!.detail).toBe('No QA gates configured');
  });

  it('should warn when QA gates API returns non-ok response', async () => {
    mockUseGetRepositoryQuery.mockReturnValue({
      data: { repository: { name: 'my-repo', isClean: true } },
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/qa-gates')) {
        return Promise.resolve({ ok: false });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            plan: { status: 'ready', totalTasks: 1, totalPhases: 1 },
          }),
      });
    });

    const { result } = renderHook(() =>
      usePreflightChecks({
        repositoryId: 'repo-1',
        planId: 'plan-1',
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.checks[2]!.status).toBe('warn');
    expect(result.current.checks[2]!.detail).toBe('Could not load QA config');
  });

  it('should warn when QA gates fetch throws', async () => {
    mockUseGetRepositoryQuery.mockReturnValue({
      data: { repository: { name: 'my-repo', isClean: true } },
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/qa-gates')) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            plan: { status: 'ready', totalTasks: 1, totalPhases: 1 },
          }),
      });
    });

    const { result } = renderHook(() =>
      usePreflightChecks({
        repositoryId: 'repo-1',
        planId: 'plan-1',
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.checks[2]!.status).toBe('warn');
    expect(result.current.checks[2]!.detail).toBe('QA check failed');
  });

  it('should warn when plan is in draft status', async () => {
    mockUseGetRepositoryQuery.mockReturnValue({
      data: { repository: { name: 'my-repo', isClean: true } },
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/qa-gates')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ config: { qaGates: [{ name: 'test' }] } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            plan: { status: 'draft', totalTasks: 1, totalPhases: 1 },
          }),
      });
    });

    const { result } = renderHook(() =>
      usePreflightChecks({
        repositoryId: 'repo-1',
        planId: 'plan-1',
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.checks[3]!.status).toBe('warn');
    expect(result.current.checks[3]!.detail).toBe(
      'Plan is still in draft - will be auto-readied'
    );
  });

  it('should fail when plan has unexpected status', async () => {
    mockUseGetRepositoryQuery.mockReturnValue({
      data: { repository: { name: 'my-repo', isClean: true } },
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/qa-gates')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ config: { qaGates: [{ name: 'test' }] } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            plan: { status: 'failed', totalTasks: 1, totalPhases: 1 },
          }),
      });
    });

    const { result } = renderHook(() =>
      usePreflightChecks({
        repositoryId: 'repo-1',
        planId: 'plan-1',
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.checks[3]!.status).toBe('fail');
    expect(result.current.checks[3]!.detail).toBe('Plan status: failed');
    expect(result.current.isReady).toBe(false);
  });

  it('should fail when plan API returns non-ok', async () => {
    mockUseGetRepositoryQuery.mockReturnValue({
      data: { repository: { name: 'my-repo', isClean: true } },
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/qa-gates')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ config: { qaGates: [{ name: 'test' }] } }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    const { result } = renderHook(() =>
      usePreflightChecks({
        repositoryId: 'repo-1',
        planId: 'plan-1',
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.checks[3]!.status).toBe('fail');
    expect(result.current.checks[3]!.detail).toBe('Plan not found');
  });

  it('should fail when plan fetch throws', async () => {
    mockUseGetRepositoryQuery.mockReturnValue({
      data: { repository: { name: 'my-repo', isClean: true } },
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/qa-gates')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ config: { qaGates: [{ name: 'test' }] } }),
        });
      }
      return Promise.reject(new Error('Network error'));
    });

    const { result } = renderHook(() =>
      usePreflightChecks({
        repositoryId: 'repo-1',
        planId: 'plan-1',
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.checks[3]!.status).toBe('fail');
    expect(result.current.checks[3]!.detail).toBe('Could not verify plan');
  });

  it('should handle singular gate count text', async () => {
    mockUseGetRepositoryQuery.mockReturnValue({
      data: { repository: { name: 'my-repo', isClean: true } },
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/qa-gates')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ config: { qaGates: [{ name: 'test' }] } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            plan: { status: 'ready', totalTasks: 1, totalPhases: 1 },
          }),
      });
    });

    const { result } = renderHook(() =>
      usePreflightChecks({
        repositoryId: 'repo-1',
        planId: 'plan-1',
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.checks[2]!.detail).toBe('1 gate active');
  });

  it('should handle multiple gates count text', async () => {
    mockUseGetRepositoryQuery.mockReturnValue({
      data: { repository: { name: 'my-repo', isClean: true } },
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/qa-gates')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              config: {
                qaGates: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            plan: { status: 'ready', totalTasks: 1, totalPhases: 1 },
          }),
      });
    });

    const { result } = renderHook(() =>
      usePreflightChecks({
        repositoryId: 'repo-1',
        planId: 'plan-1',
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.checks[2]!.detail).toBe('3 gates active');
  });
});
