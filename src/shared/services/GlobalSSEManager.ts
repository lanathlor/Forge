'use client';

/**
 * GlobalSSEManager - Centralized SSE Connection Manager
 *
 * Maintains persistent SSE connections for all active repos simultaneously.
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Event multiplexing to route updates to correct subscribers
 * - Offline queue for handling temporary disconnections
 * - Heartbeat monitoring to detect stale connections
 */

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface SSEConnectionHealth {
  status: ConnectionStatus;
  lastHeartbeat: Date | null;
  reconnectAttempts: number;
  latency: number | null;
  uptime: number;
}

export interface SSEEvent<T = unknown> {
  type: string;
  data: T;
  timestamp: string;
  connectionId: string;
}

export type SSEEventCallback<T = unknown> = (event: SSEEvent<T>) => void;
type UnsubscribeFn = () => void;

interface QueuedEvent {
  type: string;
  data: unknown;
  timestamp: string;
}

interface ConnectionConfig {
  url: string;
  id: string;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  heartbeatTimeout?: number;
}

const DEFAULT_CONFIG = {
  autoReconnect: true,
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  heartbeatTimeout: 45000, // Servers send keep-alive every 30s, allow 15s buffer
};

class SSEConnection {
  private eventSource: EventSource | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private connectionStartTime: Date | null = null;
  private lastHeartbeat: Date | null = null;
  private latency: number | null = null;
  private config: Required<ConnectionConfig>;
  private subscribers = new Map<string, Set<SSEEventCallback>>();
  private globalSubscribers = new Set<SSEEventCallback>();
  private offlineQueue: QueuedEvent[] = [];
  private maxQueueSize = 100;
  private _status: ConnectionStatus = 'disconnected';
  private statusListeners = new Set<(status: ConnectionStatus) => void>();

  constructor(config: ConnectionConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  get health(): SSEConnectionHealth {
    const now = new Date();
    return {
      status: this._status,
      lastHeartbeat: this.lastHeartbeat,
      reconnectAttempts: this.reconnectAttempts,
      latency: this.latency,
      uptime: this.connectionStartTime
        ? Math.floor((now.getTime() - this.connectionStartTime.getTime()) / 1000)
        : 0,
    };
  }

  private setStatus(status: ConnectionStatus) {
    if (this._status !== status) {
      this._status = status;
      this.statusListeners.forEach(listener => listener(status));
    }
  }

  onStatusChange(listener: (status: ConnectionStatus) => void): UnsubscribeFn {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  connect(): void {
    this.cleanup();
    this.setStatus('connecting');

    try {
      const es = new EventSource(this.config.url);
      this.eventSource = es;

      es.onopen = () => {
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        this.connectionStartTime = new Date();
        this.lastHeartbeat = new Date();
        this.startHeartbeatMonitor();
        this.flushOfflineQueue();
      };

      es.onmessage = (event) => {
        this.handleMessage(event);
      };

      es.onerror = () => {
        this.handleError();
      };

      // Listen for named events from our SSE endpoints
      const namedEvents = [
        'connected', 'bulk_update', 'repo_update', 'keep_alive',
        'task_update', 'task_output', 'qa_gate_update',
        'stuck_update', 'stuck_detected', 'stuck_resolved', 'stuck_escalated'
      ];

      namedEvents.forEach(eventType => {
        es.addEventListener(eventType, (event) => {
          this.handleNamedEvent(eventType, event as MessageEvent);
        });
      });

    } catch (error) {
      console.error(`[GlobalSSE:${this.config.id}] Connection error:`, error);
      this.handleError();
    }
  }

  private handleMessage(event: MessageEvent) {
    this.recordHeartbeat();

    try {
      const data = JSON.parse(event.data);
      this.dispatchEvent('message', data);
    } catch {
      // Non-JSON message, dispatch as raw
      this.dispatchEvent('message', event.data);
    }
  }

  private handleNamedEvent(eventType: string, event: MessageEvent) {
    this.recordHeartbeat();

    // Keep-alive doesn't need dispatching
    if (eventType === 'keep_alive') {
      return;
    }

    try {
      const data = JSON.parse(event.data);
      this.dispatchEvent(eventType, data);
    } catch (err) {
      console.error(`[GlobalSSE:${this.config.id}] Parse error for ${eventType}:`, err);
    }
  }

  private recordHeartbeat() {
    const now = new Date();
    if (this.lastHeartbeat) {
      this.latency = now.getTime() - this.lastHeartbeat.getTime();
    }
    this.lastHeartbeat = now;
    this.resetHeartbeatMonitor();
  }

  private startHeartbeatMonitor() {
    this.resetHeartbeatMonitor();
  }

  private resetHeartbeatMonitor() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
    }
    this.heartbeatTimeout = setTimeout(() => {
      console.warn(`[GlobalSSE:${this.config.id}] Heartbeat timeout - connection may be stale`);
      this.reconnect();
    }, this.config.heartbeatTimeout);
  }

