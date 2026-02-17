import { describe, it, expect } from 'vitest';
import {
  selectSession,
  selectDashboardUi,
  selectRepoSnapshots,
  selectDismissedRepoId,
  selectCurrentRepositoryId,
  selectCurrentSessionId,
  selectIsSidebarCollapsed,
  selectIsHydrated,
  selectActiveTab,
  selectSelectedTaskId,
  selectSelectedPlanId,
  selectPlanView,
  selectReviewPlanId,
  selectShowHistoryModal,
  selectShowSummaryModal,
  selectShowShortcutsModal,
  selectShowLaunchDialog,
  selectJustLaunchedPlanId,
  selectTaskStatusFilter,
  selectTaskSort,
  selectCurrentRepoSnapshot,
  selectAllSnapshotsSorted,
  selectSnapshotsNeedingAttention,
  selectTotalPendingApprovals,
  selectTotalStuckItems,
  selectCurrentRepoStats,
  selectShouldShowSnapshot,
  selectIsPlansTabActive,
  selectHasSelectedTask,
  selectIsInPlanDetail,
} from '../selectors';
import type { RootState } from '@/store';
import type { RepoSnapshot } from '@/features/sessions/store/repoSnapshotSlice';

// Create a minimal mock state
function makeState(overrides: Partial<RootState> = {}): RootState {
  const baseSnapshot: RepoSnapshot = {
    repositoryId: 'repo-1',
    repositoryName: 'Repo One',
    sessionId: 'session-1',
    lastViewedTaskId: null,
    lastViewedTab: 'tasks',
    claudeStatus: 'idle',
    currentTask: null,
    recentEvents: [],
    pendingApprovals: 0,
    stuckItems: 0,
    lastVisited: new Date('2024-01-01').toISOString(),
    lastUpdated: new Date('2024-01-01').toISOString(),
    sessionStats: null,
    currentActivity: null,
  };

  return {
    session: {
      currentRepositoryId: 'repo-1',
      currentSessionId: 'session-1',
      isSidebarCollapsed: false,
      isHydrated: true,
    },
    dashboardUi: {
      activeTab: 'tasks',
      selectedTaskId: null,
      selectedPlanId: null,
      planView: 'list',
      reviewPlanId: null,
      showHistoryModal: false,
      showSummaryModal: false,
      showShortcutsModal: false,
      showLaunchDialog: false,
      justLaunchedPlanId: null,
      taskStatusFilter: null,
      taskSortField: null,
      taskSortDirection: 'asc',
    },
    repoSnapshot: {
      snapshots: { 'repo-1': baseSnapshot },
      dismissedRepoId: null,
    },
    ...overrides,
  } as RootState;
}

describe('Base selectors', () => {
  it('selectSession returns session slice', () => {
    const state = makeState();
    expect(selectSession(state)).toBe(state.session);
  });

  it('selectDashboardUi returns dashboardUi slice', () => {
    const state = makeState();
    expect(selectDashboardUi(state)).toBe(state.dashboardUi);
  });

  it('selectRepoSnapshots returns snapshots', () => {
    const state = makeState();
    expect(selectRepoSnapshots(state)).toBe(state.repoSnapshot.snapshots);
  });

  it('selectDismissedRepoId returns dismissedRepoId', () => {
    const state = makeState();
    expect(selectDismissedRepoId(state)).toBeNull();
  });
});

describe('Session selectors', () => {
  it('selectCurrentRepositoryId returns current repo id', () => {
    const state = makeState();
    expect(selectCurrentRepositoryId(state)).toBe('repo-1');
  });

  it('selectCurrentSessionId returns current session id', () => {
    const state = makeState();
    expect(selectCurrentSessionId(state)).toBe('session-1');
  });

  it('selectIsSidebarCollapsed returns sidebar collapsed state', () => {
    const state = makeState();
    expect(selectIsSidebarCollapsed(state)).toBe(false);
  });

  it('selectIsHydrated returns hydration state', () => {
    const state = makeState();
    expect(selectIsHydrated(state)).toBe(true);
  });
});

