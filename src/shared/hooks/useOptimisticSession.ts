'use client';

import { useCallback, useRef } from 'react';
import { useAppDispatch } from '@/shared/hooks';
import { sessionsApi, useGetActiveSessionQuery } from '@/features/sessions/store/sessionsApi';

/**
 * useOptimisticSession
 *
 * Provides instant cached state when switching between repositories.
 * Instead of waiting for the API to respond with the session, this hook
 * pre-warms the RTK cache with the most recently known session data,
 * so the UI shows content immediately on repo switch.
 *
 * Usage:
 * ```tsx
 * const { prefetchSession } = useOptimisticSession();
 *
 * // On hover over a repo: pre-fetch so switch is instant
 * onHover={() => prefetchSession(repoId)}
 * ```
 */
export function useOptimisticSession() {
  const dispatch = useAppDispatch();
  // Track which repos we've already prefetched to avoid duplicate requests
  const prefetchedRepos = useRef<Set<string>>(new Set());

  /**
   * Prefetch a session for a repository so it's cached when the user switches to it.
   * Call on hover or when you anticipate the user will switch to this repo.
   * Uses RTK Query's prefetch action which respects cache TTL (60s).
   */
  const prefetchSession = useCallback((repositoryId: string) => {
    if (prefetchedRepos.current.has(repositoryId)) return;
    prefetchedRepos.current.add(repositoryId);

    // Use sessionsApi prefetch — won't re-fetch if cache is fresh within 60s
    dispatch(
      sessionsApi.util.prefetch('getActiveSession', repositoryId, {
        ifOlderThan: 60,
      }),
    );
  }, [dispatch]);

  return {
    prefetchSession,
  };
}

/**
 * useOptimisticActiveSession
 *
 * A simpler hook that wraps getActiveSession with optimistic behavior:
 * - Shows cached data immediately
 * - Fetches fresh data in background
 * - Never shows a blank loading state if we have any cached data
 */
export function useOptimisticActiveSession(repositoryId: string | null) {
  const {
    data,
    isLoading,
    isFetching,
    error,
  } = useGetActiveSessionQuery(repositoryId ?? '', {
    skip: !repositoryId,
    // Keep previous data visible while refetching (no flicker on repo switch)
    // RTK Query does this by default with selectFromResult
  });

  return {
    session: data?.session ?? null,
    // Only show loading spinner if we have NO cached data at all
    isLoading: isLoading && !data,
    // isFetching includes background refreshes (shows subtle indicator)
    isFetching,
    error,
  };
}
