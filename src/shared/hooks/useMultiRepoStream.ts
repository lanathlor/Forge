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
type SetUpdated = React.Dispatch<React.SetStateAction<string | null>>;

function handleBulkUpdate(data: MultiRepoUpdate, setRepos: SetRepos, setUpdated: SetUpdated) {
  if (data.repositories) { setRepos(data.repositories); setUpdated(data.timestamp); }
}

function handleRepoUpdate(data: MultiRepoUpdate, setRepos: SetRepos, setUpdated: SetUpdated) {
  if (!data.repository) return;
  setRepos((prev) => {
    const idx = prev.findIndex((r) => r.repositoryId === data.repository!.repositoryId);
    if (idx >= 0) { const updated = [...prev]; updated[idx] = data.repository!; return updated; }
    return [...prev, data.repository!];
  });
  setUpdated(data.timestamp);
}

function createMessageHandler(setRepos: SetRepos, setUpdated: SetUpdated, setConn: React.Dispatch<React.SetStateAction<boolean>>) {
  return (event: MessageEvent) => {
    try {
      const data: MultiRepoUpdate = JSON.parse(event.data);
      if (data.type === 'connected') { setConn(true); return; }
      if (data.type === 'bulk_update') handleBulkUpdate(data, setRepos, setUpdated);
      else if (data.type === 'repo_update') handleRepoUpdate(data, setRepos, setUpdated);
    } catch (err) { console.error('[useMultiRepoStream] Parse error:', err); }
  };
}

interface StreamRefs {
  eventSource: React.MutableRefObject<EventSource | null>;
  reconnectTimeout: React.MutableRefObject<NodeJS.Timeout | null>;
  pollTimeout: React.MutableRefObject<NodeJS.Timeout | null>;
  reconnectAttempt: React.MutableRefObject<number>;
  isPolling: React.MutableRefObject<boolean>;
  connect: React.MutableRefObject<() => void>;
  options: React.MutableRefObject<{ autoReconnect: boolean; reconnectDelay: number; pollInterval: number }>;
}

function createPolling(refs: StreamRefs, setRepos: SetRepos, setUpdated: SetUpdated, setError: React.Dispatch<React.SetStateAction<string | null>>) {
  const poll = async () => {
    try {
      const res = await fetch('/api/multi-repo-status');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setRepos(data.repositories || []);
      setUpdated(new Date().toISOString());
      setError(null);
    } catch { console.error('[useMultiRepoStream] Poll error'); }
    if (refs.isPolling.current) refs.pollTimeout.current = setTimeout(poll, refs.options.current.pollInterval);
  };
  const start = () => { if (!refs.isPolling.current) { refs.isPolling.current = true; poll(); } };
  const stop = () => { refs.isPolling.current = false; if (refs.pollTimeout.current) { clearTimeout(refs.pollTimeout.current); refs.pollTimeout.current = null; } };
  return { poll, start, stop };
}

function createCleanup(refs: StreamRefs) {
  return () => {
    refs.eventSource.current?.close();
    refs.eventSource.current = null;
    if (refs.reconnectTimeout.current) clearTimeout(refs.reconnectTimeout.current);
    if (refs.pollTimeout.current) clearTimeout(refs.pollTimeout.current);
    refs.reconnectTimeout.current = null;
    refs.pollTimeout.current = null;
  };
}

export function useMultiRepoStream(options?: UseMultiRepoStreamOptions): UseMultiRepoStreamReturn {
  const { autoReconnect = true, reconnectDelay = 3000, pollInterval = 5000 } = options || {};
  const [repositories, setRepositories] = useState<RepoSessionState[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const refs: StreamRefs = {
    eventSource: useRef<EventSource | null>(null),
    reconnectTimeout: useRef<NodeJS.Timeout | null>(null),
    pollTimeout: useRef<NodeJS.Timeout | null>(null),
    reconnectAttempt: useRef(0),
    isPolling: useRef(false),
    connect: useRef<() => void>(() => {}),
    options: useRef({ autoReconnect, reconnectDelay, pollInterval }),
  };
  refs.options.current = { autoReconnect, reconnectDelay, pollInterval };

  useEffect(() => {
    const polling = createPolling(refs, setRepositories, setLastUpdated, setError);
    const cleanup = createCleanup(refs);
    const connect = () => {
      cleanup();
      polling.stop();
      try {
        const es = new EventSource('/api/multi-repo-stream');
        refs.eventSource.current = es;
        es.onopen = () => { setConnected(true); setError(null); refs.reconnectAttempt.current = 0; polling.stop(); };
        es.onmessage = createMessageHandler(setRepositories, setLastUpdated, setConnected);
        es.onerror = () => {
          setConnected(false); setError('Connection lost'); es.close(); polling.start();
          if (refs.options.current.autoReconnect) {
            refs.reconnectAttempt.current += 1;
            const delay = Math.min(refs.options.current.reconnectDelay * Math.pow(2, refs.reconnectAttempt.current - 1), 30000);
            refs.reconnectTimeout.current = setTimeout(connect, delay);
          }
        };
      } catch (err) { setError(err instanceof Error ? err.message : 'Unknown error'); polling.start(); }
    };
    refs.connect.current = connect;
    connect();
    return () => { cleanup(); polling.stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reconnect = useCallback(() => { refs.reconnectAttempt.current = 0; refs.connect.current(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { repositories, connected, error, reconnect, lastUpdated };
}
