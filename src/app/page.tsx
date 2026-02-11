'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '@/shared/hooks';
import { setSidebarCollapsed, setCurrentRepository, setCurrentSession } from '@/features/sessions/store/sessionSlice';
import { useRepositorySession } from './hooks/useRepositorySession';
import { AppLayout } from './components/AppLayout';
import { RepositorySelector } from '@/features/repositories/components/RepositorySelector';
import { RepositoryContent } from './components/RepositoryContent';
import { EmptyRepositoryState } from './components/EmptyRepositoryState';
import { DashboardLayout } from './components/DashboardLayout';
import { NeedsAttention } from './components/NeedsAttention';
import { cn } from '@/shared/lib/utils';

/* eslint-disable max-lines-per-function */
export default function HomePage() {
  const dispatch = useAppDispatch();
  const isSidebarCollapsed = useAppSelector(state => state.session.isSidebarCollapsed);
  const { selectedRepo, handleSelectRepository } = useRepositorySession();
  const [activeSession, setActiveSession] = useState<{ id: string } | null>(null);

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

  // Handle navigation to stuck repo from NeedsAttention panel
  const handleSelectStuckRepo = useCallback((repositoryId: string, sessionId?: string | null) => {
    dispatch(setCurrentRepository(repositoryId));
    if (sessionId) {
      dispatch(setCurrentSession(sessionId));
    }
    // Trigger reload of selected repo
    handleSelectRepository({ id: repositoryId } as Parameters<typeof handleSelectRepository>[0]);
  }, [dispatch, handleSelectRepository]);

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
          <div className="flex-1 overflow-hidden min-w-0">
            {selectedRepo && activeSession ? (
              <DashboardLayout
                sessionId={activeSession.id}
                repositoryId={selectedRepo.id}
                repositoryName={selectedRepo.name}
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
    </AppLayout>
  );
}
