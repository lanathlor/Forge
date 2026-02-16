'use client';

import { Badge } from '@/shared/components/ui/badge';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { TaskList } from './TaskList';
import { TaskDetailPanel } from './TaskDetailPanel';
import { PromptInput } from './PromptInput';
import { ErrorBoundary } from '@/shared/components/error';
import type { TaskUpdate } from '@/shared/hooks';

interface DashboardTasksTabProps {
  sessionId: string;
  connected: boolean;
  error: Error | null;
  reconnect: () => void;
  handleTaskCreated: (taskId: string) => void;
  selectedTaskId: string | null;
  handleSelectTask: (taskId: string | null) => void;
  updates: TaskUpdate[];
  refreshTrigger: number;
}

/**
 * Tasks tab content for the dashboard
 */
export function DashboardTasksTab({
  sessionId,
  connected,
  error,
  reconnect,
  handleTaskCreated,
  selectedTaskId,
  handleSelectTask,
  updates,
  refreshTrigger,
}: DashboardTasksTabProps) {
  return (
    <ErrorBoundary id="tasks-tab">
      {/* Connection Status Bar */}
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-card/50 transition-all duration-300 hover:bg-card hover:shadow-sm"
        role="status"
        aria-live="polite"
        aria-label={connected ? 'Connected to server' : error ? 'Disconnected from server' : 'Connecting to server'}
      >
        <div className="flex items-center gap-2 flex-shrink-0">
          {connected ? (
            <>
              <Wifi className="h-4 w-4 text-green-600" aria-hidden="true" />
              <span className="text-xs text-green-600 hidden sm:inline">Connected</span>
            </>
          ) : error ? (
            <>
              <WifiOff className="h-4 w-4 text-red-600" aria-hidden="true" />
              <button
                onClick={reconnect}
                className="text-xs text-red-600 underline focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 rounded"
                aria-label="Reconnect to server"
              >
                Reconnect
              </button>
            </>
          ) : (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
              <span className="text-xs text-muted-foreground hidden sm:inline">Connecting...</span>
            </>
          )}
        </div>
        <Badge variant="secondary" className="text-xs" aria-label={`Session ID: ${sessionId.slice(0, 8)}`}>
          Session: {sessionId.slice(0, 8)}
        </Badge>
      </div>

      <PromptInput sessionId={sessionId} onTaskCreated={handleTaskCreated} />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-hidden">
          <ErrorBoundary id="task-list">
            <TaskList
              sessionId={sessionId}
              selectedTaskId={selectedTaskId}
              onSelectTask={handleSelectTask}
              updates={updates}
              refreshTrigger={refreshTrigger}
            />
          </ErrorBoundary>
        </div>
        <ErrorBoundary id="task-detail">
          <TaskDetailPanel
            taskId={selectedTaskId || ''}
            updates={updates}
            open={!!selectedTaskId}
            onClose={() => handleSelectTask(null)}
          />
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}
