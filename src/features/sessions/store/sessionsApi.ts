import { api } from '@/store/api';
import type { Session, SessionStatus } from '@/db/schema/sessions';
import type { Task } from '@/db/schema/tasks';

export interface SessionWithTasks extends Session {
  tasks: Task[];
  repository?: {
    id: string;
    name: string;
    path: string;
    currentBranch: string | null;
  };
}

export interface SessionWithStats extends Session {
  taskCount: number;
}

export interface SessionSummary {
  session: Session & {
    repository: {
      id: string;
      name: string;
      path: string;
      currentBranch: string | null;
    };
  };
  stats: {
    totalTasks: number;
    completedTasks: number;
    rejectedTasks: number;
    failedTasks: number;
    filesChanged: number;
    commits: number;
    duration: number;
  };
}

export interface ListSessionsParams {
  repositoryId: string;
  limit?: number;
  offset?: number;
  status?: SessionStatus;
}

export const sessionsApi = api.injectEndpoints({
  /* eslint-disable max-lines-per-function */
  endpoints: (builder) => ({
    // Get or create active session for a repository
    getActiveSession: builder.query<{ session: Session }, string>({
      query: (repositoryId) => `/sessions?repositoryId=${repositoryId}`,
      providesTags: (result) =>
        result ? [{ type: 'Session', id: result.session.id }] : ['Session'],
    }),

    // Get session by ID with all tasks
    getSession: builder.query<{ session: SessionWithTasks }, string>({
      query: (id) => `/sessions/${id}`,
      providesTags: (result, error, id) => [{ type: 'Session', id }],
    }),

    // Get session summary with stats
    getSessionSummary: builder.query<SessionSummary, string>({
      query: (id) => `/sessions/${id}?summary=true`,
      providesTags: (result, error, id) => [{ type: 'Session', id }],
    }),

    // List sessions for a repository
    listSessions: builder.query<{ sessions: SessionWithStats[] }, ListSessionsParams>({
      query: ({ repositoryId, limit = 10, offset = 0, status }) => {
        let url = `/sessions?repositoryId=${repositoryId}&list=true&limit=${limit}&offset=${offset}`;
        if (status) {
          url += `&status=${status}`;
        }
        return url;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.sessions.map((s) => ({ type: 'Session' as const, id: s.id })),
              { type: 'Session', id: 'LIST' },
            ]
          : [{ type: 'Session', id: 'LIST' }],
    }),

    // End a session
    endSession: builder.mutation<{ session: Session }, string>({
      query: (id) => ({
        url: `/sessions/${id}`,
        method: 'PATCH',
        body: { action: 'end' },
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'Session', id },
        { type: 'Session', id: 'LIST' },
      ],
    }),

    // Pause a session
    pauseSession: builder.mutation<{ session: Session }, string>({
      query: (id) => ({
        url: `/sessions/${id}`,
        method: 'PATCH',
        body: { action: 'pause' },
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Session', id }],
    }),

    // Resume a session
    resumeSession: builder.mutation<{ session: Session }, string>({
      query: (id) => ({
        url: `/sessions/${id}`,
        method: 'PATCH',
        body: { action: 'resume' },
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Session', id }],
    }),

    // Delete a session
    deleteSession: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/sessions/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'Session', id },
        { type: 'Session', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetActiveSessionQuery,
  useGetSessionQuery,
  useGetSessionSummaryQuery,
  useListSessionsQuery,
  useEndSessionMutation,
  usePauseSessionMutation,
  useResumeSessionMutation,
  useDeleteSessionMutation,
} = sessionsApi;
