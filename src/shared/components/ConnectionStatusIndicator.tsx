'use client';

import * as React from 'react';
import {
  useConnectionStatus,
  type ConnectionStatus,
} from '../contexts/SSEContext';
import { cn } from '../lib/utils';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Loader2,
  CloudOff,
  Pause,
  Activity,
} from 'lucide-react';

/* ============================================
   TYPES
   ============================================ */

interface ConnectionStatusIndicatorProps {
  /** Show detailed connection info on hover */
  showDetails?: boolean;
  /** Compact mode for smaller spaces */
  compact?: boolean;
  /** Additional class names */
  className?: string;
}

/* ============================================
   STATUS CONFIGURATION
   ============================================ */

interface StatusConfig {
  label: string;
  description: string;
  icon: React.ElementType;
  dotColor: string;
  textColor: string;
  animate?: boolean;
}

const STATUS_CONFIG: Record<ConnectionStatus, StatusConfig> = {
  connected: {
    label: 'Live',
    description: 'Real-time updates active',
    icon: Wifi,
    dotColor: 'bg-emerald-500',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    animate: false,
  },
  connecting: {
    label: 'Connecting',
    description: 'Establishing connection...',
    icon: Loader2,
    dotColor: 'bg-amber-500',
    textColor: 'text-amber-600 dark:text-amber-400',
    animate: true,
  },
  reconnecting: {
    label: 'Reconnecting',
    description: 'Connection lost, retrying...',
    icon: RefreshCw,
    dotColor: 'bg-amber-500',
    textColor: 'text-amber-600 dark:text-amber-400',
    animate: true,
  },
  disconnected: {
    label: 'Offline',
    description: 'No connection to server',
    icon: WifiOff,
    dotColor: 'bg-red-500',
    textColor: 'text-red-600 dark:text-red-400',
    animate: false,
  },
  paused: {
    label: 'Paused',
    description: 'Connection paused (page hidden)',
    icon: Pause,
    dotColor: 'bg-slate-400',
    textColor: 'text-slate-500 dark:text-slate-400',
    animate: false,
  },
};

/** Get appropriate status config based on network/connection state */
function getEffectiveStatus(
  status: ConnectionStatus,
  isOnline: boolean
): { config: StatusConfig; effectiveStatus: ConnectionStatus } {
  // If browser is offline, override status display
  if (!isOnline) {
    return {
      config: {
        label: 'No Network',
        description: 'Your device is offline',
        icon: CloudOff,
        dotColor: 'bg-slate-500',
        textColor: 'text-slate-600 dark:text-slate-400',
        animate: false,
      },
      effectiveStatus: 'disconnected',
    };
  }
  return { config: STATUS_CONFIG[status], effectiveStatus: status };
}

/* ============================================
   PULSING DOT COMPONENT
   ============================================ */

function StatusDot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {pulse && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
            color
          )}
        />
      )}
      <span
        className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', color)}
      />
    </span>
  );
}

/* ============================================
   TOOLTIP COMPONENT
   ============================================ */

interface TooltipProps {
  status: ConnectionStatus;
  reconnectAttempts: number;
  connectedCount: number;
  totalConnections: number;
  isOnline: boolean;
  queuedEventCount: number;
  averageLatency: number | null;
  onReconnect: () => void;
}

function TooltipHeader({ config }: { config: StatusConfig }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <StatusDot color={config.dotColor} pulse={config.animate} />
      <span className={cn('font-medium', config.textColor)}>
        {config.label}
      </span>
    </div>
  );
}

function TooltipStats({
  reconnectAttempts,
  connectedCount,
  totalConnections,
  isOnline,
  queuedEventCount,
  averageLatency,
}: Omit<TooltipProps, 'status' | 'onReconnect'>) {
  return (
    <div className="space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
      <div className="flex justify-between">
        <span>Network:</span>
        <span
          className={cn(
            'font-mono',
            isOnline ? 'text-emerald-500' : 'text-red-500'
          )}
        >
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
      <div className="flex justify-between">
        <span>Connections:</span>
        <span className="font-mono">
          {connectedCount}/{totalConnections}
        </span>
      </div>
      {averageLatency !== null && (
        <div className="flex justify-between">
          <span>Latency:</span>
          <span
            className={cn(
              'font-mono',
              averageLatency < 100
                ? 'text-emerald-500'
                : averageLatency < 500
                  ? 'text-amber-500'
                  : 'text-red-500'
            )}
          >
            {averageLatency}ms
          </span>
        </div>
      )}
      {reconnectAttempts > 0 && (
        <div className="flex justify-between">
          <span>Retry attempts:</span>
          <span className="font-mono">{reconnectAttempts}</span>
        </div>
      )}
      {queuedEventCount > 0 && (
        <div className="flex justify-between">
          <span>Queued events:</span>
          <span className="font-mono text-amber-500">{queuedEventCount}</span>
        </div>
      )}
    </div>
  );
}

function StatusTooltip({
  status,
  reconnectAttempts,
  connectedCount,
  totalConnections,
  isOnline,
  queuedEventCount,
  averageLatency,
  onReconnect,
}: TooltipProps) {
  const { config } = getEffectiveStatus(status, isOnline);
  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-border bg-popover p-3 shadow-lg">
      <TooltipHeader config={config} />
      <p className="mb-3 text-sm text-muted-foreground">{config.description}</p>
      <TooltipStats
        reconnectAttempts={reconnectAttempts}
        connectedCount={connectedCount}
        totalConnections={totalConnections}
        isOnline={isOnline}
        queuedEventCount={queuedEventCount}
        averageLatency={averageLatency}
      />
      {status !== 'connected' && isOnline && (
        <button
          onClick={onReconnect}
          className="mt-3 w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Reconnect Now
        </button>
      )}
    </div>
  );
}

