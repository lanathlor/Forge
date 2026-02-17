'use client';

import * as React from 'react';
import { useConnectionStatus } from '../contexts/SSEContext';
import { WifiOff, RefreshCw, CloudOff } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * ReconnectingBanner
 *
 * Shows a non-intrusive banner at the top of the page when the SSE connection
 * is lost or reconnecting, so users always know the real-time status of their
 * connection without needing to manually refresh.
 *
 * - Automatically disappears when connection is restored.
 * - Provides a manual "Reconnect" button for impatient users.
 * - Respects reduced-motion preferences.
 */
export function ReconnectingBanner({ className }: { className?: string }) {
  const { status, isOnline, reconnect, reconnectAttempts } = useConnectionStatus();

  const isVisible = status === 'reconnecting' || status === 'disconnected' || !isOnline;

  if (!isVisible) return null;

  const isOffline = !isOnline;
  const isReconnecting = status === 'reconnecting';

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-2.5',
        'text-sm font-medium',
        'transition-all duration-300 ease-in-out',
        isOffline
          ? 'bg-slate-800 text-slate-100'
          : isReconnecting
          ? 'bg-amber-500 text-amber-950'
          : 'bg-red-600 text-red-50',
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {isOffline ? (
          <CloudOff className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        ) : isReconnecting ? (
          <RefreshCw className="h-4 w-4 flex-shrink-0 animate-spin" aria-hidden="true" />
        ) : (
          <WifiOff className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        )}
        <span className="truncate">
          {isOffline
            ? 'No network connection — updates paused'
            : isReconnecting
            ? `Reconnecting${reconnectAttempts > 1 ? ` (attempt ${reconnectAttempts})` : ''}… live updates may be delayed`
            : 'Connection lost — live updates paused'}
        </span>
      </div>

      {!isOffline && status !== 'connected' && (
        <button
          onClick={reconnect}
          className={cn(
            'flex-shrink-0 px-3 py-1 rounded-md text-xs font-semibold',
            'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2',
            isReconnecting
              ? 'bg-amber-950/20 hover:bg-amber-950/30 text-amber-950 focus-visible:ring-amber-800'
              : 'bg-red-50/20 hover:bg-red-50/30 text-red-50 focus-visible:ring-red-200'
          )}
          aria-label="Manually reconnect to server"
        >
          Reconnect now
        </button>
      )}
    </div>
  );
}

export default ReconnectingBanner;
