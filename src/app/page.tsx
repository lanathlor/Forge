'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '@/shared/hooks';
import { setSidebarCollapsed } from '@/features/sessions/store/sessionSlice';
import { useRepositorySession } from './hooks/useRepositorySession';
import { PageHeader } from './components/PageHeader';
import { CollapsibleSidebar } from './components/CollapsibleSidebar';
import { RepositoryContent } from './components/RepositoryContent';
import { EmptyRepositoryState } from './components/EmptyRepositoryState';
import { DashboardLayout } from './components/DashboardLayout';

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

  return (
    <main className="h-screen flex flex-col overflow-hidden">
      <PageHeader />

      <div className="flex-1 overflow-hidden">
        <div className="container mx-auto px-4 lg:px-8 py-4 lg:py-6 h-full">
          <div className="flex flex-col lg:flex-row gap-4 h-full">
            {/* Sidebar - Collapsible on desktop, drawer on mobile */}
            <CollapsibleSidebar
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => dispatch(setSidebarCollapsed(!isSidebarCollapsed))}
              onSelectRepository={handleSelectRepository}
            />

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden">
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
      </div>
    </main>
  );
}
