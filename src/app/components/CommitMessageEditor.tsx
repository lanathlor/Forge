'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Textarea } from '@/shared/components/ui/textarea';
import { Badge } from '@/shared/components/ui/badge';
import { Loader2, CheckCircle2, RotateCcw, GitCommit } from 'lucide-react';

interface CommitMessageEditorProps { taskId: string; initialMessage: string; onCommitted?: () => void; onCancel?: () => void; }

function SuccessView({ commitSha, commitMessage, onDone }: { commitSha: string; commitMessage: string; onDone: () => void }) {
  return (
    <Card className="w-full border-green-200 bg-green-50">
      <CardHeader><div className="flex items-center gap-2"><CheckCircle2 className="h-6 w-6 text-green-600" /><CardTitle className="text-lg text-green-900">Changes Committed Successfully</CardTitle></div></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2"><div className="text-sm font-medium text-green-900">Commit SHA:</div><Badge variant="secondary" className="font-mono text-xs">{commitSha.substring(0, 8)}</Badge></div>
        <div className="space-y-2"><div className="text-sm font-medium text-green-900">Commit Message:</div><div className="p-3 rounded-md bg-white border border-green-200"><pre className="text-xs whitespace-pre-wrap text-green-900">{commitMessage}</pre></div></div>
        <Button onClick={onDone} className="w-full">Done</Button>
      </CardContent>
    </Card>
  );
}

function EditorActions({ onRegenerate, onCancel, onCommit, isRegenerating, isCommitting, canCommit }: { onRegenerate: () => void; onCancel: () => void; onCommit: () => void; isRegenerating: boolean; isCommitting: boolean; canCommit: boolean }) {
  const disabled = isRegenerating || isCommitting;
  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={onRegenerate} disabled={disabled} className="flex-1">{isRegenerating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Regenerating...</> : <><RotateCcw className="h-4 w-4 mr-2" />Regenerate</>}</Button>
      <Button variant="outline" onClick={onCancel} disabled={disabled}>Cancel</Button>
      <Button onClick={onCommit} disabled={disabled || !canCommit} className="flex-1">{isCommitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Committing...</> : <><GitCommit className="h-4 w-4 mr-2" />Commit Changes</>}</Button>
    </div>
  );
}

async function regenerateMessage(taskId: string) {
  const res = await fetch(`/api/tasks/${taskId}/regenerate-message`, { method: 'POST' });
  if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to regenerate commit message'); }
  return res.json();
}

async function commitChanges(taskId: string, message: string) {
  const res = await fetch(`/api/tasks/${taskId}/commit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commitMessage: message }) });
  if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to commit changes'); }
  return res.json();
}

function EditorForm({ commitMessage, onChange, isDisabled, error, actions }: { commitMessage: string; onChange: (v: string) => void; isDisabled: boolean; error: string | null; actions: React.ReactNode }) {
  return (
    <Card className="w-full">
      <CardHeader><div className="flex items-center gap-2"><GitCommit className="h-5 w-5" /><CardTitle className="text-lg">Review Commit Message</CardTitle></div><CardDescription>Review and edit the AI-generated commit message.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2"><label htmlFor="commit-message" className="text-sm font-medium">Commit Message</label><Textarea id="commit-message" value={commitMessage} onChange={(e) => onChange(e.target.value)} disabled={isDisabled} className="font-mono text-sm min-h-[200px]" placeholder="Enter commit message..." /><p className="text-xs text-muted-foreground">Format: <code className="text-xs bg-muted px-1 py-0.5 rounded">type(scope): subject</code></p></div>
        {error && <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>}
        {actions}
      </CardContent>
    </Card>
  );
}

export function CommitMessageEditor({ taskId, initialMessage, onCommitted, onCancel }: CommitMessageEditorProps) {
  const [commitMessage, setCommitMessage] = useState(initialMessage);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitSha, setCommitSha] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRegenerate = async () => {
    try { setIsRegenerating(true); setError(null); const data = await regenerateMessage(taskId); setCommitMessage(data.commitMessage); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to regenerate message'); }
    finally { setIsRegenerating(false); }
  };

  const handleCommit = async () => {
    try { setIsCommitting(true); setError(null); const data = await commitChanges(taskId, commitMessage); setCommitSha(data.commitSha); setTimeout(() => onCommitted?.(), 2000); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to commit changes'); }
    finally { setIsCommitting(false); }
  };

  if (commitSha) return <SuccessView commitSha={commitSha} commitMessage={commitMessage} onDone={() => onCommitted?.()} />;
  return <EditorForm commitMessage={commitMessage} onChange={setCommitMessage} isDisabled={isRegenerating || isCommitting} error={error} actions={<EditorActions onRegenerate={handleRegenerate} onCancel={() => onCancel?.()} onCommit={handleCommit} isRegenerating={isRegenerating} isCommitting={isCommitting} canCommit={!!commitMessage.trim()} />} />;
}
