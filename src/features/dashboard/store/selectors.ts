import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { RepoSnapshot } from '@/features/sessions/store/repoSnapshotSlice';

// ─── Base selectors ──────────────────────────────────────────────────────────

export const selectSession = (state: RootState) => state.session;
export const selectDashboardUi = (state: RootState) => state.dashboardUi;
export const selectRepoSnapshots = (state: RootState) => state.repoSnapshot.snapshots;
export const selectDismissedRepoId = (state: RootState) => state.repoSnapshot.dismissedRepoId;

// ─── Session selectors ───────────────────────────────────────────────────────

export const selectCurrentRepositoryId = (state: RootState) =>
  state.session.currentRepositoryId;

export const selectCurrentSessionId = (state: RootState) =>
  state.session.currentSessionId;

export const selectIsSidebarCollapsed = (state: RootState) =>
  state.session.isSidebarCollapsed;

export const selectIsHydrated = (state: RootState) =>
  state.session.isHydrated;

// ─── Dashboard UI selectors ──────────────────────────────────────────────────

export const selectActiveTab = (state: RootState) =>
  state.dashboardUi.activeTab;

export const selectSelectedTaskId = (state: RootState) =>
  state.dashboardUi.selectedTaskId;

export const selectSelectedPlanId = (state: RootState) =>
  state.dashboardUi.selectedPlanId;

export const selectPlanView = (state: RootState) =>
  state.dashboardUi.planView;

export const selectReviewPlanId = (state: RootState) =>
  state.dashboardUi.reviewPlanId;

export const selectShowHistoryModal = (state: RootState) =>
  state.dashboardUi.showHistoryModal;

export const selectShowSummaryModal = (state: RootState) =>
  state.dashboardUi.showSummaryModal;

export const selectShowShortcutsModal = (state: RootState) =>
  state.dashboardUi.showShortcutsModal;

export const selectShowLaunchDialog = (state: RootState) =>
  state.dashboardUi.showLaunchDialog;

export const selectJustLaunchedPlanId = (state: RootState) =>
  state.dashboardUi.justLaunchedPlanId;

export const selectTaskStatusFilter = (state: RootState) =>
  state.dashboardUi.taskStatusFilter;

export const selectTaskSort = (state: RootState) => ({
  field: state.dashboardUi.taskSortField,
  direction: state.dashboardUi.taskSortDirection,
});

// ─── Repo snapshot selectors ─────────────────────────────────────────────────

/** Get the snapshot for the currently selected repository */
export const selectCurrentRepoSnapshot = createSelector(
  [selectCurrentRepositoryId, selectRepoSnapshots],
  (repoId, snapshots): RepoSnapshot | null => {
    if (!repoId) return null;
    return snapshots[repoId] ?? null;
  }
);

/** Get all snapshots as an array sorted by last visited */
export const selectAllSnapshotsSorted = createSelector(
  [selectRepoSnapshots],
  (snapshots): RepoSnapshot[] =>
    Object.values(snapshots).sort(
      (a, b) => new Date(b.lastVisited).getTime() - new Date(a.lastVisited).getTime()
    )
);

/** Get snapshots that need attention (stuck items or pending approvals) */
export const selectSnapshotsNeedingAttention = createSelector(
  [selectAllSnapshotsSorted],
  (snapshots): RepoSnapshot[] =>
    snapshots.filter((s) => s.stuckItems > 0 || s.pendingApprovals > 0)
);

/** Total pending approvals across all repositories */
export const selectTotalPendingApprovals = createSelector(
  [selectRepoSnapshots],
  (snapshots): number =>
    Object.values(snapshots).reduce((sum, s) => sum + (s.pendingApprovals ?? 0), 0)
);

/** Total stuck items across all repositories */
export const selectTotalStuckItems = createSelector(
  [selectRepoSnapshots],
  (snapshots): number =>
    Object.values(snapshots).reduce((sum, s) => sum + (s.stuckItems ?? 0), 0)
);

/** Aggregate session stats for the currently selected repository */
export const selectCurrentRepoStats = createSelector(
  [selectCurrentRepoSnapshot],
  (snapshot) => snapshot?.sessionStats ?? null
);

/** Whether the current repo snapshot should be shown (has context and not dismissed) */
export const selectShouldShowSnapshot = createSelector(
  [selectCurrentRepoSnapshot, selectDismissedRepoId, selectCurrentRepositoryId],
  (snapshot, dismissedId, currentRepoId): boolean => {
    if (!snapshot || !currentRepoId) return false;
    if (dismissedId === currentRepoId) return false;
    // Has context means at least one of these is meaningful
    return !!(
      snapshot.lastViewedTaskId ||
      snapshot.currentTask ||
      snapshot.pendingApprovals > 0 ||
      snapshot.stuckItems > 0 ||
      snapshot.recentEvents.length > 0
    );
  }
);

// ─── Dashboard navigation selectors ─────────────────────────────────────────

/** Whether the plans tab is active */
export const selectIsPlansTabActive = createSelector(
  [selectActiveTab],
  (tab) => tab === 'plans'
);

/** Whether a task is selected */
export const selectHasSelectedTask = createSelector(
  [selectSelectedTaskId],
  (taskId) => taskId !== null
);

/** Whether the plan detail view is showing */
export const selectIsInPlanDetail = createSelector(
  [selectPlanView, selectSelectedPlanId],
  (view, planId) => view !== 'list' && planId !== null
);
