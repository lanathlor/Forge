'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
import { cn, formatRelativeTime } from '@/shared/lib/utils';
import {
  useGetPlanQuery,
  useUpdatePlanMutation,
  useCreatePhaseMutation,
  useUpdatePhaseMutation,
  useDeletePhaseMutation,
  useCreatePlanTaskMutation,
  useUpdatePlanTaskMutation,
  useDeletePlanTaskMutation,
} from '../store/plansApi';
import type { Plan, Phase, PlanTask, PlanIteration } from '@/db/schema';
import {
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Plus,
  Trash2,
  GripVertical,
  ChevronLeft,
  Save,
  AlertTriangle,
  Clock,
  History,
  Link2,
  Unlink,
  AlertCircle,
  Pencil,
  Zap,
  Users,
  Loader2,
  Pause,
  Play,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanEditorProps {
  planId: string;
  onBack: () => void;
}

interface DragState {
  type: 'phase' | 'task';
  id: string;
  sourcePhaseId?: string;
}

// ---------------------------------------------------------------------------
// Circular dependency detection
// ---------------------------------------------------------------------------

function detectCircularDependency(
  taskId: string,
  newDeps: string[],
  allTasks: PlanTask[]
): { hasCycle: boolean; cyclePath: string[] } {
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));

  const adjList = new Map<string, string[]>();
  for (const t of allTasks) {
    if (t.id === taskId) {
      adjList.set(t.id, newDeps);
    } else {
      const rawTDeps = t.dependsOn;
      adjList.set(
        t.id,
        Array.isArray(rawTDeps)
          ? rawTDeps
          : typeof rawTDeps === 'string' && rawTDeps
            ? (() => {
                try {
                  return JSON.parse(rawTDeps);
                } catch {
                  return [];
                }
              })()
            : []
      );
    }
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): boolean {
    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const dep of adjList.get(node) || []) {
      if (inStack.has(dep)) {
        path.push(dep);
        return true;
      }
      if (!visited.has(dep) && dfs(dep)) {
        return true;
      }
    }

    path.pop();
    inStack.delete(node);
    return false;
  }

  const hasCycle = dfs(taskId);
  const lastNode = path[path.length - 1];
  const cyclePath =
    hasCycle && lastNode
      ? path
          .slice(path.indexOf(lastNode))
          .map((id) => taskMap.get(id)?.title || id)
      : [];

  return { hasCycle, cyclePath };
}

// ---------------------------------------------------------------------------
// Inline Editable Field - click to edit, blur to save
// ---------------------------------------------------------------------------

