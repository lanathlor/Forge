'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { CheckCircle, XCircle, Loader2, FileText, Plus, Minus } from 'lucide-react';
import { CommitMessageEditor } from './CommitMessageEditor';

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

function FileStatistics({ filesChanged }: { filesChanged: FileChange[] }) {
  const fileCount = filesChanged.length;
  const insertions = filesChanged.reduce((sum, f) => sum + f.additions, 0);
  const deletions = filesChanged.reduce((sum, f) => sum + f.deletions, 0);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span>{fileCount} file{fileCount === 1 ? '' : 's'} changed</span>
      </div>
      <div className="flex items-center gap-4 text-sm ml-6">
        <div className="flex items-center gap-1 text-green-600"><Plus className="h-3 w-3" /><span>{insertions}</span></div>
        <div className="flex items-center gap-1 text-red-600"><Minus className="h-3 w-3" /><span>{deletions}</span></div>
      </div>
    </div>
  );
}

function ActionButtons({ onApprove, onReject, isLoading, qaGatesPassed }: { onApprove: () => void; onReject: () => void; isLoading: boolean; qaGatesPassed: boolean }) {
  return (
    <div className="flex gap-2 pt-2">
      <Button variant="outline" onClick={onReject} disabled={isLoading} className="flex-1">Reject & Revert</Button>
      <Button onClick={onApprove} disabled={isLoading || !qaGatesPassed} className="flex-1">
        {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating...</> : 'Approve Changes'}
      </Button>
    </div>
  );
}

async function approveTask(taskId: string) {
  const res = await fetch(`/api/tasks/${taskId}/approve`, { method: 'POST' });
  if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to generate commit message'); }
  return res.json();
}

async function rejectTask(taskId: string, reason: string | null) {
  const res = await fetch(`/api/tasks/${taskId}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
  if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to reject task'); }
}

function ReviewPanel({ filesChanged, qaGatesPassed, error, isLoading, onApprove, onReject }: { filesChanged: FileChange[]; qaGatesPassed: boolean; error: string | null; isLoading: boolean; onApprove: () => void; onReject: () => void }) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          {qaGatesPassed ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
          Review Changes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">QA Gates:</span>
          <Badge variant={qaGatesPassed ? 'default' : 'destructive'}>{qaGatesPassed ? 'All Passed' : 'Failed'}</Badge>
        </div>
        <FileStatistics filesChanged={filesChanged} />
        {error && <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>}
        <ActionButtons onApprove={onApprove} onReject={onReject} isLoading={isLoading} qaGatesPassed={qaGatesPassed} />
        {!qaGatesPassed && <p className="text-xs text-muted-foreground text-center">Fix QA gate failures before approving</p>}
      </CardContent>
    </Card>
  );
}

export function ApprovalPanel({ taskId, filesChanged, qaGatesPassed = true, onApproved, onRejected }: ApprovalPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    try { setIsLoading(true); setError(null); const data = await approveTask(taskId); setCommitMessage(data.commitMessage); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to generate commit message'); }
    finally { setIsLoading(false); }
  };

  const handleReject = async () => {
    try { await rejectTask(taskId, prompt('Reason for rejection (optional):')); onRejected?.(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to reject task'); }
  };

  if (commitMessage) return <CommitMessageEditor taskId={taskId} initialMessage={commitMessage} onCommitted={() => onApproved?.()} onCancel={() => { setCommitMessage(null); setError(null); }} />;
  return <ReviewPanel filesChanged={filesChanged} qaGatesPassed={qaGatesPassed} error={error} isLoading={isLoading} onApprove={handleApprove} onReject={handleReject} />;
}
