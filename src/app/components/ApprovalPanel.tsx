'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import {
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  Plus,
  Minus,
  ChevronDown,
  ChevronRight,
  Shield,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Keyboard,
  AlertTriangle,
} from 'lucide-react';
import { CommitMessageEditor } from './CommitMessageEditor';
import { cn } from '@/shared/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
}

interface ApprovalPanelProps {
  taskId: string;
  filesChanged: FileChange[];
  qaGatesPassed?: boolean;
  onApproved?: () => void;
  onRejected?: () => void;
}

// ---------------------------------------------------------------------------
// Pre-flight Checklist
// ---------------------------------------------------------------------------

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  auto: boolean;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: 'qa', label: 'QA gates passed', description: 'All automated quality checks have passed', auto: true },
  { id: 'diff', label: 'Diff reviewed', description: 'Changes have been reviewed in the diff viewer', auto: false },
  { id: 'message', label: 'Commit message ready', description: 'Commit message will be generated on approval', auto: true },
];

function PreFlightChecklist({
  checkedItems,
  onToggle,
  qaGatesPassed,
}: {
  checkedItems: Record<string, boolean>;
  onToggle: (id: string) => void;
  qaGatesPassed: boolean;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5" />
        Pre-flight Checklist
      </h4>
      <div className="space-y-1">
        {CHECKLIST_ITEMS.map((item) => {
          const isChecked = item.id === 'qa' ? qaGatesPassed : (checkedItems[item.id] ?? false);
          const isDisabled = item.id === 'qa';

          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && onToggle(item.id)}
              disabled={isDisabled}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors',
                'hover:bg-muted/50',
                isDisabled && 'cursor-default opacity-80',
              )}
            >
              <div
                className={cn(
                  'h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                  isChecked
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'border-border',
                  !isChecked && !isDisabled && 'hover:border-muted-foreground',
                )}
              >
                {isChecked && <CheckCircle className="h-3 w-3" />}
              </div>
              <div className="min-w-0 flex-1">
                <span className={cn('text-sm', isChecked && 'text-muted-foreground line-through')}>
                  {item.label}
                </span>
                {item.auto && (
                  <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0">auto</Badge>
                )}
              </div>
              {item.id === 'qa' && !qaGatesPassed && (
                <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// File Change Summary (expandable)
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  added: 'text-emerald-600 bg-emerald-500/10',
  modified: 'text-blue-600 bg-blue-500/10',
  deleted: 'text-red-500 bg-red-500/10',
  renamed: 'text-amber-600 bg-amber-500/10',
};

function FileChangeSummary({ filesChanged }: { filesChanged: FileChange[] }) {
  const [expanded, setExpanded] = useState(false);
  const fileCount = filesChanged.length;
  const insertions = filesChanged.reduce((sum, f) => sum + f.additions, 0);
  const deletions = filesChanged.reduce((sum, f) => sum + f.deletions, 0);

  const byStatus = filesChanged.reduce(
    (acc, f) => { acc[f.status] = (acc[f.status] || 0) + 1; return acc; },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 text-left group"
      >
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Files Changed
          </h4>
          <div className="flex items-center gap-3 text-xs">
            <span className="font-medium">{fileCount} file{fileCount !== 1 ? 's' : ''}</span>
            <span className="flex items-center gap-0.5 text-emerald-600"><Plus className="h-3 w-3" />{insertions}</span>
            <span className="flex items-center gap-0.5 text-red-500"><Minus className="h-3 w-3" />{deletions}</span>
          </div>
        </div>
        <span className="text-muted-foreground group-hover:text-foreground transition-colors">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      {/* Status breakdown badges */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(byStatus).map(([status, count]) => (
          <Badge key={status} variant="outline" className="text-[10px] px-1.5 py-0">
            {count} {status}
          </Badge>
        ))}
      </div>

      {/* Expanded file list */}
      {expanded && (
        <div className="space-y-0.5 max-h-48 overflow-y-auto rounded-md border bg-muted/20 p-2">
          {filesChanged.map((f) => (
            <div key={f.path} className="flex items-center gap-2 text-xs py-1 px-1 rounded hover:bg-muted/40">
              <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="truncate flex-1 font-mono text-[11px]" title={f.path}>{f.path}</span>
              <span className="flex items-center gap-1 text-[10px] tabular-nums flex-shrink-0">
                <span className="text-emerald-600">+{f.additions}</span>
                <span className="text-red-500">-{f.deletions}</span>
              </span>
              <span className={cn('text-[10px] px-1 rounded flex-shrink-0', STATUS_COLORS[f.status])}>
                {f.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirmation Dialogs
// ---------------------------------------------------------------------------

function ConfirmApproveDialog({
  open,
  onConfirm,
  onCancel,
  isLoading,
  fileCount,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
  fileCount: number;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isLoading && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ThumbsUp className="h-5 w-5 text-emerald-600" />
            Approve Changes
          </DialogTitle>
          <DialogDescription>
            This will generate a commit message and proceed to committing {fileCount} file{fileCount !== 1 ? 's' : ''}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating...</> : 'Confirm Approval'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmRejectDialog({
  open,
  onConfirm,
  onCancel,
  isLoading,
  reason,
  onReasonChange,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
  reason: string;
  onReasonChange: (v: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isLoading && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Reject &amp; Revert Changes
          </DialogTitle>
          <DialogDescription>
            This will revert all changes made by this task. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor="reject-reason" className="text-sm font-medium">
            Reason <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Describe why these changes are being rejected..."
            className="min-h-[80px]"
            disabled={isLoading}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Reverting...</> : 'Reject & Revert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Keyboard Shortcut Indicator
// ---------------------------------------------------------------------------

function KeyboardShortcuts() {
  return (
    <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
      <Keyboard className="h-3 w-3" />
      <span className="flex items-center gap-1">
        <kbd className="px-1 py-0.5 rounded border bg-muted font-mono text-[10px]">A</kbd> Approve
      </span>
      <span className="flex items-center gap-1">
        <kbd className="px-1 py-0.5 rounded border bg-muted font-mono text-[10px]">R</kbd> Reject
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action Buttons
// ---------------------------------------------------------------------------

function ActionButtons({
  onApprove,
  onReject,
  isLoading,
  canApprove,
}: {
  onApprove: () => void;
  onReject: () => void;
  isLoading: boolean;
  canApprove: boolean;
}) {
  return (
    <div className="flex gap-2 pt-1">
      <Button
        variant="outline"
        onClick={onReject}
        disabled={isLoading}
        className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
      >
        <ThumbsDown className="h-4 w-4 mr-2" />
        Reject &amp; Revert
      </Button>
      <Button
        onClick={onApprove}
        disabled={isLoading || !canApprove}
        className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
      >
        <ThumbsUp className="h-4 w-4 mr-2" />
        Approve Changes
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visual Feedback
// ---------------------------------------------------------------------------

function SuccessFeedback({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
      <CheckCircle className="h-4 w-4 flex-shrink-0" />
      {message}
    </div>
  );
}

function ErrorFeedback({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
      <XCircle className="h-4 w-4 flex-shrink-0" />
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// No Changes Panel
// ---------------------------------------------------------------------------

function NoChangesPanel({
  taskId,
  onApproved,
  onRejected,
}: {
  taskId: string;
  onApproved?: () => void;
  onRejected?: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const handleComplete = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/tasks/${taskId}/approve`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to complete task');
      }
      onApproved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    } finally {
      setIsLoading(false);
    }
  }, [taskId, onApproved]);

  const handleRejectConfirm = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/tasks/${taskId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reject task');
      }
      setShowRejectDialog(false);
      onRejected?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject task');
      setShowRejectDialog(false);
    } finally {
      setIsLoading(false);
    }
  }, [taskId, rejectReason, onRejected]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Eye className="h-5 w-5 text-amber-500" />
          Review Changes
        </h3>
        <Badge variant="default" className="text-xs bg-emerald-600 hover:bg-emerald-700">
          <CheckCircle className="h-3 w-3 mr-1" />QA Passed
        </Badge>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-md bg-muted/40 border text-sm text-muted-foreground">
        <FileText className="h-4 w-4 flex-shrink-0" />
        No file changes were made by this task. You can mark it as complete or reject it.
      </div>

      {error && <ErrorFeedback message={error} />}

      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          onClick={() => setShowRejectDialog(true)}
          disabled={isLoading}
          className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
        >
          <ThumbsDown className="h-4 w-4 mr-2" />
          Reject
        </Button>
        <Button
          onClick={handleComplete}
          disabled={isLoading}
          className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
        >
          {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Completing...</> : <><ThumbsUp className="h-4 w-4 mr-2" />Mark as Complete</>}
        </Button>
      </div>

      <ConfirmRejectDialog
        open={showRejectDialog}
        onConfirm={handleRejectConfirm}
        onCancel={() => setShowRejectDialog(false)}
        isLoading={isLoading}
        reason={rejectReason}
        onReasonChange={setRejectReason}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

async function approveTask(taskId: string) {
  const res = await fetch(`/api/tasks/${taskId}/approve`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to generate commit message');
  }
  return res.json();
}

async function rejectTask(taskId: string, reason: string | null) {
  const res = await fetch(`/api/tasks/${taskId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to reject task');
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function ApprovalPanelWithChanges({
  taskId,
  filesChanged,
  qaGatesPassed,
  onApproved,
  onRejected,
}: ApprovalPanelProps & { qaGatesPassed: boolean }) {
  const [isLoading, setIsLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Confirmation dialogs
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Pre-flight checklist
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({
    message: true, // auto-checked
  });

  const panelRef = useRef<HTMLDivElement>(null);

  const allChecksPassed = qaGatesPassed && CHECKLIST_ITEMS
    .filter((item) => !item.auto)
    .every((item) => checkedItems[item.id]);

  const toggleChecklistItem = useCallback((id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // --- Approve flow ---
  const handleApproveClick = useCallback(() => {
    setShowApproveDialog(true);
  }, []);

  const handleApproveConfirm = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await approveTask(taskId);
      setShowApproveDialog(false);
      setCommitMessage(data.commitMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate commit message');
      setShowApproveDialog(false);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  // --- Reject flow ---
  const handleRejectClick = useCallback(() => {
    setRejectReason('');
    setShowRejectDialog(true);
  }, []);

  const handleRejectConfirm = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await rejectTask(taskId, rejectReason || null);
      setShowRejectDialog(false);
      setSuccess('Changes have been reverted successfully.');
      setTimeout(() => onRejected?.(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject task');
      setShowRejectDialog(false);
    } finally {
      setIsLoading(false);
    }
  }, [taskId, rejectReason, onRejected]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    if (commitMessage || showApproveDialog || showRejectDialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger inside input/textarea elements
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        if (allChecksPassed && qaGatesPassed && !isLoading) {
          handleApproveClick();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (!isLoading) {
          handleRejectClick();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [commitMessage, showApproveDialog, showRejectDialog, allChecksPassed, qaGatesPassed, isLoading, handleApproveClick, handleRejectClick]);

  // --- Commit message editor view ---
  if (commitMessage) {
    return (
      <CommitMessageEditor
        taskId={taskId}
        initialMessage={commitMessage}
        onCommitted={() => onApproved?.()}
        onCancel={() => { setCommitMessage(null); setError(null); }}
      />
    );
  }

  // --- Review panel view ---
  return (
    <div ref={panelRef} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Eye className="h-5 w-5 text-amber-500" />
          Review Changes
        </h3>
        <Badge
          variant={qaGatesPassed ? 'default' : 'destructive'}
          className={cn(
            'text-xs',
            qaGatesPassed && 'bg-emerald-600 hover:bg-emerald-700',
          )}
        >
          {qaGatesPassed ? (
            <><CheckCircle className="h-3 w-3 mr-1" />QA Passed</>
          ) : (
            <><XCircle className="h-3 w-3 mr-1" />QA Failed</>
          )}
        </Badge>
      </div>

      {/* QA failure warning */}
      {!qaGatesPassed && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          QA gates have failed. Fix issues before approving.
        </div>
      )}

      {/* Files changed summary */}
      <FileChangeSummary filesChanged={filesChanged} />

      {/* Pre-flight checklist */}
      <PreFlightChecklist
        checkedItems={checkedItems}
        onToggle={toggleChecklistItem}
        qaGatesPassed={qaGatesPassed}
      />

      {/* Feedback */}
      {error && <ErrorFeedback message={error} />}
      {success && <SuccessFeedback message={success} />}

      {/* Action buttons */}
      <ActionButtons
        onApprove={handleApproveClick}
        onReject={handleRejectClick}
        isLoading={isLoading}
        canApprove={allChecksPassed && qaGatesPassed}
      />

      {/* Keyboard shortcuts hint */}
      <KeyboardShortcuts />

      {/* Confirmation dialogs */}
      <ConfirmApproveDialog
        open={showApproveDialog}
        onConfirm={handleApproveConfirm}
        onCancel={() => setShowApproveDialog(false)}
        isLoading={isLoading}
        fileCount={filesChanged.length}
      />

      <ConfirmRejectDialog
        open={showRejectDialog}
        onConfirm={handleRejectConfirm}
        onCancel={() => setShowRejectDialog(false)}
        isLoading={isLoading}
        reason={rejectReason}
        onReasonChange={setRejectReason}
      />
    </div>
  );
}

export function ApprovalPanel({
  taskId,
  filesChanged,
  qaGatesPassed = true,
  onApproved,
  onRejected,
}: ApprovalPanelProps) {
  if (filesChanged.length === 0) {
    return <NoChangesPanel taskId={taskId} onApproved={onApproved} onRejected={onRejected} />;
  }
  return (
    <ApprovalPanelWithChanges
      taskId={taskId}
      filesChanged={filesChanged}
      qaGatesPassed={qaGatesPassed}
      onApproved={onApproved}
      onRejected={onRejected}
    />
  );
}
