'use client';

import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import { MultiRepoCommandCenter } from './MultiRepoCommandCenter';
import { QuickActions } from './QuickActions';
import { RecentActivity as RecentActivityFeed, type ActivityItem } from './RecentActivity';
import { useGetActivityQuery } from '@/features/activity/store/activityApi';
import { MetricsGrid, type MetricsData } from './MetricsGrid';
import { NeedsAttention } from './NeedsAttention';
import { useStuckDetection } from '@/shared/hooks/useStuckDetection';
import { useStuckToasts } from '@/shared/components/ui/toast';
import type { StuckAlert } from '@/lib/stuck-detection/types';

/* ============================================
   TYPES & INTERFACES
   ============================================ */

export interface SessionStatus {
  id: string;
  status: 'active' | 'paused' | 'idle' | 'completed';
  currentTask?: {
    id: string;
    title: string;
    progress?: number;
  };
  startedAt?: string;
  repositoryName: string;
}

/** @deprecated Use MetricsData from MetricsGrid instead */
export interface DashboardMetrics {
  tasksCompleted: number;
  tasksCompletedTrend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  tasksInProgress: number;
  tasksPending: number;
  successRate: number;
  successRateTrend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
}

// Re-export the new metrics type
export type { MetricsData };

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: 'default' | 'primary';
}

/** @deprecated Use ActivityItem from RecentActivity instead */
export interface RecentActivityItem {
  id: string;
  type: 'task_completed' | 'task_started' | 'task_failed' | 'session_created' | 'plan_approved';
  title: string;
  description?: string;
  timestamp: string;
  status?: 'success' | 'error' | 'info' | 'warning';
}

export interface DashboardOverviewProps {
  sessionStatus?: SessionStatus;
  /** @deprecated Use metricsData instead */
  metrics?: DashboardMetrics;
  /** New metrics data format for the enhanced MetricsGrid */
  metricsData?: MetricsData;
  /** @deprecated Use onNewTask instead - legacy prop kept for backward compatibility */
  quickActions?: QuickAction[];
  /** @deprecated Activity is now fetched automatically via RTK Query */
  recentActivity?: RecentActivityItem[];
  /** @deprecated Use onNewTask instead */
  onCreateTask?: () => void;
  onNewTask?: () => void;
  onStartSession?: () => void;
  onBrowsePlans?: () => void;
  onViewRepositories?: () => void;
  onPauseSession?: () => void;
  onResumeSession?: () => void;
  onSelectRepo?: (repositoryId: string) => void;
  onPauseRepo?: (repositoryId: string, sessionId: string) => void;
  onResumeRepo?: (repositoryId: string, sessionId: string) => void;
  onActivityItemClick?: (item: ActivityItem) => void;
  selectedRepoId?: string;
  loading?: boolean;
  className?: string;
}

/* ============================================
   LEGACY METRICS CONVERSION HELPER
   ============================================ */

/**
 * Converts legacy DashboardMetrics to new MetricsData format
 * for backward compatibility during migration
 */
function convertLegacyMetrics(metrics?: DashboardMetrics): MetricsData | undefined {
  if (!metrics) return undefined;
  return {
    tasksCompletedToday: metrics.tasksCompleted,
    tasksCompletedThisWeek: metrics.tasksCompleted * 5, // Estimate
    avgTaskDurationMinutes: 45, // Default estimate
    successRatePercent: metrics.successRate,
    pendingApprovals: metrics.tasksPending,
    qaPassRatePercent: metrics.successRate, // Use success rate as proxy
    trends: {
      tasksCompleted: metrics.tasksCompletedTrend,
      successRate: metrics.successRateTrend,
    },
  };
}

/* ============================================
   SECTION DIVIDER
   ============================================ */

function SectionDivider() {
  return <div className="border-t border-border-muted" />;
}

/* ============================================
   RECENT ACTIVITY WITH RTK QUERY
   ============================================ */

interface RecentActivitySectionProps {
  repositoryId?: string;
  onItemClick?: (item: ActivityItem) => void;
  loading?: boolean;
}

const ITEMS_PER_PAGE = 20;

function appendNewItems(prev: ActivityItem[], newData: ActivityItem[]): ActivityItem[] {
  const existingIds = new Set(prev.map((item) => item.id));
  const filtered = newData.filter((item) => !existingIds.has(item.id));
  return [...prev, ...filtered];
}

