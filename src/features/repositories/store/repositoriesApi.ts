import { api } from '@/store/api';

export const repositoriesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getRepositories: builder.query({
      query: () => '/repositories',
      providesTags: ['Repository'],
    }),
    getRepository: builder.query({
      query: (id) => `/repositories/${id}`,
      providesTags: (result, error, id) => [{ type: 'Repository', id }],
    }),
    rescanRepositories: builder.mutation({
      query: () => ({
        url: '/repositories/rescan',
        method: 'POST',
      }),
      invalidatesTags: ['Repository'],
    }),
  }),
});

export const {
  useGetRepositoriesQuery,
  useGetRepositoryQuery,
  useRescanRepositoriesMutation,
} = repositoriesApi;
