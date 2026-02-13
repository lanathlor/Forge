'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTaskStream } from '@/shared/hooks';
import { TaskList } from './TaskList';
import { TaskDetailPanel } from './TaskDetailPanel';
import { PromptInput } from './PromptInput';
import { Badge } from '@/shared/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useGetSessionQuery } from '@/features/sessions/store/sessionsApi';
import {
  SessionControlsBar,
  SessionHistoryModal,
  SessionSummaryModal,
  SessionSummary,
} from '@/features/sessions/components';
import {
  PlanList,
  PlanDetailView,
  PlanExecutionView,
  PlanRefinementChat,
  PlanLaunchDialog,
  LivePlanMonitor,
} from '@/features/plans/components';
import { useGetPlansQuery } from '@/features/plans/store/plansApi';
import { QAGatesConfig } from '@/features/repositories/components';
import type { Plan } from '@/db/schema';

interface DashboardLayoutProps {
  sessionId: string;
  repositoryId: string;
  repositoryName: string;
  initialTaskId?: string | null;
  onInitialTaskConsumed?: () => void;
  onTaskSelected?: (taskId: string | null) => void;
  onTabChanged?: (tab: 'tasks' | 'plans' | 'qa-gates') => void;
  onSessionEnded?: () => void;
}

/**
 * Main Dashboard Layout Component
 *
 * Features:
 * - Real-time updates via SSE
 * - One-click plan launch with pre-flight checks
 * - Live plan monitoring across tabs
 * - Launch & Switch for multi-repo workflows
 * - Mobile-responsive layout
 * - Session management (pause, resume, end)
 */

