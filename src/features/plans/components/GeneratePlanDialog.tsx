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
  useExecutePlanMutation,
  useUpdatePlanMutation,
  useGetPlanQuery,
  useLazyGetPlanWithDetailsQuery,
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
  AlertCircle,
  RotateCcw,
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

interface PlanWarning {
  code: string;
  message: string;
  severity: 'warning' | 'info';
  phaseIndex?: number;
  taskIndex?: number;
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
  const [executePlan] = useExecutePlanMutation();
  const [updatePlan] = useUpdatePlanMutation();
  const [fetchPlanWithDetails] = useLazyGetPlanWithDetailsQuery();
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generationLlmOutput, setGenerationLlmOutput] = useState('');
  const [generationError, setGenerationError] = useState<{
    code: string;
    message: string;
    detail?: string;
  } | null>(null);
  const [generationWarnings, setGenerationWarnings] = useState<PlanWarning[]>([]);
  // planId populated once the SSE 'done' event arrives, used to fetch plan data
  const [generatingPlanId, setGeneratingPlanId] = useState<string | null>(null);
  // AbortController for the in-flight SSE generation request
  const abortControllerRef = useRef<AbortController | null>(null);
  // Elapsed time tracking
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
  const [refinementMessages, setRefinementMessages] = useState<
    RefinementMessage[]
  >([]);
  const [isRefining, setIsRefining] = useState(false);
  const [changesApplied, setChangesApplied] = useState(0);
  const refinementEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const llmOutputEndRef = useRef<HTMLDivElement>(null);

  // Re-fetch plan data after refinement
  const { data: latestPlanData } = useGetPlanQuery(generatedPlan?.id ?? '', {
    skip: !generatedPlan?.id || changesApplied === 0,
  });

  // Fetch plan data after SSE stream completes
  useEffect(() => {
    if (!generatingPlanId) return;

    // Use lazy query to fetch plan details and update cache
    fetchPlanWithDetails(generatingPlanId)
      .unwrap()
      .then((planData) => {
        setGeneratedPlan(planData.plan);
        setGeneratedPhases(planData.phases);
        setGeneratedTasks(planData.tasks);
        setExpandedPhases(new Set(planData.phases.map((p) => p.id)));
        setGeneratingPlanId(null);
        setStep('preview');
      })
      .catch((error) => {
        console.error('Failed to fetch generated plan:', error);
        setGenerationError({
          code: 'FETCH_ERROR',
          message: 'Failed to load plan details. Please try again.',
        });
        setStep('prompt');
      });
  }, [generatingPlanId, fetchPlanWithDetails]);

  // Sync latest plan data after refinement
  useEffect(() => {
    if (latestPlanData && changesApplied > 0) {
      setGeneratedPlan(latestPlanData.plan);
      setGeneratedPhases(latestPlanData.phases);
      setGeneratedTasks(latestPlanData.tasks);
    }
  }, [latestPlanData, changesApplied]);

  // Auto-scroll refinement chat
  useEffect(() => {
    refinementEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [refinementMessages]);

  // Auto-scroll LLM output during generation
  useEffect(() => {
    if (generationLlmOutput) {
      llmOutputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [generationLlmOutput]);

  // Elapsed time counter - ticks every second while generating
  useEffect(() => {
    if (step === 'generating') {
      setElapsedSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setElapsedSeconds(0);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [step]);

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
        // Abort any in-flight generation request so the server stops processing
        abortControllerRef.current?.abort();

        setTimeout(() => {
          setStep('prompt');
          setTitle('');
          setDescription('');
          setSelectedTemplate(null);
          setGenerationProgress(0);
          setGenerationStatus('');
          setGenerationLlmOutput('');
          setGenerationError(null);
          setGenerationWarnings([]);
          setGeneratingPlanId(null);
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
    [onOpenChange]
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
    setGenerationWarnings([]);
    setGenerationProgress(0);
    setGenerationStatus('Starting...');
    setGenerationLlmOutput('');

    // Create a new AbortController for this generation request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/plans/generate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repositoryId,
          title: title.trim(),
          description: description.trim(),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || 'Failed to start plan generation'
        );
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body');

      let resolvedPlanId: string | null = null;

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6)) as {
              type: string;
              message?: string;
              percent?: number;
              planId?: string;
              content?: string;
            };

            if (data.type === 'status' && data.message) {
              setGenerationStatus(data.message);
            } else if (data.type === 'progress' && data.percent !== undefined) {
              setGenerationProgress(data.percent);
            } else if (data.type === 'chunk' && data.content) {
              // Accumulate LLM output chunks for display
              setGenerationLlmOutput((prev) => prev + data.content);
            } else if (data.type === 'done' && data.planId) {
              resolvedPlanId = data.planId;
              setGenerationProgress(100);
              // Capture warnings if present
              if ((data as { warnings?: PlanWarning[] }).warnings) {
                setGenerationWarnings((data as { warnings?: PlanWarning[] }).warnings || []);
              }
              break outer;
            } else if (data.type === 'error' && data.message) {
              // Capture structured error with code
              const errorData = {
                code: (data as { code?: string }).code || 'UNKNOWN',
                message: data.message,
                detail: (data as { detail?: string }).detail,
              };
              setGenerationError(errorData);
              throw new Error(data.message);
            }
          } catch (parseErr) {
            // Ignore malformed SSE lines
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }

      if (!resolvedPlanId) {
        throw new Error('Plan generation completed without a plan ID');
      }

      if (autoLaunch) {
        // Auto-launch: mark ready and execute immediately
        await updatePlan({
          id: resolvedPlanId,
          data: { status: 'ready' },
        }).unwrap();
        await executePlan(resolvedPlanId).unwrap();
        onPlanCreated?.(resolvedPlanId);
        handleOpenChange(false);
      } else {
        // Signal to the useGetPlanQuery effect that it should fetch and show preview
        setGeneratingPlanId(resolvedPlanId);
      }
    } catch (error) {
      // User cancelled – go back to the prompt step silently
      if (error instanceof DOMException && error.name === 'AbortError') {
        setGenerationError({
          code: 'ABORTED',
          message: 'Generation cancelled',
        });
        setStep('prompt');
        return;
      }

      console.error('Failed to generate plan:', error);
      // Only set error if not already set by SSE error event
      if (!generationError) {
        setGenerationError({
          code: 'UNKNOWN',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to generate plan. Please try again.',
        });
      }
      setStep('prompt');
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleCancelGeneration = () => {
    abortControllerRef.current?.abort();
  };

  // ---------------------------------------------------------------------------
  // Launch
  // ---------------------------------------------------------------------------

  const handleLaunch = async () => {
    if (!generatedPlan) return;

    try {
      await updatePlan({
        id: generatedPlan.id,
        data: { status: 'ready' },
      }).unwrap();
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
          ? {
              ...t,
              title: editingTaskTitle,
              description: editingTaskDescription,
            }
          : t
      )
    );
    setEditingTask(null);
  };

  // ---------------------------------------------------------------------------
  // Refinement chat
  // ---------------------------------------------------------------------------

  const handleSendRefinement = async () => {
    if (!refinementInput.trim() || !generatedPlan || isRefining) return;

    const userMessage: RefinementMessage = {
      role: 'user',
      content: refinementInput,
    };
    setRefinementMessages((prev) => [...prev, userMessage]);
    setRefinementInput('');
    setIsRefining(true);

    // Add placeholder for assistant
    const assistantMessage: RefinementMessage = {
      role: 'assistant',
      content: '',
    };
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
            const clean = last.content
              .replace(/<UPDATES>[\s\S]*?<\/UPDATES>/, '')
              .trim();
            last.content =
              clean +
              (updateSummary
                ? `\n\nApplied: ${updateSummary}`
                : '\n\nChanges applied.');
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
          last.content =
            last.content || 'Sorry, something went wrong. Please try again.';
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
  // Helpers
  // ---------------------------------------------------------------------------

  const formatElapsedTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getErrorMessage = (
    code: string,
    message: string,
    detail?: string
  ): string => {
    switch (code) {
      case 'TIMEOUT':
        return `Generation timed out after ${detail || '5 minutes'} — the repository may be too large or the task too complex. Try breaking it down into smaller parts.`;
      case 'PARSE_ERROR':
        return 'The AI returned an unexpected format — try rephrasing your description or simplifying your requirements.';
      case 'ABORTED':
        return 'Generation cancelled. Your progress was not saved.';
      case 'LLM_ERROR':
        return `AI service error: ${message}. Please try again in a moment.`;
      default:
        return message || 'An unexpected error occurred. Please try again.';
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const canGenerate = title.trim().length > 0 && description.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'flex flex-col gap-0 overflow-hidden p-0 transition-all duration-200',
          step === 'preview'
            ? 'max-h-[85vh] max-w-5xl'
            : 'max-h-[85vh] max-w-2xl'
        )}
      >
        {/* ================================================================= */}
        {/* STEP 1: Prompt */}
        {/* ================================================================= */}
        {step === 'prompt' && (
          <>
            <DialogHeader className="px-6 pb-2 pt-6">
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Generate Plan
              </DialogTitle>
              <DialogDescription>
                Describe what you want to build. Pick a template or start from
                scratch.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 overflow-y-auto px-6 pb-6">
              {/* Template chips */}
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleTemplateSelect(t)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                      'border hover:border-primary/50',
                      selectedTemplate === t.id
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label
                  htmlFor="plan-title"
                  className="text-xs font-medium text-muted-foreground"
                >
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
                    if (
                      e.key === 'Enter' &&
                      (e.metaKey || e.ctrlKey) &&
                      canGenerate
                    ) {
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
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
                    <div className="flex-1 space-y-2">
                      <div>
                        <p className="text-sm font-medium text-destructive">
                          {generationError.code === 'TIMEOUT'
                            ? 'Generation Timed Out'
                            : generationError.code === 'PARSE_ERROR'
                              ? 'Format Error'
                              : generationError.code === 'ABORTED'
                                ? 'Cancelled'
                                : generationError.code === 'LLM_ERROR'
                                  ? 'AI Service Error'
                                  : 'Error'}
                        </p>
                        <p className="mt-1 text-xs text-destructive/90">
                          {getErrorMessage(
                            generationError.code,
                            generationError.message,
                            generationError.detail
                          )}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-destructive/30 text-destructive hover:bg-destructive/20 hover:text-destructive"
                        onClick={() => handleGenerate(false)}
                        disabled={!canGenerate}
                      >
                        <RotateCcw className="mr-1.5 h-3 w-3" />
                        Retry
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                >
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
                    <Rocket className="mr-1.5 h-3.5 w-3.5" />
                    Generate & Launch
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleGenerate(false)}
                    disabled={!canGenerate}
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
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
          <div className="flex flex-col items-center justify-center px-6 py-16">
            <div className="relative mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="h-8 w-8 animate-pulse text-primary" />
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary bg-background">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              </div>
            </div>

            <h3 className="mb-2 text-lg font-semibold">Generating your plan</h3>
            <p className="mb-2 text-sm text-muted-foreground">
              &quot;{title}&quot;
            </p>
            <p className="mb-6 font-mono text-xs text-primary">
              {formatElapsedTime(elapsedSeconds)} elapsed
            </p>

            {/* Progress bar */}
            <div className="mb-3 w-full max-w-xs">
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500 ease-in-out"
                  style={{
                    width: `${generationProgress > 0 ? generationProgress : 5}%`,
                  }}
                />
              </div>
              {generationProgress > 0 && (
                <p className="mt-1 text-right text-[10px] text-muted-foreground/60">
                  {generationProgress}%
                </p>
              )}
            </div>

            {/* Live status message from the LLM stream */}
            {generationStatus && (
              <p
                key={generationStatus}
                className="text-xs text-muted-foreground duration-300 animate-in fade-in"
              >
                {generationStatus}
              </p>
            )}

            {/* Live LLM output preview - shows what Claude is generating */}
            {generationLlmOutput && (
              <div className="mt-6 w-full max-w-2xl">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[10px] font-medium text-muted-foreground">
                    Live LLM Output
                  </p>
                  <p className="text-[9px] text-muted-foreground/60">
                    Streaming in real-time
                  </p>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-md border border-border/50 bg-muted/30 p-3 font-mono">
                  <pre className="whitespace-pre-wrap text-[10px] leading-relaxed text-muted-foreground/80">
                    {generationLlmOutput}
                  </pre>
                  <div ref={llmOutputEndRef} />
                </div>
                <p className="mt-1 text-right text-[9px] text-muted-foreground/50">
                  {generationLlmOutput.length.toLocaleString()} characters
                </p>
              </div>
            )}

            {/* Cancel button */}
            <Button
              variant="ghost"
              size="sm"
              className="mt-6 text-muted-foreground hover:text-foreground"
              onClick={handleCancelGeneration}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 3: Preview */}
        {/* ================================================================= */}
        {step === 'preview' && generatedPlan && (
          <>
            {/* Header */}
            <div className="flex-shrink-0 border-b px-6 pb-3 pt-5">
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    onClick={() => setStep('prompt')}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">
                      {generatedPlan.title}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {generatedPhases.length} phase
                      {generatedPhases.length !== 1 ? 's' : ''}
                      {' \u00B7 '}
                      {generatedTasks.length} task
                      {generatedTasks.length !== 1 ? 's' : ''}
                      {changesApplied > 0 && (
                        <span className="ml-1 text-primary">
                          {' \u00B7 '}
                          {changesApplied} refinement
                          {changesApplied !== 1 ? 's' : ''} applied
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRefinement(!showRefinement)}
                    className={cn(showRefinement && 'bg-muted')}
                  >
                    <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                    Refine
                  </Button>
                  <Button size="sm" onClick={handleLaunch}>
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    Launch
                  </Button>
                </div>
              </div>
            </div>

            {/* Content area */}
            <div className="flex min-h-0 flex-1 overflow-hidden">
              {/* Plan preview */}
              <div
                className={cn(
                  'flex-1 space-y-3 overflow-y-auto p-4',
                  showRefinement && 'border-r'
                )}
              >
                {/* Validation warnings */}
                {generationWarnings.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-600" />
                      <h3 className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        Plan Validation Warnings ({generationWarnings.length})
                      </h3>
                    </div>
                    <div className="space-y-1.5 pl-6">
                      {generationWarnings.map((warning, idx) => (
                        <div key={idx} className="text-xs text-amber-800 dark:text-amber-200">
                          <span className={cn(
                            'mr-2 inline-block rounded px-1.5 py-0.5 font-mono text-[10px]',
                            warning.severity === 'warning'
                              ? 'bg-amber-600/20 text-amber-900 dark:text-amber-100'
                              : 'bg-blue-600/20 text-blue-900 dark:text-blue-100'
                          )}>
                            {warning.code}
                          </span>
                          {warning.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                        className="flex w-full items-center gap-2 rounded-t-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                        )}
                        <Badge
                          variant="outline"
                          className="h-4 px-1.5 py-0 font-mono text-[10px]"
                        >
                          {phaseIdx + 1}
                        </Badge>
                        <span className="flex-1 truncate text-sm font-medium">
                          {phase.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {phaseTasks.length} task
                          {phaseTasks.length !== 1 ? 's' : ''}
                        </span>
                      </button>

                      {/* Phase description */}
                      {isExpanded && phase.description && (
                        <p className="px-3 pb-2 pl-9 text-xs text-muted-foreground">
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
                                'group flex items-start gap-2 px-3 py-2 transition-colors hover:bg-muted/30',
                                taskIdx < phaseTasks.length - 1 &&
                                  'border-b border-border/50'
                              )}
                            >
                              <GripVertical className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/30" />

                              {editingTask === task.id ? (
                                /* Editing mode */
                                <div className="flex-1 space-y-2">
                                  <Input
                                    value={editingTaskTitle}
                                    onChange={(e) =>
                                      setEditingTaskTitle(e.target.value)
                                    }
                                    className="h-7 text-xs"
                                    autoFocus
                                  />
                                  <Textarea
                                    value={editingTaskDescription}
                                    onChange={(e) =>
                                      setEditingTaskDescription(e.target.value)
                                    }
                                    className="min-h-[60px] text-xs"
                                    rows={3}
                                  />
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2 text-[10px]"
                                      onClick={saveTaskEdit}
                                    >
                                      <Check className="mr-1 h-3 w-3" />
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2 text-[10px]"
                                      onClick={() => setEditingTask(null)}
                                    >
                                      <X className="mr-1 h-3 w-3" />
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                /* Display mode */
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10px] text-muted-foreground/50">
                                      {phaseIdx + 1}.{taskIdx + 1}
                                    </span>
                                    <span className="truncate text-xs font-medium">
                                      {task.title}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startEditingTask(task);
                                      }}
                                      className="rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                                    >
                                      <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                                    </button>
                                  </div>
                                  {task.description && (
                                    <p className="mt-0.5 line-clamp-2 pl-7 text-[11px] text-muted-foreground">
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
                <div className="flex w-80 flex-shrink-0 flex-col bg-muted/20">
                  {/* Chat header */}
                  <div className="flex-shrink-0 border-b px-3 py-2">
                    <p className="text-xs font-medium">Refine with Claude</p>
                    <p className="text-[10px] text-muted-foreground">
                      Ask Claude to adjust the plan
                    </p>
                  </div>

                  {/* Messages */}
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                    {refinementMessages.length === 0 && (
                      <div className="py-8 text-center">
                        <MessageSquare className="mx-auto mb-2 h-6 w-6 text-muted-foreground/30" />
                        <p className="text-[11px] text-muted-foreground/60">
                          Try: &quot;Add error handling to phase 2&quot; or
                          &quot;Make the tasks more detailed&quot;
                        </p>
                      </div>
                    )}

                    {refinementMessages.map((msg, idx) => (
                      <Card
                        key={idx}
                        className={cn(
                          'p-2.5',
                          msg.role === 'user'
                            ? 'ml-4 border-primary/20 bg-primary/10'
                            : 'mr-4 bg-card'
                        )}
                      >
                        <p className="mb-0.5 text-[10px] font-medium text-muted-foreground">
                          {msg.role === 'user' ? 'You' : 'Claude'}
                        </p>
                        <p className="whitespace-pre-wrap text-xs leading-relaxed">
                          {msg.content}
                        </p>
                      </Card>
                    ))}

                    {isRefining &&
                      !refinementMessages[refinementMessages.length - 1]
                        ?.content && (
                        <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Thinking...
                        </div>
                      )}

                    <div ref={refinementEndRef} />
                  </div>

                  {/* Input */}
                  <div className="flex-shrink-0 border-t p-3">
                    <div className="flex gap-1.5">
                      <Textarea
                        value={refinementInput}
                        onChange={(e) => setRefinementInput(e.target.value)}
                        onKeyDown={handleRefinementKeyDown}
                        placeholder="What should change?"
                        rows={2}
                        disabled={isRefining}
                        className="min-h-0 flex-1 resize-none text-xs"
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
            <div className="flex flex-shrink-0 items-center justify-between border-t bg-muted/30 px-6 py-3">
              <p className="text-[10px] text-muted-foreground">
                Review the plan, edit tasks inline, or refine with Claude before
                launching.
              </p>
              <Button size="sm" onClick={handleLaunch} className="shadow-sm">
                <Rocket className="mr-1.5 h-3.5 w-3.5" />
                Launch Plan
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
