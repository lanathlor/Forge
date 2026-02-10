'use client';

import { useMemo } from 'react';
import { cn } from '@/shared/lib/utils';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { StatCard, ActionCard, ListCard, type ListCardItem } from '@/shared/components/ui/dashboard-cards';
import {
  Activity,
  CheckCircle2,
  Clock,
  Plus,
  GitBranch,
  FileCode,
  Zap,
  BarChart3,
  RefreshCw,
  PlayCircle,
  PauseCircle,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

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
  metrics?: DashboardMetrics;
  quickActions?: QuickAction[];
  recentActivity?: RecentActivityItem[];
  onCreateTask?: () => void;
  onStartSession?: () => void;
  onPauseSession?: () => void;
  onResumeSession?: () => void;
  loading?: boolean;
  className?: string;
}

/* ============================================
   HERO SECTION HELPERS
   ============================================ */

interface SessionStatusConfig {
  icon: LucideIcon;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const SESSION_STATUS_CONFIGS: Record<SessionStatus['status'], SessionStatusConfig> = {
  active: {
    icon: PlayCircle,
    label: 'Active Session',
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/20',
  },
  paused: {
    icon: PauseCircle,
    label: 'Session Paused',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/20',
  },
  idle: {
    icon: Clock,
    label: 'No Active Session',
    color: 'text-text-muted',
    bgColor: 'bg-muted/50',
    borderColor: 'border-border-default',
  },
  completed: {
    icon: CheckCircle2,
    label: 'Session Completed',
    color: 'text-info',
    bgColor: 'bg-info/10',
    borderColor: 'border-info/20',
  },
};

function HeroSkeleton() {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 animate-pulse rounded-xl bg-muted" />
            <div className="space-y-2">
              <div className="h-6 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="h-10 w-32 animate-pulse rounded-lg bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

function ActiveIndicator() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
    </span>
  );
}

interface SessionInfoProps {
  config: SessionStatusConfig;
  status: SessionStatus['status'];
  sessionStatus?: SessionStatus;
}

function SessionInfo({ config, status, sessionStatus }: SessionInfoProps) {
  const StatusIcon = config.icon;
  return (
    <div className="flex items-center gap-4">
      <div className={cn('flex h-14 w-14 items-center justify-center rounded-xl', config.bgColor)}>
        <StatusIcon className={cn('h-7 w-7', config.color)} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-text-primary">{config.label}</h2>
          {status === 'active' && <ActiveIndicator />}
        </div>
        {sessionStatus?.repositoryName && (
          <p className="mt-1 flex items-center gap-2 text-sm text-text-secondary">
            <GitBranch className="h-4 w-4" />
            {sessionStatus.repositoryName}
          </p>
        )}
        {sessionStatus?.currentTask && (
          <p className="mt-1 text-sm text-text-muted">Working on: {sessionStatus.currentTask.title}</p>
        )}
      </div>
    </div>
  );
}

interface SessionActionsProps {
  status: SessionStatus['status'];
  onStartSession?: () => void;
  onPauseSession?: () => void;
  onResumeSession?: () => void;
}

function SessionActions({ status, onStartSession, onPauseSession, onResumeSession }: SessionActionsProps) {
  return (
    <div className="flex items-center gap-3">
      {status === 'idle' && onStartSession && (
        <Button onClick={onStartSession} className="gap-2">
          <PlayCircle className="h-4 w-4" />
          Start Session
        </Button>
      )}
      {status === 'active' && onPauseSession && (
        <Button variant="outline" onClick={onPauseSession} className="gap-2">
          <PauseCircle className="h-4 w-4" />
          Pause
        </Button>
      )}
      {status === 'paused' && onResumeSession && (
        <Button onClick={onResumeSession} className="gap-2">
          <PlayCircle className="h-4 w-4" />
          Resume
        </Button>
      )}
    </div>
  );
}

interface TaskProgressBarProps {
  progress: number;
}

