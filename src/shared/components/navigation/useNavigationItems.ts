/* eslint-disable max-lines-per-function, complexity */
'use client';

import { useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
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
    activeItemId,
    onNavigate,
    runningTasksCount = 0,
    pendingTasksCount = 0,
    hasActiveSession = false,
    sessionStatus = 'idle',
  } = options;

  // Get current pathname for automatic active state
  const pathname = usePathname();
  const router = useRouter();

  // Determine active item based on pathname if not explicitly provided
  const effectiveActiveItemId = activeItemId ?? (() => {
    if (pathname === '/dashboard' || pathname === '/') return 'dashboard';
    if (pathname?.startsWith('/tasks')) return 'tasks';
    if (pathname?.startsWith('/plans')) return 'plans';
    if (pathname?.startsWith('/repositories')) return 'repositories';
    if (pathname?.startsWith('/settings')) return 'settings';
    return 'dashboard';
  })();

  // Get state from Redux
  const currentSessionId = useSelector((state: RootState) => state.session.currentSessionId);
  const currentRepositoryId = useSelector((state: RootState) => state.session.currentRepositoryId);

  // Derive effective session state
  const effectiveHasActiveSession = hasActiveSession || !!currentSessionId;
  const totalTasksCount = runningTasksCount + pendingTasksCount;

  // Navigation handler factory - use Next.js router for navigation
  const createNavigationHandler = useCallback(
    (itemId: string, href?: string) => () => {
      if (href) {
        router.push(href);
      }
      onNavigate?.(itemId);
    },
    [onNavigate, router]
  );

  // Build navigation items
  const items: NavItem[] = useMemo(() => {
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? '⌘' : 'Ctrl+';

    return [
      // Primary navigation items
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        href: '/dashboard',
        priority: 'primary' as const,
        active: effectiveActiveItemId === 'dashboard',
        onClick: createNavigationHandler('dashboard', '/dashboard'),
        shortcutHint: `${modKey}1`,
        status: effectiveHasActiveSession
          ? sessionStatus === 'running'
            ? 'running'
            : sessionStatus === 'error'
            ? 'error'
            : 'active'
          : 'default',
        tooltip: effectiveHasActiveSession ? 'Active session in progress' : 'View dashboard',
      },
      {
        id: 'tasks',
        label: 'Tasks',
        icon: ListTodo,
        href: '/tasks',
        priority: 'primary' as const,
        active: effectiveActiveItemId === 'tasks',
        onClick: createNavigationHandler('tasks', '/tasks'),
        shortcutHint: `${modKey}2`,
        badge: totalTasksCount > 0 ? totalTasksCount : undefined,
        status: runningTasksCount > 0 ? 'running' : 'default',
        tooltip: totalTasksCount > 0 ? `${totalTasksCount} tasks (${runningTasksCount} running)` : 'No active tasks',
      },
      {
        id: 'plans',
        label: 'Plans',
        icon: Map,
        href: '/plans',
        priority: 'primary' as const,
        active: effectiveActiveItemId === 'plans',
        onClick: createNavigationHandler('plans', '/plans'),
        shortcutHint: `${modKey}3`,
        tooltip: 'View and manage plans',
      },
      {
        id: 'repositories',
        label: 'Repositories',
        icon: FolderGit2,
        href: '/repositories',
        priority: 'primary' as const,
        active: effectiveActiveItemId === 'repositories',
        onClick: createNavigationHandler('repositories', '/repositories'),
        shortcutHint: `${modKey}4`,
        badge: currentRepositoryId ? undefined : undefined, // Could show count of repos
        tooltip: currentRepositoryId ? 'Current repository selected' : 'Select a repository',
      },

      // Secondary navigation items
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        href: '/settings',
        priority: 'secondary' as const,
        active: effectiveActiveItemId === 'settings',
        onClick: createNavigationHandler('settings', '/settings'),
        shortcutHint: `${modKey},`,
        tooltip: 'Application settings',
      },
      {
        id: 'help',
        label: 'Help',
        icon: HelpCircle,
        priority: 'secondary' as const,
        active: effectiveActiveItemId === 'help',
        onClick: createNavigationHandler('help'),
        shortcutHint: `${modKey}?`,
        tooltip: 'Help and documentation',
      },
    ];
  }, [
    effectiveActiveItemId,
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
      dashboard: '1',
      tasks: '2',
      plans: '3',
      repositories: '4',
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
