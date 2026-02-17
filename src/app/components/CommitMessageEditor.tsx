'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/shared/components/ui/card';
import { Textarea } from '@/shared/components/ui/textarea';
import { Badge } from '@/shared/components/ui/badge';
import {
  Loader2,
  CheckCircle2,
  RotateCcw,
  GitCommit,
  Eye,
  Pencil,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommitMessageEditorProps {
  taskId: string;
  initialMessage: string;
  onCommitted?: () => void;
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

async function regenerateMessage(taskId: string) {
  const res = await fetch(`/api/tasks/${taskId}/regenerate-message`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to regenerate commit message');
  }
  return res.json();
}

async function commitChanges(taskId: string, message: string) {
  const res = await fetch(`/api/tasks/${taskId}/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commitMessage: message }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to commit changes');
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Commit Message Preview
// ---------------------------------------------------------------------------

function CommitPreview({ message }: { message: string }) {
  const lines = message.split('\n');
  const subject = lines[0] || '';
  const body = lines.slice(2).join('\n').trim();

  // Parse conventional commit format: type(scope): subject
  const conventionalMatch = subject.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      {conventionalMatch ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className="px-1.5 py-0 font-mono text-[10px]"
          >
            {conventionalMatch[1]}
          </Badge>
          {conventionalMatch[2] && (
            <Badge
              variant="secondary"
              className="px-1.5 py-0 font-mono text-[10px]"
            >
              {conventionalMatch[2]}
            </Badge>
          )}
          <span className="text-sm font-medium">{conventionalMatch[3]}</span>
        </div>
      ) : (
        <p className="text-sm font-medium">{subject}</p>
      )}
      {body && (
        <pre className="whitespace-pre-wrap break-words border-t border-border/50 pt-1 text-xs text-muted-foreground">
          {body}
        </pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success View
// ---------------------------------------------------------------------------

function SuccessView({
  commitSha,
  commitMessage,
  onDone,
}: {
  commitSha: string;
  commitMessage: string;
  onDone: () => void;
}) {
  return (
    <Card className="w-full border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-900/10">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          <CardTitle className="text-lg text-emerald-900 dark:text-emerald-300">
            Changes Committed
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-emerald-900 dark:text-emerald-300">
            Commit:
          </span>
          <Badge variant="secondary" className="font-mono text-xs">
            {commitSha.substring(0, 8)}
          </Badge>
        </div>
        <CommitPreview message={commitMessage} />
        <Button onClick={onDone} className="w-full">
          Done
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Editor Actions
// ---------------------------------------------------------------------------

function EditorActions({
  onRegenerate,
  onCancel,
  onCommit,
  isRegenerating,
  isCommitting,
  canCommit,
}: {
  onRegenerate: () => void;
  onCancel: () => void;
  onCommit: () => void;
  isRegenerating: boolean;
  isCommitting: boolean;
  canCommit: boolean;
}) {
  const disabled = isRegenerating || isCommitting;
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={onRegenerate}
        disabled={disabled}
        className="flex-1"
      >
        {isRegenerating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Regenerating...
          </>
        ) : (
          <>
            <RotateCcw className="mr-2 h-4 w-4" />
            Regenerate
          </>
        )}
      </Button>
      <Button variant="outline" onClick={onCancel} disabled={disabled}>
        Cancel
      </Button>
      <Button
        onClick={onCommit}
        disabled={disabled || !canCommit}
        className="flex-1"
      >
        {isCommitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Committing...
          </>
        ) : (
          <>
            <GitCommit className="mr-2 h-4 w-4" />
            Commit Changes
          </>
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CommitMessageEditor({
  taskId,
  initialMessage,
  onCommitted,
  onCancel,
}: CommitMessageEditorProps) {
  const [commitMessage, setCommitMessage] = useState(initialMessage);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitSha, setCommitSha] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  const handleRegenerate = async () => {
    try {
      setIsRegenerating(true);
      setError(null);
      const data = await regenerateMessage(taskId);
      setCommitMessage(data.commitMessage);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to regenerate message'
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCommit = async () => {
    try {
      setIsCommitting(true);
      setError(null);
      const data = await commitChanges(taskId, commitMessage);
      setCommitSha(data.commitSha);
      setTimeout(() => onCommitted?.(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to commit changes');
    } finally {
      setIsCommitting(false);
    }
  };

  if (commitSha) {
    return (
      <SuccessView
        commitSha={commitSha}
        commitMessage={commitMessage}
        onDone={() => onCommitted?.()}
      />
    );
  }

  const isDisabled = isRegenerating || isCommitting;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            <CardTitle className="text-lg">Commit Message</CardTitle>
          </div>
          {/* Edit/Preview toggle */}
          <div className="flex overflow-hidden rounded-md border">
            <button
              onClick={() => setMode('edit')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors',
                mode === 'edit'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
            <button
              onClick={() => setMode('preview')}
              className={cn(
                'flex items-center gap-1 border-l px-2.5 py-1 text-xs font-medium transition-colors',
                mode === 'preview'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Eye className="h-3 w-3" />
              Preview
            </button>
          </div>
        </div>
        <CardDescription>
          Review and edit the AI-generated commit message.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === 'edit' ? (
          <div className="space-y-2">
            <Textarea
              id="commit-message"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              disabled={isDisabled}
              className="min-h-[200px] font-mono text-sm"
              placeholder="Enter commit message..."
            />
            <p className="text-xs text-muted-foreground">
              Format:{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                type(scope): subject
              </code>
            </p>
          </div>
        ) : (
          <CommitPreview message={commitMessage} />
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <EditorActions
          onRegenerate={handleRegenerate}
          onCancel={() => onCancel?.()}
          onCommit={handleCommit}
          isRegenerating={isRegenerating}
          isCommitting={isCommitting}
          canCommit={!!commitMessage.trim()}
        />
      </CardContent>
    </Card>
  );
}
