/* eslint-disable max-lines-per-function, complexity */
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Badge } from '@/shared/components/ui/badge';
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
import type { Phase, PlanTask } from '@/db/schema';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';

interface PlanExecutionViewProps {
  planId: string;
  onReview?: (planId: string) => void;
}

export function PlanExecutionView({ planId, onReview }: PlanExecutionViewProps) {
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
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [taskEdits, setTaskEdits] = useState<{ title: string; description: string }>({
    title: '',
    description: '',
  });
  const [phaseEdits, setPhaseEdits] = useState<{ title: string; description: string }>({
    title: '',
    description: '',
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading plan...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-destructive">Error loading plan</p>
      </div>
    );
  }

  const plan = data.plan;
  const phases = [...data.phases].sort((a, b) => a.order - b.order);
  const tasks = data.tasks;

  const phaseTasksMap = new Map<string, PlanTask[]>();
  tasks.forEach((task) => {
    if (!phaseTasksMap.has(task.phaseId)) {
      phaseTasksMap.set(task.phaseId, []);
    }
    phaseTasksMap.get(task.phaseId)!.push(task);
  });

  const startEditingTask = (task: PlanTask) => {
    setEditingTaskId(task.id);
    setTaskEdits({ title: task.title, description: task.description });
  };

  const saveTask = async () => {
    if (!editingTaskId) return;
    await updateTask({
      id: editingTaskId,
      data: { ...taskEdits, planId },
    });
    setEditingTaskId(null);
  };

  const cancelTaskEdit = () => {
    setEditingTaskId(null);
    setTaskEdits({ title: '', description: '' });
  };

  const startEditingPhase = (phase: Phase) => {
    setEditingPhaseId(phase.id);
    setPhaseEdits({ title: phase.title, description: phase.description || '' });
  };

  const savePhase = async () => {
    if (!editingPhaseId) return;
    await updatePhase({
      id: editingPhaseId,
      data: { ...phaseEdits, planId },
    });
    setEditingPhaseId(null);
  };

  const cancelPhaseEdit = () => {
    setEditingPhaseId(null);
    setPhaseEdits({ title: '', description: '' });
  };

  const handleAddPhase = async () => {
    const maxOrder = Math.max(...phases.map((p) => p.order), 0);
    await createPhase({
      planId,
      order: maxOrder + 1,
      title: 'New Phase',
      description: '',
      executionMode: 'sequential',
      pauseAfter: false,
    });
  };

  const handleDeletePhase = async (phaseId: string) => {
    if (confirm('Delete this phase and all its tasks?')) {
      await deletePhase(phaseId);
    }
  };

  const handleAddTask = async (phaseId: string) => {
    const phaseTasks = (phaseTasksMap.get(phaseId) || []).sort((a, b) => a.order - b.order);
    const maxOrder = Math.max(...phaseTasks.map((t) => t.order), 0);
    await createTask({
      phaseId,
      planId,
      order: maxOrder + 1,
      title: 'New Task',
      description: 'Task description',
      canRunInParallel: false,
    });
  };

  const handleDeleteTask = async (taskId: string) => {
    if (confirm('Delete this task?')) {
      await deleteTask(taskId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Plan Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{plan.title}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </div>
            <Badge>{plan.status}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{plan.totalPhases}</div>
              <div className="text-xs text-muted-foreground">Phases</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{plan.completedPhases}</div>
              <div className="text-xs text-muted-foreground">Completed Phases</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{plan.totalTasks}</div>
              <div className="text-xs text-muted-foreground">Tasks</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{plan.completedTasks}</div>
              <div className="text-xs text-muted-foreground">Completed Tasks</div>
            </div>
          </div>

          {plan.totalTasks > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Overall Progress</span>
                <span>{Math.round((plan.completedTasks / plan.totalTasks) * 100)}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(plan.completedTasks / plan.totalTasks) * 100}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <div className="flex gap-2">
            {plan.status === 'draft' && (
              <>
                {onReview && (
                  <Button size="sm" variant="outline" onClick={() => onReview(planId)}>
                    Iterate with Claude
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={isEditMode ? 'default' : 'outline'}
                  onClick={() => setIsEditMode(!isEditMode)}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  {isEditMode ? 'Done Editing' : 'Edit'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => updatePlan({ id: planId, data: { status: 'ready' } })}
                >
                  Mark as Ready
                </Button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            {plan.status === 'ready' && (
              <Button size="sm" onClick={() => executePlan(planId)} disabled={isExecuting}>
                {isExecuting ? 'Starting...' : 'Execute Plan'}
              </Button>
            )}
            {plan.status === 'running' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => pausePlan(planId)}
                disabled={isPausing}
              >
                {isPausing ? 'Pausing...' : 'Pause'}
              </Button>
            )}
            {plan.status === 'paused' && (
              <Button size="sm" onClick={() => resumePlan(planId)} disabled={isResuming}>
                {isResuming ? 'Resuming...' : 'Resume'}
              </Button>
            )}
            {(plan.status === 'running' || plan.status === 'paused') && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm('Are you sure you want to cancel this plan execution?')) {
                    cancelPlan(planId);
                  }
                }}
                disabled={isCancelling}
              >
                {isCancelling ? 'Cancelling...' : 'Cancel'}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Add Phase Button */}
      {isEditMode && (
        <Button onClick={handleAddPhase} className="w-full" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Add Phase
        </Button>
      )}

      {/* Phases */}
      <div className="space-y-4">
        {phases.map((phase, idx) => {
          const phaseTasks = (phaseTasksMap.get(phase.id) || []).sort(
            (a, b) => a.order - b.order
          );
          const completedCount = phaseTasks.filter((t) => t.status === 'completed').length;
          const isEditingThisPhase = editingPhaseId === phase.id;

          return (
            <Card key={phase.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {isEditingThisPhase ? (
                      <div className="space-y-2">
                        <Input
                          value={phaseEdits.title}
                          onChange={(e) =>
                            setPhaseEdits({ ...phaseEdits, title: e.target.value })
                          }
                          className="font-semibold"
                        />
                        <Textarea
                          value={phaseEdits.description}
                          onChange={(e) =>
                            setPhaseEdits({ ...phaseEdits, description: e.target.value })
                          }
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={savePhase}>
                            <Check className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelPhaseEdit}>
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={isEditMode ? 'cursor-pointer hover:bg-accent/50 p-2 rounded' : ''}
                        onClick={() => isEditMode && startEditingPhase(phase)}
                      >
                        <CardTitle className="text-lg">
                          Phase {idx + 1}: {phase.title}
                        </CardTitle>
                        <CardDescription>{phase.description}</CardDescription>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditMode && !isEditingThisPhase && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeletePhase(phase.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                    <Badge variant={phase.status === 'completed' ? 'default' : 'secondary'}>
                      {phase.status}
                    </Badge>
                    <Badge variant="outline">{phase.executionMode}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {phaseTasks.map((task, taskIdx) => {
                    const isEditingThisTask = editingTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isEditMode && !isEditingThisTask
                            ? 'cursor-pointer hover:bg-accent/50'
                            : ''
                        }`}
                        onClick={() => isEditMode && !isEditingThisTask && startEditingTask(task)}
                      >
                        {isEditingThisTask ? (
                          <div className="flex-1 space-y-2">
                            <Input
                              value={taskEdits.title}
                              onChange={(e) =>
                                setTaskEdits({ ...taskEdits, title: e.target.value })
                              }
                              placeholder="Task title"
                            />
                            <Textarea
                              value={taskEdits.description}
                              onChange={(e) =>
                                setTaskEdits({ ...taskEdits, description: e.target.value })
                              }
                              placeholder="Task description"
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={saveTask}>
                                <Check className="h-4 w-4 mr-1" />
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelTaskEdit}>
                                <X className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1">
                              <div className="font-medium">
                                {taskIdx + 1}. {task.title}
                              </div>
                              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {task.description}
                              </div>
                              {task.lastError && (
                                <div className="text-xs text-destructive mt-1">
                                  Error: {task.lastError}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {isEditMode && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTask(task.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                              {task.status === 'failed' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    retryTask(task.id);
                                  }}
                                >
                                  Retry
                                </Button>
                              )}
                              {task.attempts > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  Attempt {task.attempts}
                                </span>
                              )}
                              <Badge
                                variant={
                                  task.status === 'completed'
                                    ? 'default'
                                    : task.status === 'failed'
                                    ? 'destructive'
                                    : task.status === 'running'
                                    ? 'default'
                                    : 'secondary'
                                }
                              >
                                {task.status}
                              </Badge>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add Task Button */}
                {isEditMode && (
                  <Button
                    onClick={() => handleAddTask(phase.id)}
                    className="w-full mt-3"
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                )}

                <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {completedCount} / {phaseTasks.length} tasks completed
                  </span>
                  {phase.pauseAfter && <span>⏸️ Pause after this phase</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
