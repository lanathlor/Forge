'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSSESubscription, useSSEConnected, useSSEStatus } from '@/shared/contexts/SSEContext';

export interface TaskUpdate {
  type: 'connected' | 'task_update' | 'task_output' | 'qa_gate_update';
  taskId?: string;
  sessionId?: string;
  status?: string;
  output?: string;
  gateName?: string;
  timestamp: string;
  [key: string]: unknown;
}

interface UseTaskStreamReturn {
  updates: TaskUpdate[];
  connected: boolean;
  error: string | null;
  reconnect: () => void;
}

function useAddUpdate(maxUpdates: number) {
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const addUpdate = useCallback((update: TaskUpdate) => {
    setUpdates((prev) => {
      const next = [...prev, update];
      return next.length > maxUpdates ? next.slice(next.length - maxUpdates) : next;
    });
  }, [maxUpdates]);
  return { updates, setUpdates, addUpdate };
}

function useTaskUpdateSubscription(sessionId: string | null, addUpdate: (u: TaskUpdate) => void) {
  useSSESubscription<TaskUpdate>('unified', 'task_update', (event) => {
    if (!sessionId) return;
    const data = event.data as TaskUpdate;
    if (!data || data.sessionId !== sessionId) return;
    addUpdate({ ...data, type: 'task_update', timestamp: event.timestamp });
  }, [sessionId, addUpdate]);
}

function useTaskOutputSubscription(sessionId: string | null, addUpdate: (u: TaskUpdate) => void) {
  useSSESubscription<{ sessionId?: string; taskId?: string; output?: string }>(
    'unified', 'task_output', (event) => {
      if (!sessionId) return;
      const data = event.data;
      if (!data || data.sessionId !== sessionId) return;
      addUpdate({ type: 'task_output', sessionId: data.sessionId, taskId: data.taskId, output: data.output, timestamp: event.timestamp });
    }, [sessionId, addUpdate]);
}

function useQAGateSubscription(sessionId: string | null, addUpdate: (u: TaskUpdate) => void) {
  useSSESubscription<{ sessionId?: string; taskId?: string; gateName?: string; status?: string }>(
    'unified', 'qa_gate_update', (event) => {
      if (!sessionId) return;
      const data = event.data;
      if (!data || data.sessionId !== sessionId) return;
      addUpdate({ type: 'qa_gate_update', sessionId: data.sessionId, taskId: data.taskId, gateName: data.gateName, status: data.status, timestamp: event.timestamp });
    }, [sessionId, addUpdate]);
}

/**
 * Hook for consuming real-time task events for a specific session.
 *
 * Uses the GlobalSSEManager unified connection (already established by SSEProvider)
 * instead of opening a separate EventSource per session. Events are filtered
 * client-side by sessionId, matching the behaviour of the old /api/stream endpoint.
 */
export function useTaskStream(sessionId: string | null, options?: { maxUpdates?: number }): UseTaskStreamReturn {
  const { maxUpdates = 1000 } = options || {};
  const { updates, setUpdates, addUpdate } = useAddUpdate(maxUpdates);
  const isConnected = useSSEConnected();
  const status = useSSEStatus();

  useEffect(() => { setUpdates([]); }, [sessionId, setUpdates]);

  useTaskUpdateSubscription(sessionId, addUpdate);
  useTaskOutputSubscription(sessionId, addUpdate);
  useQAGateSubscription(sessionId, addUpdate);

  // GlobalSSEManager handles reconnection automatically. No-op for API compatibility.
  const reconnect = useCallback(() => {}, []);

  return { updates, connected: isConnected, error: status === 'disconnected' ? 'Connection lost' : null, reconnect };
}
