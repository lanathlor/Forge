'use client';

import * as React from 'react';
import { useMemo, useState, useCallback } from 'react';
import { cn } from '@/shared/lib/utils';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/dashboard-cards';
import {
  useMultiRepoStream,
  type RepoSessionState,
  type ClaudeStatus,
} from '@/shared/hooks/useMultiRepoStream';
import {
  Layers,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Brain,
  Pencil,
  Pause,
  CircleDot,
  Eye,
  Activity,
  type LucideIcon,
} from 'lucide-react';

/* ============================================
   TYPES
   ============================================ */

export interface MultiSessionOverviewCardProps {
  onSelectRepo?: (repositoryId: string) => void;
  className?: string;
}

type HealthLevel = 'good' | 'warning' | 'critical';

interface AggregateStats {
  totalRepos: number;
  activeRepos: number;
  totalTasks: number;
  completedTasks: number;
  reposNeedingAttention: number;
  stuckCount: number;
  waitingCount: number;
  workingCount: number;
  idleCount: number;
  health: HealthLevel;
}

/* ============================================
   STATUS CONFIGS
   ============================================ */

const STATUS_ICON: Record<ClaudeStatus, LucideIcon> = {
  thinking: Brain,
  writing: Pencil,
  waiting_input: Clock,
  stuck: AlertTriangle,
  paused: Pause,
  idle: CircleDot,
};

