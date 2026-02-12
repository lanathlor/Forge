'use client';

import { useMemo } from 'react';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import type { RepoSnapshot, RepoEvent } from '@/features/sessions/store/repoSnapshotSlice';
import {
  X,
  Play,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  Loader2,
  Pen,
  Eye,
  Zap,
  Activity,
  ArrowRight,
  BarChart3,
} from 'lucide-react';
import type { ClaudeStatus } from '@/shared/hooks/useMultiRepoStream';

interface RepoContextSnapshotProps {
  snapshot: RepoSnapshot;
  onDismiss: () => void;
  onResumeTask: () => void;
  onSelectTask?: (taskId: string) => void;
}

const STATUS_CONFIG: Record<ClaudeStatus, {
  label: string;
  color: string;
  bgColor: string;
  dotColor: string;
  icon: typeof Activity;
  animate?: boolean;
}> = {
  idle: {
    label: 'Idle',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/30',
    dotColor: 'bg-gray-400',
    icon: Activity,
  },
  thinking: {
    label: 'Thinking...',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    dotColor: 'bg-blue-500',
    icon: Loader2,
    animate: true,
  },
  writing: {
    label: 'Writing code',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    dotColor: 'bg-emerald-500',
    icon: Pen,
    animate: true,
  },
  waiting_input: {
    label: 'Waiting for you',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    dotColor: 'bg-amber-500',
    icon: Clock,
  },
  stuck: {
    label: 'Stuck',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    dotColor: 'bg-red-500',
    icon: AlertTriangle,
  },
  paused: {
    label: 'Paused',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/30',
    dotColor: 'bg-gray-400',
    icon: Activity,
  },
};

const EVENT_CONFIG: Record<RepoEvent['type'], { icon: typeof CheckCircle2; color: string }> = {
  task_completed: { icon: CheckCircle2, color: 'text-emerald-500' },
  task_failed: { icon: XCircle, color: 'text-red-500' },
  approval_needed: { icon: Eye, color: 'text-amber-500' },
  qa_failed: { icon: ShieldAlert, color: 'text-orange-500' },
  stuck: { icon: AlertTriangle, color: 'text-red-500' },
  plan_updated: { icon: Zap, color: 'text-blue-500' },
};

function formatTimeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// --- Sub-components ---

function LiveStatusPill({ status, activity }: { status: ClaudeStatus; activity?: string | null }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const isActive = status === 'thinking' || status === 'writing';

  return (
    <div className={cn(
      'inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium',
      config.bgColor,
      config.color,
    )}>
      <span className="relative flex h-2 w-2">
        {isActive && (
          <span className={cn(
            'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
            config.dotColor,
          )} />
        )}
        <span className={cn('relative inline-flex rounded-full h-2 w-2', config.dotColor)} />
      </span>
      <Icon className={cn('h-3 w-3', config.animate && 'animate-spin')} />
      <span>{activity || config.label}</span>
    </div>
  );
}

function SessionProgressBar({ stats }: { stats: NonNullable<RepoSnapshot['sessionStats']> }) {
  const completedPct = stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0;
  const failedPct = stats.totalTasks > 0 ? (stats.failedTasks / stats.totalTasks) * 100 : 0;
  const runningPct = stats.totalTasks > 0 ? (stats.runningTasks / stats.totalTasks) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      <BarChart3 className="h-3 w-3 text-muted-foreground shrink-0" />
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex">
          {completedPct > 0 && (
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${completedPct}%` }}
            />
          )}
          {runningPct > 0 && (
            <div
              className="h-full bg-blue-500 animate-pulse transition-all duration-500"
              style={{ width: `${runningPct}%` }}
            />
          )}
          {failedPct > 0 && (
            <div
              className="h-full bg-red-500 transition-all duration-500"
              style={{ width: `${failedPct}%` }}
            />
          )}
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
          {stats.completedTasks}/{stats.totalTasks}
        </span>
      </div>
    </div>
  );
}

function UrgentAlerts({ pendingApprovals, stuckItems }: { pendingApprovals: number; stuckItems: number }) {
  if (pendingApprovals === 0 && stuckItems === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {stuckItems > 0 && (
        <Badge
          variant="outline"
          className="text-[10px] border-red-400/50 dark:border-red-700/50 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 gap-1"
        >
          <AlertTriangle className="h-2.5 w-2.5" />
          {stuckItems} stuck
        </Badge>
      )}
      {pendingApprovals > 0 && (
        <Badge
          variant="outline"
          className="text-[10px] border-amber-400/50 dark:border-amber-700/50 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 gap-1"
        >
          <Eye className="h-2.5 w-2.5" />
          {pendingApprovals} approval{pendingApprovals > 1 ? 's' : ''}
        </Badge>
      )}
    </div>
  );
}

function CurrentTaskCard({
  task,
  onResume,
}: {
  task: NonNullable<RepoSnapshot['currentTask']>;
  onResume: () => void;
}) {
  const isRunning = task.status === 'running' || task.status === 'pre_flight';

  return (
    <button
      onClick={onResume}
      className={cn(
        'w-full text-left p-2 rounded-md border transition-all group',
        'hover:shadow-sm',
        isRunning
          ? 'border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/30'
          : 'border-border/50 bg-surface-raised hover:bg-muted/50',
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-0.5">Current task</p>
          <p className="text-sm truncate">{task.prompt}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant="outline"
            className={cn(
              'text-[10px]',
              isRunning && 'border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400',
            )}
          >
            {task.status.replace('_', ' ')}
          </Badge>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      {task.progress !== undefined && task.progress > 0 && (
        <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(task.progress, 100)}%` }}
          />
        </div>
      )}
    </button>
  );
}