describe('Dashboard UI selectors', () => {
  it('selectActiveTab returns active tab', () => {
    const state = makeState();
    expect(selectActiveTab(state)).toBe('tasks');
  });

  it('selectSelectedTaskId returns selected task id', () => {
    const state = makeState();
    expect(selectSelectedTaskId(state)).toBeNull();
  });

  it('selectSelectedPlanId returns selected plan id', () => {
    const state = makeState();
    expect(selectSelectedPlanId(state)).toBeNull();
  });

  it('selectPlanView returns plan view mode', () => {
    const state = makeState();
    expect(selectPlanView(state)).toBe('list');
  });

  it('selectReviewPlanId returns review plan id', () => {
    const state = makeState();
    expect(selectReviewPlanId(state)).toBeNull();
  });

  it('selectShowHistoryModal returns history modal state', () => {
    const state = makeState();
    expect(selectShowHistoryModal(state)).toBe(false);
  });

  it('selectShowSummaryModal returns summary modal state', () => {
    const state = makeState();
    expect(selectShowSummaryModal(state)).toBe(false);
  });

  it('selectShowShortcutsModal returns shortcuts modal state', () => {
    const state = makeState();
    expect(selectShowShortcutsModal(state)).toBe(false);
  });

  it('selectShowLaunchDialog returns launch dialog state', () => {
    const state = makeState();
    expect(selectShowLaunchDialog(state)).toBe(false);
  });

  it('selectJustLaunchedPlanId returns just launched plan id', () => {
    const state = makeState();
    expect(selectJustLaunchedPlanId(state)).toBeNull();
  });

  it('selectTaskStatusFilter returns task filter', () => {
    const state = makeState();
    expect(selectTaskStatusFilter(state)).toBeNull();
  });

  it('selectTaskSort returns task sort config', () => {
    const state = makeState();
    expect(selectTaskSort(state)).toEqual({ field: null, direction: 'asc' });
  });
});

