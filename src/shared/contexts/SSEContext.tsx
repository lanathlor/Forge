'use client';

import * as React from 'react';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  GlobalSSEManager,
  type ConnectionStatus,
  type SSEConnectionHealth,
  type SSEEvent,
  type SSEEventCallback,
} from '../services/GlobalSSEManager';

// Re-export types that components need
export type { ConnectionStatus, SSEConnectionHealth, SSEEvent, SSEEventCallback };

/* ============================================
   TYPES
   ============================================ */

export interface SSEContextValue {
  /** Overall connection status across all managed connections */
  status: ConnectionStatus;
  /** Whether all connections are healthy */
  isConnected: boolean;
  /** Health information for each connection */
  health: Map<string, SSEConnectionHealth>;
  /** Establish a new SSE connection */
  connect: (id: string, url: string) => void;
  /** Subscribe to specific events from a connection */
  subscribe: <T = unknown>(
    connectionId: string,
    eventType: string,
    callback: SSEEventCallback<T>
  ) => () => void;
  /** Subscribe to all events from a connection */
  subscribeAll: (connectionId: string, callback: SSEEventCallback) => () => void;
  /** Manually reconnect a specific connection */
  reconnect: (id: string) => void;
  /** Reconnect all connections */
  reconnectAll: () => void;
  /** Disconnect a specific connection */
  disconnect: (id: string) => void;
  /** Check if a connection exists */
  hasConnection: (id: string) => boolean;
  /** Get the number of active connections */
  connectionCount: number;
}

/* ============================================
   CONTEXT
   ============================================ */

const SSEContext = createContext<SSEContextValue | null>(null);

/**
 * Hook to access SSE connection management
 *
 * Must be used within an SSEProvider
 */
export function useSSE(): SSEContextValue {
  const context = useContext(SSEContext);
  if (!context) {
    throw new Error('useSSE must be used within an SSEProvider');
  }
  return context;
}

/**
 * Hook to get the current connection status
 */
export function useSSEStatus(): ConnectionStatus {
  const { status } = useSSE();
  return status;
}

/**
 * Hook to check if SSE is connected
 */
export function useSSEConnected(): boolean {
  const { isConnected } = useSSE();
  return isConnected;
}

/**
 * Hook to get health information for all connections
 */
export function useSSEHealth(): Map<string, SSEConnectionHealth> {
  const { health } = useSSE();
  return health;
}

/* ============================================
   PROVIDER
   ============================================ */

interface SSEProviderProps {
  children: React.ReactNode;
  autoConnect?: Array<{ id: string; url: string }>;
}

function useSSEInit(autoConnect?: Array<{ id: string; url: string }>) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [health, setHealth] = useState<Map<string, SSEConnectionHealth>>(new Map());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const unsubHealth = GlobalSSEManager.onHealthChange((newHealth) => {
      setHealth(new Map(newHealth));
      setStatus(GlobalSSEManager.getOverallStatus());
    });

    autoConnect?.forEach(({ id, url }) => GlobalSSEManager.connect(id, url));
    setStatus(GlobalSSEManager.getOverallStatus());
    setHealth(GlobalSSEManager.getHealth());

    return () => { unsubHealth(); };
  }, [autoConnect]);

  return { status, health, setStatus, setHealth };
}

function useSSEActions(setStatus: React.Dispatch<React.SetStateAction<ConnectionStatus>>, setHealth: React.Dispatch<React.SetStateAction<Map<string, SSEConnectionHealth>>>) {
  const connect = useCallback((id: string, url: string) => {
    GlobalSSEManager.connect(id, url);
    setStatus(GlobalSSEManager.getOverallStatus());
    setHealth(GlobalSSEManager.getHealth());
  }, [setStatus, setHealth]);

  const subscribe = useCallback(<T = unknown>(connectionId: string, eventType: string, callback: SSEEventCallback<T>) => {
    return GlobalSSEManager.subscribe(connectionId, eventType, callback);
  }, []);

  const subscribeAll = useCallback((connectionId: string, callback: SSEEventCallback) => GlobalSSEManager.subscribeAll(connectionId, callback), []);
  const reconnect = useCallback((id: string) => GlobalSSEManager.reconnect(id), []);
  const reconnectAll = useCallback(() => GlobalSSEManager.reconnectAll(), []);

  const disconnect = useCallback((id: string) => {
    GlobalSSEManager.disconnect(id);
    setStatus(GlobalSSEManager.getOverallStatus());
    setHealth(GlobalSSEManager.getHealth());
  }, [setStatus, setHealth]);

  const hasConnection = useCallback((id: string) => GlobalSSEManager.hasConnection(id), []);

  return { connect, subscribe, subscribeAll, reconnect, reconnectAll, disconnect, hasConnection };
}