export function DashboardLayout({
  sessionId,
  repositoryId,
  repositoryName,
  initialTaskId,
  onInitialTaskConsumed,
  onTaskSelected,
  onTabChanged,
  onSessionEnded,
}: DashboardLayoutProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'plans' | 'summary' | 'qa-gates'>('tasks');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planView, setPlanView] = useState<'list' | 'detail' | 'execution'>('list');
  const [reviewPlanId, setReviewPlanId] = useState<string | null>(null);

  // Launch dialog state
  const [launchPlan, setLaunchPlan] = useState<Plan | null>(null);
  const [showLaunchDialog, setShowLaunchDialog] = useState(false);

  const { data: sessionData } = useGetSessionQuery(sessionId);
  const { updates, connected, error, reconnect } = useTaskStream(sessionId);
  const { data: plansData } = useGetPlansQuery(repositoryId, {
    pollingInterval: 5000,
    skipPollingIfUnfocused: true,
  });

  const session = sessionData?.session;

  // Count active plans for the tab badge
  const activePlanCount = useMemo(() => {
    if (!plansData?.plans) return 0;
    return plansData.plans.filter(p => p.status === 'running' || p.status === 'paused').length;
  }, [plansData]);

  // Navigate to initial task from snapshot resume
  useEffect(() => {
    if (initialTaskId) {
      setSelectedTaskId(initialTaskId);
      onInitialTaskConsumed?.();
    }
  }, [initialTaskId, onInitialTaskConsumed]);

  // Report task selection to parent for snapshot tracking
  const handleSelectTask = useCallback((taskId: string | null) => {
    setSelectedTaskId(taskId);
    onTaskSelected?.(taskId);
  }, [onTaskSelected]);

  // Report tab changes to parent for snapshot tracking
  const handleTabChange = useCallback((tab: string) => {
    const typedTab = tab as 'tasks' | 'plans' | 'summary' | 'qa-gates';
    setActiveTab(typedTab);
    if (typedTab === 'tasks' || typedTab === 'plans' || typedTab === 'qa-gates') {
      onTabChanged?.(typedTab);
    }
  }, [onTabChanged]);

  const handleTaskCreated = useCallback((taskId: string) => {
    handleSelectTask(taskId);
    setRefreshTrigger((prev) => prev + 1);
  }, [handleSelectTask]);

  const handleSessionEnded = useCallback(() => {
    setShowSummaryModal(true);
    onSessionEnded?.();
  }, [onSessionEnded]);

  const handleSelectSession = useCallback((_newSessionId: string) => {
    window.location.reload();
  }, []);

  const handleNewSession = useCallback(() => {
    onSessionEnded?.();
  }, [onSessionEnded]);

  // Plan view navigation
  const handleViewPlan = useCallback((planId: string) => {
    setSelectedPlanId(planId);
    setPlanView('detail');
  }, []);

  const handleViewExecution = useCallback((planId: string) => {
    setSelectedPlanId(planId);
    setPlanView('execution');
    // Switch to plans tab if not already there
    if (activeTab !== 'plans') {
      handleTabChange('plans');
    }
  }, [activeTab, handleTabChange]);

  const handleBackToList = useCallback(() => {
    setPlanView('list');
    setSelectedPlanId(null);
  }, []);

  // Launch flow
  const handleOpenLaunch = useCallback((planId: string) => {
    const plan = plansData?.plans.find(p => p.id === planId);
    if (plan) {
      setLaunchPlan(plan);
      setShowLaunchDialog(true);
    }
  }, [plansData]);

  const handleLaunched = useCallback((planId: string) => {
    // Navigate to execution view after launch
    setSelectedPlanId(planId);
    setPlanView('execution');
    handleTabChange('plans');
  }, [handleTabChange]);

  const handleLaunchAndSwitch = useCallback((_planId: string) => {
    // Stay on current tab (tasks) - plan runs in background
    // The LivePlanMonitor will show the running plan
    setShowLaunchDialog(false);
  }, []);

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Session Controls Bar */}
      {session && (
        <SessionControlsBar
          session={session}
          repositoryName={repositoryName}
          onOpenHistory={() => setShowHistoryModal(true)}
          onSessionEnded={handleSessionEnded}
        />
      )}

      {/* Live Plan Monitor - always visible when plans are running */}
      <LivePlanMonitor
        repositoryId={repositoryId}
        onViewExecution={handleViewExecution}
        onViewPlan={handleViewPlan}
        className="flex-shrink-0"
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mb-3">
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="plans" className="gap-1.5">
            Plans
            {activePlanCount > 0 && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="qa-gates">QA Gates</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="flex-1 flex flex-col gap-3 overflow-hidden mt-0 data-[state=inactive]:hidden">
          {/* Connection Status Bar */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-card/50">
            <div className="flex items-center gap-2 flex-shrink-0">
              {connected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-green-600 hidden sm:inline">Connected</span>
                </>
              ) : error ? (
                <>
                  <WifiOff className="h-4 w-4 text-red-600" />
                  <button onClick={reconnect} className="text-xs text-red-600 underline">
                    Reconnect
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground hidden sm:inline">Connecting...</span>
                </>
              )}
            </div>
            <Badge variant="secondary" className="text-xs">
              Session: {sessionId.slice(0, 8)}
            </Badge>
          </div>

          <PromptInput sessionId={sessionId} onTaskCreated={handleTaskCreated} />

          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 min-w-0 overflow-hidden">
              <TaskList
                sessionId={sessionId}
                selectedTaskId={selectedTaskId}
                onSelectTask={handleSelectTask}
                updates={updates}
                refreshTrigger={refreshTrigger}
              />
            </div>
            <TaskDetailPanel
              taskId={selectedTaskId || ''}
              updates={updates}
              open={!!selectedTaskId}
              onClose={() => handleSelectTask(null)}
            />
          </div>
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans" className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
          {planView === 'list' ? (
            <div className="h-full overflow-auto">
              <PlanList
                repositoryId={repositoryId}
                onViewPlan={handleViewPlan}
                onLaunchPlan={handleOpenLaunch}
              />
            </div>
          ) : planView === 'execution' && selectedPlanId ? (
            <div className="h-full overflow-hidden">
              <PlanExecutionView
                planId={selectedPlanId}
                onBack={handleBackToList}
                onReview={(planId) => setReviewPlanId(planId)}
              />
            </div>
          ) : planView === 'detail' && selectedPlanId ? (
            <div className="h-full flex overflow-hidden">
              <div className="flex-1 overflow-auto min-w-0">
                <PlanDetailView
                  planId={selectedPlanId}
                  onBack={handleBackToList}
                  onReview={(planId) => setReviewPlanId(planId)}
                  onLaunch={handleOpenLaunch}
                  onViewExecution={handleViewExecution}
                />
              </div>
              {reviewPlanId && (
                <PlanRefinementChat
                  planId={reviewPlanId}
                  open={!!reviewPlanId}
                  onClose={() => setReviewPlanId(null)}
                  onLaunch={() => {
                    setReviewPlanId(null);
                    handleOpenLaunch(reviewPlanId);
                  }}
                />
              )}
            </div>
          ) : null}
        </TabsContent>

        {/* QA Gates Tab */}
        <TabsContent value="qa-gates" className="flex-1 overflow-auto mt-0 data-[state=inactive]:hidden">
          <QAGatesConfig repositoryId={repositoryId} />
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary" className="flex-1 overflow-auto mt-0 data-[state=inactive]:hidden">
          <SessionSummary
            sessionId={sessionId}
            onTaskClick={(taskId) => {
              handleSelectTask(taskId);
              handleTabChange('tasks');
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Plan Launch Dialog */}
      {launchPlan && (
        <PlanLaunchDialog
          plan={launchPlan}
          repositoryId={repositoryId}
          open={showLaunchDialog}
          onOpenChange={(open) => {
            setShowLaunchDialog(open);
            if (!open) setLaunchPlan(null);
          }}
          onLaunched={handleLaunched}
          onLaunchAndSwitch={handleLaunchAndSwitch}
        />
      )}

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
    </div>
  );
}
