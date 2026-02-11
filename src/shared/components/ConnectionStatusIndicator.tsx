'use client';

import * as React from 'react';
import { useConnectionStatus, type ConnectionStatus } from '../contexts/SSEContext';
import { cn } from '../lib/utils';
import { Wifi, WifiOff, RefreshCw, Loader2 } from 'lucide-react';

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
};

/* ============================================
   PULSING DOT COMPONENT
   ============================================ */

function StatusDot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {pulse && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
            color
          )}
        />
      )}
      <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', color)} />
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
  onReconnect: () => void;
}

function TooltipHeader({ config }: { config: StatusConfig }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <StatusDot color={config.dotColor} pulse={config.animate} />
      <span className={cn('font-medium', config.textColor)}>{config.label}</span>
    </div>
  );
}

function TooltipStats({ reconnectAttempts, connectedCount, totalConnections }: Omit<TooltipProps, 'status' | 'onReconnect'>) {
  return (
    <div className="space-y-1 text-xs text-muted-foreground border-t border-border pt-2">
      <div className="flex justify-between">
        <span>Connections:</span>
        <span className="font-mono">{connectedCount}/{totalConnections}</span>
      </div>
      {reconnectAttempts > 0 && (
        <div className="flex justify-between">
          <span>Retry attempts:</span>
          <span className="font-mono">{reconnectAttempts}</span>
        </div>
      )}
    </div>
  );
}

function StatusTooltip({ status, reconnectAttempts, connectedCount, totalConnections, onReconnect }: TooltipProps) {
  const config = STATUS_CONFIG[status];
  return (
    <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-popover border border-border rounded-lg shadow-lg z-50">
      <TooltipHeader config={config} />
      <p className="text-sm text-muted-foreground mb-3">{config.description}</p>
      <TooltipStats reconnectAttempts={reconnectAttempts} connectedCount={connectedCount} totalConnections={totalConnections} />
      {status !== 'connected' && (
        <button onClick={onReconnect} className="mt-3 w-full px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          Reconnect Now
        </button>
      )}
    </div>
  );
}

/* ============================================
   MAIN COMPONENT
   ============================================ */

function StatusButton({ config, status, isReconnecting, compact, reconnect }: {
  config: StatusConfig;
  status: ConnectionStatus;
  isReconnecting: boolean;
  compact: boolean;
  reconnect: () => void;
}) {
  const Icon = config.icon;
  const handleClick = () => status !== 'connected' && reconnect();
  return (
    <button
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors hover:bg-muted/50',
        status !== 'connected' ? 'cursor-pointer' : 'cursor-default'
      )}
      title={config.description}
    >
      <StatusDot color={config.dotColor} pulse={config.animate || isReconnecting} />
      {!compact && (
        <>
          <Icon className={cn('h-3.5 w-3.5', config.textColor, config.animate && 'animate-spin')} />
          <span className={config.textColor}>{config.label}</span>
        </>
      )}
    </button>
  );
}

export function ConnectionStatusIndicator({ showDetails = true, compact = false, className }: ConnectionStatusIndicatorProps) {
  const { status, isReconnecting, reconnectAttempts, totalConnections, connectedCount, reconnect } = useConnectionStatus();
  const [showTooltip, setShowTooltip] = React.useState(false);
  const config = STATUS_CONFIG[status];

  if (totalConnections === 0) return null;

  return (
    <div className={cn('relative inline-flex items-center', className)} onMouseEnter={() => showDetails && setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
      <StatusButton config={config} status={status} isReconnecting={isReconnecting} compact={compact} reconnect={reconnect} />
      {showDetails && showTooltip && (
        <StatusTooltip status={status} reconnectAttempts={reconnectAttempts} connectedCount={connectedCount} totalConnections={totalConnections} onReconnect={reconnect} />
      )}
    </div>
  );
}

/* ============================================
   MINIMAL STATUS DOT FOR TIGHT SPACES
   ============================================ */

export function ConnectionStatusDot({ className }: { className?: string }) {
  const { status, isReconnecting, reconnect } = useConnectionStatus();
  const config = STATUS_CONFIG[status];

  return (
    <button
      onClick={() => status !== 'connected' && reconnect()}
      className={cn(
        'inline-flex items-center justify-center w-6 h-6 rounded-full',
        'hover:bg-muted/50 transition-colors',
        className
      )}
      title={`${config.label}: ${config.description}`}
    >
      <StatusDot color={config.dotColor} pulse={config.animate || isReconnecting} />
    </button>
  );
}

/* ============================================
   INLINE STATUS FOR HEADERS
   ============================================ */

export function ConnectionStatusInline({ className }: { className?: string }) {
  const { status, reconnect } = useConnectionStatus();
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

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
      {status !== 'connected' && (
        <button
          onClick={reconnect}
          className="ml-1 text-xs underline hover:no-underline text-muted-foreground"
        >
          retry
        </button>
      )}
    </div>
  );
}

export default ConnectionStatusIndicator;
