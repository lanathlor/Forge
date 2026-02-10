'use client';

import * as React from 'react';
import { createContext, useContext, useCallback, useState, useRef, useEffect } from 'react';
import { cn } from '@/shared/lib/utils';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle, Clock } from 'lucide-react';
import { Button } from './button';

/* ============================================
   TYPES
   ============================================ */

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'stuck';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
  /** For stuck toasts - repository info */
  repositoryName?: string;
  /** For stuck toasts - time stuck counter */
  timeStuck?: number;
  /** Callback when toast is dismissed */
  onDismiss?: () => void;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Toast>) => void;
  clearAll: () => void;
}

/* ============================================
   CONTEXT
   ============================================ */

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

/* ============================================
   PROVIDER
   ============================================ */

interface ToastProviderProps {
  children: React.ReactNode;
  /** Maximum number of toasts to show at once */
  maxToasts?: number;
  /** Default duration in ms (0 = no auto-dismiss) */
  defaultDuration?: number;
}

function useToastTimeouts() {
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const clearTimeout_ = useCallback((id: string) => {
    const timeout = timeoutsRef.current.get(id);
    if (timeout) { clearTimeout(timeout); timeoutsRef.current.delete(id); }
  }, []);

  const setTimeout_ = useCallback((id: string, callback: () => void, duration: number) => {
    const timeout = setTimeout(callback, duration);
    timeoutsRef.current.set(id, timeout);
  }, []);

  const clearAll = useCallback(() => {
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current.clear();
  }, []);

  useEffect(() => {
    const currentTimeouts = timeoutsRef.current;
    return () => { currentTimeouts.forEach(timeout => clearTimeout(timeout)); };
  }, []);

  return { clearTimeout: clearTimeout_, setTimeout: setTimeout_, clearAll };
}

function useToastActions(defaultDuration: number, maxToasts: number, timeouts: ReturnType<typeof useToastTimeouts>) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    timeouts.clearTimeout(id);
    setToasts(prev => {
      const toast = prev.find(t => t.id === id);
      toast?.onDismiss?.();
      return prev.filter(t => t.id !== id);
    });
  }, [timeouts]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const duration = toast.duration ?? defaultDuration;

    setToasts(prev => {
      const newToasts = [...prev, { ...toast, id }];
      if (newToasts.length > maxToasts) {
        const removed = newToasts.shift();
        if (removed) timeouts.clearTimeout(removed.id);
      }
      return newToasts;
    });

    if (duration > 0) timeouts.setTimeout(id, () => removeToast(id), duration);
    return id;
  }, [defaultDuration, maxToasts, removeToast, timeouts]);

  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const clearAll = useCallback(() => { timeouts.clearAll(); setToasts([]); }, [timeouts]);

  return { toasts, addToast, removeToast, updateToast, clearAll };
}

export function ToastProvider({ children, maxToasts = 5, defaultDuration = 5000 }: ToastProviderProps) {
  const timeouts = useToastTimeouts();
  const actions = useToastActions(defaultDuration, maxToasts, timeouts);

  return (
    <ToastContext.Provider value={actions}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

/* ============================================
   TOAST CONTAINER
   ============================================ */

function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-[100] flex flex-col gap-2',
        'max-w-md w-full pointer-events-none'
      )}
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast, index) => (
        <ToastItem key={toast.id} toast={toast} index={index} />
      ))}
    </div>
  );
}

/* ============================================
   TOAST ITEM
   ============================================ */

interface ToastItemProps {
  toast: Toast;
  index: number;
}

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; icon: React.ElementType }> = {
  default: {
    bg: 'bg-background',
    border: 'border-border',
    icon: Info,
  },
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: CheckCircle,
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-950/50',
    border: 'border-red-200 dark:border-red-800',
    icon: AlertCircle,
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    border: 'border-amber-200 dark:border-amber-800',
    icon: AlertTriangle,
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/50',
    border: 'border-blue-200 dark:border-blue-800',
    icon: Info,
  },
  stuck: {
    bg: 'bg-red-50 dark:bg-red-950/50',
    border: 'border-red-300 dark:border-red-700',
    icon: Clock,
  },
};

const VARIANT_ICON_COLORS: Record<ToastVariant, string> = {
  default: 'text-muted-foreground',
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-blue-600 dark:text-blue-400',
  stuck: 'text-red-600 dark:text-red-400',
};

