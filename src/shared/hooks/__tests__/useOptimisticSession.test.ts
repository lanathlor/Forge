import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockDispatch = vi.hoisted(() => vi.fn());
const mockPrefetch = vi.hoisted(() => vi.fn().mockReturnValue({ type: 'sessions/prefetch' }));

vi.mock('@/shared/hooks', () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock('@/features/sessions/store/sessionsApi', () => ({
  sessionsApi: {
    util: {
      prefetch: mockPrefetch,
    },
  },
  useGetActiveSessionQuery: vi.fn().mockReturnValue({
    data: undefined,
    isLoading: false,
    isFetching: false,
    error: undefined,
  }),
}));

import { useOptimisticSession, useOptimisticActiveSession } from '../useOptimisticSession';
import { useGetActiveSessionQuery } from '@/features/sessions/store/sessionsApi';

describe('useOptimisticSession', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    mockPrefetch.mockClear();
  });

  it('should return a prefetchSession function', () => {
    const { result } = renderHook(() => useOptimisticSession());
    expect(typeof result.current.prefetchSession).toBe('function');
  });

  it('should dispatch prefetch action when prefetchSession is called', () => {
    const { result } = renderHook(() => useOptimisticSession());
    result.current.prefetchSession('repo-123');

    expect(mockPrefetch).toHaveBeenCalledWith('getActiveSession', 'repo-123', { ifOlderThan: 60 });
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it('should not dispatch again for the same repo (deduplication)', () => {
    const { result } = renderHook(() => useOptimisticSession());

    result.current.prefetchSession('repo-abc');
    result.current.prefetchSession('repo-abc');

    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it('should dispatch for different repos separately', () => {
    const { result } = renderHook(() => useOptimisticSession());

    result.current.prefetchSession('repo-1');
    result.current.prefetchSession('repo-2');

    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockPrefetch).toHaveBeenCalledWith('getActiveSession', 'repo-1', { ifOlderThan: 60 });
    expect(mockPrefetch).toHaveBeenCalledWith('getActiveSession', 'repo-2', { ifOlderThan: 60 });
  });
});

describe('useOptimisticActiveSession', () => {
  beforeEach(() => {
    vi.mocked(useGetActiveSessionQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: undefined,
    } as unknown as ReturnType<typeof useGetActiveSessionQuery>);
  });

  it('should return null session when no data', () => {
    const { result } = renderHook(() => useOptimisticActiveSession('repo-1'));
    expect(result.current.session).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('should return session when data is available', () => {
    const mockSession = { id: 'session-1', repositoryId: 'repo-1', status: 'active' };
    vi.mocked(useGetActiveSessionQuery).mockReturnValue({
      data: { session: mockSession as never },
      isLoading: false,
      isFetching: false,
      error: undefined,
    } as unknown as ReturnType<typeof useGetActiveSessionQuery>);

    const { result } = renderHook(() => useOptimisticActiveSession('repo-1'));
    expect(result.current.session).toEqual(mockSession);
  });

  it('should show isLoading true only when loading and no cached data', () => {
    vi.mocked(useGetActiveSessionQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      error: undefined,
    } as unknown as ReturnType<typeof useGetActiveSessionQuery>);

    const { result } = renderHook(() => useOptimisticActiveSession('repo-1'));
    expect(result.current.isLoading).toBe(true);
  });

  it('should not show isLoading when loading but has cached data', () => {
    const mockSession = { id: 'session-1', repositoryId: 'repo-1', status: 'active' };
    vi.mocked(useGetActiveSessionQuery).mockReturnValue({
      data: { session: mockSession as never },
      isLoading: true,
      isFetching: true,
      error: undefined,
    } as unknown as ReturnType<typeof useGetActiveSessionQuery>);

    const { result } = renderHook(() => useOptimisticActiveSession('repo-1'));
    // isLoading should be false because we have cached data
    expect(result.current.isLoading).toBe(false);
  });

  it('should skip query when repositoryId is null', () => {
    const { result } = renderHook(() => useOptimisticActiveSession(null));
    expect(result.current.session).toBeNull();
  });

  it('should pass isFetching through directly', () => {
    vi.mocked(useGetActiveSessionQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: true,
      error: undefined,
    } as unknown as ReturnType<typeof useGetActiveSessionQuery>);

    const { result } = renderHook(() => useOptimisticActiveSession('repo-1'));
    expect(result.current.isFetching).toBe(true);
  });
});
