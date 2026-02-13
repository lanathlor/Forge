/* eslint-disable complexity, max-lines-per-function */
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import {
  useGeneratePlanMutation,
  useExecutePlanMutation,
  useUpdatePlanMutation,
  useGetPlanQuery,
} from '../store/plansApi';
import type { Plan, Phase, PlanTask } from '@/db/schema';
import {
  Sparkles,
  Zap,
  Bug,
  RefreshCw,
  Rocket,
  Loader2,
  ChevronDown,
  ChevronRight,
  Send,
  Play,
  ArrowLeft,
  Pencil,
  Check,
  X,
  MessageSquare,
  GripVertical,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeneratePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repositoryId: string;
  onPlanCreated?: (planId: string) => void;
}

type DialogStep = 'prompt' | 'generating' | 'preview';

interface Template {
  id: string;
  label: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface RefinementMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const TEMPLATES: Template[] = [
  {
    id: 'feature',
    label: 'New Feature',
    icon: <Sparkles className="h-3.5 w-3.5" />,
    title: '',
    description:
      'Build a new feature:\n\n**What it does:**\n\n\n**User story:**\nAs a [user], I want to [action] so that [benefit].\n\n**Requirements:**\n- \n- \n\n**Technical notes:**\n',
  },
  {
    id: 'bugfix',
    label: 'Bug Fix',
    icon: <Bug className="h-3.5 w-3.5" />,
    title: '',
    description:
      'Fix a bug:\n\n**Current behavior:**\n\n\n**Expected behavior:**\n\n\n**Steps to reproduce:**\n1. \n2. \n\n**Suspected cause:**\n',
  },
  {
    id: 'refactor',
    label: 'Refactor',
    icon: <RefreshCw className="h-3.5 w-3.5" />,
    title: '',
    description:
      'Refactor code:\n\n**What to refactor:**\n\n\n**Why:**\n\n\n**Constraints:**\n- Must maintain backward compatibility\n- \n\n**Target architecture:**\n',
  },
  {
    id: 'quick',
    label: 'Quick Task',
    icon: <Zap className="h-3.5 w-3.5" />,
    title: '',
    description: '',
  },
];

const PROGRESS_MESSAGES = [
  'Analyzing your repository...',
  'Understanding the codebase structure...',
  'Designing phases and tasks...',
  'Creating implementation plan...',
  'Optimizing task dependencies...',
  'Finalizing plan details...',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GeneratePlanDialog({
  open,
  onOpenChange,
  repositoryId,
  onPlanCreated,
}: GeneratePlanDialogProps) {
  // Step state
  const [step, setStep] = useState<DialogStep>('prompt');

  // Prompt step
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Generation
  const [generatePlan] = useGeneratePlanMutation();
  const [executePlan] = useExecutePlanMutation();
  const [updatePlan] = useUpdatePlanMutation();
  const [progressIndex, setProgressIndex] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Preview step
  const [generatedPlan, setGeneratedPlan] = useState<Plan | null>(null);
  const [generatedPhases, setGeneratedPhases] = useState<Phase[]>([]);
  const [generatedTasks, setGeneratedTasks] = useState<PlanTask[]>([]);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  // Inline editing
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
  const [editingTaskDescription, setEditingTaskDescription] = useState('');

  // Refinement chat
  const [showRefinement, setShowRefinement] = useState(false);
  const [refinementInput, setRefinementInput] = useState('');
  const [refinementMessages, setRefinementMessages] = useState<RefinementMessage[]>([]);
  const [isRefining, setIsRefining] = useState(false);
  const [changesApplied, setChangesApplied] = useState(0);
  const refinementEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Re-fetch plan data after refinement
  const { data: latestPlanData } = useGetPlanQuery(generatedPlan?.id ?? '', {
    skip: !generatedPlan?.id || changesApplied === 0,
  });

  // Sync latest plan data after refinement
  useEffect(() => {
    if (latestPlanData && changesApplied > 0) {
      setGeneratedPlan(latestPlanData.plan);
      setGeneratedPhases(latestPlanData.phases);
      setGeneratedTasks(latestPlanData.tasks);
    }
  }, [latestPlanData, changesApplied]);

  // Progress animation
  useEffect(() => {
    if (step !== 'generating') return;
    const interval = setInterval(() => {
      setProgressIndex((prev) => (prev + 1) % PROGRESS_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [step]);

  // Auto-scroll refinement chat
  useEffect(() => {
    refinementEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [refinementMessages]);

  // Focus textarea on open
  useEffect(() => {
    if (open && step === 'prompt') {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open, step]);

  // Reset on close
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setTimeout(() => {
          setStep('prompt');
          setTitle('');
          setDescription('');
          setSelectedTemplate(null);
          setProgressIndex(0);
          setGenerationError(null);
          setGeneratedPlan(null);
          setGeneratedPhases([]);
          setGeneratedTasks([]);
          setExpandedPhases(new Set());
          setEditingTask(null);
          setShowRefinement(false);
          setRefinementInput('');
          setRefinementMessages([]);
          setIsRefining(false);
          setChangesApplied(0);
        }, 200);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange],
  );

  // ---------------------------------------------------------------------------
  // Template selection
  // ---------------------------------------------------------------------------

  const handleTemplateSelect = (template: Template) => {
    if (selectedTemplate === template.id) {
      setSelectedTemplate(null);
      setDescription('');
      return;
    }
    setSelectedTemplate(template.id);
    setDescription(template.description);
    if (template.title) setTitle(template.title);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // ---------------------------------------------------------------------------
  // Generation
  // ---------------------------------------------------------------------------

  const handleGenerate = async (autoLaunch = false) => {
    if (!title.trim() || !description.trim()) return;

    setStep('generating');
    setGenerationError(null);
    setProgressIndex(0);

    try {
      const result = await generatePlan({
        repositoryId,
        title: title.trim(),
        description: description.trim(),
      }).unwrap();

      setGeneratedPlan(result.plan);
      setGeneratedPhases(result.phases);
      setGeneratedTasks(result.tasks);

      // Expand all phases by default
      setExpandedPhases(new Set(result.phases.map((p) => p.id)));

      if (autoLaunch) {
        // Auto-launch: mark ready and execute
        await updatePlan({ id: result.plan.id, data: { status: 'ready' } }).unwrap();
        await executePlan(result.plan.id).unwrap();
        onPlanCreated?.(result.plan.id);
        handleOpenChange(false);
      } else {
        setStep('preview');
      }
    } catch (error) {
      console.error('Failed to generate plan:', error);
      setGenerationError(
        error instanceof Error ? error.message : 'Failed to generate plan. Please try again.',
      );
      setStep('prompt');
    }
  };

  // ---------------------------------------------------------------------------
  // Launch
  // ---------------------------------------------------------------------------

  const handleLaunch = async () => {
    if (!generatedPlan) return;

    try {
      await updatePlan({ id: generatedPlan.id, data: { status: 'ready' } }).unwrap();
      await executePlan(generatedPlan.id).unwrap();
      onPlanCreated?.(generatedPlan.id);
      handleOpenChange(false);
    } catch (error) {
      console.error('Failed to launch plan:', error);
    }
  };

  // ---------------------------------------------------------------------------
  // Inline editing
  // ---------------------------------------------------------------------------

  const startEditingTask = (task: PlanTask) => {
    setEditingTask(task.id);
    setEditingTaskTitle(task.title);
    setEditingTaskDescription(task.description);
  };

  const saveTaskEdit = () => {
    if (!editingTask) return;
    setGeneratedTasks((prev) =>
      prev.map((t) =>
        t.id === editingTask
          ? { ...t, title: editingTaskTitle, description: editingTaskDescription }
          : t,
      ),
    );
    setEditingTask(null);
  };

  // ---------------------------------------------------------------------------
  // Refinement chat
  // ---------------------------------------------------------------------------

  const handleSendRefinement = async () => {
    if (!refinementInput.trim() || !generatedPlan || isRefining) return;

    const userMessage: RefinementMessage = { role: 'user', content: refinementInput };
    setRefinementMessages((prev) => [...prev, userMessage]);
    setRefinementInput('');
    setIsRefining(true);

    // Add placeholder for assistant
    const assistantMessage: RefinementMessage = { role: 'assistant', content: '' };
    setRefinementMessages((prev) => [...prev, assistantMessage]);

    try {
      const response = await fetch(`/api/plans/${generatedPlan.id}/iterate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: refinementInput,
          conversationHistory: refinementMessages,
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body');

      let wasUpdated = false;
      let updateSummary = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'chunk') {
              setRefinementMessages((prev) => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (last?.role === 'assistant') {
                  last.content += data.content;
                }
                return msgs;
              });
            } else if (data.type === 'updated') {
              wasUpdated = data.value;
              updateSummary = data.summary || '';
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          } catch (e) {
            if (e instanceof Error && e.message !== 'Failed to get response') {
              throw e;
            }
          }
        }
      }

      if (wasUpdated) {
        setChangesApplied((prev) => prev + 1);
        // Clean up the display
        setRefinementMessages((prev) => {
          const msgs = [...prev];
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant') {
            const clean = last.content.replace(/<UPDATES>[\s\S]*?<\/UPDATES>/, '').trim();
            last.content =
              clean + (updateSummary ? `\n\nApplied: ${updateSummary}` : '\n\nChanges applied.');
          }
          return msgs;
        });
      }
    } catch (error) {
      console.error('Refinement failed:', error);
      setRefinementMessages((prev) => {
        const msgs = [...prev];
        const last = msgs[msgs.length - 1];
        if (last?.role === 'assistant') {
          last.content = last.content || 'Sorry, something went wrong. Please try again.';
        }
        return msgs;
      });
    } finally {
      setIsRefining(false);
    }
  };

  const handleRefinementKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendRefinement();
    }
  };

  // ---------------------------------------------------------------------------
  // Phase toggle
  // ---------------------------------------------------------------------------

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const canGenerate = title.trim().length > 0 && description.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'flex flex-col gap-0 p-0 overflow-hidden transition-all duration-200',
          step === 'preview' ? 'max-w-5xl max-h-[85vh]' : 'max-w-2xl max-h-[85vh]',
        )}
      >
        {/* ================================================================= */}
        {/* STEP 1: Prompt */}
        {/* ================================================================= */}
        {step === 'prompt' && (
          <>
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Generate Plan
              </DialogTitle>
              <DialogDescription>
                Describe what you want to build. Pick a template or start from scratch.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-6 space-y-4 overflow-y-auto">
              {/* Template chips */}
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleTemplateSelect(t)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                      'border hover:border-primary/50',
                      selectedTemplate === t.id
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted',
                    )}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label htmlFor="plan-title" className="text-xs font-medium text-muted-foreground">
                  Title
                </label>
                <Input
                  id="plan-title"
                  type="text"
                  placeholder="e.g., Add user authentication with OAuth"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canGenerate) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                />
              </div>

              {/* Description textarea */}
              <div className="space-y-1.5">
                <label
                  htmlFor="plan-description"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Description
                </label>
                <Textarea
                  id="plan-description"
                  ref={textareaRef}
                  placeholder="Describe what you want to build in detail. Include requirements, constraints, and any specific technologies to use..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[220px] resize-y text-sm leading-relaxed"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canGenerate) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                />
                <p className="text-[10px] text-muted-foreground/60">
                  Cmd/Ctrl+Enter to generate
                </p>
              </div>

              {/* Error display */}
              {generationError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {generationError}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerate(true)}
                    disabled={!canGenerate}
                    title="Generate and immediately launch"
                  >
                    <Rocket className="h-3.5 w-3.5 mr-1.5" />
                    Generate & Launch
                  </Button>
                  <Button size="sm" onClick={() => handleGenerate(false)} disabled={!canGenerate}>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Generate Plan
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ================================================================= */}
        {/* STEP 2: Generating */}
        {/* ================================================================= */}
        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="relative mb-6">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                <Loader2 className="h-3 w-3 text-primary animate-spin" />
              </div>
            </div>

            <h3 className="text-lg font-semibold mb-2">Generating your plan</h3>
            <p className="text-sm text-muted-foreground mb-6">&quot;{title}&quot;</p>

            {/* Progress bar */}
            <div className="w-full max-w-xs mb-4">
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-1000 ease-in-out"
                  style={{
                    width: `${Math.min(15 + progressIndex * 15, 90)}%`,
                  }}
                />
              </div>
            </div>

            {/* Rotating message */}
            <p
              key={progressIndex}
              className="text-xs text-muted-foreground animate-in fade-in duration-500"
            >
              {PROGRESS_MESSAGES[progressIndex]}
            </p>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 3: Preview */}
        {/* ================================================================= */}
        {step === 'preview' && generatedPlan && (
          <>
            {/* Header */}
            <div className="flex-shrink-0 px-6 pt-5 pb-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setStep('prompt')}
                    className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold truncate">{generatedPlan.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      {generatedPhases.length} phase{generatedPhases.length !== 1 ? 's' : ''}
                      {' \u00B7 '}
                      {generatedTasks.length} task{generatedTasks.length !== 1 ? 's' : ''}
                      {changesApplied > 0 && (
                        <span className="text-primary ml-1">
                          {' \u00B7 '}{changesApplied} refinement{changesApplied !== 1 ? 's' : ''} applied
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRefinement(!showRefinement)}
                    className={cn(showRefinement && 'bg-muted')}
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                    Refine
                  </Button>
                  <Button size="sm" onClick={handleLaunch}>
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                    Launch
                  </Button>
                </div>
              </div>
            </div>

            {/* Content area */}
            <div className="flex flex-1 overflow-hidden min-h-0">
              {/* Plan preview */}
              <div
                className={cn(
                  'flex-1 overflow-y-auto p-4 space-y-3',
                  showRefinement && 'border-r',
                )}
              >
                {generatedPhases.map((phase, phaseIdx) => {
                  const phaseTasks = generatedTasks
                    .filter((t) => t.phaseId === phase.id)
                    .sort((a, b) => a.order - b.order);
                  const isExpanded = expandedPhases.has(phase.id);

                  return (
                    <div key={phase.id} className="rounded-lg border bg-card">
                      {/* Phase header */}
                      <button
                        onClick={() => togglePhase(phase.id)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors rounded-t-lg"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                          {phaseIdx + 1}
                        </Badge>
                        <span className="text-sm font-medium flex-1 truncate">{phase.title}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {phaseTasks.length} task{phaseTasks.length !== 1 ? 's' : ''}
                        </span>
                      </button>

                      {/* Phase description */}
                      {isExpanded && phase.description && (
                        <p className="px-3 pb-2 text-xs text-muted-foreground pl-9">
                          {phase.description}
                        </p>
                      )}

                      {/* Tasks */}
                      {isExpanded && (
                        <div className="border-t">
                          {phaseTasks.map((task, taskIdx) => (
                            <div
                              key={task.id}
                              className={cn(
                                'group flex items-start gap-2 px-3 py-2 hover:bg-muted/30 transition-colors',
                                taskIdx < phaseTasks.length - 1 && 'border-b border-border/50',
                              )}
                            >
                              <GripVertical className="h-3.5 w-3.5 mt-0.5 text-muted-foreground/30 flex-shrink-0" />

                              {editingTask === task.id ? (
                                /* Editing mode */
                                <div className="flex-1 space-y-2">
                                  <Input
                                    value={editingTaskTitle}
                                    onChange={(e) => setEditingTaskTitle(e.target.value)}
                                    className="h-7 text-xs"
                                    autoFocus
                                  />
                                  <Textarea
                                    value={editingTaskDescription}
                                    onChange={(e) => setEditingTaskDescription(e.target.value)}
                                    className="text-xs min-h-[60px]"
                                    rows={3}
                                  />
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2 text-[10px]"
                                      onClick={saveTaskEdit}
                                    >
                                      <Check className="h-3 w-3 mr-1" />
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2 text-[10px]"
                                      onClick={() => setEditingTask(null)}
                                    >
                                      <X className="h-3 w-3 mr-1" />
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                /* Display mode */
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground/50 font-mono">
                                      {phaseIdx + 1}.{taskIdx + 1}
                                    </span>
                                    <span className="text-xs font-medium truncate">
                                      {task.title}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startEditingTask(task);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity"
                                    >
                                      <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                                    </button>
                                  </div>
                                  {task.description && (
                                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 pl-7">
                                      {task.description}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Refinement chat sidebar */}
              {showRefinement && (
                <div className="w-80 flex flex-col bg-muted/20 flex-shrink-0">
                  {/* Chat header */}
                  <div className="px-3 py-2 border-b flex-shrink-0">
                    <p className="text-xs font-medium">Refine with Claude</p>
                    <p className="text-[10px] text-muted-foreground">
                      Ask Claude to adjust the plan
                    </p>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                    {refinementMessages.length === 0 && (
                      <div className="text-center py-8">
                        <MessageSquare className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-[11px] text-muted-foreground/60">
                          Try: &quot;Add error handling to phase 2&quot; or &quot;Make the tasks more
                          detailed&quot;
                        </p>
                      </div>
                    )}

                    {refinementMessages.map((msg, idx) => (
                      <Card
                        key={idx}
                        className={cn(
                          'p-2.5',
                          msg.role === 'user'
                            ? 'bg-primary/10 ml-4 border-primary/20'
                            : 'bg-card mr-4',
                        )}
                      >
                        <p className="text-[10px] font-medium text-muted-foreground mb-0.5">
                          {msg.role === 'user' ? 'You' : 'Claude'}
                        </p>
                        <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </Card>
                    ))}

                    {isRefining && !refinementMessages[refinementMessages.length - 1]?.content && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Thinking...
                      </div>
                    )}

                    <div ref={refinementEndRef} />
                  </div>

                  {/* Input */}
                  <div className="p-3 border-t flex-shrink-0">
                    <div className="flex gap-1.5">
                      <Textarea
                        value={refinementInput}
                        onChange={(e) => setRefinementInput(e.target.value)}
                        onKeyDown={handleRefinementKeyDown}
                        placeholder="What should change?"
                        rows={2}
                        disabled={isRefining}
                        className="text-xs flex-1 min-h-0 resize-none"
                      />
                      <Button
                        size="sm"
                        className="h-auto px-2"
                        onClick={handleSendRefinement}
                        disabled={!refinementInput.trim() || isRefining}
                      >
                        <Send className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom action bar */}
            <div className="flex-shrink-0 px-6 py-3 border-t bg-muted/30 flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">
                Review the plan, edit tasks inline, or refine with Claude before launching.
              </p>
              <Button size="sm" onClick={handleLaunch} className="shadow-sm">
                <Rocket className="h-3.5 w-3.5 mr-1.5" />
                Launch Plan
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
