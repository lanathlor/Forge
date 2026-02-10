/* eslint-disable max-lines-per-function */
'use client';

import { type ReactNode, useState, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '@/shared/hooks';
import { setSidebarCollapsed } from '@/features/sessions/store/sessionSlice';
import { Navigation, useNavigationItems } from '@/shared/components/navigation';
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
  activeNavItem = 'sessions',
  className,
}: AppLayoutProps) {
  const dispatch = useAppDispatch();
  const isSidebarCollapsed = useAppSelector(state => state.session.isSidebarCollapsed);

  // Track active navigation for view switching (future: could route between views)
  const [currentNavItem, setCurrentNavItem] = useState(activeNavItem);

  // Navigation callback
  const handleNavigate = useCallback((itemId: string) => {
    setCurrentNavItem(itemId);
    // Future: Could implement routing here
    // router.push(`/${itemId}`);
  }, []);

  // Get navigation items with integrated state from Redux
  const { items, statusIndicators, shortcuts } = useNavigationItems({
    activeItemId: currentNavItem,
    onNavigate: handleNavigate,
    // These would typically come from Redux selectors:
    runningTasksCount: 0, // TODO: Connect to actual task state
    pendingTasksCount: 0, // TODO: Connect to actual task state
    hasActiveSession: false, // TODO: Connect to actual session state
    sessionStatus: 'idle',
  });

  return (
    <div className={cn('flex h-screen w-full overflow-hidden', className)}>
      {/* Navigation Sidebar / Mobile Menu */}
      <Navigation
        items={items}
        statusIndicators={statusIndicators}
        shortcuts={shortcuts}
        collapsed={isSidebarCollapsed}
        onCollapsedChange={(collapsed) => dispatch(setSidebarCollapsed(collapsed))}
        logo={
          <span className="text-lg font-semibold text-text-primary">
            Claude Code
          </span>
        }
        mobileHeader={
          <span className="text-lg font-semibold text-text-primary">
            Claude Code
          </span>
        }
      />

      {/* Main Content Area */}
      <main
        className={cn(
          'flex-1 flex flex-col overflow-hidden',
          'bg-surface-default',
          // Add padding top for mobile header
          'pt-14 md:pt-0'
        )}
      >
        {children}
      </main>
    </div>
  );
}

export default AppLayout;
