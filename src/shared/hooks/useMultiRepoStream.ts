'use client';

import { useState, useCallback } from 'react';
import { useSSESubscription, useSSEConnected, useSSEStatus } from '@/shared/contexts/SSEContext';

export type ClaudeStatus = 'idle' | 'thinking' | 'writing' | 'waiting_input' | 'stuck' | 'paused';

export interface RepoSessionState {
  repositoryId: string;
  repositoryName: string;
  sessionId: string | null;
  sessionStatus: 'active' | 'paused' | 'completed' | 'abandoned' | null;
  claudeStatus: ClaudeStatus;
  currentTask: { id: string; prompt: string; status: string; progress?: number } | null;
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

function upsertRepo(prev: RepoSessionState[], updated: RepoSessionState): RepoSessionState[] {
  const idx = prev.findIndex((r) => r.repositoryId === updated.repositoryId);
  if (idx >= 0) {
    const next = [...prev];
    next[idx] = updated;
    return next;
  }
  return [...prev, updated];
}

function useConnectedSubscription(setRepos: SetRepos, setUpdated: SetUpdated) {
  useSSESubscription<{ repositories?: RepoSessionState[] }>('unified', 'connected', (event) => {
    if (event.data?.repositories) {
      setRepos(event.data.repositories);
      setUpdated(new Date().toISOString());
    }
  }, []);
}

function useBulkUpdateSubscription(setRepos: SetRepos, setUpdated: SetUpdated) {
  useSSESubscription<{ repositories?: RepoSessionState[]; timestamp?: string }>('unified', 'bulk_update', (event) => {
    if (event.data?.repositories) {
      setRepos(event.data.repositories);
      setUpdated(event.data.timestamp ?? new Date().toISOString());
    }
  }, []);
}

function useRepoUpdateSubscription(setRepos: SetRepos, setUpdated: SetUpdated) {
  useSSESubscription<{ repository?: RepoSessionState; timestamp?: string }>('unified', 'repo_update', (event) => {
    if (!event.data?.repository) return;
    setRepos((prev) => upsertRepo(prev, event.data.repository!));
    setUpdated(event.data.timestamp ?? new Date().toISOString());
  }, []);
}

function useTaskUpdateRepoSubscription(setRepos: SetRepos, setUpdated: SetUpdated) {
  useSSESubscription<{ repository?: RepoSessionState; timestamp?: string }>('unified', 'task_update', (event) => {
    if (!event.data?.repository) return;
    setRepos((prev) => upsertRepo(prev, event.data.repository!));
    setUpdated(event.data.timestamp ?? new Date().toISOString());
  }, []);
}

/**
 * Hook for monitoring status of multiple repositories.
 *
 * Uses the GlobalSSEManager unified connection (already established by SSEProvider)
 * instead of opening a separate EventSource. This eliminates duplicate connections
 * and ensures all repo updates flow through the single shared SSE stream.
 */
export function useMultiRepoStream(): UseMultiRepoStreamReturn {
  const [repositories, setRepositories] = useState<RepoSessionState[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const isConnected = useSSEConnected();
  const status = useSSEStatus();

  useConnectedSubscription(setRepositories, setLastUpdated);
  useBulkUpdateSubscription(setRepositories, setLastUpdated);
  useRepoUpdateSubscription(setRepositories, setLastUpdated);
  useTaskUpdateRepoSubscription(setRepositories, setLastUpdated);

  // GlobalSSEManager handles reconnection automatically. No-op for API compatibility.
  const reconnect = useCallback(() => {}, []);

  return { repositories, connected: isConnected, error: status === 'disconnected' ? 'Connection lost' : null, reconnect, lastUpdated };
}