function ToastContent({ toast }: { toast: Toast }) {
  return (
    <div className="flex-1">
      {toast.repositoryName && <p className="text-xs font-medium text-muted-foreground mb-0.5">{toast.repositoryName}</p>}
      <p className="text-sm font-semibold">{toast.title}</p>
      {toast.description && <p className="text-sm text-muted-foreground mt-1">{toast.description}</p>}
      {toast.timeStuck !== undefined && <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-mono">Stuck for {formatDuration(toast.timeStuck)}</p>}
    </div>
  );
}

function ToastDismissButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted/50" onClick={onClick}>
      <X className="h-4 w-4" /><span className="sr-only">Dismiss</span>
    </Button>
  );
}

function ToastActionButton({ action, onDismiss }: { action: Toast['action']; onDismiss: () => void }) {
  if (!action) return null;
  return (
    <Button variant="outline" size="sm" className="mt-2" onClick={() => { action.onClick(); onDismiss(); }}>
      {action.label}
    </Button>
  );
}

function ToastItem({ toast, index }: ToastItemProps) {
  const { removeToast } = useToast();
  const [isExiting, setIsExiting] = useState(false);

  const variant = toast.variant || 'default';
  const styles = VARIANT_STYLES[variant];
  const Icon = styles.icon;

  const handleDismiss = () => { setIsExiting(true); setTimeout(() => removeToast(toast.id), 150); };

  return (
    <div className={cn('pointer-events-auto flex items-start gap-3 p-4 rounded-lg border shadow-lg', 'transform transition-all duration-200', styles.bg, styles.border, isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0', 'animate-in slide-in-from-right-4')} style={{ animationDelay: `${index * 50}ms` }} role="alert">
      <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', VARIANT_ICON_COLORS[variant])} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <ToastContent toast={toast} />
          {toast.dismissible !== false && <ToastDismissButton onClick={handleDismiss} />}
        </div>
        <ToastActionButton action={toast.action} onDismiss={handleDismiss} />
      </div>
    </div>
  );
}

/* ============================================
   HELPER FUNCTIONS
   ============================================ */

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

/* ============================================
   CONVENIENCE HOOKS
   ============================================ */

/**
 * Hook for showing stuck alerts as toasts
 */
export function useStuckToasts() {
  const { addToast, updateToast, removeToast } = useToast();
  const activeToastsRef = useRef<Map<string, string>>(new Map());

  const showStuckAlert = useCallback((
    repositoryId: string,
    repositoryName: string,
    reason: string,
    timeStuck: number,
    onAction?: () => void
  ) => {
    const existingToastId = activeToastsRef.current.get(repositoryId);

    if (existingToastId) {
      // Update existing toast
      updateToast(existingToastId, { timeStuck });
    } else {
      // Create new toast
      const toastId = addToast({
        title: getStuckTitle(reason),
        description: getStuckDescription(reason),
        variant: 'stuck',
        repositoryName,
        timeStuck,
        duration: 0, // Don't auto-dismiss stuck toasts
        action: onAction ? { label: 'View', onClick: onAction } : undefined,
        onDismiss: () => {
          activeToastsRef.current.delete(repositoryId);
        },
      });
      activeToastsRef.current.set(repositoryId, toastId);
    }
  }, [addToast, updateToast]);

  const resolveStuckAlert = useCallback((repositoryId: string) => {
    const toastId = activeToastsRef.current.get(repositoryId);
    if (toastId) {
      removeToast(toastId);
      activeToastsRef.current.delete(repositoryId);
    }
  }, [removeToast]);

  return { showStuckAlert, resolveStuckAlert };
}

function getStuckTitle(reason: string): string {
  switch (reason) {
    case 'no_output':
      return 'No Response';
    case 'waiting_input':
      return 'Waiting for Input';
    case 'repeated_failures':
      return 'Repeated Failures';
    case 'qa_gate_blocked':
      return 'QA Gate Blocked';
    case 'timeout':
      return 'Task Timeout';
    default:
      return 'Needs Attention';
  }
}

function getStuckDescription(reason: string): string {
  switch (reason) {
    case 'no_output':
      return 'Claude hasn\'t responded for a while';
    case 'waiting_input':
      return 'Waiting for your approval or input';
    case 'repeated_failures':
      return 'Multiple consecutive failures detected';
    case 'qa_gate_blocked':
      return 'Blocked by QA gate check failure';
    case 'timeout':
      return 'Task execution has timed out';
    default:
      return 'Something needs your attention';
  }
}

export default ToastProvider;
