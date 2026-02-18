import { Badge } from '@/shared/components/ui/badge';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { ErrorBoundary } from '@/shared/components/error';
import { TaskList } from '../TaskList';
import { TaskDetailPanel } from '../TaskDetailPanel';
import { PromptInput } from '../PromptInput';
import type { TaskUpdate } from '@/shared/hooks';

interface TasksTabContentProps {
  sessionId: string;
  connected: boolean;
  error: unknown;
  reconnect: () => void;
  selectedTaskId: string | null;
  handleSelectTask: (taskId: string | null) => void;
  updates: TaskUpdate[];
  refreshTrigger: number;
  handleTaskCreated: (taskId: string) => void;
}

export function TasksTabContent({
  sessionId,
  connected,
  error,
  reconnect,
  selectedTaskId,
  handleSelectTask,
  updates,
  refreshTrigger,
  handleTaskCreated,
}: TasksTabContentProps) {
  return (
    <ErrorBoundary id="tasks-tab">
      <div className="flex h-full flex-col gap-3">
        {/* Connection Status Bar */}
        <div
          className="flex flex-shrink-0 items-center justify-between gap-2 rounded-lg border bg-card/50 px-3 py-2 transition-all duration-300 hover:bg-card hover:shadow-sm"
          role="status"
          aria-live="polite"
          aria-label={
            connected
              ? 'Connected to server'
              : error
                ? 'Disconnected from server'
                : 'Connecting to server'
          }
        >
          <div className="flex flex-shrink-0 items-center gap-2">
            {connected ? (
              <>
                <Wifi className="h-4 w-4 text-green-600" aria-hidden="true" />
                <span className="hidden text-xs text-green-600 sm:inline">
                  Connected
                </span>
              </>
            ) : error ? (
              <>
                <WifiOff className="h-4 w-4 text-red-600" aria-hidden="true" />
                <button
                  onClick={reconnect}
                  className="rounded text-xs text-red-600 underline focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
                  aria-label="Reconnect to server"
                >
                  Reconnect
                </button>
              </>
            ) : (
              <>
                <Loader2
                  className="h-4 w-4 animate-spin text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  Connecting...
                </span>
              </>
            )}
          </div>
          <Badge
            variant="secondary"
            className="text-xs"
            aria-label={`Session ID: ${sessionId.slice(0, 8)}`}
          >
            Session: {sessionId.slice(0, 8)}
          </Badge>
        </div>

        <div className="flex-shrink-0">
          <PromptInput sessionId={sessionId} onTaskCreated={handleTaskCreated} />
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="min-w-0 flex-1 overflow-hidden">
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
      </div>
    </ErrorBoundary>
  );
}
