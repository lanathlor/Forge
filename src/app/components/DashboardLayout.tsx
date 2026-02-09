'use client';

import { useState, useCallback } from 'react';
import { useTaskStream } from '@/shared/hooks';
import { TaskTimeline } from './TaskTimeline';
import { TaskDetailsPanel } from './TaskDetailsPanel';
import { PromptInput } from './PromptInput';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

interface DashboardLayoutProps {
  sessionId: string;
  repositoryName: string;
}

/**
 * Main Dashboard Layout Component
 * Implements 3-column layout for desktop, stacked for mobile:
 * - Repository info (top on mobile)
 * - Task timeline (middle on mobile)
 * - Task details panel (bottom on mobile)
 *
 * Features:
 * - Real-time updates via SSE
 * - Mobile-responsive layout
 * - Connection status indicator
 */
/* eslint-disable max-lines-per-function */
export function DashboardLayout({ sessionId, repositoryName }: DashboardLayoutProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { updates, connected, error, reconnect } = useTaskStream(sessionId);

  const handleTaskCreated = useCallback((taskId: string) => {
    // Auto-select the newly created task
    setSelectedTaskId(taskId);
    // Trigger refresh in TaskTimeline
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Connection Status Bar - Mobile & Desktop */}
      <div className="flex items-center justify-between gap-2 p-2 sm:p-3 rounded-lg border bg-card">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm sm:text-base truncate">
            {repositoryName}
          </h2>
          <Badge variant="secondary" className="text-xs">
            {sessionId.slice(0, 8)}
          </Badge>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {connected ? (
            <>
              <Wifi className="h-4 w-4 text-green-600" />
              <span className="text-xs text-green-600 hidden sm:inline">
                Connected
              </span>
            </>
          ) : error ? (
            <>
              <WifiOff className="h-4 w-4 text-red-600" />
              <button
                onClick={reconnect}
                className="text-xs text-red-600 underline"
              >
                Reconnect
              </button>
            </>
          ) : (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Connecting...
              </span>
            </>
          )}
        </div>
      </div>

      {/* Prompt Input - Full Width */}
      <PromptInput sessionId={sessionId} onTaskCreated={handleTaskCreated} />

      {/* Main Layout - Responsive Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
        {/* Task Timeline - Full width on mobile, left column on desktop */}
        <div className="lg:col-span-4 xl:col-span-3 h-[40vh] lg:h-full overflow-hidden">
          <TaskTimeline
            sessionId={sessionId}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
            updates={updates}
            refreshTrigger={refreshTrigger}
          />
        </div>

        {/* Task Details Panel - Full width on mobile, main area on desktop */}
        <div className="lg:col-span-8 xl:col-span-9 h-[60vh] lg:h-full overflow-hidden">
          {selectedTaskId ? (
            <TaskDetailsPanel
              taskId={selectedTaskId}
              updates={updates}
            />
          ) : (
            <Card className="h-full">
              <CardContent className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="space-y-3">
                  <div className="text-4xl">👈</div>
                  <h3 className="text-lg font-semibold">Select a Task</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Choose a task from the timeline to view its details,
                    output, diff, and QA gate results
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
