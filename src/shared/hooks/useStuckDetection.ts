'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { StuckStatus, StuckAlert, StuckEvent } from '@/lib/stuck-detection/types';

interface UseStuckDetectionOptions {
  /** Enable auto-reconnect on connection loss */
  autoReconnect?: boolean;
  /** Delay in ms before reconnecting */
  reconnectDelay?: number;
  /** Callback when a new stuck alert is detected */
  onStuckDetected?: (alert: StuckAlert) => void;
  /** Callback when a stuck alert is resolved */
  onStuckResolved?: (alert: StuckAlert) => void;
  /** Callback when a stuck alert severity escalates */
  onStuckEscalated?: (alert: StuckAlert) => void;
}

interface UseStuckDetectionReturn {
  /** Current stuck status summary */
  status: StuckStatus | null;
  /** Whether connected to the SSE stream */
  connected: boolean;
  /** Connection error if any */
  error: string | null;
  /** Manually reconnect to the stream */
  reconnect: () => void;
  /** Acknowledge an alert for a repository */
  acknowledgeAlert: (repositoryId: string) => Promise<boolean>;
  /** Get alert for a specific repository */
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

function createEventHandler(callback?: (alert: StuckAlert) => void) {
  return (event: MessageEvent) => {
    try {
      const data: StuckEvent = JSON.parse(event.data);
      if (data.alert && callback) callback(data.alert);
    } catch (err) { console.error('[useStuckDetection] Parse error:', err); }
  };
}

function createStatusHandler(setStatus: (s: StuckStatus) => void) {
  return (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      if (data.status) setStatus(data.status);
    } catch (err) { console.error('[useStuckDetection] Parse error:', err); }
  };
}

function useSSEConnection(options: UseStuckDetectionOptions | undefined) {
  const { autoReconnect = true, reconnectDelay = 3000, onStuckDetected, onStuckResolved, onStuckEscalated } = options || {};
  const [status, setStatus] = useState<StuckStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);

  const cleanup = useCallback(() => {
    eventSourceRef.current?.close(); eventSourceRef.current = null;
    if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
  }, []);

  const connect = useCallback(() => {
    cleanup();
    try {
      const eventSource = new EventSource('/api/stuck-detection-stream');
      eventSourceRef.current = eventSource;
      eventSource.onopen = () => { setConnected(true); setError(null); reconnectAttemptRef.current = 0; };
      eventSource.addEventListener('connected', createStatusHandler(setStatus));
      eventSource.addEventListener('stuck_detected', createEventHandler(onStuckDetected));
      eventSource.addEventListener('stuck_resolved', createEventHandler(onStuckResolved));
      eventSource.addEventListener('stuck_escalated', createEventHandler(onStuckEscalated));
      eventSource.addEventListener('stuck_update', createStatusHandler(setStatus));
      eventSource.onerror = () => {
        setConnected(false); setError('Connection lost'); eventSource.close();
        if (autoReconnect) {
          reconnectAttemptRef.current += 1;
          const delay = Math.min(reconnectDelay * Math.pow(2, reconnectAttemptRef.current - 1), 30000);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };
    } catch (err) { setError(err instanceof Error ? err.message : 'Unknown error'); }
  }, [autoReconnect, reconnectDelay, cleanup, onStuckDetected, onStuckResolved, onStuckEscalated]);

  useEffect(() => { connect(); return cleanup; }, [connect, cleanup]);

  const reconnect = useCallback(() => { reconnectAttemptRef.current = 0; connect(); }, [connect]);

  return { status, connected, error, reconnect };
}

/**
 * Hook for real-time stuck detection monitoring via SSE
 */
export function useStuckDetection(options?: UseStuckDetectionOptions): UseStuckDetectionReturn {
  const { status, connected, error, reconnect } = useSSEConnection(options);

  const acknowledgeAlert = useCallback(async (repositoryId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/stuck-detection-stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repositoryId, action: 'acknowledge' }) });
      return (await response.json()).success === true;
    } catch (err) { console.error('[useStuckDetection] Acknowledge error:', err); return false; }
  }, []);

  const getAlertForRepo = useCallback((repositoryId: string): StuckAlert | null => {
    return status?.alerts.find(a => a.repositoryId === repositoryId) || null;
  }, [status]);

  return { status: status || EMPTY_STATUS, connected, error, reconnect, acknowledgeAlert, getAlertForRepo };
}

export default useStuckDetection;
