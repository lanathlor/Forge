'use client';

import React, { useState, useEffect, useRef, useCallback, type JSX } from 'react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/shared/components/ui/tabs';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Sparkles,
  Pause,
  Ban,
  X,
  FileText,
  GitBranch,
  Shield,
  Stamp,
  LayoutList,
  Terminal,
  Plus,
  Minus,
  Copy,
  Check,
} from 'lucide-react';
import dynamic from 'next/dynamic';

// Lazy load Monaco-based DiffViewer (~5MB) and QAGateResults
const DiffViewer = dynamic(
  () => import('@/features/diff-viewer/components/DiffViewer').then(m => ({ default: m.DiffViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-xs">Loading diff viewer...</span>
        </div>
      </div>
    ),
  },
);

const QAGateResults = dynamic(
  () => import('@/features/qa-gates/components/QAGateResults').then(m => ({ default: m.QAGateResults })),
  { ssr: false },
);
import { ApprovalPanel } from './ApprovalPanel';
import { TaskOutput } from './TaskOutput';
import { cn } from '@/shared/lib/utils';
import { formatDuration } from '@/shared/lib/utils';
import { useMediaQuery } from '@/shared/hooks';
import type { TaskUpdate } from '@/shared/hooks/useTaskStream';
import type { FileChange, TaskStatus } from '@/db/schema/tasks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Task {
  id: string;
  prompt: string;
  status: TaskStatus;
  claudeOutput?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  diffContent?: string | null;
  filesChanged?: FileChange[] | null;
  commitMessage?: string | null;
  currentQAAttempt?: number | null;
  committedSha?: string | null;
  rejectionReason?: string | null;
}

export interface TaskDetailPanelProps {
  taskId: string;
  updates: TaskUpdate[];
  open: boolean;
  onClose: () => void;
}

type TabValue = 'overview' | 'output' | 'changes' | 'qa' | 'approval';

// ---------------------------------------------------------------------------
// Status Configuration
// ---------------------------------------------------------------------------

