'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import {
  useGetPlansQuery,
  usePausePlanMutation,
  useResumePlanMutation,
  useCancelPlanMutation,
} from '../store/plansApi';
import { usePlanStream } from '@/shared/hooks/usePlanStream';
import type { Plan } from '@/db/schema';
import {
  Play,
  Pause,
  Square,
  Eye,
  CheckCircle2,
  XCircle,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Single running plan card
// ---------------------------------------------------------------------------

function RunningPlanCard({
  plan,
  onViewExecution,
  onPause,
  onResume,
  onCancel,
}: {
  plan: Plan;
  onViewExecution: (planId: string) => void;
  onPause: (planId: string) => void;
  onResume: (planId: string) => void;
  onCancel: (planId: string) => void;
}) {
  const isRunning = plan.status === 'running';
  const isPaused = plan.status === 'paused';
  const { latestEvent, connected } = usePlanStream(plan.id, {
    enabled: isRunning || isPaused,
  });

  const progress = plan.totalTasks > 0
    ? Math.round((plan.completedTasks / plan.totalTasks) * 100)
    : 0;

  const currentActivity = useMemo(() => {
    if (!latestEvent) return null;
    switch (latestEvent.type) {
      case 'task_started':
        return 'Starting task...';
      case 'task_progress':
        return latestEvent.status || 'Working...';
      case 'phase_started':
        return 'Starting new phase...';
      case 'task_completed':
        return 'Task completed';
      default:
        return null;
    }
  }, [latestEvent]);

  return (
    <div
      className={cn(
        'group px-3 py-2.5 rounded-lg border transition-all cursor-pointer hover:bg-muted/40',
        isRunning && 'border-l-2 border-l-blue-500',
        isPaused && 'border-l-2 border-l-amber-500',
      )}
      onClick={() => onViewExecution(plan.id)}
    >
      <div className="flex items-center gap-2">
        {/* Status indicator */}
        {isRunning && (
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
        )}
        {isPaused && (
          <Pause className="h-3 w-3 text-amber-500 flex-shrink-0" />
        )}

        {/* Title */}
        <span className="text-sm font-medium truncate flex-1">{plan.title}</span>

        {/* Live badge */}
        {connected && isRunning && (
          <span className="text-[10px] text-emerald-600 font-medium flex-shrink-0">LIVE</span>
        )}

        {/* Quick controls */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={e => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onViewExecution(plan.id)}
            title="View execution"
          >
            <Eye className="h-3 w-3" />
          </Button>
          {isRunning && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onPause(plan.id)}
              title="Pause"
            >
              <Pause className="h-3 w-3" />
            </Button>
          )}
          {isPaused && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onResume(plan.id)}
              title="Resume"
            >
              <Play className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
            onClick={() => {
              if (confirm('Cancel this plan?')) onCancel(plan.id);
            }}
            title="Cancel"
          >
            <Square className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
          <span>{plan.completedTasks}/{plan.totalTasks} tasks</span>
          <span className="font-medium">{progress}%</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isPaused ? 'bg-amber-500' : 'bg-blue-500',
              isRunning && 'animate-pulse',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current activity */}
      {currentActivity && isRunning && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <Zap className="h-3 w-3 text-blue-500 animate-pulse flex-shrink-0" />
          <span className="text-xs text-muted-foreground truncate">{currentActivity}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recently completed plan mini card
// ---------------------------------------------------------------------------

function CompletedPlanCard({
  plan,
  onView,
}: {
  plan: Plan;
  onView: (planId: string) => void;
}) {
  const isFailed = plan.status === 'failed';

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-muted/40 transition-colors"
      onClick={() => onView(plan.id)}
    >
      {isFailed ? (
        <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
      )}
      <span className={cn('text-sm truncate flex-1', isFailed && 'text-red-600')}>
        {plan.title}
      </span>
      <Badge variant={isFailed ? 'destructive' : 'default'} className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
        {isFailed ? 'failed' : 'done'}
      </Badge>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main LivePlanMonitor widget
// ---------------------------------------------------------------------------

interface LivePlanMonitorProps {
  repositoryId: string;
  onViewExecution: (planId: string) => void;
  onViewPlan: (planId: string) => void;
  className?: string;
}

export function LivePlanMonitor({
  repositoryId,
  onViewExecution,
  onViewPlan,
  className,
}: LivePlanMonitorProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { data } = useGetPlansQuery(repositoryId, {
    pollingInterval: 5000,
    skipPollingIfUnfocused: true,
  });

  const [pausePlan] = usePausePlanMutation();
  const [resumePlan] = useResumePlanMutation();
  const [cancelPlan] = useCancelPlanMutation();

  const activePlans = useMemo(() => {
    if (!data?.plans) return [];
    return data.plans.filter(p => p.status === 'running' || p.status === 'paused');
  }, [data]);

  const recentCompleted = useMemo(() => {
    if (!data?.plans) return [];
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return data.plans
      .filter(p => (p.status === 'completed' || p.status === 'failed') && new Date(p.updatedAt).getTime() > oneDayAgo)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3);
  }, [data]);

  // Don't render if nothing to show
  if (activePlans.length === 0 && recentCompleted.length === 0) {
    return null;
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          {activePlans.length > 0 && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Plan Monitor
          </span>
          {activePlans.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {activePlans.length} active
            </Badge>
          )}
        </div>
        {isCollapsed ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {/* Content */}
      {!isCollapsed && (
        <div className="px-2 pb-2 space-y-1.5">
          {/* Active plans */}
          {activePlans.map((plan) => (
            <RunningPlanCard
              key={plan.id}
              plan={plan}
              onViewExecution={onViewExecution}
              onPause={(id) => pausePlan(id)}
              onResume={(id) => resumePlan(id)}
              onCancel={(id) => cancelPlan(id)}
            />
          ))}

          {/* Recently completed */}
          {recentCompleted.length > 0 && activePlans.length > 0 && (
            <div className="border-t my-1" />
          )}
          {recentCompleted.map((plan) => (
            <CompletedPlanCard
              key={plan.id}
              plan={plan}
              onView={onViewPlan}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
