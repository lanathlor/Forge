'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useAppSelector, useAppDispatch } from '@/shared/hooks';
import { useSSESubscription } from '@/shared/contexts/SSEContext';
import {
  updateSnapshot,
  markVisited,
  addEvent,
  dismissSnapshot,
  clearDismissed,
  type RepoSnapshot,
  type RepoEvent,
  type SessionStats,
} from '@/features/sessions/store/repoSnapshotSlice';
import type { RepoSessionState } from '@/shared/hooks/useMultiRepoStream';
import type { AppDispatch } from '@/store';
import type { TaskStatus } from '@/db/schema/tasks';

interface UseRepoSnapshotOptions {
  repositories: RepoSessionState[];
  currentRepoId: string | null;
}

interface UseRepoSnapshotReturn {
  snapshot: RepoSnapshot | null;
  isDismissed: boolean;
  hasContext: boolean;
  dismiss: () => void;
  resumeTask: () => string | null;
}

interface TaskUpdateData {
  taskId?: string;
  status?: string;
  prompt?: string;
  repositoryId?: string;
}

interface StuckData {
  repositoryId?: string;
  description?: string;
}

const STATUS_EVENT_MAP: Record<string, { type: RepoEvent['type']; label: string }> = {
  completed: { type: 'task_completed', label: 'Task completed' },
  failed: { type: 'task_failed', label: 'Task failed' },
  waiting_approval: { type: 'approval_needed', label: 'Approval needed' },
  qa_failed: { type: 'qa_failed', label: 'QA failed' },
};

const ACTIVITY_LABELS: Record<string, string> = {
  thinking: 'Analyzing...',
  writing: 'Writing code...',
  waiting_input: 'Needs your input',
  stuck: 'Needs help',
};

function mapRepoToSnapshot(repo: RepoSessionState): Partial<RepoSnapshot> & { repositoryId: string } {
  return {
    repositoryId: repo.repositoryId,
    repositoryName: repo.repositoryName,
    sessionId: repo.sessionId,
    claudeStatus: repo.claudeStatus,
    currentTask: repo.currentTask ? {
      id: repo.currentTask.id,
      prompt: repo.currentTask.prompt,
      status: repo.currentTask.status as TaskStatus,
      progress: repo.currentTask.progress,
    } : null,
    pendingApprovals: repo.claudeStatus === 'waiting_input' ? 1 : 0,
    stuckItems: repo.needsAttention ? 1 : 0,
    currentActivity: ACTIVITY_LABELS[repo.claudeStatus] || null,
  };
}

function buildEventFromTaskUpdate(data: TaskUpdateData): { type: RepoEvent['type']; message: string } | null {
  if (!data.status) return null;
  const mapping = STATUS_EVENT_MAP[data.status];
  if (!mapping) return null;
  return {
    type: mapping.type,
    message: `${mapping.label}: ${(data.prompt || '').slice(0, 60)}`,
  };
}

function snapshotHasContext(snapshot: RepoSnapshot | null): boolean {
  if (!snapshot) return false;
  return (
    snapshot.lastViewedTaskId !== null ||
    snapshot.recentEvents.length > 0 ||
    snapshot.currentTask !== null ||
    snapshot.pendingApprovals > 0 ||
    snapshot.stuckItems > 0
  );
}

function useSyncRepos(repositories: RepoSessionState[], dispatch: AppDispatch) {
  useEffect(() => {
    for (const repo of repositories) {
      dispatch(updateSnapshot(mapRepoToSnapshot(repo)));
    }
  }, [repositories, dispatch]);
}

