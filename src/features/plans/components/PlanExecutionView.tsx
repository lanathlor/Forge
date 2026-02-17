'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import {
  useGetPlanQuery,
  useExecutePlanMutation,
  usePausePlanMutation,
  useResumePlanMutation,
  useCancelPlanMutation,
  useRetryPlanTaskMutation,
} from '../store/plansApi';
import { usePlanStream } from '@/shared/hooks/usePlanStream';
import type { Phase, PlanTask } from '@/db/schema';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Eye,
  EyeOff,
  Clock,
  CheckCircle2,
  XCircle,
  Circle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  ArrowRight,
  Zap,
  X,
  Rocket,
} from 'lucide-react';

interface PlanExecutionViewProps {
  planId: string;
  onBack?: () => void;
  onReview?: (planId: string) => void;
  /** When true, shows a brief launch animation before transitioning to live view */
  justLaunched?: boolean;
}

// Status helpers
type TaskStatusType = PlanTask['status'];
type PhaseStatusType = Phase['status'];

function getTaskStatusIcon(status: TaskStatusType) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-accent-primary" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-error" />;
    case 'skipped':
      return <Circle className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Circle className="h-4 w-4 text-border-muted" />;
  }
}

function getPhaseStatusColor(status: PhaseStatusType): string {
  switch (status) {
    case 'completed':
      return 'bg-success';
    case 'running':
      return 'bg-accent-primary';
    case 'failed':
      return 'bg-error';
    case 'paused':
      return 'bg-warning';
    default:
      return 'bg-border-muted';
  }
}

function getSessionTaskLabel(status: string | undefined): string {
  switch (status) {
    case 'pre_flight':
      return 'Pre-flight checks';
    case 'running':
      return 'Claude is coding';
    case 'waiting_qa':
      return 'Preparing QA';
    case 'qa_running':
      return 'Running QA gates';
    case 'waiting_approval':
      return 'Waiting for approval';
    case 'approved':
      return 'Approved, committing';
    default:
      return '';
  }
}

