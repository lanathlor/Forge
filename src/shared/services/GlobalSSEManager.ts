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
 * - Network status awareness (online/offline detection)
 * - Page visibility optimization (pause when hidden)
 * - Connection quality metrics (latency history, jitter)
 */

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'paused';

export interface ConnectionQualityMetrics {
  /** Average latency over last N samples */
  averageLatency: number | null;
  /** Latency jitter (standard deviation) */
  jitter: number | null;
  /** Latency samples for calculation */
  latencySamples: number[];
  /** Number of successful connections */
  successfulConnections: number;
  /** Number of failed connections */
  failedConnections: number;
  /** Connection success rate (0-1) */
  successRate: number;
}

export interface SSEConnectionHealth {
  status: ConnectionStatus;
  lastHeartbeat: Date | null;
  reconnectAttempts: number;
  latency: number | null;
  uptime: number;
  /** Whether the browser is online */
  isOnline: boolean;
  /** Whether the page is visible */
  isVisible: boolean;
  /** Connection quality metrics */
  quality: ConnectionQualityMetrics;
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
  /** Pause connection when page is hidden */
  pauseWhenHidden?: boolean;
  /** Reconnect when page becomes visible */
  reconnectOnVisible?: boolean;
  /** Number of latency samples to keep for quality metrics */
  latencySampleSize?: number;
}

const DEFAULT_CONFIG = {
  autoReconnect: true,
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  heartbeatTimeout: 45000, // Servers send keep-alive every 30s, allow 15s buffer
  pauseWhenHidden: false, // Don't pause by default - we want live updates
  reconnectOnVisible: true, // Reconnect when page becomes visible
  latencySampleSize: 20, // Keep last 20 latency samples
};

/** Calculate quality metrics from latency samples */
function calculateQualityMetrics(
  samples: number[],
  successCount: number,
  failCount: number
): ConnectionQualityMetrics {
  if (samples.length === 0) {
    return {
      averageLatency: null,
      jitter: null,
      latencySamples: [],
      successfulConnections: successCount,
      failedConnections: failCount,
      successRate: successCount + failCount > 0 ? successCount / (successCount + failCount) : 1,
    };
  }

  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / samples.length;
  const jitter = Math.sqrt(variance);

  return {
    averageLatency: Math.round(avg),
    jitter: Math.round(jitter),
    latencySamples: [...samples],
    successfulConnections: successCount,
    failedConnections: failCount,
    successRate: successCount + failCount > 0 ? successCount / (successCount + failCount) : 1,
  };
}

class SSEConnection {
  private eventSource: EventSource | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private connectionStartTime: Date | null = null;
  private lastHeartbeat: Date | null = null;
  private lastEventTime: Date | null = null;
  private latency: number | null = null;
  private config: Required<ConnectionConfig>;
  private subscribers = new Map<string, Set<SSEEventCallback>>();
  private globalSubscribers = new Set<SSEEventCallback>();
  private offlineQueue: QueuedEvent[] = [];
  private maxQueueSize = 100;
  private _status: ConnectionStatus = 'disconnected';
  private statusListeners = new Set<(status: ConnectionStatus) => void>();

  // Network and visibility state
  private _isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private _isVisible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;
  private visibilityHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;

  // Quality metrics
  private latencySamples: number[] = [];
  private successfulConnections = 0;
  private failedConnections = 0;

  constructor(config: ConnectionConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupBrowserEventListeners();
  }

