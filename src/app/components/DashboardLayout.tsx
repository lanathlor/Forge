'use client';

import { useState, useCallback } from 'react';
import { useTaskStream } from '@/shared/hooks';
import { TaskList } from './TaskList';
import { TaskDetailsPanel } from './TaskDetailsPanel';
import { PromptInput } from './PromptInput';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useGetSessionQuery } from '@/features/sessions/store/sessionsApi';
import {
  SessionHeader,
  SessionHistoryModal,
  SessionSummaryModal,
} from '@/features/sessions/components';
import { PlanList, PlanExecutionView, PlanIterationChat } from '@/features/plans/components';

interface DashboardLayoutProps {
  sessionId: string;
  repositoryId: string;
  repositoryName: string;
  onSessionEnded?: () => void;
}

/**
 * Main Dashboard Layout Component
 * Implements 3-column layout for desktop, stacked for mobile:
 * - Session header (top)
 * - Connection status & prompt input
 * - Task timeline (left on desktop)
 * - Task details panel (right on desktop)
 *
 * Features:
 * - Real-time updates via SSE
 * - Mobile-responsive layout
 * - Session management (pause, resume, end)
 * - Session history and summary modals
 */
 
export function DashboardLayout({
  sessionId,
  repositoryId,
  repositoryName,
  onSessionEnded,
}: DashboardLayoutProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'plans'>('tasks');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planView, setPlanView] = useState<'list' | 'execution'>('list');
  const [reviewPlanId, setReviewPlanId] = useState<string | null>(null);

  const { data: sessionData } = useGetSessionQuery(sessionId);
  const { updates, connected, error, reconnect } = useTaskStream(sessionId);

  const session = sessionData?.session;

  const handleTaskCreated = useCallback((taskId: string) => {
    // Auto-select the newly created task
    setSelectedTaskId(taskId);
    // Trigger refresh in TaskTimeline
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleSessionEnded = useCallback(() => {
    setShowSummaryModal(true);
    onSessionEnded?.();
  }, [onSessionEnded]);

  const handleSelectSession = useCallback((_newSessionId: string) => {
    // Reload to switch to the new session
    // A more elegant solution would be to update the parent state
    window.location.reload();
  }, []);

  const handleNewSession = useCallback(() => {
    // Reload to create a new session
    onSessionEnded?.();
  }, [onSessionEnded]);

  const handleViewPlan = useCallback((planId: string) => {
    setSelectedPlanId(planId);
    setPlanView('execution');
  }, []);

  const handleBackToList = useCallback(() => {
    setPlanView('list');
    setSelectedPlanId(null);
  }, []);

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Session Header with controls */}
      {session && (
        <SessionHeader
          session={session}
          repositoryName={repositoryName}
          onOpenHistory={() => setShowHistoryModal(true)}
          onOpenSummary={() => setShowSummaryModal(true)}
          onSessionEnded={handleSessionEnded}
        />
      )}

      {/* Tabs for switching between Tasks and Plans */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'tasks' | 'plans')} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mb-3">
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
        </TabsList>

        {/* Tasks Tab Content */}
        <TabsContent value="tasks" className="flex-1 flex flex-col gap-3 overflow-hidden mt-0 data-[state=inactive]:hidden">
          {/* Connection Status Bar */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-card/50">
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

            <Badge variant="secondary" className="text-xs">
              Session: {sessionId.slice(0, 8)}
            </Badge>
          </div>

          {/* Prompt Input - Full Width */}
          <PromptInput sessionId={sessionId} onTaskCreated={handleTaskCreated} />

          {/* Main Layout - Responsive Grid */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
            {/* Task List - Full width on mobile, left column on desktop */}
            <div className="lg:col-span-4 xl:col-span-3 h-[40vh] lg:h-full overflow-hidden">
              <TaskList
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
        </TabsContent>

        {/* Plans Tab Content */}
        <TabsContent value="plans" className="flex-1 overflow-auto mt-0 data-[state=inactive]:hidden">
          {planView === 'list' ? (
            <PlanList
              repositoryId={repositoryId}
              onViewPlan={handleViewPlan}
            />
          ) : selectedPlanId ? (
            <div className="space-y-4">
              <button
                onClick={handleBackToList}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ← Back to Plans
              </button>
              <PlanExecutionView
                planId={selectedPlanId}
                onReview={(planId) => setReviewPlanId(planId)}
              />
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      {/* Session History Modal */}
      <SessionHistoryModal
        repositoryId={repositoryId}
        repositoryName={repositoryName}
        currentSessionId={sessionId}
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        onSelectSession={handleSelectSession}
      />

      {/* Session Summary Modal */}
      <SessionSummaryModal
        sessionId={sessionId}
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        onNewSession={handleNewSession}
      />

      {/* Plan Iteration Chat */}
      <PlanIterationChat
        planId={reviewPlanId}
        open={!!reviewPlanId}
        onOpenChange={(open) => !open && setReviewPlanId(null)}
      />
    </div>
  );
}