function useSessionStatsFetcher(currentRepoId: string | null, dispatch: AppDispatch) {
  const fetchedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentRepoId || fetchedForRef.current === currentRepoId) return;
    fetchedForRef.current = currentRepoId;

    async function fetchStats() {
      try {
        const res = await fetch(`/api/sessions?repositoryId=${currentRepoId}`);
        if (!res.ok) return;
        const data = await res.json();
        const session = data.session;
        if (!session?.id) return;

        const detailRes = await fetch(`/api/sessions/${session.id}?summary=true`);
        if (!detailRes.ok) return;
        const detail = await detailRes.json();
        const tasks = detail.session?.tasks;
        if (!Array.isArray(tasks)) return;

        const stats: SessionStats = {
          totalTasks: tasks.length,
          completedTasks: tasks.filter((t: { status: string }) => t.status === 'completed').length,
          failedTasks: tasks.filter((t: { status: string }) => t.status === 'failed' || t.status === 'rejected').length,
          runningTasks: tasks.filter((t: { status: string }) => t.status === 'running' || t.status === 'pre_flight').length,
        };

        dispatch(updateSnapshot({
          repositoryId: currentRepoId!,
          sessionStats: stats,
        }));
      } catch {
        // Stats are best-effort, don't block snapshot display
      }
    }

    fetchStats();
  }, [currentRepoId, dispatch]);
}

function useTaskUpdateListener(dispatch: AppDispatch) {
  useSSESubscription<TaskUpdateData>(
    'unified',
    'task_update',
    useCallback((event) => {
      const data = event.data;
      if (!data?.repositoryId || !data?.taskId) return;
      const mapped = buildEventFromTaskUpdate(data);
      if (!mapped) return;
      dispatch(addEvent({
        repositoryId: data.repositoryId,
        event: {
          id: `${data.taskId}-${data.status}-${Date.now()}`,
          type: mapped.type,
          message: mapped.message,
          timestamp: new Date().toISOString(),
          taskId: data.taskId,
        },
      }));
    }, [dispatch]),
  );
}

function useStuckListener(dispatch: AppDispatch) {
  useSSESubscription<StuckData>(
    'unified',
    'stuck_detected',
    useCallback((event) => {
      const data = event.data;
      if (!data?.repositoryId) return;
      dispatch(addEvent({
        repositoryId: data.repositoryId,
        event: {
          id: `stuck-${Date.now()}`,
          type: 'stuck',
          message: data.description || 'Repository is stuck',
          timestamp: new Date().toISOString(),
        },
      }));
    }, [dispatch]),
  );
}

function useRepoDismissReset(currentRepoId: string | null, dispatch: AppDispatch) {
  const prevRepoIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentRepoId && currentRepoId !== prevRepoIdRef.current) {
      dispatch(clearDismissed());
      prevRepoIdRef.current = currentRepoId;
    }
  }, [currentRepoId, dispatch]);
}

export function useRepoSnapshot({ repositories, currentRepoId }: UseRepoSnapshotOptions): UseRepoSnapshotReturn {
  const dispatch = useAppDispatch();
  const snapshots = useAppSelector(state => state.repoSnapshot.snapshots);
  const dismissedRepoId = useAppSelector(state => state.repoSnapshot.dismissedRepoId);

  useSyncRepos(repositories, dispatch);
  useTaskUpdateListener(dispatch);
  useStuckListener(dispatch);
  useRepoDismissReset(currentRepoId, dispatch);
  useSessionStatsFetcher(currentRepoId, dispatch);

  const snapshot = currentRepoId ? snapshots[currentRepoId] || null : null;
  const isDismissed = dismissedRepoId === currentRepoId;
  const hasContext = snapshotHasContext(snapshot);

  const dismiss = useCallback(() => {
    if (currentRepoId) {
      dispatch(dismissSnapshot(currentRepoId));
      dispatch(markVisited(currentRepoId));
    }
  }, [currentRepoId, dispatch]);

  const resumeTask = useCallback(() => {
    const taskId = snapshot?.lastViewedTaskId || snapshot?.currentTask?.id;
    if (taskId) {
      dismiss();
      return taskId;
    }
    return null;
  }, [snapshot, dismiss]);

  return { snapshot, isDismissed, hasContext, dismiss, resumeTask };
}