export function SSEProvider({ children, autoConnect }: SSEProviderProps) {
  const { status, health, setStatus, setHealth } = useSSEInit(autoConnect);
  const actions = useSSEActions(setStatus, setHealth);

  const value: SSEContextValue = {
    status, isConnected: status === 'connected', health,
    ...actions, connectionCount: GlobalSSEManager.connectionCount,
  };

  return <SSEContext.Provider value={value}>{children}</SSEContext.Provider>;
}

/* ============================================
   CONVENIENCE HOOKS
   ============================================ */

/**
 * Hook to subscribe to SSE events with automatic cleanup
 *
 * @example
 * useSSESubscription('multi-repo', 'repo_update', (event) => {
 *   console.log('Repo updated:', event.data);
 * });
 */
export function useSSESubscription<T = unknown>(
  connectionId: string,
  eventType: string,
  callback: SSEEventCallback<T>,
  deps: React.DependencyList = []
): void {
  const { subscribe } = useSSE();
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler: SSEEventCallback<T> = (event) => {
      callbackRef.current(event);
    };

    const unsub = subscribe(connectionId, eventType, handler);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, eventType, subscribe, ...deps]);
}

/**
 * Hook to subscribe to all events from a connection with automatic cleanup
 */
export function useSSESubscriptionAll(
  connectionId: string,
  callback: SSEEventCallback,
  deps: React.DependencyList = []
): void {
  const { subscribeAll } = useSSE();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler: SSEEventCallback = (event) => {
      callbackRef.current(event);
    };

    const unsub = subscribeAll(connectionId, handler);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, subscribeAll, ...deps]);
}

/**
 * Hook to manage SSE data with automatic state updates
 *
 * @example
 * const { data, isLoading, error } = useSSEData<RepoState[]>(
 *   'multi-repo',
 *   'bulk_update',
 *   (event) => event.data.repositories,
 *   []
 * );
 */
export function useSSEData<T>(
  connectionId: string,
  eventType: string,
  transform: (event: SSEEvent) => T,
  initialValue: T
): { data: T; isLoading: boolean; error: string | null; lastUpdated: Date | null } {
  const { status, health, subscribe } = useSSE();
  const [data, setData] = useState<T>(initialValue);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const unsub = subscribe(connectionId, eventType, (event) => {
      try {
        const transformed = transform(event);
        setData(transformed);
        setLastUpdated(new Date());
      } catch (err) {
        console.error(`[useSSEData] Transform error for ${eventType}:`, err);
      }
    });

    return unsub;
  }, [connectionId, eventType, transform, subscribe]);

  const connectionHealth = health.get(connectionId);
  const isLoading = status === 'connecting' || (connectionHealth?.status === 'connecting');
  const error = status === 'disconnected' ? 'Connection lost' : null;

  return { data, isLoading, error, lastUpdated };
}

/* ============================================
   CONNECTION STATUS HOOK
   ============================================ */

/**
 * Hook specifically for connection status UI components
 */
export function useConnectionStatus(): {
  status: ConnectionStatus;
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  totalConnections: number;
  connectedCount: number;
  reconnect: () => void;
} {
  const { status, health, reconnectAll, connectionCount } = useSSE();

  let totalReconnectAttempts = 0;
  let connectedCount = 0;

  health.forEach((h) => {
    totalReconnectAttempts += h.reconnectAttempts;
    if (h.status === 'connected') connectedCount++;
  });

  return {
    status,
    isConnected: status === 'connected',
    isReconnecting: status === 'reconnecting',
    reconnectAttempts: totalReconnectAttempts,
    totalConnections: connectionCount,
    connectedCount,
    reconnect: reconnectAll,
  };
}

export default SSEProvider;
