'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { format } from 'date-fns';
import { Clock, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface Task {
  id: string;
  prompt: string;
  status: string;
  createdAt: string;
  completedAt?: string | null;
  startedAt?: string | null;
}

interface Session {
  id: string;
  repositoryId: string;
  status: string;
  startedAt: string;
}

interface TaskTimelineProps {
  sessionId: string;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  updates?: Array<Record<string, unknown>>;
  refreshTrigger?: number;
}

/**
 * Task Timeline Component
 * Displays all tasks in a session with their current status
 * Mobile-responsive: Stacks vertically on small screens
 */
/* eslint-disable max-lines-per-function */
export function TaskTimeline({
  sessionId,
  selectedTaskId,
  onSelectTask,
  updates = [],
  refreshTrigger = 0,
}: TaskTimelineProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessionTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, refreshTrigger]);

  // Update task statuses based on SSE updates
  useEffect(() => {
    const latestUpdate = updates[updates.length - 1];
    if (latestUpdate?.type === 'task_update' && latestUpdate.taskId && typeof latestUpdate.status === 'string') {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === latestUpdate.taskId
            ? { ...task, status: latestUpdate.status as string }
            : task
        )
      );
    }
  }, [updates]);

  async function loadSessionTasks() {
    try {
      setLoading(true);
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) throw new Error('Failed to load session');

      const data = await res.json();
      setSession(data.session);
      setTasks(data.session.tasks || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
      case 'rejected':
      case 'qa_failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running':
      case 'qa_running':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'waiting_approval':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'failed':
      case 'rejected':
      case 'qa_failed':
        return 'destructive';
      case 'running':
      case 'qa_running':
        return 'secondary';
      case 'waiting_approval':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const truncatePrompt = (prompt: string, maxLength: number = 60) => {
    if (prompt.length <= maxLength) return prompt;
    return prompt.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Task Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg">
            Task Timeline
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadSessionTasks}
            className="h-8"
          >
            Refresh
          </Button>
        </div>
        {session && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Session started {format(new Date(session.startedAt), 'PPp')}
          </p>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto space-y-2 sm:space-y-3">
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No tasks yet</p>
            <p className="text-xs mt-1">Submit a prompt to get started</p>
          </div>
        ) : (
          tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => onSelectTask(task.id)}
              className={`w-full text-left p-3 sm:p-4 rounded-lg border transition-all duration-200 ${
                selectedTaskId === task.id
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="mt-0.5 flex-shrink-0">{getStatusIcon(task.status)}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge
                      variant={getStatusVariant(task.status)}
                      className="text-xs"
                    >
                      {task.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(task.createdAt), 'HH:mm')}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-foreground break-words">
                    {truncatePrompt(task.prompt)}
                  </p>

                  {task.completedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Completed {format(new Date(task.completedAt), 'HH:mm:ss')}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}