  /** Set up browser event listeners for network and visibility changes */
  private setupBrowserEventListeners(): void {
    if (typeof window === 'undefined') return;

    // Visibility change handler
    this.visibilityHandler = () => {
      const wasVisible = this._isVisible;
      this._isVisible = document.visibilityState === 'visible';

      if (this._isVisible && !wasVisible) {
        // Page became visible
        if (this.config.reconnectOnVisible && this._status === 'paused') {
          console.log(`[GlobalSSE:${this.config.id}] Page visible, reconnecting`);
          this.connect();
        } else if (this._status === 'disconnected' || this._status === 'reconnecting') {
          // Force immediate reconnect when page becomes visible
          this.reconnect();
        }
      } else if (!this._isVisible && wasVisible && this.config.pauseWhenHidden) {
        // Page became hidden - optionally pause
        console.log(`[GlobalSSE:${this.config.id}] Page hidden, pausing connection`);
        this.pause();
      }

      this.notifyStatusListeners();
    };

    // Online handler
    this.onlineHandler = () => {
      this._isOnline = true;
      console.log(`[GlobalSSE:${this.config.id}] Network online, reconnecting`);
      if (this._status === 'disconnected' || this._status === 'reconnecting' || this._status === 'paused') {
        this.reconnect();
      }
      this.notifyStatusListeners();
    };

    // Offline handler
    this.offlineHandler = () => {
      this._isOnline = false;
      console.log(`[GlobalSSE:${this.config.id}] Network offline`);
      // Don't disconnect - let the heartbeat timeout handle it
      // This allows the connection to survive brief network blips
      this.notifyStatusListeners();
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  /** Remove browser event listeners */
  private removeBrowserEventListeners(): void {
    if (typeof window === 'undefined') return;

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
    }
    if (this.offlineHandler) {
      window.removeEventListener('offline', this.offlineHandler);
    }
  }

  /** Pause the connection (for when page is hidden) */
  private pause(): void {
    if (this._status === 'paused') return;
    this.cleanup();
    this.setStatus('paused');
  }

  private notifyStatusListeners(): void {
    this.statusListeners.forEach(listener => listener(this._status));
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  get isOnline(): boolean {
    return this._isOnline;
  }

  get isVisible(): boolean {
    return this._isVisible;
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
      isOnline: this._isOnline,
      isVisible: this._isVisible,
      quality: calculateQualityMetrics(
        this.latencySamples,
        this.successfulConnections,
        this.failedConnections
      ),
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

  /** Named events to listen for from SSE endpoints */
  private static readonly NAMED_EVENTS = [
    'connected', 'bulk_update', 'repo_update', 'keep_alive',
    'task_update', 'task_output', 'qa_gate_update',
    'stuck_update', 'stuck_detected', 'stuck_resolved', 'stuck_escalated'
  ];

  /** Handle successful connection open */
  private handleOpen = () => {
    this.setStatus('connected');
    this.reconnectAttempts = 0;
    this.connectionStartTime = new Date();
    this.lastHeartbeat = new Date();
    this.successfulConnections++;
    this.startHeartbeatMonitor();
    this.flushOfflineQueue();
  };

  /** Set up event listeners on EventSource */
  private setupEventListeners(es: EventSource): void {
    es.onopen = this.handleOpen;
    es.onmessage = (event) => this.handleMessage(event);
    es.onerror = () => this.handleError();

    SSEConnection.NAMED_EVENTS.forEach(eventType => {
      es.addEventListener(eventType, (event) => {
        this.handleNamedEvent(eventType, event as MessageEvent);
      });
    });
  }

  connect(): void {
    if (!this._isOnline) {
      console.log(`[GlobalSSE:${this.config.id}] Cannot connect - browser is offline`);
      this.setStatus('disconnected');
      return;
    }

    this.cleanup();
    this.setStatus('connecting');

    try {
      const es = new EventSource(this.config.url);
      this.eventSource = es;
      this.setupEventListeners(es);
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

    // Calculate latency from last event, not last heartbeat
    // This gives a more accurate picture of connection responsiveness
    if (this.lastEventTime) {
      const eventLatency = now.getTime() - this.lastEventTime.getTime();
      // Only record reasonable latency values (under 60 seconds)
      if (eventLatency < 60000) {
        this.latency = eventLatency;
        this.latencySamples.push(eventLatency);
        // Keep only the configured number of samples
        if (this.latencySamples.length > this.config.latencySampleSize) {
          this.latencySamples.shift();
        }
      }
    }

    this.lastHeartbeat = now;
    this.lastEventTime = now;
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
    this.failedConnections++;
    this.setStatus('disconnected');
    this.cleanup();

    if (this.config.autoReconnect && this._isOnline) {
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
    this.removeBrowserEventListeners();
  }

  /** Reset quality metrics */
  resetQualityMetrics(): void {
    this.latencySamples = [];
    this.successfulConnections = 0;
    this.failedConnections = 0;
  }

  /** Get the number of queued events */
  get queuedEventCount(): number {
    return this.offlineQueue.length;
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
  private networkListeners = new Set<(isOnline: boolean) => void>();
  private visibilityListeners = new Set<(isVisible: boolean) => void>();
  private _isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private _isVisible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;

  private constructor() {
    // Private constructor for singleton
    this.setupGlobalBrowserListeners();
  }

  /** Setup global browser event listeners for network and visibility */
  private setupGlobalBrowserListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this._isOnline = true;
      this.notifyNetworkListeners(true);
    });

    window.addEventListener('offline', () => {
      this._isOnline = false;
      this.notifyNetworkListeners(false);
    });

    document.addEventListener('visibilitychange', () => {
      this._isVisible = document.visibilityState === 'visible';
      this.notifyVisibilityListeners(this._isVisible);
    });
  }

  private notifyNetworkListeners(isOnline: boolean): void {
    this.networkListeners.forEach(listener => {
      try {
        listener(isOnline);
      } catch (err) {
        console.error('[GlobalSSE] Network listener error:', err);
      }
    });
  }

  private notifyVisibilityListeners(isVisible: boolean): void {
    this.visibilityListeners.forEach(listener => {
      try {
        listener(isVisible);
      } catch (err) {
        console.error('[GlobalSSE] Visibility listener error:', err);
      }
    });
  }

  /** Subscribe to network status changes */
  onNetworkChange(listener: (isOnline: boolean) => void): UnsubscribeFn {
    this.networkListeners.add(listener);
    return () => this.networkListeners.delete(listener);
  }

  /** Subscribe to visibility changes */
  onVisibilityChange(listener: (isVisible: boolean) => void): UnsubscribeFn {
    this.visibilityListeners.add(listener);
    return () => this.visibilityListeners.delete(listener);
  }

  /** Check if browser is online */
  get isOnline(): boolean {
    return this._isOnline;
  }

  /** Check if page is visible */
  get isVisible(): boolean {
    return this._isVisible;
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

  /**
   * Get total queued events across all connections
   */
  get totalQueuedEvents(): number {
    let total = 0;
    this.connections.forEach(connection => {
      total += connection.queuedEventCount;
    });
    return total;
  }

  /**
   * Get aggregated quality metrics across all connections
   */
  getAggregatedQuality(): ConnectionQualityMetrics {
    const allSamples: number[] = [];
    let totalSuccess = 0;
    let totalFailed = 0;

    this.connections.forEach(connection => {
      const health = connection.health;
      allSamples.push(...health.quality.latencySamples);
      totalSuccess += health.quality.successfulConnections;
      totalFailed += health.quality.failedConnections;
    });

    return calculateQualityMetrics(allSamples, totalSuccess, totalFailed);
  }

  /**
   * Reset quality metrics for all connections
   */
  resetAllQualityMetrics(): void {
    this.connections.forEach(connection => {
      connection.resetQualityMetrics();
    });
  }
}

export const GlobalSSEManager = GlobalSSEManagerClass.getInstance();
export type { SSEConnection };