interface StatusConfig {
  icon: JSX.Element;
  label: string;
  color: string;
  badgeClass: string;
  pulseClass?: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  pending: {
    icon: <Clock className="h-4 w-4" />,
    label: 'Pending',
    color: 'text-slate-500',
    badgeClass:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  pre_flight: {
    icon: <Sparkles className="h-4 w-4" />,
    label: 'Pre-flight',
    color: 'text-indigo-500',
    badgeClass:
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  },
  running: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    label: 'Running',
    color: 'text-blue-500',
    badgeClass:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    pulseClass: 'animate-pulse',
  },
  waiting_qa: {
    icon: <Pause className="h-4 w-4" />,
    label: 'Waiting QA',
    color: 'text-orange-500',
    badgeClass:
      'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  },
  qa_running: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    label: 'QA Running',
    color: 'text-blue-500',
    badgeClass:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    pulseClass: 'animate-pulse',
  },
  qa_failed: {
    icon: <XCircle className="h-4 w-4" />,
    label: 'QA Failed',
    color: 'text-red-500',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
  waiting_approval: {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: 'Needs Approval',
    color: 'text-amber-500',
    badgeClass:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  approved: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: 'Approved',
    color: 'text-emerald-500',
    badgeClass:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  completed: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: 'Completed',
    color: 'text-emerald-500',
    badgeClass:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  rejected: {
    icon: <Ban className="h-4 w-4" />,
    label: 'Rejected',
    color: 'text-red-500',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
  failed: {
    icon: <XCircle className="h-4 w-4" />,
    label: 'Failed',
    color: 'text-red-500',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
  cancelled: {
    icon: <Ban className="h-4 w-4" />,
    label: 'Cancelled',
    color: 'text-slate-400',
    badgeClass:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
};

const DEFAULT_STATUS_CONFIG: StatusConfig = {
  icon: <Clock className="h-4 w-4" />,
  label: 'Unknown',
  color: 'text-slate-400',
  badgeClass: 'bg-slate-100 text-slate-600',
};

function getStatusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status] || DEFAULT_STATUS_CONFIG;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useElapsedTime(task: Task | null) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!task) return;

    const calculate = () => {
      const start = task.startedAt
        ? new Date(task.startedAt)
        : new Date(task.createdAt);
      const end = task.completedAt ? new Date(task.completedAt) : new Date();
      setElapsed(formatDuration(start, end));
    };

    calculate();

    // Only tick for active tasks
    const isActive = [
      'running',
      'qa_running',
      'pre_flight',
      'pending',
      'waiting_qa',
    ].includes(task.status);
    if (!isActive) return;

    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [task]);

  return elapsed;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Panel Header
// ---------------------------------------------------------------------------

const PanelHeader = React.memo(function PanelHeader({
  task,
  elapsed,
  onClose,
  onCancel,
  onRetry,
}: {
  task: Task;
  elapsed: string;
  onClose: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const cfg = getStatusConfig(task.status);
  const canCancel = ['pending', 'running', 'pre_flight', 'qa_running'].includes(
    task.status
  );
  const canRetry = ['failed', 'qa_failed', 'rejected'].includes(task.status);

  return (
    <div className="flex-shrink-0 border-b bg-card px-4 py-3 sm:px-5">
      {/* Top row: status + close */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn(cfg.color, cfg.pulseClass)}>{cfg.icon}</span>
          <Badge className={cn('border-0 text-xs font-medium', cfg.badgeClass)}>
            {cfg.label}
          </Badge>
          <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
            <Clock className="h-3 w-3" />
            {elapsed}
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {canRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="h-7 border-blue-200 bg-blue-50 px-2 text-xs text-blue-700 hover:bg-blue-100"
            >
              Retry
            </Button>
          )}
          {canCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            >
              Cancel
            </Button>
          )}
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Prompt */}
      <h2
        className="line-clamp-2 text-sm font-medium leading-snug"
        title={task.prompt}
      >
        {task.prompt}
      </h2>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function MetricRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2 last:border-0">
      <span className="flex-shrink-0 text-xs text-muted-foreground">
        {label}
      </span>
      <span className={cn('text-right text-xs', mono && 'font-mono')}>
        {value}
      </span>
    </div>
  );
}

function FileChangeSummary({ files }: { files: FileChange[] }) {
  const additions = files.reduce((s, f) => s + f.additions, 0);
  const deletions = files.reduce((s, f) => s + f.deletions, 0);
  const byStatus = files.reduce(
    (acc, f) => {
      acc[f.status] = (acc[f.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Files Changed
      </h4>
      <div className="flex items-center gap-4 text-xs">
        <span className="font-medium">
          {files.length} file{files.length !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1 text-emerald-600">
          <Plus className="h-3 w-3" />
          {additions}
        </span>
        <span className="flex items-center gap-1 text-red-500">
          <Minus className="h-3 w-3" />
          {deletions}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(byStatus).map(([status, count]) => (
          <Badge
            key={status}
            variant="outline"
            className="px-1.5 py-0 text-[10px]"
          >
            {count} {status}
          </Badge>
        ))}
      </div>
      <div className="max-h-40 space-y-1 overflow-y-auto">
        {files.map((f) => (
          <div key={f.path} className="group flex items-center gap-2 text-xs">
            <FileText className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
            <span
              className="flex-1 truncate font-mono text-[11px]"
              title={f.path}
            >
              {f.path}
            </span>
            <span
              className={cn(
                'flex-shrink-0 rounded px-1 text-[10px]',
                f.status === 'added' && 'bg-emerald-500/10 text-emerald-600',
                f.status === 'modified' && 'bg-blue-500/10 text-blue-600',
                f.status === 'deleted' && 'bg-red-500/10 text-red-500',
                f.status === 'renamed' && 'bg-amber-500/10 text-amber-600'
              )}
            >
              {f.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const OverviewTab = React.memo(function OverviewTab({ task }: { task: Task }) {
  const created = new Date(task.createdAt);
  const started = task.startedAt ? new Date(task.startedAt) : null;
  const completed = task.completedAt ? new Date(task.completedAt) : null;

  return (
    <div className="h-full space-y-5 overflow-y-auto p-4">
      {/* Prompt */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Prompt
        </h4>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="whitespace-pre-wrap break-words text-sm">
            {task.prompt}
          </p>
        </div>
      </div>

      {/* Timestamps */}
      <div className="space-y-1">
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Timestamps
        </h4>
        <MetricRow label="Created" value={created.toLocaleString()} mono />
        {started && (
          <MetricRow label="Started" value={started.toLocaleString()} mono />
        )}
        {completed && (
          <MetricRow
            label="Completed"
            value={completed.toLocaleString()}
            mono
          />
        )}
        {started && completed && (
          <MetricRow
            label="Duration"
            value={formatDuration(started, completed)}
            mono
          />
        )}
      </div>

      {/* Metrics */}
      <div className="space-y-1">
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Metrics
        </h4>
        {task.currentQAAttempt && (
          <MetricRow
            label="QA Attempt"
            value={`${task.currentQAAttempt} / 3`}
          />
        )}
        {task.committedSha && (
          <MetricRow
            label="Commit"
            value={
              <span className="flex items-center gap-1">
                <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                  {task.committedSha.substring(0, 8)}
                </code>
                <CopyButton text={task.committedSha} />
              </span>
            }
          />
        )}
        {task.filesChanged && (
          <MetricRow
            label="Changes"
            value={`${task.filesChanged.length} file${task.filesChanged.length !== 1 ? 's' : ''}`}
          />
        )}
      </div>

      {/* Rejection reason */}
      {task.rejectionReason && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wider text-red-500">
            Rejection Reason
          </h4>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-900/10">
            <p className="text-sm text-red-700 dark:text-red-400">
              {task.rejectionReason}
            </p>
          </div>
        </div>
      )}

      {/* File change summary */}
      {task.filesChanged && task.filesChanged.length > 0 && (
        <FileChangeSummary files={task.filesChanged} />
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Changes Tab
// ---------------------------------------------------------------------------

function ChangesTab({ taskId, hasDiff }: { taskId: string; hasDiff: boolean }) {
  if (!hasDiff) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <GitBranch className="mb-3 h-6 w-6" />
        <p className="text-sm">No changes yet</p>
      </div>
    );
  }
  return <DiffViewer taskId={taskId} />;
}

// ---------------------------------------------------------------------------
// Tab Navigation
// ---------------------------------------------------------------------------

interface TabConfig {
  value: TabValue;
  label: string;
  icon: JSX.Element;
  available: boolean;
  badge?: string;
}

function getAvailableTabs(task: Task): TabConfig[] {
  const hasChanges = !!(
    task.diffContent ||
    (task.filesChanged && task.filesChanged.length > 0)
  );
  const showApproval = task.status === 'waiting_approval';
  const showQA = [
    'waiting_qa',
    'qa_running',
    'qa_failed',
    'waiting_approval',
    'approved',
    'completed',
    'failed',
  ].includes(task.status);

  return [
    {
      value: 'overview' as TabValue,
      label: 'Overview',
      icon: <LayoutList className="h-3.5 w-3.5" />,
      available: true,
    },
    {
      value: 'output' as TabValue,
      label: 'Output',
      icon: <Terminal className="h-3.5 w-3.5" />,
      available: true,
    },
    {
      value: 'changes' as TabValue,
      label: 'Changes',
      icon: <GitBranch className="h-3.5 w-3.5" />,
      available: true,
      badge:
        hasChanges && task.filesChanged
          ? String(task.filesChanged.length)
          : undefined,
    },
    {
      value: 'qa' as TabValue,
      label: 'QA',
      icon: <Shield className="h-3.5 w-3.5" />,
      available: showQA,
    },
    {
      value: 'approval' as TabValue,
      label: 'Approval',
      icon: <Stamp className="h-3.5 w-3.5" />,
      available: showApproval,
    },
  ];
}

function getDefaultTab(task: Task): TabValue {
  if (task.status === 'waiting_approval') return 'approval';
  if (['running', 'qa_running', 'pre_flight'].includes(task.status))
    return 'output';
  if (['completed', 'approved'].includes(task.status)) return 'overview';
  return 'overview';
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function TaskDetailPanel({
  taskId,
  updates,
  open,
  onClose,
}: TaskDetailPanelProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [output, setOutput] = useState('');
  const [activeTab, setActiveTab] = useState<TabValue>('overview');
  const processedOutputCount = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Load task data
  const loadTask = useCallback(async () => {
    if (!taskId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setTask(data.task);
        if (data.task.claudeOutput) setOutput(data.task.claudeOutput);
      }
    } catch (e) {
      console.error('Failed to load task:', e);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // Initial load & reset on taskId change
  useEffect(() => {
    if (!taskId) return;
    loadTask();
    processedOutputCount.current = 0;
    setOutput('');
  }, [taskId, loadTask]);

  // Set default tab when task loads
  useEffect(() => {
    if (task) {
      setActiveTab(getDefaultTab(task));
    }
  }, [task?.id]);

  // Process streaming output updates
  useEffect(() => {
    const outputUpdates = updates.filter(
      (x) => x.type === 'task_output' && x.taskId === taskId
    );
    const newUpdates = outputUpdates.slice(processedOutputCount.current);
    if (newUpdates.length > 0) {
      const newOutput = newUpdates.map((x) => x.output || '').join('');
      setOutput((prev) => prev + newOutput);
      processedOutputCount.current = outputUpdates.length;
    }
  }, [updates, taskId]);

  // Process status updates
  useEffect(() => {
    const statusUpdates = updates.filter(
      (x) => x.type === 'task_update' && x.taskId === taskId
    );
    const last = statusUpdates[statusUpdates.length - 1];
    if (last?.status) {
      const newStatus = last.status as TaskStatus;
      setTask((prev) => (prev ? { ...prev, status: newStatus } : null));
      if (
        [
          'waiting_qa',
          'waiting_approval',
          'qa_failed',
          'completed',
          'approved',
          'failed',
          'rejected',
          'cancelled',
        ].includes(newStatus)
      ) {
        loadTask();
      }
    }
  }, [updates, taskId, loadTask]);

  // Escape key closes panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleCancel = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        setTask((prev) =>
          prev ? { ...prev, status: 'cancelled' as TaskStatus } : null
        );
      }
    } catch (e) {
      console.error('Failed to cancel task:', e);
    }
  }, [taskId]);

  const handleRetry = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/retry`, { method: 'POST' });
      if (res.ok) {
        setTask((prev) =>
          prev ? { ...prev, status: 'pending' as TaskStatus } : null
        );
        // Clear output and reload task data
        setOutput('');
        processedOutputCount.current = 0;
        loadTask();
      }
    } catch (e) {
      console.error('Failed to retry task:', e);
    }
  }, [taskId, loadTask]);

  const elapsed = useElapsedTime(task);
  const tabs = task ? getAvailableTabs(task) : [];

  if (!open) return null;

  // Render content
  const content = (
    <div
      ref={panelRef}
      className={cn(
        'flex h-full flex-col bg-background',
        // Desktop: inline panel with border, takes ~55-60% of parent flex
        isDesktop && 'w-[55%] flex-shrink-0 border-l shadow-xl xl:w-[60%]',
        // Mobile: full-screen overlay
        !isDesktop && 'fixed inset-0 z-50'
      )}
    >
      {/* Loading State */}
      {loading && (
        <div className="flex-1 flex flex-col animate-fade-in-up">
          {/* Skeleton header */}
          <div className="flex-shrink-0 border-b bg-card px-4 py-3 sm:px-5 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-muted animate-skeleton-shimmer" />
                <div className="h-5 w-20 rounded-full bg-muted animate-skeleton-shimmer" />
                <div className="h-4 w-14 rounded bg-muted animate-skeleton-shimmer" />
              </div>
              <div className="h-7 w-7 rounded-md bg-muted animate-skeleton-shimmer" />
            </div>
            <div className="h-4 w-3/4 rounded bg-muted animate-skeleton-shimmer" />
          </div>
          {/* Skeleton tabs */}
          <div className="flex-shrink-0 border-b px-4 py-2">
            <div className="flex items-center gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-6 w-16 rounded bg-muted animate-skeleton-shimmer" />
              ))}
            </div>
          </div>
          {/* Skeleton content */}
          <div className="flex-1 p-4 space-y-5">
            <div className="space-y-2">
              <div className="h-3 w-16 rounded bg-muted animate-skeleton-shimmer" />
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="h-4 w-full rounded bg-muted animate-skeleton-shimmer" />
                <div className="h-4 w-2/3 rounded bg-muted animate-skeleton-shimmer" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-20 rounded bg-muted animate-skeleton-shimmer" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/50">
                  <div className="h-3 w-16 rounded bg-muted animate-skeleton-shimmer" />
                  <div className="h-3 w-32 rounded bg-muted animate-skeleton-shimmer" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Not Found State */}
      {!loading && !task && (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-muted-foreground">
          <p className="text-sm">Task not found</p>
          <Button variant="ghost" size="sm" onClick={onClose} className="mt-3">
            Close
          </Button>
        </div>
      )}

      {/* Main Content */}
      {!loading && task && (
        <>
          <PanelHeader
            task={task}
            elapsed={elapsed}
            onClose={onClose}
            onCancel={handleCancel}
            onRetry={handleRetry}
          />

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabValue)}
            className="flex flex-1 flex-col overflow-hidden"
          >
            {/* Tab List */}
            <div className="flex-shrink-0 border-b px-2 sm:px-4">
              <TabsList className="h-9 gap-0 bg-transparent p-0">
                {tabs
                  .filter((t) => t.available)
                  .map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className={cn(
                        'relative h-9 rounded-none border-b-2 border-transparent px-3 text-xs font-medium',
                        'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none',
                        'transition-colors hover:text-foreground'
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                        {tab.badge && (
                          <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0 text-[10px] font-medium tabular-nums">
                            {tab.badge}
                          </span>
                        )}
                      </span>
                    </TabsTrigger>
                  ))}
              </TabsList>
            </div>

            {/* Tab Content */}
            <TabsContent
              value="overview"
              className="mt-0 flex-1 overflow-hidden"
            >
              <OverviewTab task={task} />
            </TabsContent>

            <TabsContent
              value="output"
              className="mt-0 flex-1 overflow-hidden p-3 sm:p-4"
            >
              <TaskOutput output={output} status={task.status} />
            </TabsContent>

            <TabsContent
              value="changes"
              className="mt-0 flex-1 overflow-hidden"
            >
              <ChangesTab
                taskId={taskId}
                hasDiff={
                  !!(
                    task.diffContent ||
                    (task.filesChanged && task.filesChanged.length > 0)
                  )
                }
              />
            </TabsContent>

            <TabsContent value="qa" className="mt-0 flex-1 overflow-y-auto p-4">
              <QAGateResults
                taskId={taskId}
                attempt={task.currentQAAttempt ?? 1}
              />
            </TabsContent>

            {task.status === 'waiting_approval' && (
              <TabsContent
                value="approval"
                className="mt-0 flex-1 overflow-y-auto p-4"
              >
                <ApprovalPanel
                  taskId={taskId}
                  filesChanged={task.filesChanged ?? []}
                  qaGatesPassed
                  onApproved={loadTask}
                  onRejected={loadTask}
                />
              </TabsContent>
            )}
          </Tabs>
        </>
      )}
    </div>
  );

  // On mobile, render with backdrop overlay
  if (!isDesktop) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40 bg-black/50 duration-200 animate-in fade-in"
          onClick={onClose}
        />
        {content}
      </>
    );
  }

  return content;
}
