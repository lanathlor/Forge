'use client';

import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/dashboard-cards';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  CheckCircle2,
  XCircle,
  PlayCircle,
  PauseCircle,
  Clock,
  FileText,
  GitBranch,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Zap,
  ChevronRight,
  RefreshCw,
  Loader2,
} from 'lucide-react';

/* ============================================
   TYPES & INTERFACES
   ============================================ */

export type ActivityType =
  // Task events
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'task_cancelled'
  // Session events
  | 'session_started'
  | 'session_paused'
  | 'session_resumed'
  | 'session_ended'
  // Plan events
  | 'plan_created'
  | 'plan_started'
  | 'plan_completed'
  | 'plan_failed'
  // QA gate events
  | 'qa_passed'
  | 'qa_failed';

export type ActivityStatus = 'success' | 'error' | 'warning' | 'info' | 'neutral';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: string;
  status: ActivityStatus;
  /** Link to navigate to details (e.g., task details, session, plan) */
  detailsLink?: string;
  /** Metadata for additional context */
  metadata?: {
    taskId?: string;
    sessionId?: string;
    planId?: string;
    repositoryName?: string;
    duration?: number; // in milliseconds
    qaGateName?: string;
  };
}

export interface RecentActivityProps {
  /** Activity items to display */
  items?: ActivityItem[];
  /** Loading state */
  loading?: boolean;
  /** Whether more items are being loaded */
  loadingMore?: boolean;
  /** Whether there are more items to load */
  hasMore?: boolean;
  /** Callback when "Load more" is clicked */
  onLoadMore?: () => void;
  /** Callback when refresh is clicked */
  onRefresh?: () => void;
  /** Callback when an activity item is clicked */
  onItemClick?: (item: ActivityItem) => void;
  /** Maximum height for the scroll container */
  maxHeight?: number | string;
  /** Additional className */
  className?: string;
}

/* ============================================
   ACTIVITY ICONS & STYLING
   ============================================ */

const ACTIVITY_ICONS: Record<ActivityType, React.ReactNode> = {
  // Task events
  task_started: <PlayCircle className="h-4 w-4" />,
  task_completed: <CheckCircle2 className="h-4 w-4" />,
  task_failed: <XCircle className="h-4 w-4" />,
  task_cancelled: <XCircle className="h-4 w-4" />,
  // Session events
  session_started: <Zap className="h-4 w-4" />,
  session_paused: <PauseCircle className="h-4 w-4" />,
  session_resumed: <PlayCircle className="h-4 w-4" />,
  session_ended: <CheckCircle2 className="h-4 w-4" />,
  // Plan events
  plan_created: <FileText className="h-4 w-4" />,
  plan_started: <GitBranch className="h-4 w-4" />,
  plan_completed: <CheckCircle2 className="h-4 w-4" />,
  plan_failed: <XCircle className="h-4 w-4" />,
  // QA gate events
  qa_passed: <ShieldCheck className="h-4 w-4" />,
  qa_failed: <ShieldAlert className="h-4 w-4" />,
};

const ACTIVITY_ICON_COLORS: Record<ActivityStatus, string> = {
  success: 'text-success',
  error: 'text-error',
  warning: 'text-warning',
  info: 'text-info',
  neutral: 'text-text-muted',
};

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  // Task events
  task_started: 'Started',
  task_completed: 'Completed',
  task_failed: 'Failed',
  task_cancelled: 'Cancelled',
  // Session events
  session_started: 'Session Started',
  session_paused: 'Paused',
  session_resumed: 'Resumed',
  session_ended: 'Session Ended',
  // Plan events
  plan_created: 'Created',
  plan_started: 'Executing',
  plan_completed: 'Completed',
  plan_failed: 'Failed',
  // QA gate events
  qa_passed: 'QA Passed',
  qa_failed: 'QA Failed',
};

const BADGE_VARIANTS: Record<ActivityStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  success: 'default',
  error: 'destructive',
  warning: 'secondary',
  info: 'outline',
  neutral: 'secondary',
};

/* ============================================
   HELPER FUNCTIONS
   ============================================ */

