'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppSelector, useAppDispatch, useMultiRepoStream } from '@/shared/hooks';
import { setSidebarCollapsed, setCurrentRepository, setCurrentSession } from '@/features/sessions/store/sessionSlice';
import { updateSnapshot } from '@/features/sessions/store/repoSnapshotSlice';
import { useRepositorySession } from './hooks/useRepositorySession';
import { useRepoSnapshot } from './hooks/useRepoSnapshot';
import { AppLayout } from './components/AppLayout';
import { RepositorySelector } from '@/features/repositories/components/RepositorySelector';
import { RepositoryContent } from './components/RepositoryContent';
import { EmptyRepositoryState } from './components/EmptyRepositoryState';
import { DashboardLayout } from './components/DashboardLayout';
import { NeedsAttention } from './components/NeedsAttention';
import { RepoContextSnapshot } from './components/RepoContextSnapshot';
import { cn } from '@/shared/lib/utils';

/* eslint-disable max-lines-per-function, complexity */
export default function HomePage() {
  const dispatch = useAppDispatch();
  const isSidebarCollapsed = useAppSelector(state => state.session.isSidebarCollapsed);
  const { selectedRepo, handleSelectRepository } = useRepositorySession();
  const [activeSession, setActiveSession] = useState<{ id: string } | null>(null);
  const [initialTaskId, setInitialTaskId] = useState<string | null>(null);

  // Multi-repo stream for live status across all repos
  const { repositories } = useMultiRepoStream();

  // Repo context snapshot for instant context on repo switch
  const { snapshot, isDismissed, hasContext, dismiss, resumeTask } = useRepoSnapshot({
    repositories,
    currentRepoId: selectedRepo?.id ?? null,
  });

  const loadActiveSession = useCallback(async (repositoryId: string) => {
    try {
      const res = await fetch(`/api/sessions?repositoryId=${repositoryId}`);
      if (!res.ok) throw new Error('Failed to load session');

      const data = await res.json();
      setActiveSession(data.session);
    } catch (error) {
      console.error('Error loading session:', error);
    }
  }, []);

  // Load or create active session when repository is selected
  useEffect(() => {
    if (selectedRepo) {
      loadActiveSession(selectedRepo.id);
    }
  }, [selectedRepo, loadActiveSession]);

  // Track last viewed task in snapshot
  const handleTaskSelected = useCallback((taskId: string | null) => {
    if (selectedRepo && taskId) {
      dispatch(updateSnapshot({
        repositoryId: selectedRepo.id,
        lastViewedTaskId: taskId,
      }));
    }
  }, [selectedRepo, dispatch]);

  // Track active tab in snapshot
  const handleTabChanged = useCallback((tab: 'tasks' | 'plans' | 'qa-gates') => {
    if (selectedRepo && tab !== 'qa-gates') {
      dispatch(updateSnapshot({
        repositoryId: selectedRepo.id,
        lastViewedTab: tab,
      }));
    }
  }, [selectedRepo, dispatch]);

  // Handle resume from snapshot
  const handleResumeTask = useCallback(() => {
    const taskId = resumeTask();
    if (taskId) {
      setInitialTaskId(taskId);
    }
  }, [resumeTask]);

  // Handle selecting a task from snapshot events
  const handleSnapshotSelectTask = useCallback((taskId: string) => {
    dismiss();
    setInitialTaskId(taskId);
  }, [dismiss]);

  // Handle navigation to stuck repo from NeedsAttention panel
  const handleSelectStuckRepo = useCallback((repositoryId: string, sessionId?: string | null) => {
    dispatch(setCurrentRepository(repositoryId));
    if (sessionId) {
      dispatch(setCurrentSession(sessionId));
    }
    // Trigger reload of selected repo
    handleSelectRepository({ id: repositoryId } as Parameters<typeof handleSelectRepository>[0]);
  }, [dispatch, handleSelectRepository]);

  // Clear initial task ID after it's been consumed
  const handleInitialTaskConsumed = useCallback(() => {
    setInitialTaskId(null);
  }, []);

  const showSnapshot = hasContext && !isDismissed && selectedRepo && activeSession;

  return (
    <AppLayout activeNavItem="sessions">
      <div className="flex-1 overflow-hidden h-full">
        <div className="flex flex-col lg:flex-row gap-4 h-full p-4 lg:p-6">
          {/* Repository Selector Panel */}
          <div
            className={cn(
              'flex-shrink-0 transition-all duration-300 ease-in-out flex flex-col gap-4',
              isSidebarCollapsed ? 'w-16' : 'w-80',
              // Hide on mobile, show as a panel on larger screens
              'hidden lg:block'
            )}
          >
            <RepositorySelector
              onSelect={handleSelectRepository}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => dispatch(setSidebarCollapsed(!isSidebarCollapsed))}
            />
            {/* Needs Attention Panel - shows all stuck repos across the dashboard */}
            {!isSidebarCollapsed && (
              <NeedsAttention
                onSelectRepo={handleSelectStuckRepo}
                defaultCollapsed={false}
                maxVisible={3}
                className="flex-shrink-0"
              />
            )}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden min-w-0 flex flex-col gap-3">
            {/* Repo Context Snapshot - shows instantly on repo switch */}
            {showSnapshot && snapshot && (
              <div className="flex-shrink-0">
                <RepoContextSnapshot
                  snapshot={snapshot}
                  onDismiss={dismiss}
                  onResumeTask={handleResumeTask}
                  onSelectTask={handleSnapshotSelectTask}
                />
              </div>
            )}

            {/* Dashboard content */}
            <div className="flex-1 overflow-hidden min-w-0">
              {selectedRepo && activeSession ? (
                <DashboardLayout
                  sessionId={activeSession.id}
                  repositoryId={selectedRepo.id}
                  repositoryName={selectedRepo.name}
                  initialTaskId={initialTaskId}
                  onInitialTaskConsumed={handleInitialTaskConsumed}
                  onTaskSelected={handleTaskSelected}
                  onTabChanged={handleTabChanged}
                  onSessionEnded={() => {
                    // Clear session and reload to get a new one
                    setActiveSession(null);
                    loadActiveSession(selectedRepo.id);
                  }}
                />
              ) : selectedRepo ? (
                <RepositoryContent repository={selectedRepo} />
              ) : (
                <EmptyRepositoryState />
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