function RecentEventsList({
  events,
  onSelectTask,
}: {
  events: RepoEvent[];
  onSelectTask?: (taskId: string) => void;
}) {
  if (events.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
        Recent
      </p>
      <div className="space-y-0.5">
        {events.slice(0, 3).map((event) => {
          const config = EVENT_CONFIG[event.type];
          const Icon = config.icon;
          const isClickable = !!event.taskId && !!onSelectTask;

          return (
            <button
              key={event.id}
              onClick={() => event.taskId && onSelectTask?.(event.taskId)}
              disabled={!isClickable}
              className={cn(
                'flex items-center gap-2 w-full text-left py-1 rounded-sm',
                isClickable && 'hover:bg-muted/40 px-1 -mx-1 cursor-pointer',
                !isClickable && 'cursor-default',
              )}
            >
              <Icon className={cn('h-3 w-3 shrink-0', config.color)} />
              <span className="text-xs truncate flex-1">{event.message}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatTimeAgo(event.timestamp)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Main Component ---

export function RepoContextSnapshot({
  snapshot,
  onDismiss,
  onResumeTask,
  onSelectTask,
}: RepoContextSnapshotProps) {
  const hasAttention = snapshot.pendingApprovals > 0 || snapshot.stuckItems > 0;
  const hasCurrentTask = snapshot.currentTask !== null;
  const hasEvents = snapshot.recentEvents.length > 0;
  const hasStats = snapshot.sessionStats !== null && snapshot.sessionStats.totalTasks > 0;
  const isActive = snapshot.claudeStatus !== 'idle' && snapshot.claudeStatus !== 'paused';

  const urgencyLevel = useMemo(() => {
    if (snapshot.stuckItems > 0) return 'critical';
    if (snapshot.pendingApprovals > 0) return 'attention';
    if (isActive) return 'active';
    return 'normal';
  }, [snapshot.stuckItems, snapshot.pendingApprovals, isActive]);

  const borderStyle = useMemo(() => {
    switch (urgencyLevel) {
      case 'critical': return 'border-red-400/60 dark:border-red-700/60 shadow-red-500/5';
      case 'attention': return 'border-amber-400/60 dark:border-amber-700/60 shadow-amber-500/5';
      case 'active': return 'border-blue-400/60 dark:border-blue-700/60 shadow-blue-500/5';
      default: return 'border-border/60';
    }
  }, [urgencyLevel]);

  const canResume = hasCurrentTask || !!snapshot.lastViewedTaskId;

  return (
    <div
      className={cn(
        'rounded-lg border bg-card shadow-sm overflow-hidden',
        'transition-all duration-200 animate-in fade-in slide-in-from-top-2',
        borderStyle,
      )}
    >
      {/* Compact single-row header for normal states */}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        {/* Left: live status + alerts */}
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <LiveStatusPill
            status={snapshot.claudeStatus}
            activity={snapshot.currentActivity}
          />
          {hasAttention && (
            <UrgentAlerts
              pendingApprovals={snapshot.pendingApprovals}
              stuckItems={snapshot.stuckItems}
            />
          )}
        </div>

        {/* Right: quick actions */}
        <div className="flex items-center gap-1 shrink-0">
          {canResume && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={onResumeTask}
            >
              <Play className="h-3 w-3" />
              <span className="hidden sm:inline">Resume</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={onDismiss}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Body - only shown when there's meaningful content */}
      {(hasCurrentTask || hasEvents || hasStats) && (
        <div className="px-3 pb-2.5 space-y-2">
          {/* Session progress bar */}
          {hasStats && snapshot.sessionStats && (
            <SessionProgressBar stats={snapshot.sessionStats} />
          )}

          {/* Current task */}
          {hasCurrentTask && snapshot.currentTask && (
            <CurrentTaskCard task={snapshot.currentTask} onResume={onResumeTask} />
          )}

          {/* Recent events */}
          {hasEvents && (
            <RecentEventsList events={snapshot.recentEvents} onSelectTask={onSelectTask} />
          )}

          {/* Last visited - subtle footer */}
          <p className="text-[10px] text-muted-foreground/70">
            Last here {formatTimeAgo(snapshot.lastVisited)}
          </p>
        </div>
      )}
    </div>
  );
}

export default RepoContextSnapshot;
