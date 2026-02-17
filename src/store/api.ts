import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Base API setup for RTK Query
 *
 * IMPORTANT: Do NOT define endpoints here!
 * Each feature should inject its own endpoints using api.injectEndpoints()
 *
 * Example:
 * ```typescript
 * // src/features/myFeature/store/myFeatureApi.ts
 * import { api } from '@/store/api';
 *
 * export const myFeatureApi = api.injectEndpoints({
 *   endpoints: (builder) => ({
 *     getItems: builder.query({ ... }),
 *   }),
 * });
 *
 * export const { useGetItemsQuery } = myFeatureApi;
 * ```
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: [
    'Repository',
    'Session',
    'Task',
    'QAGate',
    'Plan',
    'Phase',
    'PlanTask',
    'Activity',
  ],
  endpoints: () => ({}), // Empty - features will inject their endpoints
});
