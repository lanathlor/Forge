import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { storage, STORAGE_KEYS } from '@/shared/lib/localStorage';
import type { TaskStatus } from '@/db/schema/tasks';
import type { ClaudeStatus } from '@/shared/hooks/useMultiRepoStream';

export interface RepoEvent {
  id: string;
  type: 'task_completed' | 'task_failed' | 'approval_needed' | 'qa_failed' | 'stuck' | 'plan_updated';
  message: string;
  timestamp: string;
  taskId?: string;
}

export interface SnapshotTask {
  id: string;
  prompt: string;
  status: TaskStatus;
  progress?: number;
}

export interface SessionStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
}

export interface RepoSnapshot {
  repositoryId: string;
  repositoryName: string;
  sessionId: string | null;
  lastViewedTaskId: string | null;
  lastViewedTab: 'tasks' | 'plans';
  claudeStatus: ClaudeStatus;
  currentTask: SnapshotTask | null;
  recentEvents: RepoEvent[];
  pendingApprovals: number;
  stuckItems: number;
  lastVisited: string;
  lastUpdated: string;
  sessionStats: SessionStats | null;
  /** Brief description of what Claude is doing right now */
  currentActivity: string | null;
}

interface RepoSnapshotState {
  snapshots: Record<string, RepoSnapshot>;
  dismissedRepoId: string | null;
}

const MAX_EVENTS = 5;

const loadPersistedSnapshots = (): RepoSnapshotState => {
  const persisted = storage.get<Record<string, RepoSnapshot>>(STORAGE_KEYS.REPO_SNAPSHOTS);
  return {
    snapshots: persisted || {},
    dismissedRepoId: null,
  };
};

const initialState: RepoSnapshotState = loadPersistedSnapshots();

function persistSnapshots(snapshots: Record<string, RepoSnapshot>) {
  storage.set(STORAGE_KEYS.REPO_SNAPSHOTS, snapshots);
}

const DEFAULT_SNAPSHOT: Omit<RepoSnapshot, 'repositoryId'> = {
  repositoryName: '',
  sessionId: null,
  lastViewedTaskId: null,
  lastViewedTab: 'tasks',
  claudeStatus: 'idle' as ClaudeStatus,
  currentTask: null,
  recentEvents: [],
  pendingApprovals: 0,
  stuckItems: 0,
  lastVisited: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
  sessionStats: null,
  currentActivity: null,
};

export const repoSnapshotSlice = createSlice({
  name: 'repoSnapshot',
  initialState,
  reducers: {
    updateSnapshot: (state, action: PayloadAction<Partial<RepoSnapshot> & { repositoryId: string }>) => {
      const { repositoryId, ...updates } = action.payload;
      const existing = state.snapshots[repositoryId];
      state.snapshots[repositoryId] = {
        ...(existing || { ...DEFAULT_SNAPSHOT, repositoryId }),
        ...updates,
        lastUpdated: new Date().toISOString(),
      };
      persistSnapshots(state.snapshots);
    },

    markVisited: (state, action: PayloadAction<string>) => {
      const repoId = action.payload;
      if (state.snapshots[repoId]) {
        state.snapshots[repoId].lastVisited = new Date().toISOString();
        persistSnapshots(state.snapshots);
      }
    },

    addEvent: (state, action: PayloadAction<{ repositoryId: string; event: RepoEvent }>) => {
      const { repositoryId, event } = action.payload;
      const snapshot = state.snapshots[repositoryId];
      if (snapshot) {
        snapshot.recentEvents = [event, ...snapshot.recentEvents].slice(0, MAX_EVENTS);
        snapshot.lastUpdated = new Date().toISOString();
        persistSnapshots(state.snapshots);
      }
    },

    dismissSnapshot: (state, action: PayloadAction<string>) => {
      state.dismissedRepoId = action.payload;
    },

    clearDismissed: (state) => {
      state.dismissedRepoId = null;
    },

    removeSnapshot: (state, action: PayloadAction<string>) => {
      delete state.snapshots[action.payload];
      persistSnapshots(state.snapshots);
    },
  },
});

export const {
  updateSnapshot,
  markVisited,
  addEvent,
  dismissSnapshot,
  clearDismissed,
  removeSnapshot,
} = repoSnapshotSlice.actions;

export default repoSnapshotSlice.reducer;