describe('Repo snapshot selectors', () => {
  it('selectCurrentRepoSnapshot returns snapshot for current repo', () => {
    const state = makeState();
    expect(selectCurrentRepoSnapshot(state)).toEqual(
      expect.objectContaining({ repositoryId: 'repo-1' })
    );
  });

  it('selectCurrentRepoSnapshot returns null when no current repo', () => {
    const state = makeState({
      session: {
        currentRepositoryId: null,
        currentSessionId: null,
        isSidebarCollapsed: false,
        isHydrated: true,
      },
    } as Partial<RootState>);
    expect(selectCurrentRepoSnapshot(state)).toBeNull();
  });

  it('selectCurrentRepoSnapshot returns null when repo not in snapshots', () => {
    const state = makeState({
      session: {
        currentRepositoryId: 'unknown-repo',
        currentSessionId: null,
        isSidebarCollapsed: false,
        isHydrated: true,
      },
    } as Partial<RootState>);
    expect(selectCurrentRepoSnapshot(state)).toBeNull();
  });

  it('selectAllSnapshotsSorted returns sorted snapshots', () => {
    const snapshot1: RepoSnapshot = {
      repositoryId: 'repo-1',
      repositoryName: 'Repo 1',
      sessionId: null,
      lastViewedTaskId: null,
      lastViewedTab: 'tasks',
      claudeStatus: 'idle',
      currentTask: null,
      recentEvents: [],
      pendingApprovals: 0,
      stuckItems: 0,
      lastVisited: new Date('2024-01-01').toISOString(),
      lastUpdated: new Date('2024-01-01').toISOString(),
      sessionStats: null,
      currentActivity: null,
    };
    const snapshot2: RepoSnapshot = {
      ...snapshot1,
      repositoryId: 'repo-2',
      repositoryName: 'Repo 2',
      lastVisited: new Date('2024-01-02').toISOString(),
    };

    const state = makeState({
      repoSnapshot: {
        snapshots: { 'repo-1': snapshot1, 'repo-2': snapshot2 },
        dismissedRepoId: null,
      },
    } as Partial<RootState>);

    const sorted = selectAllSnapshotsSorted(state);
    expect(sorted[0]!.repositoryId).toBe('repo-2'); // more recent first
    expect(sorted[1]!.repositoryId).toBe('repo-1');
  });

  it('selectSnapshotsNeedingAttention filters by pending approvals or stuck items', () => {
    const snapshot1: RepoSnapshot = {
      repositoryId: 'repo-1',
      repositoryName: 'Repo 1',
      sessionId: null,
      lastViewedTaskId: null,
      lastViewedTab: 'tasks',
      claudeStatus: 'idle',
      currentTask: null,
      recentEvents: [],
      pendingApprovals: 2,
      stuckItems: 0,
      lastVisited: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      sessionStats: null,
      currentActivity: null,
    };
    const snapshot2: RepoSnapshot = {
      ...snapshot1,
      repositoryId: 'repo-2',
      repositoryName: 'Repo 2',
      pendingApprovals: 0,
      stuckItems: 0,
    };

    const state = makeState({
      repoSnapshot: {
        snapshots: { 'repo-1': snapshot1, 'repo-2': snapshot2 },
        dismissedRepoId: null,
      },
    } as Partial<RootState>);

    const needingAttention = selectSnapshotsNeedingAttention(state);
    expect(needingAttention).toHaveLength(1);
    expect(needingAttention[0]!.repositoryId).toBe('repo-1');
  });

  it('selectTotalPendingApprovals sums all pending approvals', () => {
    const makeSnapshot = (
      id: string,
      pendingApprovals: number
    ): RepoSnapshot => ({
      repositoryId: id,
      repositoryName: id,
      sessionId: null,
      lastViewedTaskId: null,
      lastViewedTab: 'tasks',
      claudeStatus: 'idle',
      currentTask: null,
      recentEvents: [],
      pendingApprovals,
      stuckItems: 0,
      lastVisited: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      sessionStats: null,
      currentActivity: null,
    });

    const state = makeState({
      repoSnapshot: {
        snapshots: {
          'repo-1': makeSnapshot('repo-1', 3),
          'repo-2': makeSnapshot('repo-2', 2),
        },
        dismissedRepoId: null,
      },
    } as Partial<RootState>);

    expect(selectTotalPendingApprovals(state)).toBe(5);
  });

  it('selectTotalStuckItems sums all stuck items', () => {
    const makeSnapshot = (id: string, stuckItems: number): RepoSnapshot => ({
      repositoryId: id,
      repositoryName: id,
      sessionId: null,
      lastViewedTaskId: null,
      lastViewedTab: 'tasks',
      claudeStatus: 'idle',
      currentTask: null,
      recentEvents: [],
      pendingApprovals: 0,
      stuckItems,
      lastVisited: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      sessionStats: null,
      currentActivity: null,
    });

    const state = makeState({
      repoSnapshot: {
        snapshots: {
          'repo-1': makeSnapshot('repo-1', 1),
          'repo-2': makeSnapshot('repo-2', 4),
        },
        dismissedRepoId: null,
      },
    } as Partial<RootState>);

    expect(selectTotalStuckItems(state)).toBe(5);
  });

  it('selectCurrentRepoStats returns session stats for current repo', () => {
    const stats = {
      totalTasks: 10,
      completedTasks: 5,
      failedTasks: 1,
      runningTasks: 1,
    };
    const state = makeState({
      repoSnapshot: {
        snapshots: {
          'repo-1': {
            repositoryId: 'repo-1',
            repositoryName: 'Repo 1',
            sessionId: null,
            lastViewedTaskId: null,
            lastViewedTab: 'tasks',
            claudeStatus: 'idle',
            currentTask: null,
            recentEvents: [],
            pendingApprovals: 0,
            stuckItems: 0,
            lastVisited: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            sessionStats: stats,
            currentActivity: null,
          },
        },
        dismissedRepoId: null,
      },
    } as Partial<RootState>);

    expect(selectCurrentRepoStats(state)).toEqual(stats);
  });

  it('selectCurrentRepoStats returns null when no snapshot', () => {
    const state = makeState({
      session: {
        currentRepositoryId: 'unknown',
        currentSessionId: null,
        isSidebarCollapsed: false,
        isHydrated: true,
      },
    } as Partial<RootState>);
    expect(selectCurrentRepoStats(state)).toBeNull();
  });
});

