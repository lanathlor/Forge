'use client';

import { useState, useEffect, useRef, type JSX } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui/tabs';
import { Badge } from '@/shared/components/ui/badge';
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { DiffViewer } from '@/features/diff-viewer/components/DiffViewer';
import { QAGateResults } from '@/features/qa-gates/components/QAGateResults';
import { ApprovalPanel } from './ApprovalPanel';
import type { TaskUpdate } from '@/shared/hooks/useTaskStream';
import type { FileChange } from '@/db/schema/tasks';

interface Task { id: string; prompt: string; status: string; claudeOutput?: string | null; createdAt: string; startedAt?: string | null; completedAt?: string | null; diffContent?: string | null; filesChanged?: FileChange[] | null; commitMessage?: string | null; }
interface TaskDetailsPanelProps { taskId: string; updates: TaskUpdate[]; }

const STATUS_ICONS: Record<string, JSX.Element> = {
  completed: <CheckCircle className="h-5 w-5 text-green-600" />, failed: <XCircle className="h-5 w-5 text-red-600" />, rejected: <XCircle className="h-5 w-5 text-red-600" />,
  qa_failed: <XCircle className="h-5 w-5 text-red-600" />, running: <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />, qa_running: <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />, waiting_approval: <AlertCircle className="h-5 w-5 text-yellow-600" />,
};

function LoadingState() { return <Card className="h-full"><CardContent className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></CardContent></Card>; }
function NotFoundState() { return <Card className="h-full"><CardContent className="flex items-center justify-center h-full"><p className="text-muted-foreground">Task not found</p></CardContent></Card>; }
function OutputTab({ output, status, outputEndRef }: { output: string; status: string; outputEndRef: React.RefObject<HTMLDivElement | null> }) {
  return <div className="h-full border rounded-lg bg-muted/50 overflow-y-auto"><div className="p-4 font-mono text-xs sm:text-sm">{output ? <><pre className="whitespace-pre-wrap break-words">{output}</pre><div ref={outputEndRef} /></> : <p className="text-muted-foreground italic">{status === 'running' ? 'Waiting for output...' : 'No output available'}</p>}</div></div>;
}

function DiffTab({ taskId, hasDiff }: { taskId: string; hasDiff: boolean }) {
  if (hasDiff) return <DiffViewer taskId={taskId} />;
  return <div className="h-full border rounded-lg flex items-center justify-center"><p className="text-muted-foreground text-sm">No changes yet</p></div>;
}

function TaskHeader({ task }: { task: Task }) {
  return (
    <CardHeader className="flex-shrink-0 pb-3"><div className="flex items-start justify-between gap-4 flex-wrap"><div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-2">{STATUS_ICONS[task.status]}<Badge variant="secondary" className="text-xs">{task.status.replace('_', ' ')}</Badge></div>
      <CardTitle className="text-base sm:text-lg break-words">{task.prompt}</CardTitle>
    </div></div></CardHeader>
  );
}

function TaskTabs({ task, taskId, output, outputEndRef, onReload }: { task: Task; taskId: string; output: string; outputEndRef: React.RefObject<HTMLDivElement | null>; onReload: () => void }) {
  return (
    <Tabs defaultValue={task.status === 'waiting_approval' ? 'approval' : 'output'} className="h-full flex flex-col">
      <TabsList className="flex-shrink-0 w-full sm:w-auto"><TabsTrigger value="output" className="flex-1 sm:flex-none">Output</TabsTrigger><TabsTrigger value="diff" className="flex-1 sm:flex-none">Diff</TabsTrigger><TabsTrigger value="qa" className="flex-1 sm:flex-none">QA Gates</TabsTrigger>{task.status === 'waiting_approval' && <TabsTrigger value="approval" className="flex-1 sm:flex-none">Approval</TabsTrigger>}</TabsList>
      <TabsContent value="output" className="flex-1 mt-4 overflow-hidden"><OutputTab output={output} status={task.status} outputEndRef={outputEndRef} /></TabsContent>
      <TabsContent value="diff" className="flex-1 mt-4 overflow-hidden"><DiffTab taskId={taskId} hasDiff={!!(task.diffContent || task.filesChanged)} /></TabsContent>
      <TabsContent value="qa" className="flex-1 mt-4 overflow-y-auto"><QAGateResults taskId={taskId} /></TabsContent>
      {task.status === 'waiting_approval' && task.filesChanged && <TabsContent value="approval" className="flex-1 mt-4 overflow-y-auto"><ApprovalPanel taskId={taskId} filesChanged={task.filesChanged} qaGatesPassed onApproved={onReload} onRejected={onReload} /></TabsContent>}
    </Tabs>
  );
}

function useTaskLoader(taskId: string) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [output, setOutput] = useState('');

  const loadTask = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setTask(data.task);
        // Set initial output from database
        setOutput(data.task.claudeOutput || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset output when taskId changes
    setOutput('');
    setTask(null);
    loadTask();
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { task, setTask, loading, output, setOutput, loadTask };
}

function useOutputUpdates(updates: TaskUpdate[], taskId: string, setOutput: React.Dispatch<React.SetStateAction<string>>, outputEndRef: React.RefObject<HTMLDivElement | null>) {
  const processedCountRef = useRef(0);
  const currentTaskIdRef = useRef(taskId);

  useEffect(() => {
    // Reset processed count when task changes
    if (currentTaskIdRef.current !== taskId) {
      currentTaskIdRef.current = taskId;
      processedCountRef.current = 0;
    }

    // Filter updates for this specific task
    const outputUpdates = updates.filter((x) => x.type === 'task_output' && x.taskId === taskId);

    // Only process new updates we haven't seen yet
    const newUpdates = outputUpdates.slice(processedCountRef.current);

    if (newUpdates.length > 0) {
      const newOutput = newUpdates.map((x) => x.output || '').join('');
      setOutput(prev => prev + newOutput);
      processedCountRef.current = outputUpdates.length;

      setTimeout(() => {
        outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [updates, taskId, setOutput, outputEndRef]);
}

function useStatusUpdates(updates: TaskUpdate[], taskId: string, task: Task | null, setTask: React.Dispatch<React.SetStateAction<Task | null>>, loadTask: () => Promise<void>) {
  useEffect(() => {
    const statusUpdates = updates.filter((x) => x.type === 'task_update' && x.taskId === taskId);
    const latestUpdate = statusUpdates[statusUpdates.length - 1];
    if (latestUpdate?.status && task && task.status !== latestUpdate.status) {
      setTask({ ...task, status: latestUpdate.status });
      if (['waiting_qa', 'waiting_approval', 'completed', 'failed', 'approved'].includes(latestUpdate.status)) setTimeout(() => loadTask(), 500);
    }
  }, [updates, taskId, task, setTask, loadTask]);
}

export function TaskDetailsPanel({ taskId, updates }: TaskDetailsPanelProps) {
  const outputEndRef = useRef<HTMLDivElement>(null);
  const { task, setTask, loading, output, setOutput, loadTask } = useTaskLoader(taskId);
  useOutputUpdates(updates, taskId, setOutput, outputEndRef);
  useStatusUpdates(updates, taskId, task, setTask, loadTask);
  if (loading) return <LoadingState />;
  if (!task) return <NotFoundState />;
  return <Card className="h-full flex flex-col"><TaskHeader task={task} /><CardContent className="flex-1 overflow-hidden"><TaskTabs task={task} taskId={taskId} output={output} outputEndRef={outputEndRef} onReload={loadTask} /></CardContent></Card>;
}
