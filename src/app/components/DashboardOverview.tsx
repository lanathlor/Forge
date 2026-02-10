'use client';

import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { ListCard, type ListCardItem } from '@/shared/components/ui/dashboard-cards';
import { MultiRepoCommandCenter } from './MultiRepoCommandCenter';
import { QuickActions } from './QuickActions';
import {
  Activity,
  CheckCircle2,
  Zap,
  RefreshCw,
  PlayCircle,
  XCircle,
} from 'lucide-react';
import { MetricsGrid, type MetricsData } from './MetricsGrid';

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
   RECENT ACTIVITY HELPERS
   ============================================ */

const ACTIVITY_ICONS: Record<RecentActivityItem['type'], React.ReactNode> = {
  task_completed: <CheckCircle2 className="h-4 w-4 text-success" />,
  task_started: <PlayCircle className="h-4 w-4 text-info" />,
  task_failed: <XCircle className="h-4 w-4 text-error" />,
  session_created: <Zap className="h-4 w-4 text-accent-primary" />,
  plan_approved: <CheckCircle2 className="h-4 w-4 text-success" />,
};

const ACTIVITY_BADGES: Record<RecentActivityItem['type'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  task_completed: { label: 'Completed', variant: 'default' },
  task_started: { label: 'Started', variant: 'secondary' },
  task_failed: { label: 'Failed', variant: 'destructive' },
  session_created: { label: 'New Session', variant: 'outline' },
  plan_approved: { label: 'Approved', variant: 'default' },
};

function formatRelativeTime(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

interface ActivityItemContentProps {
  item: RecentActivityItem;
}

function ActivityItemContent({ item }: ActivityItemContentProps) {
  const badge = ACTIVITY_BADGES[item.type];
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0">{ACTIVITY_ICONS[item.type]}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-text-primary">{item.title}</span>
          <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
        </div>
        {item.description && <p className="mt-0.5 truncate text-xs text-text-muted">{item.description}</p>}
        <p className="mt-1 text-xs text-text-muted">{formatRelativeTime(item.timestamp)}</p>
      </div>
    </div>
  );
}

function ActivityEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <Activity className="h-8 w-8 text-text-muted" />
      <p className="text-sm text-text-muted">No recent activity</p>
    </div>
  );
}

interface RecentActivityProps {
  recentActivity?: RecentActivityItem[];
  loading?: boolean;
}

function RecentActivity({ recentActivity, loading }: RecentActivityProps) {
  const listItems: ListCardItem[] = React.useMemo(() => {
    if (!recentActivity) return [];
    return recentActivity.map((item) => ({
      id: item.id,
      content: <ActivityItemContent item={item} />,
    }));
  }, [recentActivity]);

  return (
    <section aria-labelledby="recent-activity-heading">
      <ListCard
        title={<span id="recent-activity-heading" className="text-base font-semibold">Recent Activity</span>}
        items={listItems}
        maxHeight={320}
        emptyState={<ActivityEmptyState />}
        loading={loading}
        loadingItemCount={4}
        headerAction={
          <Button variant="ghost" size="sm" className="gap-1 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />
    </section>
  );
}

/* ============================================
   SECTION DIVIDER
   ============================================ */

function SectionDivider() {
  return <div className="border-t border-border-muted" />;
}

/* ============================================
   MAIN DASHBOARD OVERVIEW COMPONENT
   ============================================ */

/**
 * DashboardOverview Component
 *
 * A comprehensive dashboard view with:
 * - Hero section for active session status
 * - Metrics grid (1 col mobile, 2 cols tablet, 4 cols desktop)
 * - Quick actions area
 * - Recent activity feed
 *
 * Uses CSS Grid with responsive columns and proper spacing.
 */
// eslint-disable-next-line max-lines-per-function
export function DashboardOverview({
  sessionStatus: _sessionStatus,
  metrics,
  metricsData,
  quickActions: _quickActions,
  recentActivity,
  onCreateTask,
  onNewTask,
  onStartSession,
  onBrowsePlans,
  onViewRepositories,
  onPauseSession: _onPauseSession,
  onResumeSession: _onResumeSession,
  onSelectRepo,
  onPauseRepo,
  onResumeRepo,
  selectedRepoId,
  loading,
  className,
}: DashboardOverviewProps) {
  // Support both new metricsData and legacy metrics props
  const resolvedMetrics = metricsData ?? convertLegacyMetrics(metrics);

  // Support both legacy onCreateTask and new onNewTask
  const handleNewTask = onNewTask ?? onCreateTask;

  return (
    <div className={cn('flex flex-col gap-6 sm:gap-8', className)}>
      {/* Multi-Repo Command Center - Primary hero section */}
      <MultiRepoCommandCenter
        onSelectRepo={onSelectRepo}
        onPauseRepo={onPauseRepo}
        onResumeRepo={onResumeRepo}
        selectedRepoId={selectedRepoId}
        maxVisible={8}
      />

      <MetricsGrid metrics={resolvedMetrics} loading={loading} />

      <SectionDivider />

      {/* Quick Actions - Full width for better touch accessibility */}
      <QuickActions
        onNewTask={handleNewTask}
        onStartSession={onStartSession}
        onBrowsePlans={onBrowsePlans}
        onViewRepositories={onViewRepositories}
        loading={loading}
      />

      <SectionDivider />

      {/* Recent Activity */}
      <RecentActivity recentActivity={recentActivity} loading={loading} />
    </div>
  );
}

export default DashboardOverview;
