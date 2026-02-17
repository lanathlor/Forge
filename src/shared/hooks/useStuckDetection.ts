'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type {
  StuckStatus,
  StuckAlert,
  StuckEvent,
} from '@/lib/stuck-detection/types';
import { useSSE, useSSESubscription } from '@/shared/contexts/SSEContext';

interface UseStuckDetectionOptions {
  onStuckDetected?: (alert: StuckAlert) => void;
  onStuckResolved?: (alert: StuckAlert) => void;
  onStuckEscalated?: (alert: StuckAlert) => void;
}

interface UseStuckDetectionReturn {
  status: StuckStatus;
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

function addAlert(prev: StuckStatus, alert: StuckAlert): StuckStatus {
  return {
    ...prev,
    totalStuckCount: prev.totalStuckCount + 1,
    alerts: [
      ...prev.alerts.filter((a) => a.repositoryId !== alert.repositoryId),
      alert,
    ],
    lastUpdated: new Date().toISOString(),
  };
}

function removeAlert(prev: StuckStatus, repositoryId: string): StuckStatus {
  return {
    ...prev,
    totalStuckCount: Math.max(0, prev.totalStuckCount - 1),
    alerts: prev.alerts.filter((a) => a.repositoryId !== repositoryId),
    lastUpdated: new Date().toISOString(),
  };
}

function updateAlert(prev: StuckStatus, alert: StuckAlert): StuckStatus {
  return {
    ...prev,
    alerts: prev.alerts.map((a) =>
      a.repositoryId === alert.repositoryId ? alert : a
    ),
    lastUpdated: new Date().toISOString(),
  };
}

type SetStatus = React.Dispatch<React.SetStateAction<StuckStatus>>;
type CallbacksRef = React.MutableRefObject<UseStuckDetectionOptions | undefined>;

function useStuckStatusSubscriptions(setStatus: SetStatus) {
  useSSESubscription<{ stuckStatus?: StuckStatus }>(
    'unified', 'connected',
    (event) => { if (event.data?.stuckStatus) setStatus(event.data.stuckStatus); },
    []
  );
  useSSESubscription<{ status?: StuckStatus }>(
    'unified', 'stuck_update',
    (event) => { if (event.data?.status) setStatus(event.data.status); },
    []
  );
}

function useStuckAlertSubscriptions(setStatus: SetStatus, callbacksRef: CallbacksRef) {
  useSSESubscription<StuckEvent>('unified', 'stuck_detected', (event) => {
    const { alert } = event.data as StuckEvent;
    if (alert) { callbacksRef.current?.onStuckDetected?.(alert); setStatus((prev) => addAlert(prev, alert)); }
  }, []);
  useSSESubscription<StuckEvent>('unified', 'stuck_resolved', (event) => {
    const { alert } = event.data as StuckEvent;
    if (alert) { callbacksRef.current?.onStuckResolved?.(alert); setStatus((prev) => removeAlert(prev, alert.repositoryId)); }
  }, []);
  useSSESubscription<StuckEvent>('unified', 'stuck_escalated', (event) => {
    const { alert } = event.data as StuckEvent;
    if (alert) { callbacksRef.current?.onStuckEscalated?.(alert); setStatus((prev) => updateAlert(prev, alert)); }
  }, []);
}

function useStuckEventHandlers(setStatus: SetStatus, callbacksRef: CallbacksRef) {
  useStuckStatusSubscriptions(setStatus);
  useStuckAlertSubscriptions(setStatus, callbacksRef);
}

async function postAcknowledge(repositoryId: string): Promise<boolean> {
  try {
    const response = await fetch('/api/sse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repositoryId, action: 'acknowledge' }),
    });
    return (await response.json()).success === true;
  } catch (err) {
    console.error('[useStuckDetection] Acknowledge error:', err);
    return false;
  }
}

export function useStuckDetection(
  options?: UseStuckDetectionOptions
): UseStuckDetectionReturn {
  const { status: connectionStatus, reconnectAll, isConnected } = useSSE();
  const [status, setStatus] = useState<StuckStatus>(EMPTY_STATUS);
  const callbacksRef = useRef(options);

  useEffect(() => {
    callbacksRef.current = options;
  }, [options]);
  useStuckEventHandlers(setStatus, callbacksRef);

  const acknowledgeAlert = useCallback(
    async (repositoryId: string): Promise<boolean> => {
      const success = await postAcknowledge(repositoryId);
      if (success) {
        setStatus((prev) => ({
          ...prev,
          alerts: prev.alerts.map((a) =>
            a.repositoryId === repositoryId ? { ...a, acknowledged: true } : a
          ),
        }));
      }
      return success;
    },
    []
  );

  const getAlertForRepo = useCallback(
    (repositoryId: string): StuckAlert | null =>
      status.alerts.find((a) => a.repositoryId === repositoryId) || null,
    [status.alerts]
  );

  return {
    status,
    connected: isConnected,
    error: connectionStatus === 'disconnected' ? 'Connection lost' : null,
    reconnect: reconnectAll,
    acknowledgeAlert,
    getAlertForRepo,
  };
}

export default useStuckDetection;