function formatTimeEstimate(ms: number): string {
  if (ms <= 0) return '--';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `~${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `~${minutes}m`;
  return `~${seconds}s`;
}

// ── Phase Dot/Icon ──
function PhaseIcon({
  status,
  index,
}: {
  status: PhaseStatusType;
  index: number;
  size?: 'sm' | 'md';
}) {
  if (status === 'completed') return <CheckCircle2 className="h-3 w-3" />;
  if (status === 'failed') return <XCircle className="h-3 w-3" />;
  return <>{index + 1}</>;
}

// ── Desktop Phase Item ──
function DesktopPhaseItem({
  phase,
  index,
  phases,
  phaseTasks,
  currentPhaseId,
  onClickTask,
}: {
  phase: Phase;
  index: number;
  phases: Phase[];
  phaseTasks: PlanTask[];
  currentPhaseId: string | null;
  onClickTask: (id: string) => void;
}) {
  const completedCount = phaseTasks.filter(
    (t) => t.status === 'completed'
  ).length;
  const progress =
    phaseTasks.length > 0 ? (completedCount / phaseTasks.length) * 100 : 0;
  const isCurrent = phase.id === currentPhaseId;

  return (
    <div className="flex items-center">
      {index > 0 && (
        <div
          className={cn(
            'mx-0.5 h-0.5 w-6 flex-shrink-0',
            phase.status === 'completed' ||
              phases[index - 1]?.status === 'completed'
              ? 'bg-success'
              : 'bg-border-muted'
          )}
        />
      )}
      <button
        onClick={() => {
          const firstTask = phaseTasks.sort((a, b) => a.order - b.order)[0];
          if (firstTask) onClickTask(firstTask.id);
        }}
        className={cn(
          'flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-all',
          'border hover:bg-surface-interactive',
          isCurrent &&
            'border-accent-primary bg-accent-primary-subtle ring-2 ring-accent-primary/50',
          phase.status === 'completed' && 'border-success/30 bg-success-subtle',
          phase.status === 'failed' && 'border-error/30 bg-error-subtle',
          phase.status === 'pending' && 'border-border-muted opacity-60'
        )}
      >
        <div
          className={cn(
            'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
            getPhaseStatusColor(phase.status),
            phase.status === 'completed'
              ? 'text-success-foreground'
              : 'text-white',
            phase.status === 'running' && 'animate-pulse-subtle'
          )}
        >
          <PhaseIcon status={phase.status} index={index} />
        </div>
        <div className="min-w-0 text-left">
          <div className="max-w-[120px] truncate font-medium">
            {phase.title}
          </div>
          <div className="text-muted-foreground">
            {completedCount}/{phaseTasks.length}
          </div>
        </div>
        {phaseTasks.length > 0 && (
          <div className="h-1 w-12 flex-shrink-0 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                phase.status === 'failed' ? 'bg-error' : 'bg-success'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </button>
    </div>
  );
}

// ── Mobile Phase Item ──
function MobilePhaseItem({
  phase,
  index,
  totalPhases,
  phaseTasks,
  currentPhaseId,
  onClickTask,
}: {
  phase: Phase;
  index: number;
  totalPhases: number;
  phaseTasks: PlanTask[];
  currentPhaseId: string | null;
  onClickTask: (id: string) => void;
}) {
  const completedCount = phaseTasks.filter(
    (t) => t.status === 'completed'
  ).length;
  const progress =
    phaseTasks.length > 0 ? (completedCount / phaseTasks.length) * 100 : 0;
  const isCurrent = phase.id === currentPhaseId;

  return (
    <div className="flex items-start gap-2">
      <div className="flex flex-shrink-0 flex-col items-center pt-0.5">
        <div
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold',
            getPhaseStatusColor(phase.status),
            phase.status === 'completed'
              ? 'text-success-foreground'
              : 'text-white',
            phase.status === 'running' && 'animate-pulse-subtle'
          )}
        >
          <PhaseIcon status={phase.status} index={index} />
        </div>
        {index < totalPhases - 1 && (
          <div
            className={cn(
              'mt-0.5 h-3 w-0.5',
              phase.status === 'completed' ? 'bg-success' : 'bg-border-muted'
            )}
          />
        )}
      </div>
      <button
        onClick={() => {
          const firstTask = phaseTasks.sort((a, b) => a.order - b.order)[0];
          if (firstTask) onClickTask(firstTask.id);
        }}
        className={cn(
          'flex flex-1 items-center justify-between py-0.5 text-xs',
          isCurrent && 'font-semibold text-accent-primary'
        )}
      >
        <span className="truncate">{phase.title}</span>
        <div className="ml-2 flex flex-shrink-0 items-center gap-1.5">
          <span className="text-muted-foreground">
            {completedCount}/{phaseTasks.length}
          </span>
          <div className="h-1 w-8 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                'h-full rounded-full',
                phase.status === 'failed' ? 'bg-error' : 'bg-success'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </button>
    </div>
  );
}

// ── Task Row ──
function TaskRow({
  task,
  isSelected,
  isActive,
  currentSessionTaskStatus,
  activeTaskRef,
  onTaskClick,
  onRetry,
}: {
  task: PlanTask;
  isSelected: boolean;
  isActive: boolean;
  currentSessionTaskStatus: string | undefined;
  activeTaskRef: React.RefObject<HTMLDivElement | null>;
  onTaskClick: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const hasDeps = task.dependsOn && task.dependsOn.length > 0;

  return (
    <div
      ref={isActive ? activeTaskRef : undefined}
      onClick={() => onTaskClick(task.id)}
      className={cn(
        'flex cursor-pointer items-center gap-3 border-l-2 px-4 py-2.5 transition-colors',
        'hover:bg-surface-interactive/50',
        isActive && 'border-l-accent-primary bg-accent-primary-subtle/20',
        isSelected &&
          !isActive &&
          'border-l-accent-secondary bg-surface-interactive',
        !isActive && !isSelected && 'border-l-transparent',
        task.status === 'failed' && 'border-l-error'
      )}
    >
      <div className="flex-shrink-0">{getTaskStatusIcon(task.status)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'truncate text-sm font-medium',
              task.status === 'completed' &&
                'text-muted-foreground line-through'
            )}
          >
            {task.title}
          </span>
          {hasDeps && (
            <span className="flex-shrink-0 text-[10px] text-muted-foreground">
              deps
            </span>
          )}
        </div>
        {isActive && currentSessionTaskStatus && (
          <div className="mt-0.5 flex items-center gap-1">
            <span className="text-xs text-accent-primary">
              {getSessionTaskLabel(currentSessionTaskStatus)}
            </span>
          </div>
        )}
        {task.status === 'failed' && task.lastError && (
          <div className="mt-0.5 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 flex-shrink-0 text-error" />
            <span className="truncate text-xs text-error">
              {task.lastError}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {task.attempts > 1 && (
          <span className="text-[10px] text-muted-foreground">
            Attempt {task.attempts}
          </span>
        )}
        {task.status === 'failed' && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onRetry(task.id);
            }}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Retry
          </Button>
        )}
        <ChevronRight
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            isSelected && 'rotate-90'
          )}
        />
      </div>
    </div>
  );
}

// ── Task Detail Panel ──
function TaskDetailPanel({
  task,
  taskOutput,
  sessionTaskStatus,
  outputEndRef,
  onClose,
}: {
  task: PlanTask;
  taskOutput: string | null;
  sessionTaskStatus: string | undefined;
  outputEndRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col border-t bg-surface-sunken md:w-1/2 md:border-t-0">
      <div className="flex items-center justify-between border-b bg-surface-raised px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {getTaskStatusIcon(task.status)}
          <span className="truncate text-sm font-medium">{task.title}</span>
          {task.status === 'running' && sessionTaskStatus && (
            <Badge
              variant="secondary"
              className="animate-pulse-subtle px-1.5 py-0 text-[10px]"
            >
              {getSessionTaskLabel(sessionTaskStatus)}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="border-b bg-surface-base px-4 py-3 text-sm text-muted-foreground">
        <p className="whitespace-pre-wrap text-xs leading-relaxed">
          {task.description}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px]">
          {task.startedAt && (
            <span>
              Started: {new Date(task.startedAt).toLocaleTimeString()}
            </span>
          )}
          {task.completedAt && (
            <span>
              Completed: {new Date(task.completedAt).toLocaleTimeString()}
            </span>
          )}
          {task.commitSha && (
            <span className="font-mono">SHA: {task.commitSha.slice(0, 7)}</span>
          )}
          {task.attempts > 1 && <span>Attempt {task.attempts}</span>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {taskOutput ? (
          <div className="relative">
            {task.status === 'running' && (
              <div className="sticky top-0 z-10 -mt-1 mb-2 flex items-center gap-1.5 border-b bg-surface-sunken/80 pb-2 pt-1 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-accent-primary" />
                <span className="text-[10px] font-medium text-accent-primary">
                  Streaming live output
                </span>
              </div>
            )}
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
              {taskOutput}
              <div ref={outputEndRef} />
            </pre>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-sm text-muted-foreground">
            {task.status === 'running' ? (
              <>
                <Loader2 className="mb-2 h-5 w-5 animate-spin" />
                <span>Waiting for output...</span>
              </>
            ) : task.status === 'pending' ? (
              <span>Task hasn&apos;t started yet</span>
            ) : (
              <span>No output captured</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Header Controls ──
function HeaderControls({
  plan,
  planId,
  isRunning,
  watchMode,
  setWatchMode,
  onReview,
  executePlan,
  pausePlan,
  resumePlan,
  cancelPlan,
  isExecuting,
  isPausing,
  isResuming,
  isCancelling,
}: {
  plan: { status: string };
  planId: string;
  isRunning: boolean;
  watchMode: boolean;
  setWatchMode: (v: boolean) => void;
  onReview?: (id: string) => void;
  executePlan: (id: string) => void;
  pausePlan: (id: string) => void;
  resumePlan: (id: string) => void;
  cancelPlan: (id: string) => void;
  isExecuting: boolean;
  isPausing: boolean;
  isResuming: boolean;
  isCancelling: boolean;
}) {
  return (
    <div className="flex flex-shrink-0 items-center gap-2">
      {isRunning && (
        <Button
          size="sm"
          variant={watchMode ? 'default' : 'outline'}
          onClick={() => setWatchMode(!watchMode)}
          className="gap-1.5"
        >
          {watchMode ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">Watch</span>
        </Button>
      )}
      {plan.status === 'draft' && onReview && (
        <Button size="sm" variant="outline" onClick={() => onReview(planId)}>
          Iterate
        </Button>
      )}
      {plan.status === 'ready' && (
        <Button
          size="sm"
          onClick={() => executePlan(planId)}
          disabled={isExecuting}
          className="gap-1.5"
        >
          <Play className="h-3.5 w-3.5" />
          {isExecuting ? 'Starting...' : 'Execute'}
        </Button>
      )}
      {isRunning && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => pausePlan(planId)}
          disabled={isPausing}
          className="gap-1.5"
        >
          <Pause className="h-3.5 w-3.5" />
          {isPausing ? 'Pausing...' : 'Pause'}
        </Button>
      )}
      {plan.status === 'paused' && (
        <Button
          size="sm"
          onClick={() => resumePlan(planId)}
          disabled={isResuming}
          className="gap-1.5"
        >
          <Play className="h-3.5 w-3.5" />
          {isResuming ? 'Resuming...' : 'Resume'}
        </Button>
      )}
      {(isRunning || plan.status === 'paused') && (
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            if (confirm('Cancel this plan execution?')) cancelPlan(planId);
          }}
          disabled={isCancelling}
          className="gap-1.5"
        >
          <Square className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">
            {isCancelling ? 'Cancelling...' : 'Cancel'}
          </span>
        </Button>
      )}
    </div>
  );
}

// ── Progress Section ──
function ProgressSection({
  plan,
  overallProgress,
  estimatedRemaining,
  isRunning,
}: {
  plan: {
    completedTasks: number;
    totalTasks: number;
    completedPhases: number;
    totalPhases: number;
    status: string;
  };
  overallProgress: number;
  estimatedRemaining: number;
  isRunning: boolean;
}) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>
            {plan.completedTasks}/{plan.totalTasks} tasks
          </span>
          <span>
            {plan.completedPhases}/{plan.totalPhases} phases
          </span>
        </div>
        <div className="flex items-center gap-3">
          {estimatedRemaining > 0 && isRunning && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimeEstimate(estimatedRemaining)} remaining
            </span>
          )}
          <span className="font-medium">{Math.round(overallProgress)}%</span>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            plan.status === 'failed' ? 'bg-error' : 'bg-accent-primary',
            isRunning && 'animate-pulse-subtle'
          )}
          style={{ width: `${overallProgress}%` }}
        />
      </div>
    </div>
  );
}

// ── Activity Indicator ──
function ActivityIndicator({
  runningTask,
  sessionStatus,
}: {
  runningTask: PlanTask;
  sessionStatus: string | undefined;
}) {
  return (
    <div className="mt-2 flex items-center gap-2 text-xs">
      <Zap className="h-3 w-3 animate-pulse text-accent-primary" />
      <span className="text-muted-foreground">Now:</span>
      <span className="truncate font-medium">{runningTask.title}</span>
      {sessionStatus && (
        <>
          <ArrowRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          <span className="flex-shrink-0 text-accent-primary">
            {getSessionTaskLabel(sessionStatus)}
          </span>
        </>
      )}
    </div>
  );
}

// ── Plan Header Bar ──
function PlanHeaderBar({
  plan,
  planId,
  isRunning,
  connected,
  overallProgress,
  estimatedRemaining,
  runningTask,
  currentSessionTaskStatus,
  watchMode,
  setWatchMode,
  onReview,
  onBack,
  executePlan,
  pausePlan,
  resumePlan,
  cancelPlan,
  isExecuting,
  isPausing,
  isResuming,
  isCancelling,
}: {
  plan: {
    title: string;
    description: string | null;
    status: string;
    completedTasks: number;
    totalTasks: number;
    completedPhases: number;
    totalPhases: number;
  };
  planId: string;
  isRunning: boolean;
  connected: boolean;
  overallProgress: number;
  estimatedRemaining: number;
  runningTask: PlanTask | undefined;
  currentSessionTaskStatus: string | undefined;
  watchMode: boolean;
  setWatchMode: (v: boolean) => void;
  onReview?: (id: string) => void;
  onBack?: () => void;
  executePlan: (id: string) => void;
  pausePlan: (id: string) => void;
  resumePlan: (id: string) => void;
  cancelPlan: (id: string) => void;
  isExecuting: boolean;
  isPausing: boolean;
  isResuming: boolean;
  isCancelling: boolean;
}) {
  return (
    <div className="flex-shrink-0 border-b bg-surface-raised px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="flex-shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <h2 className="truncate text-lg font-semibold">{plan.title}</h2>
            <PlanStatusBadge status={plan.status} />
            {connected && isRunning && (
              <span className="flex items-center gap-1 text-xs text-success">
                <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-success" />
                Live
              </span>
            )}
          </div>
          {plan.description && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {plan.description}
            </p>
          )}
        </div>
        <HeaderControls
          plan={plan}
          planId={planId}
          isRunning={isRunning}
          watchMode={watchMode}
          setWatchMode={setWatchMode}
          onReview={onReview}
          executePlan={executePlan}
          pausePlan={pausePlan}
          resumePlan={resumePlan}
          cancelPlan={cancelPlan}
          isExecuting={isExecuting}
          isPausing={isPausing}
          isResuming={isResuming}
          isCancelling={isCancelling}
        />
      </div>
      <ProgressSection
        plan={plan}
        overallProgress={overallProgress}
        estimatedRemaining={estimatedRemaining}
        isRunning={isRunning}
      />
      {isRunning && runningTask && (
        <ActivityIndicator
          runningTask={runningTask}
          sessionStatus={currentSessionTaskStatus}
        />
      )}
    </div>
  );
}

// ── Loading / Launch Animation ──
function LoadingState({
  showLaunchAnimation,
  connected,
}: {
  showLaunchAnimation: boolean;
  connected: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 duration-300 animate-in fade-in">
      <div className="relative">
        <div
          className={cn(
            'flex h-16 w-16 items-center justify-center rounded-2xl',
            showLaunchAnimation ? 'animate-pulse bg-primary/10' : 'bg-muted'
          )}
        >
          {showLaunchAnimation ? (
            <Rocket className="h-8 w-8 animate-bounce text-primary" />
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          )}
        </div>
        {showLaunchAnimation && connected && (
          <span className="absolute -right-1 -top-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
        )}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">
          {showLaunchAnimation
            ? 'Launching plan...'
            : 'Loading execution view...'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {showLaunchAnimation
            ? 'Connecting to live execution stream'
            : 'Fetching plan data'}
        </p>
      </div>
    </div>
  );
}

function computeEstimatedRemaining(tasks: PlanTask[]): number {
  const completedTasks = tasks.filter(
    (t) => t.status === 'completed' && t.startedAt && t.completedAt
  );
  if (completedTasks.length === 0) return 0;
  const avgDuration =
    completedTasks.reduce((sum, t) => {
      return (
        sum +
        (new Date(t.completedAt!).getTime() - new Date(t.startedAt!).getTime())
      );
    }, 0) / completedTasks.length;
  return (
    avgDuration *
    tasks.filter((t) => t.status === 'pending' || t.status === 'running').length
  );
}

function buildPhaseTasksMap(tasks: PlanTask[]): Map<string, PlanTask[]> {
  const map = new Map<string, PlanTask[]>();
  tasks.forEach((task) => {
    if (!map.has(task.phaseId)) map.set(task.phaseId, []);
    map.get(task.phaseId)!.push(task);
  });
  return map;
}

export function PlanExecutionView({
  planId,
  onBack,
  onReview,
  justLaunched,
}: PlanExecutionViewProps) {
  const { data, isLoading, error } = useGetPlanQuery(planId, {
    pollingInterval: 3000,
    skipPollingIfUnfocused: true,
  });
  const [executePlan, { isLoading: isExecuting }] = useExecutePlanMutation();
  const [pausePlan, { isLoading: isPausing }] = usePausePlanMutation();
  const [resumePlan, { isLoading: isResuming }] = useResumePlanMutation();
  const [cancelPlan, { isLoading: isCancelling }] = useCancelPlanMutation();
  const [retryTask] = useRetryPlanTaskMutation();

  const isRunning = data?.plan?.status === 'running';
  const streamEnabled = isRunning || data?.plan?.status === 'paused';
  const { latestEvent, connected, taskOutputs } = usePlanStream(planId, {
    enabled: streamEnabled,
  });

  const [watchMode, setWatchMode] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showLaunchAnimation, setShowLaunchAnimation] =
    useState(!!justLaunched);
  const activeTaskRef = useRef<HTMLDivElement>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss launch animation once SSE connects or after timeout
  useEffect(() => {
    if (!showLaunchAnimation) return;
    if (connected || isRunning) {
      const timer = setTimeout(() => setShowLaunchAnimation(false), 800);
      return () => clearTimeout(timer);
    }
    const timeout = setTimeout(() => setShowLaunchAnimation(false), 4000);
    return () => clearTimeout(timeout);
  }, [showLaunchAnimation, connected, isRunning]);

  // Auto-select running task when in watch mode
  useEffect(() => {
    if (!watchMode || !data?.tasks) return;
    const runTask = data.tasks.find((t) => t.status === 'running');
    if (runTask && runTask.id !== selectedTaskId) {
      setSelectedTaskId(runTask.id);
    }
  }, [watchMode, data?.tasks, selectedTaskId]);

  useEffect(() => {
    if (watchMode && activeTaskRef.current) {
      activeTaskRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [latestEvent, watchMode]);

  useEffect(() => {
    if (outputEndRef.current && selectedTaskId) {
      outputEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [taskOutputs, selectedTaskId]);

  const estimatedRemaining = useMemo(() => {
    return data ? computeEstimatedRemaining(data.tasks) : 0;
  }, [data]);

  const currentSessionTaskStatus = useMemo(() => {
    return latestEvent?.type === 'task_progress'
      ? latestEvent.status
      : undefined;
  }, [latestEvent]);

  const handleTaskClick = useCallback((taskId: string) => {
    setSelectedTaskId((prev) => (prev === taskId ? null : taskId));
  }, []);

  if (isLoading || showLaunchAnimation) {
    return (
      <LoadingState
        showLaunchAnimation={showLaunchAnimation}
        connected={connected}
      />
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-error">{error ? 'Error loading plan' : 'No data'}</p>
      </div>
    );
  }

  const plan = data.plan;
  const phases = [...data.phases].sort((a, b) => a.order - b.order);
  const tasks = data.tasks;
  const phaseTasksMap = buildPhaseTasksMap(tasks);

  const overallProgress =
    plan.totalTasks > 0 ? (plan.completedTasks / plan.totalTasks) * 100 : 0;
  const runningTask = tasks.find((t) => t.status === 'running');
  const selectedTask = selectedTaskId
    ? tasks.find((t) => t.id === selectedTaskId)
    : undefined;
  const selectedTaskOutput = selectedTask?.taskId
    ? (taskOutputs.get(selectedTask.taskId) ?? null)
    : null;

  return (
    <div className="flex h-full flex-col">
      <PlanHeaderBar
        plan={plan}
        planId={planId}
        isRunning={isRunning}
        connected={connected}
        overallProgress={overallProgress}
        estimatedRemaining={estimatedRemaining}
        runningTask={runningTask}
        currentSessionTaskStatus={currentSessionTaskStatus}
        watchMode={watchMode}
        setWatchMode={setWatchMode}
        onReview={onReview}
        onBack={onBack}
        executePlan={executePlan}
        pausePlan={pausePlan}
        resumePlan={resumePlan}
        cancelPlan={cancelPlan}
        isExecuting={isExecuting}
        isPausing={isPausing}
        isResuming={isResuming}
        isCancelling={isCancelling}
      />

      {/* ── Phase Timeline ── */}
      <div className="flex-shrink-0 overflow-x-auto border-b bg-surface-base px-4 py-3">
        <div className="hidden min-w-0 items-center gap-1 md:flex">
          {phases.map((phase, idx) => (
            <DesktopPhaseItem
              key={phase.id}
              phase={phase}
              index={idx}
              phases={phases}
              phaseTasks={phaseTasksMap.get(phase.id) || []}
              currentPhaseId={plan.currentPhaseId}
              onClickTask={handleTaskClick}
            />
          ))}
        </div>
        <div className="space-y-1 md:hidden">
          {phases.map((phase, idx) => (
            <MobilePhaseItem
              key={phase.id}
              phase={phase}
              index={idx}
              totalPhases={phases.length}
              phaseTasks={phaseTasksMap.get(phase.id) || []}
              currentPhaseId={plan.currentPhaseId}
              onClickTask={handleTaskClick}
            />
          ))}
        </div>
      </div>

      {/* ── Main Content: Task List + Detail Panel ── */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <div
          className={cn(
            'overflow-y-auto',
            selectedTask ? 'border-r md:w-1/2' : 'w-full'
          )}
        >
          {phases.map((phase) => {
            const phaseTasks = (phaseTasksMap.get(phase.id) || []).sort(
              (a, b) => a.order - b.order
            );
            const completedCount = phaseTasks.filter(
              (t) => t.status === 'completed'
            ).length;
            const progress =
              phaseTasks.length > 0
                ? (completedCount / phaseTasks.length) * 100
                : 0;

            return (
              <div key={phase.id} className="border-b last:border-b-0">
                <PhaseHeader
                  phase={phase}
                  completedCount={completedCount}
                  totalCount={phaseTasks.length}
                  progress={progress}
                />
                <div>
                  {phaseTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isSelected={selectedTaskId === task.id}
                      isActive={task.status === 'running'}
                      currentSessionTaskStatus={currentSessionTaskStatus}
                      activeTaskRef={activeTaskRef}
                      onTaskClick={handleTaskClick}
                      onRetry={(id) => retryTask(id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {selectedTask && (
          <TaskDetailPanel
            task={selectedTask}
            taskOutput={selectedTaskOutput}
            sessionTaskStatus={
              selectedTask.status === 'running'
                ? currentSessionTaskStatus
                : undefined
            }
            outputEndRef={outputEndRef}
            onClose={() => setSelectedTaskId(null)}
          />
        )}
      </div>
    </div>
  );
}

// ── Phase Header ──
function PhaseHeader({
  phase,
  completedCount,
  totalCount,
  progress,
}: {
  phase: Phase;
  completedCount: number;
  totalCount: number;
  progress: number;
}) {
  return (
    <div
      className={cn(
        'sticky top-0 z-10 flex items-center justify-between bg-surface-sunken/50 px-4 py-2.5',
        phase.status === 'running' && 'bg-accent-primary-subtle/30'
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            'text-sm font-semibold',
            phase.status === 'running' && 'text-accent-primary'
          )}
        >
          {phase.title}
        </span>
        <Badge
          variant={
            phase.status === 'completed'
              ? 'default'
              : phase.status === 'failed'
                ? 'destructive'
                : 'secondary'
          }
          className="px-1.5 py-0 text-[10px]"
        >
          {phase.status}
        </Badge>
        {phase.executionMode !== 'sequential' && (
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            {phase.executionMode}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {completedCount}/{totalCount}
        </span>
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              phase.status === 'failed' ? 'bg-error' : 'bg-success'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Plan Status Badge ──
function PlanStatusBadge({ status }: { status: string }) {
  const variant =
    status === 'completed'
      ? 'default'
      : status === 'failed'
        ? 'destructive'
        : status === 'running'
          ? 'default'
          : 'secondary';

  return (
    <Badge
      variant={variant}
      className={cn(
        'text-[10px]',
        status === 'running' &&
          'bg-accent-primary text-accent-primary-foreground'
      )}
    >
      {status}
    </Badge>
  );
}
