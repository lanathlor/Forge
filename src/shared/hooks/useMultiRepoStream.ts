'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

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

interface UseMultiRepoStreamOptions { autoReconnect?: boolean; reconnectDelay?: number; pollInterval?: number }
interface UseMultiRepoStreamReturn { repositories: RepoSessionState[]; connected: boolean; error: string | null; reconnect: () => void; lastUpdated: string | null }
type SetRepos = React.Dispatch<React.SetStateAction<RepoSessionState[]>>;
type SetString = React.Dispatch<React.SetStateAction<string | null>>;
type SetBool = React.Dispatch<React.SetStateAction<boolean>>;

function handleBulkUpdate(data: MultiRepoUpdate, setRepos: SetRepos, setUpdated: SetString) {
  if (data.repositories) { setRepos(data.repositories); setUpdated(data.timestamp); }
}

function handleRepoUpdate(data: MultiRepoUpdate, setRepos: SetRepos, setUpdated: SetString) {
  if (!data.repository) return;
  setRepos((prev) => {
    const idx = prev.findIndex((r) => r.repositoryId === data.repository!.repositoryId);
    if (idx >= 0) { const updated = [...prev]; updated[idx] = data.repository!; return updated; }
    return [...prev, data.repository!];
  });
  setUpdated(data.timestamp);
}

function handleSSEMessage(data: MultiRepoUpdate, setRepos: SetRepos, setUpdated: SetString, setConn: SetBool) {
  if (data.type === 'connected') { setConn(true); return; }
  if (data.type === 'bulk_update') handleBulkUpdate(data, setRepos, setUpdated);
  else if (data.type === 'repo_update') handleRepoUpdate(data, setRepos, setUpdated);
}

function createMessageHandler(setRepos: SetRepos, setUpdated: SetString, setConn: SetBool) {
  return (event: MessageEvent) => {
    try { handleSSEMessage(JSON.parse(event.data), setRepos, setUpdated, setConn); }
    catch (err) { console.error('[useMultiRepoStream] Parse error:', err); }
  };
}

function useStreamRefs() {
  return {
    eventSource: useRef<EventSource | null>(null),
    reconnectTimeout: useRef<NodeJS.Timeout | null>(null),
    pollTimeout: useRef<NodeJS.Timeout | null>(null),
    reconnectAttempt: useRef(0),
    isPolling: useRef(false),
  };
}

function usePolling(refs: ReturnType<typeof useStreamRefs>, pollInterval: number, setRepos: SetRepos, setUpdated: SetString, setError: SetString) {
  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/multi-repo-status');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setRepos(data.repositories || []); setUpdated(new Date().toISOString()); setError(null);
    } catch { console.error('[useMultiRepoStream] Poll error'); }
    if (refs.isPolling.current) refs.pollTimeout.current = setTimeout(poll, pollInterval);
  }, [pollInterval, refs, setRepos, setUpdated, setError]);

  const start = useCallback(() => { if (!refs.isPolling.current) { refs.isPolling.current = true; poll(); } }, [poll, refs]);
  const stop = useCallback(() => { refs.isPolling.current = false; if (refs.pollTimeout.current) { clearTimeout(refs.pollTimeout.current); refs.pollTimeout.current = null; } }, [refs]);
  return { poll, start, stop };
}

export function useMultiRepoStream(options?: UseMultiRepoStreamOptions): UseMultiRepoStreamReturn {
  const { autoReconnect = true, reconnectDelay = 3000, pollInterval = 5000 } = options || {};
  const [repositories, setRepositories] = useState<RepoSessionState[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const refs = useStreamRefs();
  const polling = usePolling(refs, pollInterval, setRepositories, setLastUpdated, setError);

  const cleanup = useCallback(() => {
    refs.eventSource.current?.close(); refs.eventSource.current = null;
    if (refs.reconnectTimeout.current) clearTimeout(refs.reconnectTimeout.current);
    if (refs.pollTimeout.current) clearTimeout(refs.pollTimeout.current);
    refs.reconnectTimeout.current = null; refs.pollTimeout.current = null;
  }, [refs]);

  const connect = useCallback(() => {
    cleanup(); polling.stop();
    try {
      const es = new EventSource('/api/multi-repo-stream');
      refs.eventSource.current = es;
      es.onopen = () => { setConnected(true); setError(null); refs.reconnectAttempt.current = 0; polling.stop(); };
      es.onmessage = createMessageHandler(setRepositories, setLastUpdated, setConnected);
      es.onerror = () => { setConnected(false); setError('Connection lost'); es.close(); polling.start();
        if (autoReconnect) { refs.reconnectAttempt.current += 1; refs.reconnectTimeout.current = setTimeout(connect, Math.min(reconnectDelay * Math.pow(2, refs.reconnectAttempt.current - 1), 30000)); }
      };
    } catch (err) { setError(err instanceof Error ? err.message : 'Unknown error'); polling.start(); }
  }, [autoReconnect, reconnectDelay, cleanup, polling, refs]);

  useEffect(() => { connect(); return () => { cleanup(); polling.stop(); }; }, [connect, cleanup, polling]);
  const reconnect = useCallback(() => { refs.reconnectAttempt.current = 0; connect(); }, [connect, refs]);
  return { repositories, connected, error, reconnect, lastUpdated };
}
