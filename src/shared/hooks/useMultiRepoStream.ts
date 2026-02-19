'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  useSSESubscription,
  useSSEConnected,
  useSSEStatus,
} from '@/shared/contexts/SSEContext';

export type ClaudeStatus =
  | 'idle'
  | 'thinking'
  | 'writing'
  | 'waiting_input'
  | 'stuck'
  | 'paused';

export interface RepoSessionState {
  repositoryId: string;
  repositoryName: string;
  sessionId: string | null;
  sessionStatus: 'active' | 'paused' | 'completed' | 'abandoned' | null;
  claudeStatus: ClaudeStatus;
  currentTask: {
    id: string;
    prompt: string;
    status: string;
    progress?: number;
  } | null;
  timeElapsed: number;
  lastActivity: string;
  needsAttention: boolean;
}

export interface MultiRepoUpdate {
  type: 'connected' | 'repo_update' | 'bulk_update';
  repositories?: RepoSessionState[];
  repository?: RepoSessionState;
  timestamp: string;
}

interface UseMultiRepoStreamReturn {
  repositories: RepoSessionState[];
  connected: boolean;
  error: string | null;
  reconnect: () => void;
  lastUpdated: string | null;
}

type SetRepos = React.Dispatch<React.SetStateAction<RepoSessionState[]>>;
type SetUpdated = React.Dispatch<React.SetStateAction<string | null>>;

function upsertRepo(
  prev: RepoSessionState[],
  updated: RepoSessionState
): RepoSessionState[] {
  const idx = prev.findIndex((r) => r.repositoryId === updated.repositoryId);
  if (idx >= 0) {
    const next = [...prev];
    next[idx] = updated;
    return next;
  }
  return [...prev, updated];
}

function useConnectedSubscription(setRepos: SetRepos, setUpdated: SetUpdated) {
  useSSESubscription<{ repositories?: RepoSessionState[] }>(
    'unified',
    'connected',
    (event) => {
      console.log('[useMultiRepoStream] Received connected event:', {
        hasData: !!event.data,
        hasRepositories: !!event.data?.repositories,
        repoCount: event.data?.repositories?.length,
        eventType: event.type,
        timestamp: event.timestamp,
      });
      if (event.data?.repositories) {
        console.log('[useMultiRepoStream] Setting repositories:', event.data.repositories.length);
        setRepos(event.data.repositories);
        setUpdated(new Date().toISOString());
      } else {
        console.warn('[useMultiRepoStream] Connected event has no repositories!', event);
      }
    },
    []
  );
}

function useBulkUpdateSubscription(setRepos: SetRepos, setUpdated: SetUpdated) {
  useSSESubscription<{ repositories?: RepoSessionState[]; timestamp?: string }>(
    'unified',
    'bulk_update',
    (event) => {
      console.log('[useMultiRepoStream] Received bulk_update event:', {
        hasData: !!event.data,
        hasRepositories: !!event.data?.repositories,
        repoCount: event.data?.repositories?.length,
      });
      if (event.data?.repositories) {
        setRepos(event.data.repositories);
        setUpdated(event.data.timestamp ?? new Date().toISOString());
      }
    },
    []
  );
}

function useRepoUpdateSubscription(setRepos: SetRepos, setUpdated: SetUpdated) {
  useSSESubscription<{ repository?: RepoSessionState; timestamp?: string }>(
    'unified',
    'repo_update',
    (event) => {
      if (!event.data?.repository) return;
      setRepos((prev) => upsertRepo(prev, event.data.repository!));
      setUpdated(event.data.timestamp ?? new Date().toISOString());
    },
    []
  );
}

function useTaskUpdateRepoSubscription(
  setRepos: SetRepos,
  setUpdated: SetUpdated
) {
  useSSESubscription<{ repository?: RepoSessionState; timestamp?: string }>(
    'unified',
    'task_update',
    (event) => {
      if (!event.data?.repository) return;
      setRepos((prev) => upsertRepo(prev, event.data.repository!));
      setUpdated(event.data.timestamp ?? new Date().toISOString());
    },
    []
  );
}

interface RepositoryApiResponse {
  id: string;
  name: string;
  updatedAt?: string;
}

async function fetchRepositoriesFromApi(
  setRepositories: SetRepos,
  setLastUpdated: SetUpdated
): Promise<void> {
  console.log('[useMultiRepoStream] No SSE data received, falling back to REST API fetch');

  try {
    const response = await fetch('/api/repositories');
    if (!response.ok) {
      console.error('[useMultiRepoStream] Failed to fetch repositories:', response.statusText);
      return;
    }

    const data = await response.json();
    console.log('[useMultiRepoStream] REST API fetch result:', {
      hasRepos: !!data.repositories,
      count: data.repositories?.length || 0,
    });

    if (data.repositories && Array.isArray(data.repositories)) {
      // Transform repository data to RepoSessionState format
      const repoStates: RepoSessionState[] = data.repositories.map((repo: RepositoryApiResponse) => ({
        repositoryId: repo.id,
        repositoryName: repo.name,
        sessionId: null,
        sessionStatus: null,
        claudeStatus: 'idle' as ClaudeStatus,
        currentTask: null,
        timeElapsed: 0,
        lastActivity: repo.updatedAt || new Date().toISOString(),
        needsAttention: false,
      }));

      console.log('[useMultiRepoStream] Setting repositories from REST API:', repoStates.length);
      setRepositories(repoStates);
      setLastUpdated(new Date().toISOString());
    }
  } catch (error) {
    console.error('[useMultiRepoStream] Failed to fetch repositories via REST API:', error);
  }
}

/**
 * Hook for monitoring status of multiple repositories.
 *
 * Uses the GlobalSSEManager unified connection (already established by SSEProvider)
 * instead of opening a separate EventSource. This eliminates duplicate connections
 * and ensures all repo updates flow through the single shared SSE stream.
 *
 * Includes fallback REST API polling to handle cases where SSE events are missed
 * due to race conditions during initial page load.
 */
export function useMultiRepoStream(): UseMultiRepoStreamReturn {
  const [repositories, setRepositories] = useState<RepoSessionState[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const isConnected = useSSEConnected();
  const status = useSSEStatus();
  const hasFetchedRef = useRef(false);

  useConnectedSubscription(setRepositories, setLastUpdated);
  useBulkUpdateSubscription(setRepositories, setLastUpdated);
  useRepoUpdateSubscription(setRepositories, setLastUpdated);
  useTaskUpdateRepoSubscription(setRepositories, setLastUpdated);

  // Fallback: Fetch repositories via REST API if SSE hasn't provided data
  // This handles race conditions where components subscribe before SSE connection is ready
  useEffect(() => {
    const fetchIfNeeded = async () => {
      // Only fetch once, and only if we have no data yet but are connected
      if (hasFetchedRef.current || repositories.length > 0 || !isConnected) {
        return;
      }

      hasFetchedRef.current = true;
      await fetchRepositoriesFromApi(setRepositories, setLastUpdated);
    };

    // Small delay to give SSE events a chance to arrive first
    const timeoutId = setTimeout(fetchIfNeeded, 1000);

    return () => clearTimeout(timeoutId);
  }, [isConnected, repositories.length]);

  // GlobalSSEManager handles reconnection automatically. No-op for API compatibility.
  const reconnect = useCallback(() => {}, []);

  return {
    repositories,
    connected: isConnected,
    error: status === 'disconnected' ? 'Connection lost' : null,
    reconnect,
    lastUpdated,
  };
}
