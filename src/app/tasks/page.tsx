'use client';

import { useAppSelector } from '@/shared/hooks';
import { AppLayout } from '../components/AppLayout';
import { TasksTabContent } from '../components/DashboardLayout/TasksTabContent';
import { useTaskStream } from '@/shared/hooks';

export default function TasksPage() {
  const currentSessionId = useAppSelector(state => state.session.currentSessionId);
  const { updates, connected, error, reconnect } = useTaskStream(currentSessionId || '');

  if (!currentSessionId) {
    return (
      <AppLayout activeNavItem="tasks">
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">No active session. Please select a repository.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activeNavItem="tasks">
      <div className="h-full p-4 lg:p-6">
        <TasksTabContent
          sessionId={currentSessionId}
          connected={connected}
          error={error}
          reconnect={reconnect}
          selectedTaskId={null}
          handleSelectTask={() => {}}
          updates={updates}
          refreshTrigger={0}
          handleTaskCreated={() => {}}
        />
      </div>
    </AppLayout>
  );
}
