import { api } from '@/store/api';
import type { Plan, Phase, PlanTask, PlanIteration } from '@/db/schema';

export interface PlanWithDetails {
  plan: Plan;
  phases: Phase[];
  tasks: PlanTask[];
  iterations: PlanIteration[];
}

export interface GeneratePlanRequest {
  repositoryId: string;
  title: string;
  description: string;
}

export interface CreatePlanRequest {
  repositoryId: string;
  title: string;
  description?: string;
}

export interface UpdatePlanRequest {
  title?: string;
  description?: string;
  status?: 'draft' | 'ready' | 'running' | 'paused' | 'completed' | 'failed';
}

export interface ReviewPlanRequest {
  reviewType: 'refine_descriptions' | 'add_missing' | 'optimize_order' | 'break_down';
  scope?: 'all' | 'phase' | 'task';
  targetId?: string;
}

export interface ReviewResult {
  iterationId: string;
  suggestions: Array<{
    type: string;
    target: string;
    reasoning: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  }>;
}

export interface ApplySuggestionsRequest {
  iterationId: string;
  suggestionIndices: number[];
}

// Helper to update plan status in both caches optimistically.
// Must be called after plansApi is defined (closures capture by reference).
function optimisticPlanStatusUpdate(
  id: string,
  status: Plan['status'],
  dispatch: (action: unknown) => unknown,
) {
  const patchPlan = dispatch(
    plansApi.util.updateQueryData('getPlan', id, (draft) => {
      if (draft.plan) {
        draft.plan.status = status;
      }
    }),
  ) as { undo: () => void };

  const patchList = dispatch(
    plansApi.util.updateQueryData('getPlans', undefined, (draft) => {
      const plan = draft.plans.find((p: Plan) => p.id === id);
      if (plan) plan.status = status;
    }),
  ) as { undo: () => void };

  return { patchPlan, patchList };
}