const STATUS_STYLES: Record<ClaudeStatus, { color: string; bg: string; dot: string }> = {
  thinking: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30', dot: 'bg-blue-500' },
  writing: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', dot: 'bg-emerald-500' },
  waiting_input: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', dot: 'bg-amber-500' },
  stuck: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', dot: 'bg-red-500' },
  paused: { color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800/30', dot: 'bg-slate-400' },
  idle: { color: 'text-slate-400 dark:text-slate-500', bg: 'bg-slate-50 dark:bg-slate-900/30', dot: 'bg-slate-300' },
};

const HEALTH_CONFIG: Record<HealthLevel, { label: string; color: string; bg: string; border: string; icon: LucideIcon }> = {
  good: { label: 'Healthy', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800/50', icon: CheckCircle2 },
  warning: { label: 'Needs Attention', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800/50', icon: Clock },
  critical: { label: 'Action Required', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800/50', icon: AlertTriangle },
};

/* ============================================
   HELPERS
   ============================================ */

function computeStats(repos: RepoSessionState[]): AggregateStats {
  const stuckCount = repos.filter(r => r.claudeStatus === 'stuck').length;
  const waitingCount = repos.filter(r => r.claudeStatus === 'waiting_input').length;
  const workingCount = repos.filter(r => r.claudeStatus === 'thinking' || r.claudeStatus === 'writing').length;
  const idleCount = repos.filter(r => r.claudeStatus === 'idle' || r.claudeStatus === 'paused').length;
  const activeRepos = repos.filter(r => r.sessionStatus === 'active' || r.sessionStatus === 'paused').length;
  const reposNeedingAttention = repos.filter(r => r.needsAttention || r.claudeStatus === 'stuck' || r.claudeStatus === 'waiting_input').length;

  // Estimate task counts from currentTask progress
  let totalTasks = 0;
  let completedTasks = 0;
  for (const repo of repos) {
    if (repo.currentTask) {
      totalTasks += 1;
      if (repo.currentTask.status === 'completed' || repo.currentTask.status === 'approved') {
        completedTasks += 1;
      }
    }
  }

  let health: HealthLevel = 'good';
  if (stuckCount >= 2) health = 'critical';
  else if (stuckCount === 1 || waitingCount >= 2) health = 'warning';

  return {
    totalRepos: repos.length,
    activeRepos,
    totalTasks,
    completedTasks,
    reposNeedingAttention,
    stuckCount,
    waitingCount,
    workingCount,
    idleCount,
    health,
  };
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '\u2026';
}

/* ============================================
   SUB-COMPONENTS
   ============================================ */

function HealthBadge({ health }: { health: HealthLevel }) {
  const config = HEALTH_CONFIG[health];
  const Icon = config.icon;

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
      config.bg,
      config.color,
    )}>
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
    </div>
  );
}

function StatPill({ icon: Icon, value, label, color }: { icon: LucideIcon; value: number; label: string; color: string }) {
  if (value === 0) return null;
  return (
    <div className={cn('flex items-center gap-1.5 text-xs', color)}>
      <Icon className="h-3.5 w-3.5" />
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="opacity-80 hidden sm:inline">{label}</span>
    </div>
  );
}

function AggregateProgressBar({ stats }: { stats: AggregateStats }) {
  const total = stats.stuckCount + stats.waitingCount + stats.workingCount + stats.idleCount;
  if (total === 0) return null;

  const segments = [
    { count: stats.workingCount, color: 'bg-blue-500', label: 'active' },
    { count: stats.waitingCount, color: 'bg-amber-500', label: 'waiting' },
    { count: stats.stuckCount, color: 'bg-red-500', label: 'stuck' },
    { count: stats.idleCount, color: 'bg-slate-300 dark:bg-slate-600', label: 'idle' },
  ];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Session distribution</span>
        <span className="tabular-nums">{stats.activeRepos} active of {stats.totalRepos}</span>
      </div>
      <div className="h-2 rounded-full bg-muted/30 overflow-hidden flex">
        {segments.map(seg => {
          if (seg.count === 0) return null;
          const pct = (seg.count / total) * 100;
          return (
            <div
              key={seg.label}
              className={cn('h-full transition-all duration-500', seg.color)}
              style={{ width: `${pct}%` }}
              title={`${seg.count} ${seg.label}`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {segments.map(seg => {
          if (seg.count === 0) return null;
          return (
            <div key={seg.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={cn('h-2 w-2 rounded-full', seg.color)} />
              <span>{seg.count} {seg.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RepoMiniCard({
  repo,
  onSelect,
}: {
  repo: RepoSessionState;
  onSelect: () => void;
}) {
  const style = STATUS_STYLES[repo.claudeStatus];
  const Icon = STATUS_ICON[repo.claudeStatus];
  const isWorking = repo.claudeStatus === 'thinking' || repo.claudeStatus === 'writing';
  const needsAction = repo.claudeStatus === 'stuck' || repo.claudeStatus === 'waiting_input';

  return (
    <button
      onClick={onSelect}
      className={cn(
        'group flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg border transition-all',
        'hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        needsAction
          ? 'border-current/20 ' + style.bg
          : 'border-border/50 hover:border-border hover:bg-muted/30',
      )}
    >
      {/* Status indicator */}
      <div className={cn(
        'relative flex items-center justify-center h-8 w-8 rounded-lg shrink-0',
        style.bg,
      )}>
        <Icon className={cn(
          'h-4 w-4',
          style.color,
          isWorking && 'animate-pulse',
        )} />
        {isWorking && (
          <span className={cn(
            'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full',
            style.dot,
          )}>
            <span className={cn('absolute inset-0 rounded-full animate-ping opacity-75', style.dot)} />
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{repo.repositoryName}</span>
          {needsAction && (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1 py-0 h-4 shrink-0',
                repo.claudeStatus === 'stuck'
                  ? 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400'
                  : 'border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400',
              )}
            >
              {repo.claudeStatus === 'stuck' ? 'stuck' : 'waiting'}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {repo.currentTask ? truncate(repo.currentTask.prompt, 50) : 'No active task'}
        </p>
      </div>

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
    </button>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyOverview() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-muted/50 mb-3">
        <Layers className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">No active sessions</p>
      <p className="text-xs text-muted-foreground max-w-[200px]">
        Start a session on a repository to see it here
      </p>
    </div>
  );
}

/* ============================================
   MAIN COMPONENT
   ============================================ */

export const MultiSessionOverviewCard = React.memo(function MultiSessionOverviewCard({
  onSelectRepo,
  className,
}: MultiSessionOverviewCardProps) {
  const { repositories, connected, error } = useMultiRepoStream();
  const [isExpanded, setIsExpanded] = useState(false);

  const stats = useMemo(() => computeStats(repositories), [repositories]);

  // Sort: stuck first, then waiting, then active, then idle
  const sortedRepos = useMemo(() => {
    const priority: Record<ClaudeStatus, number> = {
      stuck: 0,
      waiting_input: 1,
      thinking: 2,
      writing: 3,
      paused: 4,
      idle: 5,
    };
    return [...repositories].sort((a, b) => {
      const pDiff = priority[a.claudeStatus] - priority[b.claudeStatus];
      if (pDiff !== 0) return pDiff;
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    });
  }, [repositories]);

  // Show top 3 in collapsed mode, all in expanded
  const visibleRepos = useMemo(() => isExpanded ? sortedRepos : sortedRepos.slice(0, 3), [isExpanded, sortedRepos]);
  const hiddenCount = useMemo(() => sortedRepos.length - 3, [sortedRepos.length]);

  const handleSelect = useCallback((repoId: string) => {
    onSelectRepo?.(repoId);
  }, [onSelectRepo]);

  const isLoading = useMemo(() => !connected && repositories.length === 0 && !error, [connected, repositories.length, error]);

  const healthConfig = useMemo(() => HEALTH_CONFIG[stats.health], [stats.health]);

  return (
    <Card className={cn(
      'relative overflow-hidden transition-colors',
      stats.health === 'critical' && 'border-red-200 dark:border-red-800/40',
      stats.health === 'warning' && 'border-amber-200 dark:border-amber-800/40',
      className,
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn(
            'flex items-center justify-center h-9 w-9 rounded-lg',
            healthConfig.bg,
          )}>
            <Activity className={cn('h-4.5 w-4.5', healthConfig.color)} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Sessions Overview</h3>
            <p className="text-xs text-muted-foreground">
              {stats.totalRepos === 0
                ? 'No repos monitored'
                : `${stats.activeRepos} active across ${stats.totalRepos} repo${stats.totalRepos !== 1 ? 's' : ''}`
              }
            </p>
          </div>
        </div>
        <HealthBadge health={stats.health} />
      </div>

      <CardContent className="px-5 pb-5 pt-0 space-y-4">
        {isLoading ? (
          <OverviewSkeleton />
        ) : repositories.length === 0 ? (
          <EmptyOverview />
        ) : (
          <>
            {/* Quick stats row */}
            <div className="flex items-center gap-4 flex-wrap">
              <StatPill icon={AlertTriangle} value={stats.stuckCount} label="stuck" color="text-red-600 dark:text-red-400" />
              <StatPill icon={Clock} value={stats.waitingCount} label="waiting" color="text-amber-600 dark:text-amber-400" />
              <StatPill icon={Zap} value={stats.workingCount} label="active" color="text-blue-600 dark:text-blue-400" />
              <StatPill icon={CircleDot} value={stats.idleCount} label="idle" color="text-slate-500 dark:text-slate-400" />
            </div>

            {/* Progress bar */}
            <AggregateProgressBar stats={stats} />

            {/* Repos needing attention callout */}
            {stats.reposNeedingAttention > 0 && (
              <div className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
                stats.health === 'critical'
                  ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300'
                  : 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300',
              )}>
                <Eye className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <strong>{stats.reposNeedingAttention}</strong> repo{stats.reposNeedingAttention !== 1 ? 's' : ''} need{stats.reposNeedingAttention === 1 ? 's' : ''} your attention
                </span>
              </div>
            )}

            {/* Mini repo cards */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                All Sessions
              </p>
              <div className="space-y-1">
                {visibleRepos.map(repo => (
                  <RepoMiniCard
                    key={repo.repositoryId}
                    repo={repo}
                    onSelect={() => handleSelect(repo.repositoryId)}
                  />
                ))}
              </div>

              {/* Expand/collapse */}
              {hiddenCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      {hiddenCount} more repo{hiddenCount !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
});

export default MultiSessionOverviewCard;