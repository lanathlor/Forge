'use client';

import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import { useTaskStream, useKeyboardShortcuts } from '@/shared/hooks';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { useGetSessionQuery } from '@/features/sessions/store/sessionsApi';
import {
  SessionControlsBar,
  SessionHistoryModal,
  SessionSummaryModal,
} from '@/features/sessions/components';
import {
  LivePlanMonitor,
} from '@/features/plans/components';
import { useGetPlansQuery } from '@/features/plans/store/plansApi';
import type { Plan } from '@/db/schema';
import { PerformanceProfiler } from '@/shared/components/performance';
import { ErrorBoundary } from '@/shared/components/error';
import { KeyboardShortcutsModal } from '@/shared/components/KeyboardShortcutsModal';
import { KeyboardShortcutsFAB } from '@/shared/components/KeyboardShortcutsFAB';
import { TasksTabContent } from './DashboardLayout/TasksTabContent';

// Lazy load heavy components for better code splitting
const SessionSummary = lazy(() => import('@/features/sessions/components').then(mod => ({ default: mod.SessionSummary })));
const PlanList = lazy(() => import('@/features/plans/components').then(mod => ({ default: mod.PlanList })));
const PlanDetailView = lazy(() => import('@/features/plans/components').then(mod => ({ default: mod.PlanDetailView })));
const PlanExecutionView = lazy(() => import('@/features/plans/components').then(mod => ({ default: mod.PlanExecutionView })));
const PlanRefinementChat = lazy(() => import('@/features/plans/components').then(mod => ({ default: mod.PlanRefinementChat })));
const PlanLaunchDialog = lazy(() => import('@/features/plans/components').then(mod => ({ default: mod.PlanLaunchDialog })));
const QAGatesConfig = lazy(() => import('@/features/repositories/components').then(mod => ({ default: mod.QAGatesConfig })));

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
 * Loading fallback for lazy-loaded components
 */
function LoadingFallback({ message }: { message: string }) {
  return (
    <div
      className="flex items-center justify-center h-full min-h-[300px]"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        <span className="text-sm">{message}</span>
      </div>
    </div>
  );
}

/**
 * Register all keyboard shortcuts for the dashboard
 */