function InlineEditable({
  value,
  onSave,
  className,
  inputClassName,
  placeholder,
  multiline = false,
  disabled = false,
  saving = false,
}: {
  value: string;
  onSave: (newValue: string) => Promise<void> | void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
  saving?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (!multiline) inputRef.current.select();
    }
  }, [isEditing, multiline]);

  const handleSave = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      await onSave(trimmed);
    } else {
      setDraft(value);
    }
    setIsEditing(false);
  }, [draft, value, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        setDraft(value);
        setIsEditing(false);
      }
    },
    [handleSave, multiline, value]
  );

  if (disabled) {
    return (
      <span className={className}>
        {value || (
          <span className="italic text-muted-foreground">{placeholder}</span>
        )}
      </span>
    );
  }

  if (isEditing) {
    const sharedProps = {
      ref: inputRef,
      value: draft,
      onBlur: handleSave,
      onKeyDown: handleKeyDown,
      placeholder,
    };

    return (
      <div className="flex items-start gap-1.5">
        {multiline ? (
          <Textarea
            {...sharedProps}
            onChange={(e) => setDraft(e.target.value)}
            className={cn('min-h-[60px] flex-1 text-xs', inputClassName)}
            rows={3}
          />
        ) : (
          <Input
            {...sharedProps}
            onChange={(e) => setDraft(e.target.value)}
            className={cn('h-8 flex-1 text-sm', inputClassName)}
          />
        )}
        {saving && (
          <Loader2 className="mt-2 h-3.5 w-3.5 flex-shrink-0 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }

  return (
    <span
      className={cn(
        className,
        '-mx-1 cursor-text rounded-sm px-1 transition-colors',
        'hover:bg-muted/60 hover:ring-1 hover:ring-border/50',
        !value && 'italic text-muted-foreground'
      )}
      onClick={() => setIsEditing(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsEditing(true);
        }
      }}
    >
      {value || placeholder}
      {saving && (
        <Loader2 className="ml-1 inline-block h-3 w-3 animate-spin text-muted-foreground" />
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Drag-and-drop hook
// ---------------------------------------------------------------------------

function useDragHandlers(
  phases: Phase[],
  phaseTasksMap: Map<string, PlanTask[]>,
  updatePhase: ReturnType<typeof useUpdatePhaseMutation>[0],
  updateTask: ReturnType<typeof useUpdatePlanTaskMutation>[0],
  planId: string
) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handlePhaseDragStart = useCallback(
    (e: React.DragEvent, phaseId: string) => {
      setDragState({ type: 'phase', id: phaseId });
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', phaseId);
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = '0.5';
      }
    },
    []
  );

  const handleTaskDragStart = useCallback(
    (e: React.DragEvent, taskId: string, phaseId: string) => {
      setDragState({ type: 'task', id: taskId, sourcePhaseId: phaseId });
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', taskId);
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = '0.5';
      }
    },
    []
  );

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDragState(null);
    setDragOverId(null);
  }, []);

  const handlePhaseDragOver = useCallback(
    (e: React.DragEvent, targetPhaseId: string) => {
      if (!dragState || dragState.type !== 'phase') return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverId(targetPhaseId);
    },
    [dragState]
  );

  const handlePhaseDrop = useCallback(
    async (e: React.DragEvent, targetPhaseId: string) => {
      e.preventDefault();
      if (
        !dragState ||
        dragState.type !== 'phase' ||
        dragState.id === targetPhaseId
      ) {
        setDragState(null);
        setDragOverId(null);
        return;
      }

      const draggedIdx = phases.findIndex((p) => p.id === dragState.id);
      const targetIdx = phases.findIndex((p) => p.id === targetPhaseId);
      if (draggedIdx === -1 || targetIdx === -1) return;

      const reordered = [...phases];
      const [moved] = reordered.splice(draggedIdx, 1);
      if (!moved) return;
      reordered.splice(targetIdx, 0, moved);

      const updates = reordered.map((p, i) =>
        updatePhase({ id: p.id, data: { order: i + 1, planId } })
      );
      await Promise.all(updates);
      setDragState(null);
      setDragOverId(null);
    },
    [dragState, phases, updatePhase, planId]
  );

  const handleTaskDragOver = useCallback(
    (e: React.DragEvent, targetTaskId: string) => {
      if (!dragState || dragState.type !== 'task') return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverId(targetTaskId);
    },
    [dragState]
  );

  const handleTaskDrop = useCallback(
    async (e: React.DragEvent, targetTaskId: string, targetPhaseId: string) => {
      e.preventDefault();
      if (
        !dragState ||
        dragState.type !== 'task' ||
        dragState.id === targetTaskId
      ) {
        setDragState(null);
        setDragOverId(null);
        return;
      }

      const sourceTasks = phaseTasksMap.get(dragState.sourcePhaseId!) || [];
      const targetTasks = phaseTasksMap.get(targetPhaseId) || [];

      if (dragState.sourcePhaseId === targetPhaseId) {
        const reordered = [...sourceTasks];
        const draggedIdx = reordered.findIndex((t) => t.id === dragState.id);
        const targetIdx = reordered.findIndex((t) => t.id === targetTaskId);
        if (draggedIdx === -1 || targetIdx === -1) return;

        const [moved] = reordered.splice(draggedIdx, 1);
        if (!moved) return;
        reordered.splice(targetIdx, 0, moved);

        const updates = reordered.map((t, i) =>
          updateTask({ id: t.id, data: { order: i + 1, planId } })
        );
        await Promise.all(updates);
      } else {
        const targetIdx = targetTasks.findIndex((t) => t.id === targetTaskId);
        await updateTask({
          id: dragState.id,
          data: { phaseId: targetPhaseId, order: targetIdx + 1, planId },
        });
        const remainingSource = sourceTasks.filter(
          (t) => t.id !== dragState.id
        );
        const sourceUpdates = remainingSource.map((t, i) =>
          updateTask({ id: t.id, data: { order: i + 1, planId } })
        );
        await Promise.all(sourceUpdates);
      }

      setDragState(null);
      setDragOverId(null);
    },
    [dragState, phaseTasksMap, updateTask, planId]
  );

  return {
    dragState,
    dragOverId,
    handlePhaseDragStart,
    handleTaskDragStart,
    handleDragEnd,
    handlePhaseDragOver,
    handlePhaseDrop,
    handleTaskDragOver,
    handleTaskDrop,
  };
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PlanEditor({ planId, onBack }: PlanEditorProps) {
  const { data, isLoading, error } = useGetPlanQuery(planId, {
    pollingInterval: 5000,
    skipPollingIfUnfocused: true,
  });

  const [updatePlan] = useUpdatePlanMutation();
  const [createPhase] = useCreatePhaseMutation();
  const [updatePhase] = useUpdatePhaseMutation();
  const [deletePhase] = useDeletePhaseMutation();
  const [createTask] = useCreatePlanTaskMutation();
  const [updateTask] = useUpdatePlanTaskMutation();
  const [deleteTask] = useDeletePlanTaskMutation();

  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [depPickerTaskId, setDepPickerTaskId] = useState<string | null>(null);
  const [depError, setDepError] = useState<string | null>(null);
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());

  const phases = useMemo(() => {
    if (!data) return [];
    return [...data.phases].sort((a, b) => a.order - b.order);
  }, [data]);

  const phaseTasksMap = useMemo(() => {
    if (!data) return new Map<string, PlanTask[]>();
    const map = new Map<string, PlanTask[]>();
    data.tasks.forEach((task) => {
      if (!map.has(task.phaseId)) map.set(task.phaseId, []);
      map.get(task.phaseId)!.push(task);
    });
    map.forEach((tasks) => tasks.sort((a, b) => a.order - b.order));
    return map;
  }, [data]);

  const {
    dragState,
    dragOverId,
    handlePhaseDragStart,
    handleTaskDragStart,
    handleDragEnd,
    handlePhaseDragOver,
    handlePhaseDrop,
    handleTaskDragOver,
    handleTaskDrop,
  } = useDragHandlers(phases, phaseTasksMap, updatePhase, updateTask, planId);

  // Auto-expand all on first load
  const phasesLength = phases.length;
  const expandedSize = expandedPhases.size;
  useEffect(() => {
    if (phasesLength > 0 && expandedSize === 0) {
      setExpandedPhases(new Set(phases.map((p) => p.id)));
    }
  }, [phasesLength, expandedSize, phases]);

  const togglePhase = useCallback((phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  }, []);

  // --- Optimistic saving helpers ---
  const withSaving = useCallback(
    async (key: string, fn: () => Promise<unknown>) => {
      setSavingFields((prev) => new Set(prev).add(key));
      try {
        await fn();
      } finally {
        setTimeout(() => {
          setSavingFields((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }, 600);
      }
    },
    []
  );

  // --- Inline save handlers ---
  const handleSaveTitle = useCallback(
    (title: string) =>
      withSaving('plan-title', () =>
        updatePlan({ id: planId, data: { title } }).unwrap()
      ),
    [planId, updatePlan, withSaving]
  );

  const handleSaveDescription = useCallback(
    (description: string) =>
      withSaving('plan-desc', () =>
        updatePlan({ id: planId, data: { description } }).unwrap()
      ),
    [planId, updatePlan, withSaving]
  );

  const handleSavePhaseTitle = useCallback(
    (phaseId: string, title: string) =>
      withSaving(`phase-${phaseId}`, () =>
        updatePhase({ id: phaseId, data: { title, planId } }).unwrap()
      ),
    [planId, updatePhase, withSaving]
  );

  const handleSavePhaseDescription = useCallback(
    (phaseId: string, description: string) =>
      withSaving(`phase-${phaseId}`, () =>
        updatePhase({ id: phaseId, data: { description, planId } }).unwrap()
      ),
    [planId, updatePhase, withSaving]
  );

  const handleSaveTaskTitle = useCallback(
    (taskId: string, title: string) =>
      withSaving(`task-${taskId}`, () =>
        updateTask({ id: taskId, data: { title, planId } }).unwrap()
      ),
    [planId, updateTask, withSaving]
  );

  const handleSaveTaskDescription = useCallback(
    (taskId: string, description: string) =>
      withSaving(`task-${taskId}`, () =>
        updateTask({ id: taskId, data: { description, planId } }).unwrap()
      ),
    [planId, updateTask, withSaving]
  );

  // --- Phase CRUD ---
  const handleAddPhase = useCallback(async () => {
    const maxOrder = Math.max(...phases.map((p) => p.order), 0);
    const result = await createPhase({
      planId,
      order: maxOrder + 1,
      title: 'New Phase',
      description: '',
      executionMode: 'sequential',
      pauseAfter: false,
    });
    if ('data' in result && result.data) {
      setExpandedPhases((prev) => new Set([...prev, result.data.phase.id]));
    }
  }, [phases, planId, createPhase]);

  const handleDeletePhase = useCallback(
    async (phaseId: string) => {
      if (!confirm('Delete this phase and all its tasks?')) return;
      await deletePhase(phaseId);
    },
    [deletePhase]
  );

  // --- Task CRUD ---
  const handleAddTask = useCallback(
    async (phaseId: string) => {
      const phaseTasks = phaseTasksMap.get(phaseId) || [];
      const maxOrder = Math.max(...phaseTasks.map((t) => t.order), 0);
      await createTask({
        phaseId,
        planId,
        order: maxOrder + 1,
        title: 'New Task',
        description: '',
        canRunInParallel: false,
      });
    },
    [phaseTasksMap, planId, createTask]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      if (!confirm('Delete this task?')) return;
      await deleteTask(taskId);
    },
    [deleteTask]
  );

  // --- Dependency management ---
  const toggleDependency = useCallback(
    async (taskId: string, depTaskId: string) => {
      if (!data) return;
      const task = data.tasks.find((t) => t.id === taskId);
      if (!task) return;

      const rawCurrentDeps = task.dependsOn;
      const currentDeps: string[] = Array.isArray(rawCurrentDeps)
        ? rawCurrentDeps
        : typeof rawCurrentDeps === 'string' && rawCurrentDeps
          ? (() => {
              try {
                return JSON.parse(rawCurrentDeps);
              } catch {
                return [];
              }
            })()
          : [];
      const newDeps = currentDeps.includes(depTaskId)
        ? currentDeps.filter((d) => d !== depTaskId)
        : [...currentDeps, depTaskId];

      const { hasCycle, cyclePath } = detectCircularDependency(
        taskId,
        newDeps,
        data.tasks
      );
      if (hasCycle) {
        setDepError(`Circular dependency: ${cyclePath.join(' \u2192 ')}`);
        setTimeout(() => setDepError(null), 4000);
        return;
      }

      await withSaving(`dep-${taskId}`, () =>
        updateTask({
          id: taskId,
          data: { dependsOn: newDeps, planId },
        }).unwrap()
      );
    },
    [data, updateTask, planId, withSaving]
  );

  // --- Loading/error states ---
  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <EditorBreadcrumb onBack={onBack} />
        <EditorSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-col">
        <EditorBreadcrumb onBack={onBack} />
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
  const iterations = data.iterations;
  const isEditable = plan.status === 'draft' || plan.status === 'ready';
  const isSaving = savingFields.size > 0;

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden lg:flex-row">
      {/* Main editor area */}
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto pb-6">
        {/* Breadcrumb + actions */}
        <div className="flex flex-shrink-0 items-center justify-between">
          <EditorBreadcrumb onBack={onBack} planTitle={plan.title} />
          <div className="flex items-center gap-2">
            {isSaving ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground duration-200 animate-in fade-in">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
                <Save className="h-3 w-3" />
                All changes saved
              </span>
            )}
            <Button
              variant={showHistory ? 'default' : 'outline'}
              size="sm"
              className="h-8"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">History</span>
              {iterations.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 h-4 px-1 text-[10px] leading-none"
                >
                  {iterations.length}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Plan header */}
        <PlanHeaderEditor
          plan={plan}
          isEditable={isEditable}
          savingFields={savingFields}
          onSaveTitle={handleSaveTitle}
          onSaveDescription={handleSaveDescription}
          phasesCount={phases.length}
        />

        {/* Dependency error toast */}
        {depError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 duration-200 animate-in slide-in-from-top-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{depError}</span>
            <button
              className="ml-auto text-red-400/60 hover:text-red-400"
              onClick={() => setDepError(null)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Phases */}
        <div className="space-y-3">
          {phases.map((phase, idx) => (
            <EditorPhaseItem
              key={phase.id}
              phase={phase}
              phaseNumber={idx + 1}
              phaseTasks={phaseTasksMap.get(phase.id) || []}
              allTasks={allTasks}
              isExpanded={expandedPhases.has(phase.id)}
              isEditable={isEditable}
              savingFields={savingFields}
              dragState={dragState}
              dragOverId={dragOverId}
              depPickerTaskId={depPickerTaskId}
              planId={planId}
              updatePhase={updatePhase}
              updateTask={updateTask}
              onToggle={() => togglePhase(phase.id)}
              onSavePhaseTitle={(title) =>
                handleSavePhaseTitle(phase.id, title)
              }
              onSavePhaseDescription={(desc) =>
                handleSavePhaseDescription(phase.id, desc)
              }
              onDeletePhase={() => handleDeletePhase(phase.id)}
              onSaveTaskTitle={handleSaveTaskTitle}
              onSaveTaskDescription={handleSaveTaskDescription}
              onDeleteTask={handleDeleteTask}
              onAddTask={() => handleAddTask(phase.id)}
              onPhaseDragStart={handlePhaseDragStart}
              onPhaseDragOver={handlePhaseDragOver}
              onPhaseDrop={handlePhaseDrop}
              onDragEnd={handleDragEnd}
              onTaskDragStart={handleTaskDragStart}
              onTaskDragOver={handleTaskDragOver}
              onTaskDrop={handleTaskDrop}
              onToggleDepPicker={(taskId) =>
                setDepPickerTaskId((prev) => (prev === taskId ? null : taskId))
              }
              onToggleDependency={toggleDependency}
            />
          ))}
        </div>

        {/* Add phase button */}
        {isEditable && (
          <Button
            onClick={handleAddPhase}
            variant="outline"
            className="h-10 w-full border-dashed"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Phase
          </Button>
        )}
      </div>

      {/* Version history sidebar */}
      <VersionHistorySidebar
        iterations={iterations}
        isVisible={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Breadcrumb
// ---------------------------------------------------------------------------

function EditorBreadcrumb({
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
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="text-xs font-medium text-primary">Editor</span>
        </>
      )}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Plan Header Editor
// ---------------------------------------------------------------------------

function PlanHeaderEditor({
  plan,
  isEditable,
  savingFields,
  onSaveTitle,
  onSaveDescription,
  phasesCount,
}: {
  plan: Plan;
  isEditable: boolean;
  savingFields: Set<string>;
  onSaveTitle: (title: string) => Promise<void>;
  onSaveDescription: (description: string) => Promise<void>;
  phasesCount: number;
}) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-5 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <PlanStatusBadge status={plan.status} />
        <span className="text-xs text-muted-foreground">
          Created {formatRelativeTime(new Date(plan.createdAt))}
        </span>
        {savingFields.has('plan-title') && (
          <span className="flex items-center gap-1 text-xs text-emerald-500 animate-in fade-in">
            <Check className="h-3 w-3" />
            Saved
          </span>
        )}
      </div>

      <InlineEditable
        value={plan.title}
        onSave={onSaveTitle}
        className="block text-lg font-semibold text-foreground sm:text-xl"
        disabled={!isEditable}
        placeholder="Plan title..."
        saving={savingFields.has('plan-title')}
      />

      <InlineEditable
        value={plan.description || ''}
        onSave={onSaveDescription}
        className="block text-sm text-muted-foreground"
        disabled={!isEditable}
        placeholder="Click to add a description..."
        multiline
        saving={savingFields.has('plan-desc')}
      />

      <div className="flex items-center gap-4 border-t border-border/50 pt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          {phasesCount} phase{phasesCount !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          <Check className="h-3 w-3" />
          {plan.completedTasks}/{plan.totalTasks} tasks
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Updated {formatRelativeTime(new Date(plan.updatedAt))}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor Phase Item
// ---------------------------------------------------------------------------

// eslint-disable-next-line complexity
const EditorPhaseItem = React.memo(function EditorPhaseItem({
  phase,
  phaseNumber,
  phaseTasks,
  allTasks,
  isExpanded,
  isEditable,
  savingFields,
  dragState,
  dragOverId,
  depPickerTaskId,
  planId,
  updatePhase,
  updateTask,
  onToggle,
  onSavePhaseTitle,
  onSavePhaseDescription,
  onDeletePhase,
  onSaveTaskTitle,
  onSaveTaskDescription,
  onDeleteTask,
  onAddTask,
  onPhaseDragStart,
  onPhaseDragOver,
  onPhaseDrop,
  onDragEnd,
  onTaskDragStart,
  onTaskDragOver,
  onTaskDrop,
  onToggleDepPicker,
  onToggleDependency,
}: {
  phase: Phase;
  phaseNumber: number;
  phaseTasks: PlanTask[];
  allTasks: PlanTask[];
  isExpanded: boolean;
  isEditable: boolean;
  savingFields: Set<string>;
  dragState: DragState | null;
  dragOverId: string | null;
  depPickerTaskId: string | null;
  planId: string;
  updatePhase: ReturnType<typeof useUpdatePhaseMutation>[0];
  updateTask: ReturnType<typeof useUpdatePlanTaskMutation>[0];
  onToggle: () => void;
  onSavePhaseTitle: (title: string) => Promise<void>;
  onSavePhaseDescription: (desc: string) => Promise<void>;
  onDeletePhase: () => void;
  onSaveTaskTitle: (taskId: string, title: string) => Promise<void>;
  onSaveTaskDescription: (taskId: string, desc: string) => Promise<void>;
  onDeleteTask: (id: string) => void;
  onAddTask: () => void;
  onPhaseDragStart: (e: React.DragEvent, phaseId: string) => void;
  onPhaseDragOver: (e: React.DragEvent, phaseId: string) => void;
  onPhaseDrop: (e: React.DragEvent, phaseId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onTaskDragStart: (
    e: React.DragEvent,
    taskId: string,
    phaseId: string
  ) => void;
  onTaskDragOver: (e: React.DragEvent, taskId: string) => void;
  onTaskDrop: (e: React.DragEvent, taskId: string, phaseId: string) => void;
  onToggleDepPicker: (taskId: string) => void;
  onToggleDependency: (taskId: string, depTaskId: string) => void;
}) {
  const isDragOver = dragOverId === phase.id && dragState?.type === 'phase';

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-200',
        isDragOver && 'scale-[1.01] ring-2 ring-primary/50',
        phase.status === 'completed' && 'border-emerald-500/30',
        phase.status === 'failed' && 'border-red-500/30'
      )}
      draggable={isEditable}
      onDragStart={(e) => onPhaseDragStart(e, phase.id)}
      onDragOver={(e) => onPhaseDragOver(e, phase.id)}
      onDrop={(e) => onPhaseDrop(e, phase.id)}
      onDragEnd={onDragEnd}
    >
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-3 transition-colors sm:px-4',
          'hover:bg-muted/40',
          isExpanded && 'border-b border-border/50'
        )}
      >
        {isEditable && (
          <div className="flex-shrink-0 cursor-grab text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing">
            <GripVertical className="h-4 w-4" />
          </div>
        )}

        <button
          onClick={onToggle}
          className="flex-shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div
          className={cn(
            'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold',
            phase.status === 'completed'
              ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
              : phase.status === 'failed'
                ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30'
                : 'bg-muted text-muted-foreground'
          )}
        >
          {phase.status === 'completed' ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            phaseNumber
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <InlineEditable
              value={phase.title}
              onSave={onSavePhaseTitle}
              className="text-sm font-medium text-foreground"
              disabled={!isEditable}
              placeholder="Phase title..."
              saving={savingFields.has(`phase-${phase.id}`)}
            />
            {phase.executionMode !== 'sequential' && (
              <Badge variant="outline" className="h-5 px-1.5 py-0 text-[10px]">
                <Users className="mr-0.5 h-2.5 w-2.5" />
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
          {(phase.description || isEditable) && (
            <InlineEditable
              value={phase.description ?? ''}
              onSave={onSavePhaseDescription}
              className="mt-0.5 block truncate text-xs text-muted-foreground"
              disabled={!isEditable}
              placeholder="Add description..."
              saving={savingFields.has(`phase-${phase.id}`)}
            />
          )}
        </div>

        <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground">
          {phaseTasks.length} task{phaseTasks.length !== 1 ? 's' : ''}
        </span>

        {isEditable && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 flex-shrink-0 p-0 text-destructive hover:text-destructive"
            onClick={onDeletePhase}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {isExpanded && (
        <CardContent className="p-0">
          {/* Phase settings - only visible in edit mode */}
          {isEditable && (
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
              <EditorTaskRow
                key={task.id}
                task={task}
                allTasks={allTasks}
                isEditable={isEditable}
                savingFields={savingFields}
                showDepPicker={depPickerTaskId === task.id}
                isDragOver={
                  dragOverId === task.id && dragState?.type === 'task'
                }
                onSaveTitle={(title) => onSaveTaskTitle(task.id, title)}
                onSaveDescription={(desc) =>
                  onSaveTaskDescription(task.id, desc)
                }
                onDelete={() => onDeleteTask(task.id)}
                onDragStart={(e) => onTaskDragStart(e, task.id, phase.id)}
                onDragOver={(e) => onTaskDragOver(e, task.id)}
                onDrop={(e) => onTaskDrop(e, task.id, phase.id)}
                onDragEnd={onDragEnd}
                onToggleDepPicker={() => onToggleDepPicker(task.id)}
                onToggleDependency={(depId) =>
                  onToggleDependency(task.id, depId)
                }
                updateTask={updateTask}
                planId={planId}
              />
            ))}
          </div>

          {isEditable && (
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
        </CardContent>
      )}
    </Card>
  );
});

// ---------------------------------------------------------------------------
// Editor Task Row
// ---------------------------------------------------------------------------

const EditorTaskRow = React.memo(function EditorTaskRow({
  task,
  allTasks,
  isEditable,
  savingFields,
  showDepPicker,
  isDragOver,
  onSaveTitle,
  onSaveDescription,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onToggleDepPicker,
  onToggleDependency,
  updateTask,
  planId,
}: {
  task: PlanTask;
  allTasks: PlanTask[];
  isEditable: boolean;
  savingFields: Set<string>;
  showDepPicker: boolean;
  isDragOver: boolean;
  onSaveTitle: (title: string) => Promise<void>;
  onSaveDescription: (desc: string) => Promise<void>;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onToggleDepPicker: () => void;
  onToggleDependency: (depId: string) => void;
  updateTask: ReturnType<typeof useUpdatePlanTaskMutation>[0];
  planId: string;
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
    .filter(Boolean) as PlanTask[];
  const availableDeps = allTasks.filter((t) => t.id !== task.id);
  const isSaving =
    savingFields.has(`task-${task.id}`) || savingFields.has(`dep-${task.id}`);

  return (
    <div
      className={cn(
        'group px-3 py-3 transition-all duration-150 sm:px-4',
        isDragOver && 'border-t-2 border-t-primary bg-primary/5'
      )}
      draggable={isEditable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-start gap-2">
        {isEditable && (
          <div className="mt-0.5 flex-shrink-0 cursor-grab text-muted-foreground/30 opacity-0 transition-opacity hover:text-muted-foreground active:cursor-grabbing group-hover:opacity-100">
            <GripVertical className="h-4 w-4" />
          </div>
        )}

        <div className="mt-1.5 flex-shrink-0">
          <div
            className={cn(
              'h-2.5 w-2.5 rounded-full',
              task.status === 'completed' && 'bg-emerald-500',
              task.status === 'running' && 'animate-pulse bg-amber-500',
              task.status === 'failed' && 'bg-red-500',
              task.status === 'skipped' && 'bg-slate-400',
              task.status === 'pending' && 'bg-muted-foreground/30'
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <InlineEditable
              value={task.title}
              onSave={onSaveTitle}
              className="text-sm font-medium text-foreground"
              disabled={!isEditable}
              placeholder="Task title..."
              saving={isSaving}
            />
            {isSaving && (
              <Check className="h-3 w-3 text-emerald-500 animate-in fade-in" />
            )}
          </div>

          <InlineEditable
            value={task.description}
            onSave={onSaveDescription}
            className="mt-0.5 line-clamp-2 block whitespace-pre-wrap text-xs text-muted-foreground"
            disabled={!isEditable}
            placeholder="Describe what this task should accomplish..."
            multiline
          />

          {isEditable && (
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

          {depTasks.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Link2 className="h-3 w-3 text-muted-foreground/50" />
              {depTasks.map((dep) => (
                <span
                  key={dep.id}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]',
                    dep.status === 'completed'
                      ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                      : 'border-border bg-muted/30 text-muted-foreground'
                  )}
                >
                  {dep.status === 'completed' && (
                    <Check className="h-2.5 w-2.5" />
                  )}
                  {dep.title}
                  {isEditable && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleDependency(dep.id);
                      }}
                      className="ml-0.5 hover:text-destructive"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {showDepPicker && isEditable && (
            <DependencyPicker
              availableTasks={availableDeps}
              currentDeps={deps}
              onToggle={onToggleDependency}
              onClose={onToggleDepPicker}
            />
          )}
        </div>

        {isEditable && (
          <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onToggleDepPicker();
              }}
              title="Manage dependencies"
            >
              <Link2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Dependency Picker
// ---------------------------------------------------------------------------

function DependencyPicker({
  availableTasks,
  currentDeps,
  onToggle,
  onClose,
}: {
  availableTasks: PlanTask[];
  currentDeps: string[];
  onToggle: (depId: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const filtered = availableTasks.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      ref={ref}
      className="mt-2 space-y-2 rounded-lg border bg-popover p-2 shadow-lg duration-150 animate-in slide-in-from-top-1"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">
          Dependencies
        </span>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search tasks..."
        className="h-7 text-xs"
        autoFocus
      />

      <div className="max-h-40 space-y-0.5 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">
            No tasks found
          </p>
        ) : (
          filtered.map((t) => {
            const isSelected = currentDeps.includes(t.id);
            return (
              <button
                key={t.id}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors',
                  isSelected
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-muted/60'
                )}
                onClick={() => onToggle(t.id)}
              >
                <div
                  className={cn(
                    'flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input'
                  )}
                >
                  {isSelected && <Check className="h-2.5 w-2.5" />}
                </div>
                <span className="truncate">{t.title}</span>
                {isSelected && (
                  <Unlink className="ml-auto h-3 w-3 flex-shrink-0 text-muted-foreground" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Version History Sidebar
// ---------------------------------------------------------------------------

function VersionHistorySidebar({
  iterations,
  isVisible,
  onClose,
}: {
  iterations: PlanIteration[];
  isVisible: boolean;
  onClose: () => void;
}) {
  const sortedIterations = useMemo(
    () =>
      [...iterations].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [iterations]
  );

  const iterationTypeLabels: Record<
    string,
    { label: string; icon: React.ReactNode; color: string }
  > = {
    generation: {
      label: 'Generated',
      icon: <Zap className="h-2.5 w-2.5" />,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    },
    review: {
      label: 'Reviewed',
      icon: <Check className="h-2.5 w-2.5" />,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    },
    refine: {
      label: 'Refined',
      icon: <Pencil className="h-2.5 w-2.5" />,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    user_edit: {
      label: 'Edited',
      icon: <Pencil className="h-2.5 w-2.5" />,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
  };

  return (
    <>
      {isVisible && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={cn(
          'flex w-72 flex-shrink-0 flex-col overflow-hidden border-l bg-card',
          'fixed bottom-0 right-0 top-0 z-50 lg:static lg:z-auto',
          'transition-transform duration-200 ease-in-out',
          isVisible ? 'translate-x-0' : 'translate-x-full lg:translate-x-0',
          !isVisible && 'hidden lg:flex',
          isVisible && 'flex'
        )}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <History className="h-4 w-4" />
            Version History
          </h3>
          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {sortedIterations.length === 0 ? (
            <div className="py-8 text-center">
              <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No history yet</p>
              <p className="mt-1 text-[10px] text-muted-foreground/60">
                Changes will appear here as the plan evolves
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {sortedIterations.map((iteration, idx) => {
                const typeConfig =
                  iterationTypeLabels[iteration.iterationType] ||
                  iterationTypeLabels.user_edit;
                const changes = iteration.changes as
                  | Record<string, unknown>[]
                  | Record<string, unknown>
                  | null;
                const changeCount = Array.isArray(changes)
                  ? changes.length
                  : changes
                    ? Object.keys(changes).length
                    : 0;
                const isLatest = idx === 0;

                return (
                  <div
                    key={iteration.id}
                    className={cn(
                      'relative pb-4 pl-6',
                      idx < sortedIterations.length - 1 &&
                        'ml-2 border-l border-border/50'
                    )}
                  >
                    <div
                      className={cn(
                        'absolute left-0 top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 bg-card',
                        isLatest ? 'border-primary' : 'border-border'
                      )}
                    >
                      <div
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          isLatest ? 'bg-primary' : 'bg-muted-foreground/30'
                        )}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium',
                            typeConfig!.color
                          )}
                        >
                          {typeConfig!.icon}
                          {typeConfig!.label}
                        </span>
                        <span className="text-[10px] capitalize text-muted-foreground">
                          by {iteration.changedBy}
                        </span>
                        {isLatest && (
                          <span className="text-[10px] font-medium text-primary">
                            Latest
                          </span>
                        )}
                      </div>

                      {iteration.prompt && (
                        <p className="line-clamp-2 text-xs italic text-muted-foreground">
                          &ldquo;{iteration.prompt}&rdquo;
                        </p>
                      )}

                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
                        <span>
                          {formatRelativeTime(new Date(iteration.createdAt))}
                        </span>
                        {changeCount > 0 && (
                          <span>
                            {changeCount} change{changeCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Editor Skeleton
// ---------------------------------------------------------------------------

function EditorSkeleton() {
  return (
    <div className="mt-4 animate-pulse space-y-4">
      <div className="space-y-3 rounded-xl border bg-card p-6">
        <div className="h-4 w-20 rounded bg-muted" />
        <div className="h-7 w-64 rounded bg-muted" />
        <div className="h-4 w-96 rounded bg-muted/60" />
        <div className="mt-3 h-px bg-border/50" />
        <div className="flex gap-4">
          <div className="h-3 w-16 rounded bg-muted/40" />
          <div className="h-3 w-20 rounded bg-muted/40" />
          <div className="h-3 w-24 rounded bg-muted/40" />
        </div>
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="rounded-lg border bg-card">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="h-4 w-4 rounded bg-muted/40" />
            <div className="h-7 w-7 rounded-full bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-40 rounded bg-muted" />
            </div>
            <div className="h-3 w-12 rounded bg-muted/40" />
          </div>
          <div className="border-t border-border/30">
            {[1, 2, 3].map((j) => (
              <div
                key={j}
                className="flex items-center gap-3 border-b border-border/15 px-4 py-3"
              >
                <div className="h-2.5 w-2.5 rounded-full bg-muted/40" />
                <div className="flex-1 space-y-1">
                  <div className="h-3.5 w-32 rounded bg-muted" />
                  <div className="h-3 w-48 rounded bg-muted/40" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
