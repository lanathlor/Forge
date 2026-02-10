'use client';

import { useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  Activity,
  Map,
  FolderGit2,
  ListTodo,
  Settings,
  HelpCircle,
} from 'lucide-react';
import type { RootState } from '@/store';
import type { NavItem, StatusIndicator } from './Navigation';

export interface UseNavigationItemsOptions {
  /** Currently active navigation item ID */
  activeItemId?: string;
  /** Callback when a navigation item is clicked */
  onNavigate?: (itemId: string) => void;
  /** Number of running tasks */
  runningTasksCount?: number;
  /** Number of pending tasks */
  pendingTasksCount?: number;
  /** Whether there's an active session */
  hasActiveSession?: boolean;
  /** Current session status */
  sessionStatus?: 'idle' | 'running' | 'paused' | 'error';
}

export interface UseNavigationItemsResult {
  /** Navigation items configured with proper state */
  items: NavItem[];
  /** Status indicators for the navigation header */
  statusIndicators: StatusIndicator[];
  /** Keyboard shortcuts map */
  shortcuts: Record<string, string>;
}

/**
 * Hook to generate navigation items with proper state integration.
 * Connects to Redux store for session and task state.
 */
export function useNavigationItems(
  options: UseNavigationItemsOptions = {}
): UseNavigationItemsResult {
  const {
    activeItemId = 'sessions',
    onNavigate,
    runningTasksCount = 0,
    pendingTasksCount = 0,
    hasActiveSession = false,
    sessionStatus = 'idle',
  } = options;

  // Get state from Redux
  const currentSessionId = useSelector((state: RootState) => state.session.currentSessionId);
  const currentRepositoryId = useSelector((state: RootState) => state.session.currentRepositoryId);

  // Derive effective session state
  const effectiveHasActiveSession = hasActiveSession || !!currentSessionId;
  const totalTasksCount = runningTasksCount + pendingTasksCount;

  // Navigation handler factory
  const createNavigationHandler = useCallback(
    (itemId: string) => () => {
      onNavigate?.(itemId);
    },
    [onNavigate]
  );

  // Build navigation items
  const items: NavItem[] = useMemo(() => {
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? '⌘' : 'Ctrl+';

    return [
      // Primary navigation items
      {
        id: 'sessions',
        label: 'Sessions',
        icon: Activity,
        priority: 'primary' as const,
        active: activeItemId === 'sessions',
        onClick: createNavigationHandler('sessions'),
        shortcutHint: `${modKey}1`,
        status: effectiveHasActiveSession
          ? sessionStatus === 'running'
            ? 'running'
            : sessionStatus === 'error'
            ? 'error'
            : 'active'
          : 'default',
        tooltip: effectiveHasActiveSession ? 'Active session in progress' : 'Start a new session',
      },
      {
        id: 'plans',
        label: 'Plans',
        icon: Map,
        priority: 'primary' as const,
        active: activeItemId === 'plans',
        onClick: createNavigationHandler('plans'),
        shortcutHint: `${modKey}2`,
        tooltip: 'View and manage plans',
      },
      {
        id: 'repositories',
        label: 'Repositories',
        icon: FolderGit2,
        priority: 'primary' as const,
        active: activeItemId === 'repositories',
        onClick: createNavigationHandler('repositories'),
        shortcutHint: `${modKey}3`,
        badge: currentRepositoryId ? undefined : undefined, // Could show count of repos
        tooltip: currentRepositoryId ? 'Current repository selected' : 'Select a repository',
      },
      {
        id: 'tasks',
        label: 'Tasks',
        icon: ListTodo,
        priority: 'primary' as const,
        active: activeItemId === 'tasks',
        onClick: createNavigationHandler('tasks'),
        shortcutHint: `${modKey}4`,
        badge: totalTasksCount > 0 ? totalTasksCount : undefined,
        status: runningTasksCount > 0 ? 'running' : 'default',
        tooltip: totalTasksCount > 0 ? `${totalTasksCount} tasks (${runningTasksCount} running)` : 'No active tasks',
      },

      // Secondary navigation items
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        priority: 'secondary' as const,
        active: activeItemId === 'settings',
        onClick: createNavigationHandler('settings'),
        shortcutHint: `${modKey},`,
        tooltip: 'Application settings',
      },
      {
        id: 'help',
        label: 'Help',
        icon: HelpCircle,
        priority: 'secondary' as const,
        active: activeItemId === 'help',
        onClick: createNavigationHandler('help'),
        shortcutHint: `${modKey}?`,
        tooltip: 'Help and documentation',
      },
    ];
  }, [
    activeItemId,
    createNavigationHandler,
    effectiveHasActiveSession,
    sessionStatus,
    currentRepositoryId,
    totalTasksCount,
    runningTasksCount,
  ]);

  // Build status indicators
  const statusIndicators: StatusIndicator[] = useMemo(() => {
    const indicators: StatusIndicator[] = [];

    // Active session indicator
    if (effectiveHasActiveSession) {
      indicators.push({
        id: 'session',
        label: 'Session',
        value: sessionStatus === 'running' ? 'Running' : sessionStatus === 'paused' ? 'Paused' : 'Active',
        type: sessionStatus === 'running' ? 'success' : sessionStatus === 'error' ? 'error' : 'info',
        pulse: sessionStatus === 'running',
        onClick: onNavigate ? () => onNavigate('sessions') : undefined,
      });
    }

    // Running tasks indicator
    if (runningTasksCount > 0) {
      indicators.push({
        id: 'running-tasks',
        label: 'Running',
        value: runningTasksCount,
        type: 'info',
        pulse: true,
        onClick: onNavigate ? () => onNavigate('tasks') : undefined,
      });
    }

    // Pending tasks indicator
    if (pendingTasksCount > 0 && runningTasksCount === 0) {
      indicators.push({
        id: 'pending-tasks',
        label: 'Pending',
        value: pendingTasksCount,
        type: 'neutral',
        onClick: onNavigate ? () => onNavigate('tasks') : undefined,
      });
    }

    return indicators;
  }, [effectiveHasActiveSession, sessionStatus, runningTasksCount, pendingTasksCount, onNavigate]);

  // Keyboard shortcuts map
  const shortcuts: Record<string, string> = useMemo(
    () => ({
      sessions: '1',
      plans: '2',
      repositories: '3',
      tasks: '4',
      settings: ',',
      help: '/',
    }),
    []
  );

  return {
    items,
    statusIndicators,
    shortcuts,
  };
}

export default useNavigationItems;
