'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { StuckStatus, StuckAlert, StuckEvent } from '@/lib/stuck-detection/types';

interface UseStuckDetectionOptions {
  autoReconnect?: boolean;
  reconnectDelay?: number;
  onStuckDetected?: (alert: StuckAlert) => void;
  onStuckResolved?: (alert: StuckAlert) => void;
  onStuckEscalated?: (alert: StuckAlert) => void;
}

interface UseStuckDetectionReturn {
  status: StuckStatus | null;
  connected: boolean;
  error: string | null;
  reconnect: () => void;
  acknowledgeAlert: (repositoryId: string) => Promise<boolean>;
  getAlertForRepo: (repositoryId: string) => StuckAlert | null;
}

const EMPTY_STATUS: StuckStatus = {
  totalStuckCount: 0,
  waitingInputCount: 0,
  failedCount: 0,
  qaBlockedCount: 0,
  alerts: [],
  highestSeverity: null,
  lastUpdated: new Date().toISOString(),
};

function countsEqual(a: StuckStatus, b: StuckStatus): boolean {
  return a.totalStuckCount === b.totalStuckCount &&
    a.waitingInputCount === b.waitingInputCount &&
    a.failedCount === b.failedCount &&
    a.qaBlockedCount === b.qaBlockedCount &&
    a.highestSeverity === b.highestSeverity;
}

function alertsEqual(alertsA: StuckAlert[], alertsB: StuckAlert[]): boolean {
  if (alertsA.length !== alertsB.length) return false;
  const sortedA = [...alertsA].sort((a, b) => a.id.localeCompare(b.id));
  const sortedB = [...alertsB].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = 0; i < sortedA.length; i++) {
    const alertA = sortedA[i], alertB = sortedB[i];
    if (!alertA || !alertB) return false;
    if (alertA.id !== alertB.id || alertA.acknowledged !== alertB.acknowledged || alertA.severity !== alertB.severity) return false;
  }
  return true;
}

function statusEquals(a: StuckStatus | null, b: StuckStatus): boolean {
  if (!a) return false;
  return countsEqual(a, b) && alertsEqual(a.alerts, b.alerts);
}

interface StuckRefs {
  eventSource: React.MutableRefObject<EventSource | null>;
  reconnectTimeout: React.MutableRefObject<NodeJS.Timeout | null>;
  reconnectAttempt: React.MutableRefObject<number>;
  connect: React.MutableRefObject<() => void>;
  options: React.MutableRefObject<{ autoReconnect: boolean; reconnectDelay: number }>;
  callbacks: React.MutableRefObject<{ onStuckDetected?: (a: StuckAlert) => void; onStuckResolved?: (a: StuckAlert) => void; onStuckEscalated?: (a: StuckAlert) => void }>;
}

function createCleanup(refs: StuckRefs) {
  return () => {
    refs.eventSource.current?.close();
    refs.eventSource.current = null;
    if (refs.reconnectTimeout.current) { clearTimeout(refs.reconnectTimeout.current); refs.reconnectTimeout.current = null; }
  };
}

function createStatusHandler(setStatus: React.Dispatch<React.SetStateAction<StuckStatus | null>>) {
  return (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      if (data.status) setStatus(prev => statusEquals(prev, data.status) ? prev : data.status);
    } catch (err) { console.error('[useStuckDetection] Parse error:', err); }
  };
}

function createAlertHandler(getCallback: () => ((a: StuckAlert) => void) | undefined) {
  return (event: MessageEvent) => {
    try {
      const data: StuckEvent = JSON.parse(event.data);
      const cb = getCallback();
      if (data.alert && cb) cb(data.alert);
    } catch (err) { console.error('[useStuckDetection] Parse error:', err); }
  };
}

function useStuckRefs(options: UseStuckDetectionOptions): StuckRefs {
  const { autoReconnect = true, reconnectDelay = 3000, onStuckDetected, onStuckResolved, onStuckEscalated } = options;
  const refs: StuckRefs = {
    eventSource: useRef<EventSource | null>(null),
    reconnectTimeout: useRef<NodeJS.Timeout | null>(null),
    reconnectAttempt: useRef(0),
    connect: useRef<() => void>(() => {}),
    options: useRef({ autoReconnect, reconnectDelay }),
    callbacks: useRef({ onStuckDetected, onStuckResolved, onStuckEscalated }),
  };
  refs.options.current = { autoReconnect, reconnectDelay };
  refs.callbacks.current = { onStuckDetected, onStuckResolved, onStuckEscalated };
  return refs;
}

function setupConnection(refs: StuckRefs, setStatus: React.Dispatch<React.SetStateAction<StuckStatus | null>>, setConnected: React.Dispatch<React.SetStateAction<boolean>>, setError: React.Dispatch<React.SetStateAction<string | null>>) {
  const cleanup = createCleanup(refs);
  const statusHandler = createStatusHandler(setStatus);
  const connect = () => {
    cleanup();
    try {
      const es = new EventSource('/api/stuck-detection-stream');
      refs.eventSource.current = es;
      es.onopen = () => { setConnected(true); setError(null); refs.reconnectAttempt.current = 0; };
      es.addEventListener('connected', statusHandler);
      es.addEventListener('stuck_update', statusHandler);
      es.addEventListener('stuck_detected', createAlertHandler(() => refs.callbacks.current.onStuckDetected));
      es.addEventListener('stuck_resolved', createAlertHandler(() => refs.callbacks.current.onStuckResolved));
      es.addEventListener('stuck_escalated', createAlertHandler(() => refs.callbacks.current.onStuckEscalated));
      es.onerror = () => {
        setConnected(false); setError('Connection lost'); es.close();
        if (refs.options.current.autoReconnect) {
          refs.reconnectAttempt.current += 1;
          const delay = Math.min(refs.options.current.reconnectDelay * Math.pow(2, refs.reconnectAttempt.current - 1), 30000);
          refs.reconnectTimeout.current = setTimeout(connect, delay);
        }
      };
    } catch (err) { setError(err instanceof Error ? err.message : 'Unknown error'); }
  };
  refs.connect.current = connect;
  connect();
  return cleanup;
}

export function useStuckDetection(options?: UseStuckDetectionOptions): UseStuckDetectionReturn {
  const [status, setStatus] = useState<StuckStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refs = useStuckRefs(options || {});

  useEffect(() => setupConnection(refs, setStatus, setConnected, setError), []); // eslint-disable-line react-hooks/exhaustive-deps

  const reconnect = useCallback(() => { refs.reconnectAttempt.current = 0; refs.connect.current(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const acknowledgeAlert = useCallback(async (repositoryId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/stuck-detection-stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repositoryId, action: 'acknowledge' }) });
      return (await response.json()).success === true;
    } catch (err) { console.error('[useStuckDetection] Acknowledge error:', err); return false; }
  }, []);
  const getAlertForRepo = useCallback((repositoryId: string): StuckAlert | null => status?.alerts.find(a => a.repositoryId === repositoryId) || null, [status]);
  return { status: status || EMPTY_STATUS, connected, error, reconnect, acknowledgeAlert, getAlertForRepo };
}

export default useStuckDetection;