  private handleError() {
    this.setStatus('disconnected');
    this.cleanup();

    if (this.config.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    this.setStatus('reconnecting');
    this.reconnectAttempts += 1;

    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.config.maxReconnectDelay
    );

    console.log(`[GlobalSSE:${this.config.id}] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  reconnect(): void {
    this.reconnectAttempts = 0;
    this.connect();
  }

  private dispatchEvent(type: string, data: unknown) {
    const event: SSEEvent = {
      type,
      data,
      timestamp: new Date().toISOString(),
      connectionId: this.config.id,
    };

    // Dispatch to type-specific subscribers
    const typeSubscribers = this.subscribers.get(type);
    if (typeSubscribers) {
      typeSubscribers.forEach(callback => {
        try {
          callback(event);
        } catch (err) {
          console.error(`[GlobalSSE:${this.config.id}] Subscriber error:`, err);
        }
      });
    }

    // Dispatch to global subscribers
    this.globalSubscribers.forEach(callback => {
      try {
        callback(event);
      } catch (err) {
        console.error(`[GlobalSSE:${this.config.id}] Global subscriber error:`, err);
      }
    });
  }

  subscribe<T = unknown>(eventType: string, callback: SSEEventCallback<T>): UnsubscribeFn {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(callback as SSEEventCallback);

    return () => {
      const subs = this.subscribers.get(eventType);
      if (subs) {
        subs.delete(callback as SSEEventCallback);
        if (subs.size === 0) {
          this.subscribers.delete(eventType);
        }
      }
    };
  }

  subscribeAll(callback: SSEEventCallback): UnsubscribeFn {
    this.globalSubscribers.add(callback);
    return () => this.globalSubscribers.delete(callback);
  }

  private queueEvent(type: string, data: unknown) {
    if (this.offlineQueue.length >= this.maxQueueSize) {
      this.offlineQueue.shift(); // Remove oldest
    }
    this.offlineQueue.push({
      type,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  private flushOfflineQueue() {
    while (this.offlineQueue.length > 0) {
      const event = this.offlineQueue.shift()!;
      this.dispatchEvent(event.type, event.data);
    }
  }

  private cleanup() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  disconnect(): void {
    this.config.autoReconnect = false;
    this.cleanup();
    this.setStatus('disconnected');
    this.subscribers.clear();
    this.globalSubscribers.clear();
    this.statusListeners.clear();
  }
}

/**
 * GlobalSSEManager - Singleton manager for all SSE connections
 *
 * Usage:
 *   const manager = GlobalSSEManager.getInstance();
 *   manager.connect('multi-repo', '/api/multi-repo-stream');
 *   const unsub = manager.subscribe('multi-repo', 'repo_update', (event) => { ... });
 */
class GlobalSSEManagerClass {
  private static instance: GlobalSSEManagerClass | null = null;
  private connections = new Map<string, SSEConnection>();
  private healthListeners = new Set<(health: Map<string, SSEConnectionHealth>) => void>();

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): GlobalSSEManagerClass {
    if (!GlobalSSEManagerClass.instance) {
      GlobalSSEManagerClass.instance = new GlobalSSEManagerClass();
    }
    return GlobalSSEManagerClass.instance;
  }

  /**
   * Create or get a connection to an SSE endpoint
   */
  connect(id: string, url: string, config?: Partial<Omit<ConnectionConfig, 'id' | 'url'>>): SSEConnection {
    if (this.connections.has(id)) {
      return this.connections.get(id)!;
    }

    const connection = new SSEConnection({ id, url, ...config });
    this.connections.set(id, connection);

    // Track status changes for health monitoring
    connection.onStatusChange(() => {
      this.notifyHealthListeners();
    });

    connection.connect();
    return connection;
  }

  /**
   * Get an existing connection
   */
  getConnection(id: string): SSEConnection | undefined {
    return this.connections.get(id);
  }

  /**
   * Subscribe to events from a specific connection
   */
  subscribe<T = unknown>(
    connectionId: string,
    eventType: string,
    callback: SSEEventCallback<T>
  ): UnsubscribeFn {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.warn(`[GlobalSSE] No connection found with id: ${connectionId}`);
      return () => {};
    }
    return connection.subscribe(eventType, callback);
  }

  /**
   * Subscribe to all events from a specific connection
   */
  subscribeAll(connectionId: string, callback: SSEEventCallback): UnsubscribeFn {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.warn(`[GlobalSSE] No connection found with id: ${connectionId}`);
      return () => {};
    }
    return connection.subscribeAll(callback);
  }

  /**
   * Get health status of all connections
   */
  getHealth(): Map<string, SSEConnectionHealth> {
    const health = new Map<string, SSEConnectionHealth>();
    this.connections.forEach((connection, id) => {
      health.set(id, connection.health);
    });
    return health;
  }

  /**
   * Get overall connection status (worst status of all connections)
   */
  getOverallStatus(): ConnectionStatus {
    const statuses = Array.from(this.connections.values()).map(c => c.status);

    if (statuses.length === 0) return 'disconnected';
    if (statuses.every(s => s === 'connected')) return 'connected';
    if (statuses.some(s => s === 'reconnecting')) return 'reconnecting';
    if (statuses.some(s => s === 'connecting')) return 'connecting';
    return 'disconnected';
  }

  /**
   * Subscribe to health changes across all connections
   */
  onHealthChange(listener: (health: Map<string, SSEConnectionHealth>) => void): UnsubscribeFn {
    this.healthListeners.add(listener);
    return () => this.healthListeners.delete(listener);
  }

  private notifyHealthListeners() {
    const health = this.getHealth();
    this.healthListeners.forEach(listener => {
      try {
        listener(health);
      } catch (err) {
        console.error('[GlobalSSE] Health listener error:', err);
      }
    });
  }

  /**
   * Reconnect a specific connection
   */
  reconnect(id: string): void {
    const connection = this.connections.get(id);
    if (connection) {
      connection.reconnect();
    }
  }

  /**
   * Reconnect all connections
   */
  reconnectAll(): void {
    this.connections.forEach(connection => connection.reconnect());
  }

  /**
   * Disconnect a specific connection
   */
  disconnect(id: string): void {
    const connection = this.connections.get(id);
    if (connection) {
      connection.disconnect();
      this.connections.delete(id);
      this.notifyHealthListeners();
    }
  }

  /**
   * Disconnect all connections
   */
  disconnectAll(): void {
    this.connections.forEach(connection => connection.disconnect());
    this.connections.clear();
    this.healthListeners.clear();
  }

  /**
   * Get the number of active connections
   */
  get connectionCount(): number {
    return this.connections.size;
  }

  /**
   * Check if a connection exists
   */
  hasConnection(id: string): boolean {
    return this.connections.has(id);
  }
}

export const GlobalSSEManager = GlobalSSEManagerClass.getInstance();
export type { SSEConnection };