function formatRelativeTimestamp(timestamp: string): string {
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return 'Unknown time';
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h`;
}

/* ============================================
   SUBCOMPONENTS
   ============================================ */

interface ActivityIconProps {
  type: ActivityType;
  status: ActivityStatus;
}

function ActivityIcon({ type, status }: ActivityIconProps) {
  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
        'bg-surface-interactive',
        ACTIVITY_ICON_COLORS[status]
      )}
    >
      {ACTIVITY_ICONS[type]}
    </div>
  );
}

interface ActivityMetadataProps {
  item: ActivityItem;
}

function ActivityMetadata({ item }: ActivityMetadataProps) {
  return (
    <div className="mt-1.5 flex items-center gap-3 text-xs text-text-muted">
      <span className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {formatRelativeTimestamp(item.timestamp)}
      </span>
      {item.metadata?.duration !== undefined && (
        <span className="flex items-center gap-1">
          <Activity className="h-3 w-3" />
          {formatDuration(item.metadata.duration)}
        </span>
      )}
      {item.metadata?.repositoryName && (
        <span className="flex items-center gap-1 truncate">
          <GitBranch className="h-3 w-3" />
          {item.metadata.repositoryName}
        </span>
      )}
      {item.metadata?.qaGateName && (
        <span className="flex items-center gap-1">
          <Shield className="h-3 w-3" />
          {item.metadata.qaGateName}
        </span>
      )}
    </div>
  );
}

interface ActivityContentBodyProps {
  item: ActivityItem;
  showChevron?: boolean;
}

function ActivityContentBody({ item, showChevron }: ActivityContentBodyProps) {
  const label = ACTIVITY_LABELS[item.type];
  const badgeVariant = BADGE_VARIANTS[item.status];

  return (
    <div className="flex items-start gap-3 py-3">
      <ActivityIcon type={item.type} status={item.status} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-text-primary truncate max-w-[200px] sm:max-w-none">
            {item.title}
          </span>
          <Badge variant={badgeVariant} className="text-xs shrink-0">{label}</Badge>
        </div>
        {item.description && (
          <p className="mt-0.5 text-xs text-text-muted line-clamp-2">{item.description}</p>
        )}
        <ActivityMetadata item={item} />
      </div>
      {showChevron && (
        <ChevronRight className="h-4 w-4 shrink-0 text-text-muted group-hover:text-text-primary transition-colors" />
      )}
    </div>
  );
}

interface ActivityItemContentProps {
  item: ActivityItem;
  onClick?: () => void;
}

function ActivityItemContent({ item, onClick }: ActivityItemContentProps) {
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'group w-full text-left px-4 transition-colors duration-150',
          'hover:bg-surface-interactive focus-visible:bg-surface-interactive',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
        )}
      >
        <ActivityContentBody item={item} showChevron />
      </button>
    );
  }
  return (
    <div className="px-4">
      <ActivityContentBody item={item} />
    </div>
  );
}

function ActivitySkeletonItem() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

function ActivityEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-interactive">
        <Activity className="h-7 w-7 text-text-muted" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-text-primary">No activity yet</p>
        <p className="mt-1 text-xs text-text-muted max-w-[200px]">
          Activity from tasks, sessions, plans, and QA gates will appear here
        </p>
      </div>
    </div>
  );
}

interface ActivityListProps {
  items: ActivityItem[];
  onItemClick?: (item: ActivityItem) => void;
}

function ActivityList({ items, onItemClick }: ActivityListProps) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.id}>
          <ActivityItemContent
            item={item}
            onClick={onItemClick ? () => onItemClick(item) : undefined}
          />
        </li>
      ))}
    </ul>
  );
}

interface LoadMoreButtonProps {
  onClick: () => void;
  loading?: boolean;
}

function LoadMoreButton({ onClick, loading }: LoadMoreButtonProps) {
  return (
    <div className="p-4 border-t border-border">
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={loading}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading...
          </>
        ) : (
          'Load more'
        )}
      </Button>
    </div>
  );
}

interface ActivityHeaderProps {
  onRefresh?: () => void;
  loading?: boolean;
}

function ActivityHeader({ onRefresh, loading }: ActivityHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-border">
      <div>
        <h3 id="recent-activity-heading" className="text-base font-semibold text-text-primary">
          Recent Activity
        </h3>
        <p className="text-xs text-text-muted mt-0.5">Tasks, sessions, plans, and QA results</p>
      </div>
      {onRefresh && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </Button>
      )}
    </div>
  );
}

/* ============================================
   MAIN COMPONENT
   ============================================ */

const CARD_CLASSES = 'rounded-lg border bg-card shadow-sm overflow-hidden';

interface ActivityLoadingSkeletonProps {
  className?: string;
}

function ActivityLoadingSkeleton({ className }: ActivityLoadingSkeletonProps) {
  return (
    <section aria-labelledby="recent-activity-heading" className={cn(CARD_CLASSES, className)}>
      <ActivityHeader loading />
      <div className="divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <ActivitySkeletonItem key={i} />
        ))}
      </div>
    </section>
  );
}

interface ActivityContentSectionProps {
  items?: ActivityItem[];
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  onItemClick?: (item: ActivityItem) => void;
  maxHeight: string;
  className?: string;
}

function ActivityContentSection(props: ActivityContentSectionProps) {
  const { items, loadingMore, hasMore, onLoadMore, onRefresh, onItemClick, maxHeight, className } = props;
  const isEmpty = !items || items.length === 0;

  return (
    <section aria-labelledby="recent-activity-heading" className={cn(CARD_CLASSES, className)}>
      <ActivityHeader onRefresh={onRefresh} loading={loadingMore} />
      <div className="overflow-y-auto" style={{ maxHeight }}>
        {isEmpty ? <ActivityEmptyState /> : <ActivityList items={items} onItemClick={onItemClick} />}
      </div>
      {hasMore && onLoadMore && <LoadMoreButton onClick={onLoadMore} loading={loadingMore} />}
    </section>
  );
}

/** RecentActivity - Comprehensive activity feed with chronological events */
export function RecentActivity(props: RecentActivityProps) {
  const { loading, maxHeight = 400, className, ...rest } = props;
  const formattedMaxHeight = typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight;

  if (loading) return <ActivityLoadingSkeleton className={className} />;
  return <ActivityContentSection {...rest} maxHeight={formattedMaxHeight} className={className} />;
}

export default RecentActivity;
