'use client';

import { type ReactNode, useCallback, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/shared/hooks';
import { hydrateFromStorage, setSidebarCollapsed, setCurrentRepository, setCurrentSession } from '@/features/sessions/store/sessionSlice';
import { Navigation, useNavigationItems } from '@/shared/components/navigation';
import { QuickSwitchDock } from './QuickSwitchDock';
import { StuckAlertToastManager } from './StuckAlertToastManager';
import { ConnectionStatusIndicator } from '@/shared/components/ConnectionStatusIndicator';
import { ReconnectingBanner } from '@/shared/components/ReconnectingBanner';
import { cn } from '@/shared/lib/utils';

export interface AppLayoutProps {
  /** The main content to render */
  children: ReactNode;
  /** Currently active navigation item ID */
  activeNavItem?: string;
  /** Additional class name for the layout container */
  className?: string;
}

/**
 * AppLayout provides the main application shell with responsive navigation.
 *
 * Features:
 * - Desktop sidebar with collapse toggle
 * - Mobile hamburger menu with slide-out drawer
 * - Status indicators for active sessions and running tasks
 * - Keyboard navigation support with global shortcuts
 * - Responsive breakpoint handling
 *
 * Usage:
 * ```tsx
 * <AppLayout activeNavItem="sessions">
 *   <DashboardContent />
 * </AppLayout>
 * ```
 */
export function AppLayout({
  children,
  activeNavItem,
  className,
}: AppLayoutProps) {
  const dispatch = useAppDispatch();
  const isSidebarCollapsed = useAppSelector(state => state.session.isSidebarCollapsed);
  const currentRepositoryId = useAppSelector(state => state.session.currentRepositoryId);

  // Hydrate state from localStorage on mount (client-side only)
  useEffect(() => {
    dispatch(hydrateFromStorage());
  }, [dispatch]);

  // Handle repo selection from QuickSwitchDock with zero page reload
  const handleDockSelectRepo = useCallback((repositoryId: string, sessionId?: string | null) => {
    dispatch(setCurrentRepository(repositoryId));
    if (sessionId) {
      dispatch(setCurrentSession(sessionId));
    }
  }, [dispatch]);

  // Handle stuck alert view action - navigates to the stuck repo
  const handleViewStuckAlert = useCallback((repositoryId: string, sessionId: string | null) => {
    dispatch(setCurrentRepository(repositoryId));
    if (sessionId) {
      dispatch(setCurrentSession(sessionId));
    }
  }, [dispatch]);

  // Navigation is now handled by Next.js routing, no need for local state

  // Get navigation items with integrated state from Redux
  // The activeItemId is automatically determined from the current pathname
  const { items, statusIndicators, shortcuts } = useNavigationItems({
    activeItemId: activeNavItem,
    // These would typically come from Redux selectors:
    runningTasksCount: 0, // TODO: Connect to actual task state
    pendingTasksCount: 0, // TODO: Connect to actual task state
    hasActiveSession: false, // TODO: Connect to actual session state
    sessionStatus: 'idle',
  });

  return (
    <div className={cn('flex h-screen w-full overflow-hidden', className)}>
      {/* Stuck Alert Toast Manager - Instant notifications for stuck repos */}
      <StuckAlertToastManager onViewAlert={handleViewStuckAlert} />

      {/* Navigation Sidebar / Mobile Menu */}
      <Navigation
        items={items}
        statusIndicators={statusIndicators}
        shortcuts={shortcuts}
        collapsed={isSidebarCollapsed}
        onCollapsedChange={(collapsed) => dispatch(setSidebarCollapsed(collapsed))}
        logo={
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg font-semibold text-text-primary truncate">
              Claude Code
            </span>
            <ConnectionStatusIndicator compact showDetails={false} className="flex-shrink-0" />
          </div>
        }
        mobileHeader={
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-text-primary">
              Claude Code
            </span>
            <ConnectionStatusIndicator compact showDetails={false} />
          </div>
        }
      />

      {/* Main Content Area */}
      <main
        className={cn(
          'flex-1 flex flex-col overflow-hidden',
          'bg-surface-default',
          // Add padding top for mobile header
          'pt-14 md:pt-0',
          // Add padding bottom for mobile tab bar
          'pb-16 md:pb-0'
        )}
      >
        {/* Reconnecting Banner - shown when SSE connection is lost/reconnecting */}
        <ReconnectingBanner />

        {/* Quick-Switch Repo Dock - Desktop: top bar, Mobile: bottom tab bar */}
        <QuickSwitchDock
          selectedRepoId={currentRepositoryId || undefined}
          onSelectRepo={handleDockSelectRepo}
          position="top"
        />

        {/* Page Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}

export default AppLayout;