/* eslint-disable max-lines-per-function */
export const plansApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get all plans (optionally filtered by repository)
    getPlans: builder.query<{ plans: Plan[] }, string | void>({
      query: (repositoryId) =>
        repositoryId ? `/plans?repositoryId=${repositoryId}` : '/plans',
      providesTags: (result) =>
        result
          ? [
              ...result.plans.map((p) => ({ type: 'Plan' as const, id: p.id })),
              { type: 'Plan', id: 'LIST' },
            ]
          : [{ type: 'Plan', id: 'LIST' }],
    }),

    // Get a single plan with all details
    getPlan: builder.query<PlanWithDetails, string>({
      query: (id) => `/plans/${id}`,
      providesTags: (result, error, id) => [{ type: 'Plan', id }],
    }),

    // Create a new plan manually
    createPlan: builder.mutation<{ plan: Plan }, CreatePlanRequest>({
      query: (data) => ({
        url: '/plans',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'Plan', id: 'LIST' }],
    }),

    // Generate a plan with Claude
    generatePlan: builder.mutation<
      { plan: Plan; phases: Phase[]; tasks: PlanTask[] },
      GeneratePlanRequest
    >({
      query: (data) => ({
        url: '/plans/generate',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'Plan', id: 'LIST' }],
    }),

    // Update a plan
    updatePlan: builder.mutation<
      { plan: Plan },
      { id: string; data: UpdatePlanRequest }
    >({
      query: ({ id, data }) => ({
        url: `/plans/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Plan', id }],
    }),

    // Delete a plan
    deletePlan: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/plans/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'Plan', id },
        { type: 'Plan', id: 'LIST' },
      ],
    }),

    // Review a plan with Claude
    reviewPlan: builder.mutation<
      ReviewResult,
      { id: string; data: ReviewPlanRequest }
    >({
      query: ({ id, data }) => ({
        url: `/plans/${id}/review`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Plan', id }],
    }),

    // Apply suggestions to a plan
    applySuggestions: builder.mutation<
      { plan: Plan; phases: Phase[]; tasks: PlanTask[] },
      { id: string; data: ApplySuggestionsRequest }
    >({
      query: ({ id, data }) => ({
        url: `/plans/${id}/apply-suggestions`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Plan', id }],
    }),

    /**
     * Execute a plan.
     * Optimistically updates status to 'running' on both getPlan and getPlans caches.
     */
    executePlan: builder.mutation<{ status: string; message: string }, string>({
      query: (id) => ({
        url: `/plans/${id}/execute`,
        method: 'POST',
      }),
      onQueryStarted: async (id, { dispatch, queryFulfilled }) => {
        const { patchPlan, patchList } = optimisticPlanStatusUpdate(id, 'running', dispatch);
        try {
          await queryFulfilled;
        } catch {
          patchPlan.undo();
          patchList.undo();
        }
      },
      invalidatesTags: (result, error, id) => [{ type: 'Plan', id }],
    }),

    /**
     * Pause plan execution.
     * Optimistically updates status to 'paused' instantly.
     */
    pausePlan: builder.mutation<{ plan: Plan }, string>({
      query: (id) => ({
        url: `/plans/${id}/pause`,
        method: 'POST',
      }),
      onQueryStarted: async (id, { dispatch, queryFulfilled }) => {
        const { patchPlan, patchList } = optimisticPlanStatusUpdate(id, 'paused', dispatch);
        try {
          await queryFulfilled;
        } catch {
          patchPlan.undo();
          patchList.undo();
        }
      },
      invalidatesTags: (result, error, id) => [{ type: 'Plan', id }],
    }),

    /**
     * Resume plan execution.
     * Optimistically updates status to 'running' instantly.
     */
    resumePlan: builder.mutation<{ status: string; message: string }, string>({
      query: (id) => ({
        url: `/plans/${id}/resume`,
        method: 'POST',
      }),
      onQueryStarted: async (id, { dispatch, queryFulfilled }) => {
        const { patchPlan, patchList } = optimisticPlanStatusUpdate(id, 'running', dispatch);
        try {
          await queryFulfilled;
        } catch {
          patchPlan.undo();
          patchList.undo();
        }
      },
      invalidatesTags: (result, error, id) => [{ type: 'Plan', id }],
    }),

    /**
     * Cancel plan execution.
     * Optimistically updates status to 'failed' instantly, then reconciles with server.
     */
    cancelPlan: builder.mutation<{ plan: Plan }, string>({
      query: (id) => ({
        url: `/plans/${id}/cancel`,
        method: 'POST',
      }),
      onQueryStarted: async (id, { dispatch, queryFulfilled }) => {
        // Optimistically show as failed (most likely outcome of cancel)
        const { patchPlan, patchList } = optimisticPlanStatusUpdate(id, 'failed', dispatch);
        try {
          const { data } = await queryFulfilled;
          // Reconcile with actual server status
          dispatch(
            plansApi.util.updateQueryData('getPlan', id, (draft) => {
              if (draft.plan && data.plan) {
                draft.plan.status = data.plan.status;
              }
            }),
          );
        } catch {
          patchPlan.undo();
          patchList.undo();
        }
      },
      invalidatesTags: (result, error, id) => [{ type: 'Plan', id }],
    }),

    // Phase management
    createPhase: builder.mutation<{ phase: Phase }, Partial<Phase>>({
      query: (data) => ({
        url: '/phases',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, data) => [{ type: 'Plan', id: data.planId }],
    }),

    updatePhase: builder.mutation<{ phase: Phase }, { id: string; data: Partial<Phase> }>({
      query: ({ id, data }) => ({
        url: `/phases/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { data }) => [{ type: 'Plan', id: data.planId }],
    }),

    deletePhase: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/phases/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Plan', id: 'LIST' }],
    }),

    // Task management
    createPlanTask: builder.mutation<{ task: PlanTask }, Partial<PlanTask>>({
      query: (data) => ({
        url: '/plan-tasks',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, data) => [{ type: 'Plan', id: data.planId }],
    }),

    updatePlanTask: builder.mutation<{ task: PlanTask }, { id: string; data: Partial<PlanTask> }>({
      query: ({ id, data }) => ({
        url: `/plan-tasks/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { data }) => [{ type: 'Plan', id: data.planId }],
    }),

    deletePlanTask: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/plan-tasks/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Plan', id: 'LIST' }],
    }),

    retryPlanTask: builder.mutation<{ task: PlanTask }, string>({
      query: (id) => ({
        url: `/plan-tasks/${id}/retry`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, _id) => [
        { type: 'Plan', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetPlansQuery,
  useGetPlanQuery,
  useCreatePlanMutation,
  useGeneratePlanMutation,
  useUpdatePlanMutation,
  useDeletePlanMutation,
  useReviewPlanMutation,
  useApplySuggestionsMutation,
  useExecutePlanMutation,
  usePausePlanMutation,
  useResumePlanMutation,
  useCancelPlanMutation,
  useCreatePhaseMutation,
  useUpdatePhaseMutation,
  useDeletePhaseMutation,
  useCreatePlanTaskMutation,
  useUpdatePlanTaskMutation,
  useDeletePlanTaskMutation,
  useRetryPlanTaskMutation,
} = plansApi;