function TaskProgressBar({ progress }: TaskProgressBarProps) {
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-text-secondary">Task Progress</span>
        <span className="font-medium text-text-primary">{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-accent-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

interface HeroSectionProps {
  sessionStatus?: SessionStatus;
  onStartSession?: () => void;
  onPauseSession?: () => void;
  onResumeSession?: () => void;
  loading?: boolean;
}

function HeroSection({ sessionStatus, onStartSession, onPauseSession, onResumeSession, loading }: HeroSectionProps) {
  if (loading) return <HeroSkeleton />;

  const status = sessionStatus?.status || 'idle';
  const config = SESSION_STATUS_CONFIGS[status];
  const showProgress = sessionStatus?.currentTask?.progress !== undefined && status === 'active';

  return (
    <Card className={cn('relative overflow-hidden border-2 transition-colors', config.borderColor)}>
      <div className={cn('absolute inset-0 opacity-50', config.bgColor)} />
      <CardContent className="relative p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <SessionInfo config={config} status={status} sessionStatus={sessionStatus} />
          <SessionActions
            status={status}
            onStartSession={onStartSession}
            onPauseSession={onPauseSession}
            onResumeSession={onResumeSession}
          />
        </div>
        {showProgress && <TaskProgressBar progress={sessionStatus!.currentTask!.progress!} />}
      </CardContent>
    </Card>
  );
}

/* ============================================
   METRICS GRID HELPERS
   ============================================ */

interface MetricCardConfig {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  trend?: { value: string; direction: 'up' | 'down' | 'neutral'; label?: string };
  variant: 'default' | 'success' | 'primary' | 'warning' | 'error';
}

function formatTrend(
  trend?: { value: number; direction: 'up' | 'down' | 'neutral' },
  label?: string
): MetricCardConfig['trend'] {
  if (!trend) return undefined;
  return { value: `${trend.value}%`, direction: trend.direction, label };
}

function getMetricsValues(metrics?: DashboardMetrics) {
  return {
    tasksCompleted: metrics?.tasksCompleted ?? 0,
    tasksInProgress: metrics?.tasksInProgress ?? 0,
    tasksPending: metrics?.tasksPending ?? 0,
    successRate: metrics?.successRate ?? 0,
  };
}

function buildMetricCards(metrics?: DashboardMetrics): MetricCardConfig[] {
  const values = getMetricsValues(metrics);

  return [
    {
      icon: <CheckCircle2 className="h-5 w-5" />,
      value: values.tasksCompleted,
      label: 'Tasks Completed',
      trend: formatTrend(metrics?.tasksCompletedTrend, 'vs last week'),
      variant: 'success',
    },
    {
      icon: <Activity className="h-5 w-5" />,
      value: values.tasksInProgress,
      label: 'In Progress',
      variant: 'primary',
    },
    {
      icon: <Clock className="h-5 w-5" />,
      value: values.tasksPending,
      label: 'Pending Tasks',
      variant: 'warning',
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      value: `${values.successRate}%`,
      label: 'Success Rate',
      trend: formatTrend(metrics?.successRateTrend),
      variant: 'default',
    },
  ];
}

interface MetricsGridProps {
  metrics?: DashboardMetrics;
  loading?: boolean;
}

function MetricsGrid({ metrics, loading }: MetricsGridProps) {
  const metricCards = buildMetricCards(metrics);

  return (
    <section aria-labelledby="metrics-heading">
      <h3 id="metrics-heading" className="sr-only">Dashboard Metrics</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card, index) => (
          <StatCard
            key={index}
            icon={card.icon}
            value={card.value}
            label={card.label}
            trend={card.trend}
            variant={card.variant}
            loading={loading}
            size="sm"
          />
        ))}
      </div>
    </section>
  );
}

/* ============================================
   QUICK ACTIONS SECTION
   ============================================ */

const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { id: 'new-task', title: 'Create New Task', description: 'Start a new automated task', icon: <Plus className="h-5 w-5" />, variant: 'primary' },
  { id: 'browse-repos', title: 'Browse Repositories', description: 'View and manage your repos', icon: <GitBranch className="h-5 w-5" /> },
  { id: 'view-code', title: 'Code Explorer', description: 'Browse generated code changes', icon: <FileCode className="h-5 w-5" /> },
];

interface QuickActionsProps {
  quickActions?: QuickAction[];
  onCreateTask?: () => void;
  loading?: boolean;
}

function QuickActions({ quickActions, onCreateTask, loading }: QuickActionsProps) {
  const actions = quickActions || DEFAULT_QUICK_ACTIONS;

  return (
    <section aria-labelledby="quick-actions-heading">
      <div className="mb-4 flex items-center justify-between">
        <h3 id="quick-actions-heading" className="text-base font-semibold text-text-primary">Quick Actions</h3>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <ActionCard
            key={action.id}
            icon={action.icon}
            title={action.title}
            description={action.description}
            variant={action.variant === 'primary' ? 'primary' : 'default'}
            onClick={action.id === 'new-task' && onCreateTask ? onCreateTask : action.onClick}
            loading={loading}
            size="sm"
          />
        ))}
      </div>
    </section>
  );
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
  const listItems: ListCardItem[] = useMemo(() => {
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
export function DashboardOverview({
  sessionStatus,
  metrics,
  quickActions,
  recentActivity,
  onCreateTask,
  onStartSession,
  onPauseSession,
  onResumeSession,
  loading,
  className,
}: DashboardOverviewProps) {
  return (
    <div className={cn('flex flex-col gap-6 sm:gap-8', className)}>
      <HeroSection
        sessionStatus={sessionStatus}
        onStartSession={onStartSession}
        onPauseSession={onPauseSession}
        onResumeSession={onResumeSession}
        loading={loading}
      />

      <MetricsGrid metrics={metrics} loading={loading} />

      <SectionDivider />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-8">
        <div className="lg:col-span-3">
          <QuickActions quickActions={quickActions} onCreateTask={onCreateTask} loading={loading} />
        </div>
        <div className="lg:col-span-2">
          <RecentActivity recentActivity={recentActivity} loading={loading} />
        </div>
      </div>
    </div>
  );
}

export default DashboardOverview;
