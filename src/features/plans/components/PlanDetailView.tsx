'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Badge } from '@/shared/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { PlanStatusBadge } from './PlanStatusBadge';
import { cn, formatRelativeTime, formatDuration } from '@/shared/lib/utils';
import {
  useGetPlanQuery,
  useExecutePlanMutation,
  usePausePlanMutation,
  useResumePlanMutation,
  useCancelPlanMutation,
  useUpdatePlanMutation,
  useCreatePhaseMutation,
  useUpdatePhaseMutation,
  useDeletePhaseMutation,
  useCreatePlanTaskMutation,
  useUpdatePlanTaskMutation,
  useDeletePlanTaskMutation,
  useRetryPlanTaskMutation,
} from '../store/plansApi';
import type { Plan, Phase, PlanTask } from '@/db/schema';
import {
  ChevronRight,
  ChevronDown,
  Play,
  Pause,
  RotateCcw,
  Square,
  Edit2,
  Check,
  X,
  Plus,
  Trash2,
  MessageSquare,
  Layers,
  ListChecks,
  Clock,
  AlertTriangle,
  ArrowRight,
  GitCommit,
  RefreshCw,
  Zap,
  Shield,
  ChevronLeft,
  Rocket,
  Eye,
  Users,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanDetailViewProps {
  planId: string;
  onBack: () => void;
  onReview?: (planId: string) => void;
  onLaunch?: (planId: string) => void;
  onViewExecution?: (planId: string) => void;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PlanDetailView({
  planId,
  onBack,
  onReview,
  onLaunch,
  onViewExecution,
}: PlanDetailViewProps) {
  const { data, isLoading, error } = useGetPlanQuery(planId, {
    pollingInterval: 2000,
    skipPollingIfUnfocused: true,
  });

  const [executePlan, { isLoading: isExecuting }] = useExecutePlanMutation();
  const [pausePlan, { isLoading: isPausing }] = usePausePlanMutation();
  const [resumePlan, { isLoading: isResuming }] = useResumePlanMutation();
  const [cancelPlan, { isLoading: isCancelling }] = useCancelPlanMutation();
  const [updatePlan] = useUpdatePlanMutation();
  const [createPhase] = useCreatePhaseMutation();
  const [updatePhase] = useUpdatePhaseMutation();
  const [deletePhase] = useDeletePhaseMutation();
  const [createTask] = useCreatePlanTaskMutation();
  const [updateTask] = useUpdatePlanTaskMutation();
  const [deleteTask] = useDeletePlanTaskMutation();
  const [retryTask] = useRetryPlanTaskMutation();

  const [isEditMode, setIsEditMode] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [taskEdits, setTaskEdits] = useState({ title: '', description: '' });
  const [phaseEdits, setPhaseEdits] = useState({ title: '', description: '' });

  // Expand all phases by default on first load
  const phases = useMemo(() => {
    if (!data) return [];
    return [...data.phases].sort((a, b) => a.order - b.order);
  }, [data]);

  // Auto-expand phases that are running or failed
  useMemo(() => {
    if (!phases.length) return;
    const newExpanded = new Set(expandedPhases);
    let changed = false;
    phases.forEach((phase) => {
      if (
        (phase.status === 'running' || phase.status === 'failed') &&
        !newExpanded.has(phase.id)
      ) {
        newExpanded.add(phase.id);
        changed = true;
      }
    });
    // On first load, expand all
    if (expandedPhases.size === 0 && phases.length > 0) {
      phases.forEach((p) => newExpanded.add(p.id));
      changed = true;
    }
    if (changed) setExpandedPhases(newExpanded);
  }, [phases]);

  const phaseTasksMap = useMemo(() => {
    if (!data) return new Map<string, PlanTask[]>();
    const map = new Map<string, PlanTask[]>();
    data.tasks.forEach((task) => {
      if (!map.has(task.phaseId)) map.set(task.phaseId, []);
      map.get(task.phaseId)!.push(task);
    });
    return map;
  }, [data]);

  const togglePhase = useCallback((phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  }, []);

  // Task editing
  const startEditingTask = useCallback((task: PlanTask) => {
    setEditingTaskId(task.id);
    setTaskEdits({ title: task.title, description: task.description });
  }, []);

  const saveTask = useCallback(async () => {
    if (!editingTaskId) return;
    await updateTask({ id: editingTaskId, data: { ...taskEdits, planId } });
    setEditingTaskId(null);
  }, [editingTaskId, taskEdits, planId, updateTask]);

  const cancelTaskEdit = useCallback(() => {
    setEditingTaskId(null);
    setTaskEdits({ title: '', description: '' });
  }, []);

  // Phase editing
  const startEditingPhase = useCallback((phase: Phase) => {
    setEditingPhaseId(phase.id);
    setPhaseEdits({ title: phase.title, description: phase.description || '' });
  }, []);

  const savePhase = useCallback(async () => {
    if (!editingPhaseId) return;
    await updatePhase({ id: editingPhaseId, data: { ...phaseEdits, planId } });
    setEditingPhaseId(null);
  }, [editingPhaseId, phaseEdits, planId, updatePhase]);

  const cancelPhaseEdit = useCallback(() => {
    setEditingPhaseId(null);
    setPhaseEdits({ title: '', description: '' });
  }, []);

  const handleAddPhase = useCallback(async () => {
    const maxOrder = Math.max(...phases.map((p) => p.order), 0);
    await createPhase({
      planId,
      order: maxOrder + 1,
      title: 'New Phase',
      description: '',
      executionMode: 'sequential',
      pauseAfter: false,
    });
  }, [phases, planId, createPhase]);

  const handleDeletePhase = useCallback(
    async (phaseId: string) => {
      if (confirm('Delete this phase and all its tasks?')) {
        await deletePhase(phaseId);
      }
    },
    [deletePhase]
  );

  const handleAddTask = useCallback(
    async (phaseId: string) => {
      const phaseTasks = (phaseTasksMap.get(phaseId) || []).sort(
        (a, b) => a.order - b.order
      );
      const maxOrder = Math.max(...phaseTasks.map((t) => t.order), 0);
      await createTask({
        phaseId,
        planId,
        order: maxOrder + 1,
        title: 'New Task',
        description: 'Task description',
        canRunInParallel: false,
      });
    },
    [phaseTasksMap, planId, createTask]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      if (confirm('Delete this task?')) {
        await deleteTask(taskId);
      }
    },
    [deleteTask]
  );

  // Loading & error states
  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <PlanDetailSkeleton onBack={onBack} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-col">
        <Breadcrumb onBack={onBack} />
        <div className="flex flex-1 items-center justify-center">
          <div className="space-y-3 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
            <p className="text-sm font-medium text-destructive">
              Failed to load plan
            </p>
            <Button variant="outline" size="sm" onClick={onBack}>
              Back to Plans
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const plan = data.plan;
  const allTasks = data.tasks;

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto pb-6">
      {/* Breadcrumb */}
      <Breadcrumb onBack={onBack} planTitle={plan.title} />

      {/* Header Card */}
      <PlanHeaderCard
        plan={plan}
        allTasks={allTasks}
        isEditMode={isEditMode}
        onToggleEdit={() => setIsEditMode(!isEditMode)}
        onExecute={() => executePlan(planId)}
        onLaunch={onLaunch ? () => onLaunch(planId) : undefined}
        onViewExecution={
          onViewExecution ? () => onViewExecution(planId) : undefined
        }
        onPause={() => pausePlan(planId)}
        onResume={() => resumePlan(planId)}
        onCancel={() => {
          if (confirm('Cancel this plan execution?')) cancelPlan(planId);
        }}
        onMarkReady={() =>
          updatePlan({ id: planId, data: { status: 'ready' } })
        }
        onReview={onReview ? () => onReview(planId) : undefined}
        isExecuting={isExecuting}
        isPausing={isPausing}
        isResuming={isResuming}
        isCancelling={isCancelling}
      />

      {/* Phase List */}
      <div className="space-y-3">
        {phases.map((phase, idx) => (
          <PhaseItem
            key={phase.id}
            phase={phase}
            phaseNumber={idx + 1}
            phaseTasks={(phaseTasksMap.get(phase.id) || []).sort(
              (a, b) => a.order - b.order
            )}
            allTasks={allTasks}
            isExpanded={expandedPhases.has(phase.id)}
            isEditMode={isEditMode}
            isEditingPhase={editingPhaseId === phase.id}
            isCurrent={plan.currentPhaseId === phase.id}
            currentTaskId={plan.currentTaskId}
            editingTaskId={editingTaskId}
            phaseEdits={phaseEdits}
            taskEdits={taskEdits}
            planId={planId}
            updatePhase={updatePhase}
            updateTask={updateTask}
            onToggle={() => togglePhase(phase.id)}
            onStartEditPhase={() => startEditingPhase(phase)}
            onSavePhase={savePhase}
            onCancelPhaseEdit={cancelPhaseEdit}
            onDeletePhase={() => handleDeletePhase(phase.id)}
            onPhaseEditsChange={setPhaseEdits}
            onStartEditTask={startEditingTask}
            onSaveTask={saveTask}
            onCancelTaskEdit={cancelTaskEdit}
            onDeleteTask={handleDeleteTask}
            onRetryTask={(id) => retryTask(id)}
            onAddTask={() => handleAddTask(phase.id)}
            onTaskEditsChange={setTaskEdits}
          />
        ))}
      </div>

      {/* Add phase button in edit mode */}
      {isEditMode && (
        <Button
          onClick={handleAddPhase}
          variant="outline"
          className="w-full border-dashed"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Phase
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plan Header Card (extracted to reduce main component complexity)
// ---------------------------------------------------------------------------

const PlanHeaderCard = React.memo(function PlanHeaderCard({
  plan,
  allTasks,
  isEditMode,
  onToggleEdit,
  onExecute,
  onLaunch,
  onViewExecution,
  onPause,
  onResume,
  onCancel,
  onMarkReady,
  onReview,
  isExecuting,
  isPausing,
  isResuming,
  isCancelling,
}: {
  plan: Plan;
  allTasks: PlanTask[];
  isEditMode: boolean;
  onToggleEdit: () => void;
  onExecute: () => void;
  onLaunch?: () => void;
  onViewExecution?: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onMarkReady: () => void;
  onReview?: () => void;
  isExecuting: boolean;
  isPausing: boolean;
  isResuming: boolean;
  isCancelling: boolean;
}) {
  const progress =
    plan.totalTasks > 0
      ? Math.round((plan.completedTasks / plan.totalTasks) * 100)
      : 0;
  const failedTasks = allTasks.filter((t) => t.status === 'failed');
  const runningTasks = allTasks.filter((t) => t.status === 'running');
  const isActive = plan.status === 'running' || plan.status === 'paused';

  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-5 sm:p-6',
        isActive && 'border-l-4 border-l-amber-500',
        plan.status === 'failed' && 'border-l-4 border-l-red-500',
        plan.status === 'completed' && 'border-l-4 border-l-emerald-500'
      )}
    >
      {/* Title row */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-foreground sm:text-xl">
              {plan.title}
            </h1>
            <PlanStatusBadge status={plan.status} />
          </div>
          {plan.description && (
            <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
              {plan.description}
            </p>
          )}
        </div>

        <ExecutionControls
          status={plan.status}
          isEditMode={isEditMode}
          onEdit={onToggleEdit}
          onExecute={onExecute}
          onLaunch={onLaunch}
          onViewExecution={onViewExecution}
          onPause={onPause}
          onResume={onResume}
          onCancel={onCancel}
          onMarkReady={onMarkReady}
          onReview={onReview}
          isExecuting={isExecuting}
          isPausing={isPausing}
          isResuming={isResuming}
          isCancelling={isCancelling}
        />
      </div>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill
          icon={<Layers className="h-3.5 w-3.5" />}
          label="Phases"
          value={`${plan.completedPhases}/${plan.totalPhases}`}
        />
        <StatPill
          icon={<ListChecks className="h-3.5 w-3.5" />}
          label="Tasks"
          value={`${plan.completedTasks}/${plan.totalTasks}`}
        />
        <StatPill
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Updated"
          value={formatRelativeTime(new Date(plan.updatedAt))}
        />
        {plan.startedAt && plan.completedAt ? (
          <StatPill
            icon={<Zap className="h-3.5 w-3.5" />}
            label="Duration"
            value={formatDuration(
              new Date(plan.startedAt),
              new Date(plan.completedAt)
            )}
          />
        ) : plan.startedAt ? (
          <StatPill
            icon={<Zap className="h-3.5 w-3.5" />}
            label="Running since"
            value={formatRelativeTime(new Date(plan.startedAt))}
          />
        ) : (
          <StatPill
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Created"
            value={formatRelativeTime(new Date(plan.createdAt))}
          />
        )}
      </div>

      {/* Progress bar */}
      {plan.totalTasks > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
            <span className="font-medium">Overall Progress</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                plan.status === 'failed'
                  ? 'bg-red-500'
                  : plan.status === 'completed'
                    ? 'bg-emerald-500'
                    : 'bg-primary'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Alert banners */}
      {failedTasks.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            {failedTasks.length} task{failedTasks.length > 1 ? 's' : ''} failed
          </span>
        </div>
      )}

      {runningTasks.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
          <RefreshCw className="h-4 w-4 flex-shrink-0 animate-spin" />
          <span>
            {runningTasks.length} task{runningTasks.length > 1 ? 's' : ''}{' '}
            running
          </span>
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Breadcrumb
// ---------------------------------------------------------------------------

function Breadcrumb({
  onBack,
  planTitle,
}: {
  onBack: () => void;
  planTitle?: string;
}) {
  return (
    <nav className="flex flex-shrink-0 items-center gap-1.5 text-sm">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Plans</span>
      </button>
      {planTitle && (
        <>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="max-w-[200px] truncate font-medium text-foreground sm:max-w-[400px]">
            {planTitle}
          </span>
        </>
      )}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Execution Controls
// ---------------------------------------------------------------------------

function ExecutionControls({
  status,
  isEditMode,
  onEdit,
  onExecute,
  onLaunch,
  onViewExecution,
  onPause,
  onResume,
  onCancel,
  onMarkReady,
  onReview,
  isExecuting,
  isPausing,
  isResuming,
  isCancelling,
}: {
  status: string;
  isEditMode: boolean;
  onEdit: () => void;
  onExecute: () => void;
  onLaunch?: () => void;
  onViewExecution?: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onMarkReady: () => void;
  onReview?: () => void;
  isExecuting: boolean;
  isPausing: boolean;
  isResuming: boolean;
  isCancelling: boolean;
}) {
  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
      {/* Draft actions */}
      {status === 'draft' && (
        <>
          {onReview && (
            <Button
              size="sm"
              variant="outline"
              onClick={onReview}
              className="h-8"
            >
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">Iterate</span>
            </Button>
          )}
          <Button
            size="sm"
            variant={isEditMode ? 'default' : 'outline'}
            onClick={onEdit}
            className="h-8"
          >
            <Edit2 className="mr-1.5 h-3.5 w-3.5" />
            {isEditMode ? 'Done' : 'Edit'}
          </Button>
          {onLaunch ? (
            <Button size="sm" onClick={onLaunch} className="h-8 gap-1.5">
              <Rocket className="h-3.5 w-3.5" />
              Launch
            </Button>
          ) : (
            <Button size="sm" onClick={onMarkReady} className="h-8">
              <Shield className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mark</span> Ready
            </Button>
          )}
        </>
      )}

      {/* Ready actions */}
      {status === 'ready' && (
        <>
          {onReview && (
            <Button
              size="sm"
              variant="outline"
              onClick={onReview}
              className="h-8"
            >
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">Iterate</span>
            </Button>
          )}
          {onLaunch ? (
            <Button size="sm" onClick={onLaunch} className="h-8 gap-1.5">
              <Rocket className="h-3.5 w-3.5" />
              Launch
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onExecute}
              disabled={isExecuting}
              className="h-8"
            >
              <Play className="mr-1.5 h-3.5 w-3.5" />
              {isExecuting ? 'Starting...' : 'Execute'}
            </Button>
          )}
        </>
      )}

      {/* Running actions */}
      {status === 'running' && (
        <>
          {onViewExecution && (
            <Button size="sm" onClick={onViewExecution} className="h-8 gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Live View
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onPause}
            disabled={isPausing}
            className="h-8"
          >
            <Pause className="mr-1.5 h-3.5 w-3.5" />
            {isPausing ? 'Pausing...' : 'Pause'}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onCancel}
            disabled={isCancelling}
            className="h-8"
          >
            <Square className="mr-1.5 h-3.5 w-3.5" />
            {isCancelling ? 'Cancelling...' : 'Cancel'}
          </Button>
        </>
      )}

      {/* Paused actions */}
      {status === 'paused' && (
        <>
          <Button
            size="sm"
            onClick={onResume}
            disabled={isResuming}
            className="h-8"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {isResuming ? 'Resuming...' : 'Resume'}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onCancel}
            disabled={isCancelling}
            className="h-8"
          >
            <Square className="mr-1.5 h-3.5 w-3.5" />
            {isCancelling ? 'Cancelling...' : 'Cancel'}
          </Button>
        </>
      )}

      {/* Failed actions */}
      {status === 'failed' && (
        <>
          <Button
            size="sm"
            onClick={onResume}
            disabled={isResuming}
            className="h-8"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {isResuming ? 'Resuming...' : 'Retry'}
          </Button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Pill
// ---------------------------------------------------------------------------

function StatPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs">
      <span className="flex-shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="truncate font-medium text-foreground">{value}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase Item (extracted to reduce complexity)
// ---------------------------------------------------------------------------

// eslint-disable-next-line complexity
const PhaseItem = React.memo(function PhaseItem({
  phase,
  phaseNumber,
  phaseTasks,
  allTasks,
  isExpanded,
  isEditMode,
  isEditingPhase,
  isCurrent,
  currentTaskId,
  editingTaskId,
  phaseEdits,
  taskEdits,
  planId,
  updatePhase,
  updateTask,
  onToggle,
  onStartEditPhase,
  onSavePhase,
  onCancelPhaseEdit,
  onDeletePhase,
  onPhaseEditsChange,
  onStartEditTask,
  onSaveTask,
  onCancelTaskEdit,
  onDeleteTask,
  onRetryTask,
  onAddTask,
  onTaskEditsChange,
}: {
  phase: Phase;
  phaseNumber: number;
  phaseTasks: PlanTask[];
  allTasks: PlanTask[];
  isExpanded: boolean;
  isEditMode: boolean;
  isEditingPhase: boolean;
  isCurrent: boolean;
  currentTaskId: string | null;
  editingTaskId: string | null;
  phaseEdits: { title: string; description: string };
  taskEdits: { title: string; description: string };
  planId: string;
  updatePhase: ReturnType<typeof useUpdatePhaseMutation>[0];
  updateTask: ReturnType<typeof useUpdatePlanTaskMutation>[0];
  onToggle: () => void;
  onStartEditPhase: () => void;
  onSavePhase: () => void;
  onCancelPhaseEdit: () => void;
  onDeletePhase: () => void;
  onPhaseEditsChange: (edits: { title: string; description: string }) => void;
  onStartEditTask: (task: PlanTask) => void;
  onSaveTask: () => void;
  onCancelTaskEdit: () => void;
  onDeleteTask: (taskId: string) => void;
  onRetryTask: (taskId: string) => void;
  onAddTask: () => void;
  onTaskEditsChange: (edits: { title: string; description: string }) => void;
}) {
  const completedCount = phaseTasks.filter(
    (t) => t.status === 'completed'
  ).length;
  const failedCount = phaseTasks.filter((t) => t.status === 'failed').length;
  const phaseProgress =
    phaseTasks.length > 0
      ? Math.round((completedCount / phaseTasks.length) * 100)
      : 0;

  return (
    <Card
      className={cn(
        'overflow-hidden transition-colors',
        isCurrent && 'ring-1 ring-primary/30',
        phase.status === 'running' && 'border-amber-500/30',
        phase.status === 'failed' && 'border-red-500/30',
        phase.status === 'completed' && 'border-emerald-500/30'
      )}
    >
      {/* Phase Header - always visible, acts as toggle */}
      <button
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
          'hover:bg-muted/40',
          isExpanded && 'border-b border-border/50'
        )}
        onClick={onToggle}
      >
        {/* Expand/collapse chevron */}
        <div className="flex-shrink-0 text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>

        {/* Phase number indicator */}
        <PhaseNumberBadge
          number={phaseNumber}
          status={phase.status}
          isCurrent={isCurrent}
        />

        {/* Phase title & info */}
        <div className="min-w-0 flex-1">
          {isEditingPhase ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <Input
                value={phaseEdits.title}
                onChange={(e) =>
                  onPhaseEditsChange({ ...phaseEdits, title: e.target.value })
                }
                className="h-8 text-sm font-semibold"
                autoFocus
              />
              <Textarea
                value={phaseEdits.description}
                onChange={(e) =>
                  onPhaseEditsChange({
                    ...phaseEdits,
                    description: e.target.value,
                  })
                }
                rows={2}
                className="text-xs"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={onSavePhase} className="h-7">
                  <Check className="mr-1 h-3 w-3" />
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onCancelPhaseEdit}
                  className="h-7"
                >
                  <X className="mr-1 h-3 w-3" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {phase.title}
                </span>
                <PhaseStatusBadge status={phase.status} />
                {phase.executionMode !== 'sequential' && (
                  <Badge
                    variant="outline"
                    className="h-5 px-1.5 py-0 text-[10px]"
                  >
                    {phase.executionMode}
                  </Badge>
                )}
                {phase.pauseAfter && (
                  <Badge
                    variant="outline"
                    className="h-5 border-orange-500/30 px-1.5 py-0 text-[10px] text-orange-400"
                  >
                    <Pause className="mr-0.5 h-2.5 w-2.5" />
                    Pause after
                  </Badge>
                )}
              </div>
              {phase.description && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {phase.description}
                </p>
              )}
            </>
          )}
        </div>

        {/* Phase stats */}
        <div className="hidden flex-shrink-0 items-center gap-3 sm:flex">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  phase.status === 'failed'
                    ? 'bg-red-500'
                    : phase.status === 'completed'
                      ? 'bg-emerald-500'
                      : 'bg-primary'
                )}
                style={{ width: `${phaseProgress}%` }}
              />
            </div>
            <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
              {completedCount}/{phaseTasks.length}
            </span>
          </div>
          {failedCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertTriangle className="h-3 w-3" />
              {failedCount}
            </span>
          )}
        </div>

        {/* Edit/Delete in edit mode */}
        {isEditMode && !isEditingPhase && (
          <div
            className="flex flex-shrink-0 items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={onStartEditPhase}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={onDeletePhase}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </button>

      {/* Phase Content - collapsible task list */}
      {isExpanded && (
        <CardContent className="p-0">
          {/* Phase settings - only visible in edit mode */}
          {isEditMode && !isEditingPhase && (
            <div className="border-b border-border/30 bg-muted/20 px-4 py-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-foreground">
                      Execution Mode
                    </label>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      How tasks in this phase should run
                    </p>
                  </div>
                  <Select
                    value={phase.executionMode}
                    onValueChange={(value) =>
                      updatePhase({
                        id: phase.id,
                        data: {
                          executionMode: value as
                            | 'sequential'
                            | 'parallel'
                            | 'manual',
                          planId,
                        },
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sequential">
                        <div className="flex items-center gap-1.5">
                          <Play className="h-3 w-3" />
                          Sequential
                        </div>
                      </SelectItem>
                      <SelectItem value="parallel">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3 w-3" />
                          Parallel
                        </div>
                      </SelectItem>
                      <SelectItem value="manual">
                        <div className="flex items-center gap-1.5">
                          <Pause className="h-3 w-3" />
                          Manual
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-foreground">
                      Pause After Phase
                    </label>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Stop execution after this phase completes
                    </p>
                  </div>
                  <Checkbox
                    checked={phase.pauseAfter}
                    onCheckedChange={(checked) =>
                      updatePhase({
                        id: phase.id,
                        data: { pauseAfter: checked === true, planId },
                      })
                    }
                  />
                </div>
              </div>
            </div>
          )}

          <div className="divide-y divide-border/30">
            {phaseTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                allTasks={allTasks}
                isEditMode={isEditMode}
                isEditing={editingTaskId === task.id}
                taskEdits={taskEdits}
                isCurrent={currentTaskId === task.id}
                updateTask={updateTask}
                planId={planId}
                onStartEdit={() => onStartEditTask(task)}
                onSave={onSaveTask}
                onCancel={onCancelTaskEdit}
                onDelete={() => onDeleteTask(task.id)}
                onRetry={() => onRetryTask(task.id)}
                onEditChange={onTaskEditsChange}
              />
            ))}
          </div>

          {isEditMode && (
            <div className="border-t border-border/30 p-3">
              <Button
                onClick={onAddTask}
                variant="ghost"
                size="sm"
                className="h-8 w-full text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Task
              </Button>
            </div>
          )}

          <div className="flex justify-between bg-muted/20 px-4 py-2 text-xs text-muted-foreground sm:hidden">
            <span>
              {completedCount}/{phaseTasks.length} tasks completed
            </span>
            {failedCount > 0 && (
              <span className="text-red-400">{failedCount} failed</span>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
});

// ---------------------------------------------------------------------------
// Phase Number Badge
// ---------------------------------------------------------------------------

function PhaseNumberBadge({
  number,
  status,
  isCurrent,
}: {
  number: number;
  status: string;
  isCurrent: boolean;
}) {
  return (
    <div
      className={cn(
        'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        status === 'completed' &&
          'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
        status === 'running' &&
          'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
        status === 'failed' &&
          'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
        status === 'paused' &&
          'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30',
        status === 'pending' &&
          (isCurrent
            ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
            : 'bg-muted text-muted-foreground')
      )}
    >
      {status === 'completed' ? <Check className="h-3.5 w-3.5" /> : number}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase Status Badge (inline)
// ---------------------------------------------------------------------------

function PhaseStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'text-muted-foreground bg-muted' },
    running: {
      label: 'Running',
      className: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    completed: {
      label: 'Done',
      className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
    failed: {
      label: 'Failed',
      className: 'text-red-400 bg-red-500/10 border-red-500/20',
    },
    paused: {
      label: 'Paused',
      className: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    },
  };

  const c = config[status] ?? config.pending;

  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-md border px-1.5 py-0 text-[10px] font-medium',
        c!.className
      )}
    >
      {c!.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Task Row
// ---------------------------------------------------------------------------

const TaskRow = React.memo(function TaskRow({
  task,
  allTasks,
  isEditMode,
  isEditing,
  taskEdits,
  isCurrent,
  updateTask,
  planId,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
  onRetry,
  onEditChange,
}: {
  task: PlanTask;
  allTasks: PlanTask[];
  isEditMode: boolean;
  isEditing: boolean;
  taskEdits: { title: string; description: string };
  isCurrent: boolean;
  updateTask: ReturnType<typeof useUpdatePlanTaskMutation>[0];
  planId: string;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onEditChange: (edits: { title: string; description: string }) => void;
}) {
  const rawDeps = task.dependsOn;
  const deps: string[] = Array.isArray(rawDeps)
    ? rawDeps
    : typeof rawDeps === 'string' && rawDeps
      ? (() => {
          try {
            return JSON.parse(rawDeps);
          } catch {
            return [];
          }
        })()
      : [];
  const depTasks = deps
    .map((depId) => allTasks.find((t) => t.id === depId))
    .filter(Boolean);

  return (
    <div
      className={cn(
        'group px-4 py-3 transition-colors',
        isCurrent && 'bg-primary/5',
        isEditMode && !isEditing && 'cursor-pointer hover:bg-muted/40',
        task.status === 'running' && 'bg-amber-500/5'
      )}
      onClick={() => isEditMode && !isEditing && onStartEdit()}
    >
      {isEditing ? (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          <Input
            value={taskEdits.title}
            onChange={(e) =>
              onEditChange({ ...taskEdits, title: e.target.value })
            }
            placeholder="Task title"
            className="h-8 text-sm"
            autoFocus
          />
          <Textarea
            value={taskEdits.description}
            onChange={(e) =>
              onEditChange({ ...taskEdits, description: e.target.value })
            }
            placeholder="Task description"
            rows={3}
            className="text-xs"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={onSave} className="h-7">
              <Check className="mr-1 h-3 w-3" />
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onCancel}
              className="h-7"
            >
              <X className="mr-1 h-3 w-3" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          {/* Task status indicator */}
          <TaskStatusDot status={task.status} />

          {/* Task content */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {task.title}
              </span>
              <TaskStatusLabel status={task.status} />
              {task.attempts > 1 && (
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  Attempt {task.attempts}
                </span>
              )}
            </div>

            <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
              {task.description}
            </p>

            {/* Task parallel execution setting - only in edit mode */}
            {isEditMode && !isEditing && (
              <div className="mt-2 flex items-center gap-2">
                <Checkbox
                  checked={task.canRunInParallel}
                  onCheckedChange={(checked) =>
                    updateTask({
                      id: task.id,
                      data: { canRunInParallel: checked === true, planId },
                    })
                  }
                  id={`parallel-${task.id}`}
                />
                <label
                  htmlFor={`parallel-${task.id}`}
                  className="cursor-pointer text-[11px] text-muted-foreground"
                >
                  Can run in parallel with other tasks
                </label>
              </div>
            )}

            {/* Dependencies */}
            {depTasks.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                {depTasks.map((dep) => (
                  <span
                    key={dep!.id}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]',
                      dep!.status === 'completed'
                        ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                        : dep!.status === 'failed'
                          ? 'border-red-500/20 bg-red-500/5 text-red-400'
                          : 'border-border bg-muted/30 text-muted-foreground'
                    )}
                  >
                    {dep!.status === 'completed' && (
                      <Check className="h-2.5 w-2.5" />
                    )}
                    {dep!.title}
                  </span>
                ))}
              </div>
            )}

            {/* Commit SHA */}
            {task.commitSha && (
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                <GitCommit className="h-3 w-3" />
                <code className="font-mono">{task.commitSha.slice(0, 8)}</code>
              </div>
            )}

            {/* Error */}
            {task.lastError && (
              <div className="mt-1.5 rounded-md border border-red-500/15 bg-red-500/5 px-2.5 py-1.5 text-xs text-red-400">
                {task.lastError}
              </div>
            )}
          </div>

          {/* Task actions */}
          <div className="flex flex-shrink-0 items-center gap-1">
            {task.status === 'failed' && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry();
                }}
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Retry
              </Button>
            )}
            {isEditMode && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-destructive opacity-0 hover:text-destructive group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Task Status Dot
// ---------------------------------------------------------------------------

function TaskStatusDot({ status }: { status: string }) {
  return (
    <div className="mt-1.5 flex-shrink-0">
      <div
        className={cn(
          'h-2.5 w-2.5 rounded-full',
          status === 'completed' && 'bg-emerald-500',
          status === 'running' && 'animate-pulse bg-amber-500',
          status === 'failed' && 'bg-red-500',
          status === 'skipped' && 'bg-slate-400',
          status === 'pending' && 'bg-muted-foreground/30'
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task Status Label
// ---------------------------------------------------------------------------

function TaskStatusLabel({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: {
      label: 'Pending',
      className: 'text-muted-foreground bg-muted border-transparent',
    },
    running: {
      label: 'Running',
      className: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    completed: {
      label: 'Done',
      className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
    failed: {
      label: 'Failed',
      className: 'text-red-400 bg-red-500/10 border-red-500/20',
    },
    skipped: {
      label: 'Skipped',
      className: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
    },
  };
  const c = config[status] ?? config.pending;

  return (
    <span
      className={cn(
        'inline-flex h-4 items-center rounded border px-1.5 py-0 text-[10px] font-medium',
        c!.className
      )}
    >
      {c!.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function PlanDetailSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <>
      <Breadcrumb onBack={onBack} />
      <div className="mt-4 space-y-4">
        {/* Header skeleton */}
        <div className="animate-pulse space-y-4 rounded-xl border bg-card p-6">
          <div className="flex justify-between">
            <div className="flex-1 space-y-2">
              <div className="h-6 w-48 rounded bg-muted" />
              <div className="h-4 w-72 rounded bg-muted/60" />
            </div>
            <div className="h-8 w-24 rounded bg-muted" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-muted/40" />
            ))}
          </div>
          <div className="h-2 rounded-full bg-muted" />
        </div>

        {/* Phase skeletons */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border bg-card">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="h-7 w-7 rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="h-3 w-64 rounded bg-muted/60" />
              </div>
              <div className="h-1.5 w-16 rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
