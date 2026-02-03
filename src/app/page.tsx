'use client';

import { useAppSelector, useAppDispatch } from '@/shared/hooks';
import { setSidebarCollapsed } from '@/features/sessions/store/sessionSlice';
import { useRepositorySession } from './hooks/useRepositorySession';
import { PageHeader } from './components/PageHeader';
import { CollapsibleSidebar } from './components/CollapsibleSidebar';
import { RepositoryContent } from './components/RepositoryContent';
import { EmptyRepositoryState } from './components/EmptyRepositoryState';

export default function HomePage() {
  const dispatch = useAppDispatch();
  const isSidebarCollapsed = useAppSelector(state => state.session.isSidebarCollapsed);
  const { selectedRepo, handleSelectRepository } = useRepositorySession();

  return (
    <main className="h-screen flex flex-col overflow-hidden">
      <PageHeader />

      <div className="flex-1 overflow-hidden">
        <div className="container mx-auto px-4 lg:px-8 py-6 h-full">
          <div className="flex gap-4 h-full">
            <CollapsibleSidebar
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => dispatch(setSidebarCollapsed(!isSidebarCollapsed))}
              onSelectRepository={handleSelectRepository}
            />

            <div className="flex-1 overflow-hidden">
              {selectedRepo ? (
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
