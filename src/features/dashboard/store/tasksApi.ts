import { api } from '@/store/api';
import type { Task } from '@/db/schema/tasks';

export interface TaskWithRelations extends Task {
  session?: {
    id: string;
    repositoryId: string;
    status: string;
    repository?: {
      id: string;
      name: string;
      path: string;
      currentBranch: string | null;
    };
  };
}

export interface QAGateResult {
  gateName: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  output?: string | null;
  duration?: number | null;
  runAt?: string | null;
}

export interface TaskWithQA extends TaskWithRelations {
  qaResults?: QAGateResult[];
}

export interface CreateTaskRequest {
  sessionId: string;
  prompt: string;
}

export interface ApproveTaskRequest {
  taskId: string;
  commitMessage?: string;
}

export interface RejectTaskRequest {
  taskId: string;
  reason: string;
}

export const tasksApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getTask: builder.query<{ task: TaskWithRelations }, string>({
      query: (id) => `/tasks/${id}`,
      providesTags: (result, error, id) => [{ type: 'Task', id }],
    }),
    getTaskQAResults: builder.query<{ results: QAGateResult[] }, string>({
      query: (taskId) => `/tasks/${taskId}/qa-gates/results`,
      providesTags: (result, error, taskId) => [{ type: 'Task', id: taskId }],
    }),
    createTask: builder.mutation<{ task: Task }, CreateTaskRequest>({
      query: ({ sessionId, prompt }) => ({
        url: '/tasks',
        method: 'POST',
        body: { sessionId, prompt },
      }),
      invalidatesTags: (result) =>
        result ? [{ type: 'Session', id: result.task.sessionId }] : ['Session'],
    }),
    runTaskQAGates: builder.mutation<{ success: boolean }, string>({
      query: (taskId) => ({
        url: `/tasks/${taskId}/qa-gates/run`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, taskId) => [
        { type: 'Task', id: taskId },
      ],
    }),
  }),
});

// Approval/rejection mutations — split to keep endpoints() under line limit
const tasksApiWithApprovals = tasksApi.injectEndpoints({
  endpoints: (builder) => ({
    approveTask: builder.mutation<{ task: Task }, ApproveTaskRequest>({
      query: ({ taskId, commitMessage }) => ({
        url: `/tasks/${taskId}/approve`,
        method: 'POST',
        body: commitMessage ? { commitMessage } : {},
      }),
      onQueryStarted: async ({ taskId }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          tasksApi.util.updateQueryData('getTask', taskId, (draft) => {
            if (draft.task) draft.task.status = 'approved' as Task['status'];
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
      ],
    }),
    rejectTask: builder.mutation<{ task: Task }, RejectTaskRequest>({
      query: ({ taskId, reason }) => ({
        url: `/tasks/${taskId}/reject`,
        method: 'POST',
        body: { reason },
      }),
      onQueryStarted: async ({ taskId }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          tasksApi.util.updateQueryData('getTask', taskId, (draft) => {
            if (draft.task) draft.task.status = 'rejected' as Task['status'];
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
      ],
    }),
  }),
});

// Retry/cancel mutations — split to keep endpoints() under line limit
const tasksApiWithActions = tasksApi.injectEndpoints({
  endpoints: (builder) => ({
    retryTask: builder.mutation<{ success: boolean; message: string }, string>({
      query: (taskId) => ({
        url: `/tasks/${taskId}/retry`,
        method: 'POST',
      }),
      onQueryStarted: async (taskId, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          tasksApi.util.updateQueryData('getTask', taskId, (draft) => {
            if (draft.task) draft.task.status = 'queued' as Task['status'];
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (result, error, taskId) => [
        { type: 'Task', id: taskId },
      ],
    }),
    cancelTask: builder.mutation<{ success: boolean }, string>({
      query: (taskId) => ({
        url: `/tasks/${taskId}`,
        method: 'DELETE',
      }),
      onQueryStarted: async (taskId, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          tasksApi.util.updateQueryData('getTask', taskId, (draft) => {
            if (draft.task) draft.task.status = 'cancelled' as Task['status'];
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (result, error, taskId) => [
        { type: 'Task', id: taskId },
      ],
    }),
  }),
});

export const {
  useGetTaskQuery,
  useGetTaskQAResultsQuery,
  useCreateTaskMutation,
  useRunTaskQAGatesMutation,
} = tasksApi;

export const { useApproveTaskMutation, useRejectTaskMutation } =
  tasksApiWithApprovals;
export const { useRetryTaskMutation, useCancelTaskMutation } =
  tasksApiWithActions;
