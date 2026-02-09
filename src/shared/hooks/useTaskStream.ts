'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

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

/**
 * Custom hook for consuming Server-Sent Events from the task stream
 *
 * @param sessionId - The session ID to subscribe to
 * @param options - Configuration options
 * @returns Updates array, connection status, and reconnect function
 */
/* eslint-disable max-lines-per-function */
export function useTaskStream(
  sessionId: string | null,
  options?: {
    autoReconnect?: boolean;
    reconnectDelay?: number;
    maxUpdates?: number;
  }
): UseTaskStreamReturn {
  const {
    autoReconnect = true,
    reconnectDelay = 3000,
    maxUpdates = 1000,
  } = options || {};

  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!sessionId) return;

    cleanup();

    try {
      const eventSource = new EventSource(`/api/stream?sessionId=${sessionId}`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnected(true);
        setError(null);
        reconnectAttemptRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data: TaskUpdate = JSON.parse(event.data);

          if (data.type === 'connected') {
            setConnected(true);
            return;
          }

          setUpdates((prev) => {
            const newUpdates = [...prev, data];
            // Limit updates array size to prevent memory issues
            if (newUpdates.length > maxUpdates) {
              return newUpdates.slice(newUpdates.length - maxUpdates);
            }
            return newUpdates;
          });
        } catch (err) {
          console.error('Error parsing SSE message:', err);
        }
      };

      eventSource.onerror = () => {
        setConnected(false);
        setError('Connection lost');
        eventSource.close();

        // Auto-reconnect logic
        if (autoReconnect) {
          reconnectAttemptRef.current += 1;
          const delay = Math.min(
            reconnectDelay * Math.pow(2, reconnectAttemptRef.current - 1),
            30000
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error creating EventSource:', err);
    }
  }, [sessionId, autoReconnect, reconnectDelay, maxUpdates, cleanup]);

  useEffect(() => {
    if (sessionId) {
      connect();
    }

    return () => {
      cleanup();
    };
  }, [sessionId, connect, cleanup]);

  const reconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    connect();
  }, [connect]);

  return {
    updates,
    connected,
    error,
    reconnect,
  };
}
