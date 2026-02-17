'use client';

import { useState, useCallback } from 'react';
import { useAppSelector } from '@/shared/hooks';
import { AppLayout } from '../components/AppLayout';
import { TasksTabContent } from '../components/DashboardLayout/TasksTabContent';
import { useTaskStream } from '@/shared/hooks';

export default function TasksPage() {
  const currentSessionId = useAppSelector(state => state.session.currentSessionId);
  const { updates, connected, error, reconnect } = useTaskStream(currentSessionId || '');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSelectTask = useCallback((taskId: string | null) => {
    setSelectedTaskId(taskId);
  }, []);

  const handleTaskCreated = useCallback((_taskId: string) => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

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
          selectedTaskId={selectedTaskId}
          handleSelectTask={handleSelectTask}
          updates={updates}
          refreshTrigger={refreshTrigger}
          handleTaskCreated={handleTaskCreated}
        />
      </div>
    </AppLayout>
  );
}