function useActivityPagination(repositoryId?: string) {
  const [offset, setOffset] = React.useState(0);
  const [allItems, setAllItems] = React.useState<ActivityItem[]>([]);

  const { data, isLoading, isFetching, refetch } = useGetActivityQuery(
    { repositoryId, limit: ITEMS_PER_PAGE, offset },
    { pollingInterval: 30000, skipPollingIfUnfocused: true }
  );

  React.useEffect(() => {
    if (!data?.items) return;
    setAllItems((prev) => offset === 0 ? data.items : appendNewItems(prev, data.items));
  }, [data, offset]);

  const handleLoadMore = React.useCallback(() => setOffset((prev) => prev + ITEMS_PER_PAGE), []);

  const handleRefresh = React.useCallback(() => {
    setOffset(0);
    setAllItems([]);
    refetch();
  }, [refetch]);

  return { allItems, data, isLoading, isFetching, offset, handleLoadMore, handleRefresh };
}

function RecentActivitySection({ repositoryId, onItemClick, loading: externalLoading }: RecentActivitySectionProps) {
  const { allItems, data, isLoading, isFetching, offset, handleLoadMore, handleRefresh } =
    useActivityPagination(repositoryId);

  return (
    <RecentActivityFeed
      items={allItems}
      loading={externalLoading || (isLoading && offset === 0)}
      loadingMore={isFetching && offset > 0}
      hasMore={data?.hasMore ?? false}
      onLoadMore={handleLoadMore}
      onRefresh={handleRefresh}
      onItemClick={onItemClick}
      maxHeight={400}
    />
  );
}

/* ============================================
   STUCK DETECTION INTEGRATION
   ============================================ */

function useStuckDetectionIntegration(
  onSelectRepo?: (repositoryId: string) => void
) {
  const { showStuckAlert, resolveStuckAlert } = useStuckToasts();

  const handleStuckDetected = React.useCallback((alert: StuckAlert) => {
    showStuckAlert(alert.repositoryId, alert.repositoryName, alert.reason, alert.stuckDurationSeconds, () => onSelectRepo?.(alert.repositoryId));
  }, [showStuckAlert, onSelectRepo]);

  const handleStuckResolved = React.useCallback((alert: StuckAlert) => {
    resolveStuckAlert(alert.repositoryId);
  }, [resolveStuckAlert]);

  useStuckDetection({ onStuckDetected: handleStuckDetected, onStuckResolved: handleStuckResolved });
}

/* ============================================
   MAIN DASHBOARD OVERVIEW COMPONENT
   ============================================ */

/** DashboardOverview - Comprehensive dashboard with metrics, actions, and activity */
export function DashboardOverview(props: DashboardOverviewProps) {
  const {
    metrics, metricsData, onCreateTask, onNewTask, onStartSession, onBrowsePlans,
    onViewRepositories, onSelectRepo, onPauseRepo, onResumeRepo, onActivityItemClick,
    selectedRepoId, loading, className,
  } = props;

  const resolvedMetrics = metricsData ?? convertLegacyMetrics(metrics);
  const handleNewTask = onNewTask ?? onCreateTask;

  useStuckDetectionIntegration(onSelectRepo);

  const handleNeedsAttentionSelect = React.useCallback((repositoryId: string, _sessionId?: string | null) => {
    onSelectRepo?.(repositoryId);
  }, [onSelectRepo]);

  return (
    <div className={cn('flex flex-col gap-6 sm:gap-8', className)}>
      <NeedsAttention onSelectRepo={handleNeedsAttentionSelect} maxVisible={3} />
      <MultiRepoCommandCenter onSelectRepo={onSelectRepo} onPauseRepo={onPauseRepo} onResumeRepo={onResumeRepo} selectedRepoId={selectedRepoId} maxVisible={8} />
      <MetricsGrid metrics={resolvedMetrics} loading={loading} />
      <SectionDivider />
      <QuickActions onNewTask={handleNewTask} onStartSession={onStartSession} onBrowsePlans={onBrowsePlans} onViewRepositories={onViewRepositories} loading={loading} />
      <SectionDivider />
      <RecentActivitySection repositoryId={selectedRepoId} onItemClick={onActivityItemClick} loading={loading} />
    </div>
  );
}

export default DashboardOverview;
