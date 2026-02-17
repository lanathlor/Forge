import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type DashboardTab = 'tasks' | 'plans' | 'qa-gates' | 'summary';
export type PlanView = 'list' | 'detail' | 'execution';

interface DashboardUiState {
  /** Currently selected tab in the dashboard */
  activeTab: DashboardTab;
  /** Currently selected task ID in the task list */
  selectedTaskId: string | null;
  /** Currently selected plan ID */
  selectedPlanId: string | null;
  /** Current plan view mode */
  planView: PlanView;
  /** Plan ID being reviewed/refined */
  reviewPlanId: string | null;
  /** Whether the session history modal is open */
  showHistoryModal: boolean;
  /** Whether the session summary modal is open */
  showSummaryModal: boolean;
  /** Whether the keyboard shortcuts modal is open */
  showShortcutsModal: boolean;
  /** Whether the plan launch dialog is open */
  showLaunchDialog: boolean;
  /** Plan that was just launched (for post-launch UX) */
  justLaunchedPlanId: string | null;
  /** Task filter for the task list */
  taskStatusFilter: string | null;
  /** Task sort field */
  taskSortField: 'createdAt' | 'status' | 'prompt' | null;
  /** Task sort direction */
  taskSortDirection: 'asc' | 'desc';
}

const initialState: DashboardUiState = {
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
  taskSortField: 'createdAt',
  taskSortDirection: 'desc',
};

export const dashboardUiSlice = createSlice({
  name: 'dashboardUi',
  initialState,
  reducers: {
    setActiveTab: (state, action: PayloadAction<DashboardTab>) => {
      state.activeTab = action.payload;
    },

    setSelectedTaskId: (state, action: PayloadAction<string | null>) => {
      state.selectedTaskId = action.payload;
    },

    setSelectedPlanId: (state, action: PayloadAction<string | null>) => {
      state.selectedPlanId = action.payload;
      if (action.payload) {
        state.planView = 'detail';
      }
    },

    setPlanView: (state, action: PayloadAction<PlanView>) => {
      state.planView = action.payload;
    },

    setReviewPlanId: (state, action: PayloadAction<string | null>) => {
      state.reviewPlanId = action.payload;
    },

    openPlanExecution: (state, action: PayloadAction<string>) => {
      state.selectedPlanId = action.payload;
      state.planView = 'execution';
      state.activeTab = 'plans';
    },

    resetPlanView: (state) => {
      state.selectedPlanId = null;
      state.planView = 'list';
      state.reviewPlanId = null;
    },

    setShowHistoryModal: (state, action: PayloadAction<boolean>) => {
      state.showHistoryModal = action.payload;
    },

    setShowSummaryModal: (state, action: PayloadAction<boolean>) => {
      state.showSummaryModal = action.payload;
    },

    setShowShortcutsModal: (state, action: PayloadAction<boolean>) => {
      state.showShortcutsModal = action.payload;
    },

    setShowLaunchDialog: (state, action: PayloadAction<boolean>) => {
      state.showLaunchDialog = action.payload;
    },

    setJustLaunchedPlanId: (state, action: PayloadAction<string | null>) => {
      state.justLaunchedPlanId = action.payload;
    },

    setTaskStatusFilter: (state, action: PayloadAction<string | null>) => {
      state.taskStatusFilter = action.payload;
    },

    setTaskSort: (
      state,
      action: PayloadAction<{ field: DashboardUiState['taskSortField']; direction?: DashboardUiState['taskSortDirection'] }>
    ) => {
      const { field, direction } = action.payload;
      if (state.taskSortField === field && !direction) {
        // Toggle direction when clicking the same field
        state.taskSortDirection = state.taskSortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        state.taskSortField = field;
        state.taskSortDirection = direction ?? 'desc';
      }
    },

    /** Reset all dashboard UI state (e.g. when switching repositories) */
    resetDashboardUi: () => initialState,
  },
});

export const {
  setActiveTab,
  setSelectedTaskId,
  setSelectedPlanId,
  setPlanView,
  setReviewPlanId,
  openPlanExecution,
  resetPlanView,
  setShowHistoryModal,
  setShowSummaryModal,
  setShowShortcutsModal,
  setShowLaunchDialog,
  setJustLaunchedPlanId,
  setTaskStatusFilter,
  setTaskSort,
  resetDashboardUi,
} = dashboardUiSlice.actions;

export default dashboardUiSlice.reducer;
