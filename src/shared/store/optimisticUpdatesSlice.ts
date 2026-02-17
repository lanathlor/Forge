import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Optimistic Updates Slice
 *
 * Tracks in-flight operations to give INSTANT UI feedback before the server responds.
 * Each pending operation stores:
 * - The entity being modified (id + type)
 * - The optimistic state to show immediately
 * - The original state to rollback to on failure
 * - A timestamp for cleanup of stale operations
 *
 * Flow:
 * 1. User performs action → dispatch optimisticUpdate → UI updates instantly
 * 2. API call succeeds → dispatch confirmUpdate → RTK cache takes over
 * 3. API call fails → dispatch rollbackUpdate → UI reverts to original state
 */

export type OptimisticEntityType = 'task' | 'plan' | 'session' | 'planTask';

export type TaskStatusOptimistic =
  | 'queued'
  | 'running'
  | 'waiting_approval'
  | 'approved'
  | 'rejected'
  | 'failed'
  | 'cancelled';

export type PlanStatusOptimistic =
  | 'draft'
  | 'ready'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type SessionStatusOptimistic = 'active' | 'paused' | 'ended';

export interface OptimisticTaskState {
  status: TaskStatusOptimistic;
  /** Human-readable label shown in pending state */
  pendingLabel?: string;
}

export interface OptimisticPlanState {
  status: PlanStatusOptimistic;
  pendingLabel?: string;
}

export interface OptimisticSessionState {
  status: SessionStatusOptimistic;
  pendingLabel?: string;
}

export type OptimisticState =
  | OptimisticTaskState
  | OptimisticPlanState
  | OptimisticSessionState;

export interface PendingOperation {
  /** Unique operation ID (can match RTK mutation requestId) */
  operationId: string;
  entityType: OptimisticEntityType;
  entityId: string;
  /** The optimistic state to display immediately */
  optimisticState: OptimisticState;
  /** The original state to revert to on failure */
  originalState: OptimisticState;
  /** ISO timestamp for cleanup */
  startedAt: string;
}

interface OptimisticUpdatesState {
  /** Map of entityId → active pending operation (one per entity at a time) */
  pendingByEntityId: Record<string, PendingOperation>;
}

const initialState: OptimisticUpdatesState = {
  pendingByEntityId: {},
};

// Max age for a pending operation before auto-cleanup (30 seconds)
const MAX_OPERATION_AGE_MS = 30_000;

export const optimisticUpdatesSlice = createSlice({
  name: 'optimisticUpdates',
  initialState,
  reducers: {
    /**
     * Register an optimistic update when an action is initiated.
     * The UI should immediately reflect `optimisticState`.
     */
    registerOptimisticUpdate: (state, action: PayloadAction<PendingOperation>) => {
      const { entityId } = action.payload;
      state.pendingByEntityId[entityId] = action.payload;
    },

    /**
     * Confirm a successful operation — removes the pending entry.
     * RTK Query cache will have been updated by the mutation response.
     */
    confirmOptimisticUpdate: (state, action: PayloadAction<{ entityId: string; operationId: string }>) => {
      const { entityId, operationId } = action.payload;
      if (state.pendingByEntityId[entityId]?.operationId === operationId) {
        delete state.pendingByEntityId[entityId];
      }
    },

    /**
     * Roll back a failed operation — removes the pending entry.
     * Components should re-read from RTK cache (which still has original data).
     */
    rollbackOptimisticUpdate: (state, action: PayloadAction<{ entityId: string; operationId: string }>) => {
      const { entityId, operationId } = action.payload;
      if (state.pendingByEntityId[entityId]?.operationId === operationId) {
        delete state.pendingByEntityId[entityId];
      }
    },

    /**
     * Cleanup stale operations older than MAX_OPERATION_AGE_MS.
     * Call periodically or on component mount.
     */
    cleanupStaleOperations: (state) => {
      const cutoff = Date.now() - MAX_OPERATION_AGE_MS;
      for (const entityId of Object.keys(state.pendingByEntityId)) {
        const op = state.pendingByEntityId[entityId];
        if (op && new Date(op.startedAt).getTime() < cutoff) {
          delete state.pendingByEntityId[entityId];
        }
      }
    },
  },
});

export const {
  registerOptimisticUpdate,
  confirmOptimisticUpdate,
  rollbackOptimisticUpdate,
  cleanupStaleOperations,
} = optimisticUpdatesSlice.actions;

export default optimisticUpdatesSlice.reducer;