/* ============================================
   MAIN COMPONENT
   ============================================ */

function StatusButton({
  config,
  status,
  isReconnecting,
  isOnline,
  compact,
  reconnect,
}: {
  config: StatusConfig;
  status: ConnectionStatus;
  isReconnecting: boolean;
  isOnline: boolean;
  compact: boolean;
  reconnect: () => void;
}) {
  const Icon = config.icon;
  const canReconnect = status !== 'connected' && isOnline;
  const handleClick = () => canReconnect && reconnect();
  return (
    <button
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted/50',
        canReconnect ? 'cursor-pointer' : 'cursor-default'
      )}
      title={config.description}
    >
      <StatusDot
        color={config.dotColor}
        pulse={config.animate || isReconnecting}
      />
      {!compact && (
        <>
          <Icon
            className={cn(
              'h-3.5 w-3.5',
              config.textColor,
              config.animate && 'animate-spin'
            )}
          />
          <span className={config.textColor}>{config.label}</span>
        </>
      )}
    </button>
  );
}

export function ConnectionStatusIndicator({
  showDetails = true,
  compact = false,
  className,
}: ConnectionStatusIndicatorProps) {
  const {
    status,
    isReconnecting,
    reconnectAttempts,
    totalConnections,
    connectedCount,
    isOnline,
    queuedEventCount,
    averageLatency,
    reconnect,
  } = useConnectionStatus();
  const [showTooltip, setShowTooltip] = React.useState(false);
  const { config } = getEffectiveStatus(status, isOnline);

  if (totalConnections === 0) return null;

  return (
    <div
      className={cn('relative inline-flex items-center', className)}
      onMouseEnter={() => showDetails && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <StatusButton
        config={config}
        status={status}
        isReconnecting={isReconnecting}
        isOnline={isOnline}
        compact={compact}
        reconnect={reconnect}
      />
      {showDetails && showTooltip && (
        <StatusTooltip
          status={status}
          reconnectAttempts={reconnectAttempts}
          connectedCount={connectedCount}
          totalConnections={totalConnections}
          isOnline={isOnline}
          queuedEventCount={queuedEventCount}
          averageLatency={averageLatency}
          onReconnect={reconnect}
        />
      )}
    </div>
  );
}

/* ============================================
   MINIMAL STATUS DOT FOR TIGHT SPACES
   ============================================ */

export function ConnectionStatusDot({ className }: { className?: string }) {
  const { status, isReconnecting, isOnline, reconnect } = useConnectionStatus();
  const { config } = getEffectiveStatus(status, isOnline);
  const canReconnect = status !== 'connected' && isOnline;

  return (
    <button
      onClick={() => canReconnect && reconnect()}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-full',
        'transition-colors hover:bg-muted/50',
        className
      )}
      title={`${config.label}: ${config.description}`}
    >
      <StatusDot
        color={config.dotColor}
        pulse={config.animate || isReconnecting}
      />
    </button>
  );
}

/* ============================================
   INLINE STATUS FOR HEADERS
   ============================================ */

export function ConnectionStatusInline({ className }: { className?: string }) {
  const { status, isOnline, averageLatency, reconnect } = useConnectionStatus();
  const { config } = getEffectiveStatus(status, isOnline);
  const Icon = config.icon;
  const canReconnect = status !== 'connected' && isOnline;

  return (
    <div className={cn('inline-flex items-center gap-1.5 text-xs', className)}>
      <StatusDot color={config.dotColor} pulse={config.animate} />
      <Icon
        className={cn(
          'h-3 w-3',
          config.textColor,
          config.animate && 'animate-spin'
        )}
      />
      <span className={config.textColor}>{config.label}</span>
      {status === 'connected' && averageLatency !== null && (
        <span className="ml-1 text-muted-foreground">({averageLatency}ms)</span>
      )}
      {canReconnect && (
        <button
          onClick={reconnect}
          className="ml-1 text-xs text-muted-foreground underline hover:no-underline"
        >
          retry
        </button>
      )}
    </div>
  );
}

/* ============================================
   LATENCY INDICATOR FOR PERFORMANCE-SENSITIVE UIs
   ============================================ */

interface LatencyIndicatorProps {
  className?: string;
  showLabel?: boolean;
}

export function LatencyIndicator({
  className,
  showLabel = false,
}: LatencyIndicatorProps) {
  const { status, averageLatency } = useConnectionStatus();

  if (status !== 'connected' || averageLatency === null) {
    return null;
  }

  const getLatencyColor = (latency: number) => {
    if (latency < 100) return 'text-emerald-500';
    if (latency < 300) return 'text-lime-500';
    if (latency < 500) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div className={cn('inline-flex items-center gap-1 text-xs', className)}>
      <Activity className={cn('h-3 w-3', getLatencyColor(averageLatency))} />
      {showLabel && <span className="text-muted-foreground">Latency:</span>}
      <span className={cn('font-mono', getLatencyColor(averageLatency))}>
        {averageLatency}ms
      </span>
    </div>
  );
}

export default ConnectionStatusIndicator;