describe('selectShouldShowSnapshot', () => {
  const baseSnapshot: RepoSnapshot = {
    repositoryId: 'repo-1',
    repositoryName: 'Repo 1',
    sessionId: null,
    lastViewedTaskId: null,
    lastViewedTab: 'tasks',
    claudeStatus: 'idle',
    currentTask: null,
    recentEvents: [],
    pendingApprovals: 0,
    stuckItems: 0,
    lastVisited: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    sessionStats: null,
    currentActivity: null,
  };

  it('returns false when no snapshot', () => {
    const state = makeState({
      session: {
        currentRepositoryId: 'unknown',
        currentSessionId: null,
        isSidebarCollapsed: false,
        isHydrated: true,
      },
    } as Partial<RootState>);
    expect(selectShouldShowSnapshot(state)).toBe(false);
  });

  it('returns false when dismissed', () => {
    const state = makeState({
      repoSnapshot: {
        snapshots: {
          'repo-1': { ...baseSnapshot, lastViewedTaskId: 'task-1' },
        },
        dismissedRepoId: 'repo-1',
      },
    } as Partial<RootState>);
    expect(selectShouldShowSnapshot(state)).toBe(false);
  });

  it('returns true when has lastViewedTaskId', () => {
    const state = makeState({
      repoSnapshot: {
        snapshots: {
          'repo-1': { ...baseSnapshot, lastViewedTaskId: 'task-1' },
        },
        dismissedRepoId: null,
      },
    } as Partial<RootState>);
    expect(selectShouldShowSnapshot(state)).toBe(true);
  });

  it('returns true when has pending approvals', () => {
    const state = makeState({
      repoSnapshot: {
        snapshots: { 'repo-1': { ...baseSnapshot, pendingApprovals: 1 } },
        dismissedRepoId: null,
      },
    } as Partial<RootState>);
    expect(selectShouldShowSnapshot(state)).toBe(true);
  });

  it('returns false when snapshot is empty', () => {
    const state = makeState({
      repoSnapshot: {
        snapshots: { 'repo-1': baseSnapshot },
        dismissedRepoId: null,
      },
    } as Partial<RootState>);
    expect(selectShouldShowSnapshot(state)).toBe(false);
  });
});

describe('Dashboard navigation selectors', () => {
  it('selectIsPlansTabActive returns true when plans tab active', () => {
    const state = makeState({
      dashboardUi: {
        activeTab: 'plans',
        selectedTaskId: null,
        selectedPlanId: null,
        planView: 'list',
        reviewPlanId: null,
        showHistoryModal: false,
        showSummaryModal: false,
        showShortcutsModal: false,
        showLaunchDialog: false,
        justLaunchedPlanId: null,
        taskStatusFilter: null,
        taskSortField: null,
        taskSortDirection: 'asc',
      },
    } as Partial<RootState>);
    expect(selectIsPlansTabActive(state)).toBe(true);
  });

  it('selectIsPlansTabActive returns false when tasks tab active', () => {
    const state = makeState();
    expect(selectIsPlansTabActive(state)).toBe(false);
  });

  it('selectHasSelectedTask returns false when no task selected', () => {
    const state = makeState();
    expect(selectHasSelectedTask(state)).toBe(false);
  });

  it('selectHasSelectedTask returns true when task is selected', () => {
    const state = makeState({
      dashboardUi: {
        activeTab: 'tasks',
        selectedTaskId: 'task-123',
        selectedPlanId: null,
        planView: 'list',
        reviewPlanId: null,
        showHistoryModal: false,
        showSummaryModal: false,
        showShortcutsModal: false,
        showLaunchDialog: false,
        justLaunchedPlanId: null,
        taskStatusFilter: null,
        taskSortField: null,
        taskSortDirection: 'asc',
      },
    } as Partial<RootState>);
    expect(selectHasSelectedTask(state)).toBe(true);
  });

  it('selectIsInPlanDetail returns false when in list view', () => {
    const state = makeState();
    expect(selectIsInPlanDetail(state)).toBe(false);
  });

  it('selectIsInPlanDetail returns true when in detail view with plan selected', () => {
    const state = makeState({
      dashboardUi: {
        activeTab: 'plans',
        selectedTaskId: null,
        selectedPlanId: 'plan-123',
        planView: 'detail',
        reviewPlanId: null,
        showHistoryModal: false,
        showSummaryModal: false,
        showShortcutsModal: false,
        showLaunchDialog: false,
        justLaunchedPlanId: null,
        taskStatusFilter: null,
        taskSortField: null,
        taskSortDirection: 'asc',
      },
    } as Partial<RootState>);
    expect(selectIsInPlanDetail(state)).toBe(true);
  });
});
