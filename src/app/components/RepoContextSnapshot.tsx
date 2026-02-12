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
} from 'lucide-react';
import type { ClaudeStatus } from '@/shared/hooks/useMultiRepoStream';

interface RepoContextSnapshotProps {
  snapshot: RepoSnapshot;
  onDismiss: () => void;
  onResumeTask: () => void;
  onSelectTask?: (taskId: string) => void;
}

const STATUS_CONFIG: Record<ClaudeStatus, { label: string; color: string; icon: typeof Activity }> = {
  idle: { label: 'Idle', color: 'text-muted-foreground', icon: Activity },
  thinking: { label: 'Thinking...', color: 'text-blue-600 dark:text-blue-400', icon: Loader2 },
  writing: { label: 'Writing code', color: 'text-emerald-600 dark:text-emerald-400', icon: Pen },
  waiting_input: { label: 'Waiting for you', color: 'text-amber-600 dark:text-amber-400', icon: Clock },
  stuck: { label: 'Stuck', color: 'text-red-600 dark:text-red-400', icon: AlertTriangle },
  paused: { label: 'Paused', color: 'text-muted-foreground', icon: Activity },
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

function ClaudeStatusIndicator({ status }: { status: ClaudeStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const isAnimating = status === 'thinking' || status === 'writing';

  return (
    <div className={cn('flex items-center gap-2', config.color)}>
      <Icon className={cn('h-4 w-4', isAnimating && 'animate-spin')} />
      <span className="text-sm font-medium">{config.label}</span>
    </div>
  );
}

function CurrentTaskBanner({ task, onResume }: { task: NonNullable<RepoSnapshot['currentTask']>; onResume: () => void }) {
  return (
    <button
      onClick={onResume}
      className="w-full text-left p-2.5 rounded-md border border-border/50 bg-surface-raised hover:bg-muted/60 transition-colors group"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm truncate flex-1">{task.prompt}</p>
        <Badge variant="outline" className="text-[10px] shrink-0">{task.status.replace('_', ' ')}</Badge>
      </div>
      <p className="text-xs text-muted-foreground mt-1 group-hover:text-foreground transition-colors">
        Click to resume
      </p>
    </button>
  );
}

function EventItem({ event, onSelectTask }: { event: RepoEvent; onSelectTask?: (taskId: string) => void }) {
  const config = EVENT_CONFIG[event.type];
  const Icon = config.icon;

  return (
    <button
      onClick={() => event.taskId && onSelectTask?.(event.taskId)}
      disabled={!event.taskId || !onSelectTask}
      className={cn(
        'flex items-start gap-2 w-full text-left py-1.5',
        event.taskId && onSelectTask && 'hover:bg-muted/40 rounded-md px-1.5 -mx-1.5 transition-colors cursor-pointer',
        (!event.taskId || !onSelectTask) && 'cursor-default',
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', config.color)} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground truncate">{event.message}</p>
        <p className="text-[10px] text-muted-foreground">{formatTimeAgo(event.timestamp)}</p>
      </div>
    </button>
  );
}

function AttentionBadges({ pendingApprovals, stuckItems }: { pendingApprovals: number; stuckItems: number }) {
  if (pendingApprovals === 0 && stuckItems === 0) return null;
  return (
    <div className="flex items-center gap-2">
      {pendingApprovals > 0 && (
        <Badge variant="outline" className="text-xs border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30">
          <Eye className="h-3 w-3 mr-1" />
          {pendingApprovals} approval{pendingApprovals > 1 ? 's' : ''}
        </Badge>
      )}
      {stuckItems > 0 && (
        <Badge variant="outline" className="text-xs border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {stuckItems} stuck
        </Badge>
      )}
    </div>
  );
}

export function RepoContextSnapshot({
  snapshot,
  onDismiss,
  onResumeTask,
  onSelectTask,
}: RepoContextSnapshotProps) {
  const hasAttention = snapshot.pendingApprovals > 0 || snapshot.stuckItems > 0;
  const hasCurrentTask = snapshot.currentTask !== null;
  const hasEvents = snapshot.recentEvents.length > 0;
  const isActive = snapshot.claudeStatus !== 'idle' && snapshot.claudeStatus !== 'paused';

  const borderColor = useMemo(() => {
    if (snapshot.stuckItems > 0) return 'border-red-300 dark:border-red-800';
    if (snapshot.pendingApprovals > 0) return 'border-amber-300 dark:border-amber-800';
    if (isActive) return 'border-blue-300 dark:border-blue-800';
    return 'border-border';
  }, [snapshot.stuckItems, snapshot.pendingApprovals, isActive]);

  return (
    <div
      className={cn(
        'rounded-lg border bg-card shadow-sm overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-top-2',
        borderColor,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-3 min-w-0">
          <ClaudeStatusIndicator status={snapshot.claudeStatus} />
          {snapshot.lastViewedTab && (
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {snapshot.lastViewedTab}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(hasCurrentTask || snapshot.lastViewedTaskId) && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onResumeTask}>
              <Play className="h-3 w-3" />
              Resume
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onDismiss}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 space-y-2.5">
        {/* Attention badges */}
        {hasAttention && (
          <AttentionBadges pendingApprovals={snapshot.pendingApprovals} stuckItems={snapshot.stuckItems} />
        )}

        {/* Current task */}
        {hasCurrentTask && snapshot.currentTask && (
          <CurrentTaskBanner task={snapshot.currentTask} onResume={onResumeTask} />
        )}

        {/* Recent events */}
        {hasEvents && (
          <div className="space-y-0.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Recent Activity
            </p>
            {snapshot.recentEvents.slice(0, 3).map((event) => (
              <EventItem key={event.id} event={event} onSelectTask={onSelectTask} />
            ))}
          </div>
        )}

        {/* Last visited */}
        <p className="text-[10px] text-muted-foreground">
          Last visited {formatTimeAgo(snapshot.lastVisited)}
        </p>
      </div>
    </div>
  );
}

export default RepoContextSnapshot;
