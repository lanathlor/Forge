import { api } from '@/store/api';
import type { ActivityItem } from '@/app/components/RecentActivity';

export interface ActivityResponse {
  items: ActivityItem[];
  hasMore: boolean;
  total: number;
}

export interface GetActivityParams {
  repositoryId?: string;
  limit?: number;
  offset?: number;
  since?: string;
}

export const activityApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getActivity: builder.query<ActivityResponse, GetActivityParams | void>({
      query: (params) => {
        const searchParams = new URLSearchParams();

        if (params?.repositoryId) {
          searchParams.set('repositoryId', params.repositoryId);
        }
        if (params?.limit) {
          searchParams.set('limit', String(params.limit));
        }
        if (params?.offset) {
          searchParams.set('offset', String(params.offset));
        }
        if (params?.since) {
          searchParams.set('since', params.since);
        }

        const queryString = searchParams.toString();
        return `/activity${queryString ? `?${queryString}` : ''}`;
      },
      // Invalidate when tasks, sessions, plans change
      providesTags: ['Task', 'Session', 'Plan'],
    }),
  }),
});

export const { useGetActivityQuery } = activityApi;