function useRegisterDashboardShortcuts(params: {
  registerShortcut: ReturnType<typeof useKeyboardShortcuts>['registerShortcut'];
  handleTabChange: (tab: string) => void;
  handleSelectTask: (taskId: string | null) => void;
  selectedTaskId: string | null;
  showShortcutsModal: boolean;
  setShowShortcutsModal: (show: boolean) => void;
  showHistoryModal: boolean;
  setShowHistoryModal: (show: boolean) => void;
  showSummaryModal: boolean;
  setShowSummaryModal: (show: boolean) => void;
  reviewPlanId: string | null;
  setReviewPlanId: (id: string | null) => void;
}) {
  const {
    registerShortcut,
    handleTabChange,
    handleSelectTask,
    selectedTaskId,
    showShortcutsModal,
    setShowShortcutsModal,
    showHistoryModal,
    setShowHistoryModal,
    showSummaryModal,
    setShowSummaryModal,
    reviewPlanId,
    setReviewPlanId,
  } = params;

  useEffect(() => {
    // Show shortcuts modal
    registerShortcut({
      id: 'show-shortcuts',
      key: '?',
      shift: true,
      description: 'Show keyboard shortcuts',
      category: 'General',
      handler: () => setShowShortcutsModal(true),
      excludeInputs: true,
    });

    // Tab navigation shortcuts
    registerShortcut({
      id: 'go-to-tasks',
      key: '1',
      ctrl: true,
      description: 'Go to Tasks tab',
      category: 'Navigation',
      handler: () => handleTabChange('tasks'),
      excludeInputs: true,
    });

    registerShortcut({
      id: 'go-to-plans',
      key: '2',
      ctrl: true,
      description: 'Go to Plans tab',
      category: 'Navigation',
      handler: () => handleTabChange('plans'),
      excludeInputs: true,
    });

    registerShortcut({
      id: 'go-to-qa-gates',
      key: '3',
      ctrl: true,
      description: 'Go to QA Gates tab',
      category: 'Navigation',
      handler: () => handleTabChange('qa-gates'),
      excludeInputs: true,
    });

    registerShortcut({
      id: 'go-to-summary',
      key: '4',
      ctrl: true,
      description: 'Go to Summary tab',
      category: 'Navigation',
      handler: () => handleTabChange('summary'),
      excludeInputs: true,
    });

    // Close panels/modals with Escape
    registerShortcut({
      id: 'close-panel',
      key: 'Escape',
      description: 'Close panels and modals',
      category: 'General',
      handler: () => {
        if (selectedTaskId) {
          handleSelectTask(null);
        } else if (showShortcutsModal) {
          setShowShortcutsModal(false);
        } else if (showHistoryModal) {
          setShowHistoryModal(false);
        } else if (showSummaryModal) {
          setShowSummaryModal(false);
        } else if (reviewPlanId) {
          setReviewPlanId(null);
        }
      },
      excludeInputs: false,
    });
  }, [
    registerShortcut,
    handleTabChange,
    selectedTaskId,
    handleSelectTask,
    showShortcutsModal,
    setShowShortcutsModal,
    showHistoryModal,
    setShowHistoryModal,
    showSummaryModal,
    setShowSummaryModal,
    reviewPlanId,
    setReviewPlanId,
  ]);
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
 * - Code splitting for heavy components (Plans, QA Gates, Summary)
 * - Performance optimized with React.memo and lazy loading
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
  const [justLaunchedPlanId, setJustLaunchedPlanId] = useState<string | null>(null);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  const { data: sessionData } = useGetSessionQuery(sessionId);
  const { updates, connected, error, reconnect } = useTaskStream(sessionId);
  const { data: plansData } = useGetPlansQuery(repositoryId, {
    pollingInterval: 5000,
    skipPollingIfUnfocused: true,
  });

  const { registerShortcut, getShortcuts } = useKeyboardShortcuts();

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
    // Navigate to execution view after launch with animation
    setJustLaunchedPlanId(planId);
    setSelectedPlanId(planId);
    setPlanView('execution');
    handleTabChange('plans');
    // Clear justLaunched flag after transition
    setTimeout(() => setJustLaunchedPlanId(null), 5000);
  }, [handleTabChange]);

  const handleLaunchAndSwitch = useCallback((_planId: string) => {
    // Stay on current tab (tasks) - plan runs in background
    // The LivePlanMonitor will show the running plan
    setShowLaunchDialog(false);
    // Switch to tasks tab if not already there
    if (activeTab !== 'tasks') {
      handleTabChange('tasks');
    }
  }, [activeTab, handleTabChange]);

  // Register keyboard shortcuts
  useRegisterDashboardShortcuts({
    registerShortcut,
    handleTabChange,
    handleSelectTask,
    selectedTaskId,
    showShortcutsModal,
    setShowShortcutsModal,
    showHistoryModal,
    setShowHistoryModal,
    showSummaryModal,
    setShowSummaryModal,
    reviewPlanId,
    setReviewPlanId,
  });

  return (
    <PerformanceProfiler id="DashboardLayout">
      <ErrorBoundary id="dashboard-main">
        <div className="h-full flex flex-col gap-3">
          {/* Session Controls Bar */}
          {session && (
            <ErrorBoundary id="session-controls">
              <SessionControlsBar
                session={session}
                repositoryName={repositoryName}
                onOpenHistory={() => setShowHistoryModal(true)}
                onSessionEnded={handleSessionEnded}
              />
            </ErrorBoundary>
          )}

          {/* Live Plan Monitor - always visible when plans are running */}
          <ErrorBoundary id="live-plan-monitor">
            <LivePlanMonitor
              repositoryId={repositoryId}
              onViewExecution={handleViewExecution}
              onViewPlan={handleViewPlan}
              className="flex-shrink-0"
            />
          </ErrorBoundary>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mb-3" role="tablist" aria-label="Dashboard navigation">
              <TabsTrigger value="tasks" aria-label="View tasks" aria-controls="tasks-panel" className="transition-all duration-200 hover:scale-105 active:scale-95">Tasks</TabsTrigger>
              <TabsTrigger
                value="plans"
                className="gap-1.5 transition-all duration-200 hover:scale-105 active:scale-95"
                aria-label={`View plans${activePlanCount > 0 ? `, ${activePlanCount} active` : ''}`}
                aria-controls="plans-panel"
              >
                Plans
                {activePlanCount > 0 && (
                  <span className="relative flex h-2 w-2" role="status" aria-label={`${activePlanCount} active plans`}>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" aria-hidden="true" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" aria-hidden="true" />
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="qa-gates" aria-label="View QA gates configuration" aria-controls="qa-gates-panel" className="transition-all duration-200 hover:scale-105 active:scale-95">QA Gates</TabsTrigger>
              <TabsTrigger value="summary" aria-label="View session summary" aria-controls="summary-panel" className="transition-all duration-200 hover:scale-105 active:scale-95">Summary</TabsTrigger>
            </TabsList>

            {/* Tasks Tab */}
            <TabsContent
              value="tasks"
              id="tasks-panel"
              role="tabpanel"
              aria-labelledby="tasks-tab"
              className="flex-1 flex flex-col gap-3 overflow-hidden mt-0 data-[state=inactive]:hidden data-[state=active]:animate-slide-up-fade"
            >
              <TasksTabContent
                sessionId={sessionId}
                connected={connected}
                error={error}
                reconnect={reconnect}
                selectedTaskId={selectedTaskId}
                handleSelectTask={handleSelectTask}
                updates={updates}
                refreshTrigger={refreshTrigger}
                handleTaskCreated={handleTaskCreated}
              />
            </TabsContent>

            {/* Plans Tab */}
            <TabsContent
              value="plans"
              id="plans-panel"
              role="tabpanel"
              aria-labelledby="plans-tab"
              className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden data-[state=active]:animate-slide-up-fade"
            >
              <ErrorBoundary id="plans-tab">
                <Suspense fallback={<LoadingFallback message="Loading plans..." />}>
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
                        justLaunched={justLaunchedPlanId === selectedPlanId}
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
                </Suspense>
              </ErrorBoundary>
            </TabsContent>

            {/* QA Gates Tab */}
            <TabsContent
              value="qa-gates"
              id="qa-gates-panel"
              role="tabpanel"
              aria-labelledby="qa-gates-tab"
              className="flex-1 overflow-auto mt-0 data-[state=inactive]:hidden data-[state=active]:animate-slide-up-fade"
            >
              <ErrorBoundary id="qa-gates-tab">
                <Suspense fallback={<LoadingFallback message="Loading QA gates..." />}>
                  <QAGatesConfig repositoryId={repositoryId} />
                </Suspense>
              </ErrorBoundary>
            </TabsContent>

            {/* Summary Tab */}
            <TabsContent
              value="summary"
              id="summary-panel"
              role="tabpanel"
              aria-labelledby="summary-tab"
              className="flex-1 overflow-auto mt-0 data-[state=inactive]:hidden data-[state=active]:animate-slide-up-fade"
            >
              <ErrorBoundary id="summary-tab">
                <Suspense fallback={<LoadingFallback message="Loading summary..." />}>
                  <SessionSummary
                    sessionId={sessionId}
                    onTaskClick={(taskId) => {
                      handleSelectTask(taskId);
                      handleTabChange('tasks');
                    }}
                  />
                </Suspense>
              </ErrorBoundary>
            </TabsContent>
          </Tabs>

          {/* Plan Launch Dialog */}
          {launchPlan && (
            <Suspense fallback={null}>
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
            </Suspense>
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

          {/* Keyboard Shortcuts Modal */}
          <KeyboardShortcutsModal
            open={showShortcutsModal}
            onOpenChange={setShowShortcutsModal}
            shortcuts={getShortcuts()}
          />

          {/* Keyboard Shortcuts FAB */}
          <KeyboardShortcutsFAB />
        </div>
      </ErrorBoundary>
    </PerformanceProfiler>
  );
}
