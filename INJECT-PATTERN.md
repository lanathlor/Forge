# RTK Query Inject Pattern - Implementation Guide

**Status**: ✅ Implemented
**Date**: 2026-02-01

## The Problem (Before)

❌ **Centralized endpoints** - All features defined in one file:

```typescript
// src/store/api.ts (BAD)
export const api = createApi({
  endpoints: (builder) => ({
    // Repositories
    getRepositories: builder.query({...}),
    getRepository: builder.query({...}),

    // Sessions
    getSessions: builder.query({...}),

    // Tasks
    getTasks: builder.query({...}),

    // This file grows forever! ❌
  }),
});
```

**Issues**:
- Tight coupling between unrelated features
- Merge conflicts when multiple teams work
- Hard to add/remove features
- One massive file that grows forever
- Violates feature-based architecture

## The Solution (After)

✅ **Inject Pattern** - Each feature owns its endpoints:

### 1. Base API (Minimal)

```typescript
// src/store/api.ts - ONLY base setup
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Repository', 'Session', 'Task', 'QAGate'],
  endpoints: () => ({}), // EMPTY! ✅
});
```

**This file never grows!**

### 2. Feature Injects Endpoints

```typescript
// src/features/repositories/store/repositoriesApi.ts
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

// Export hooks from THIS feature file
export const {
  useGetRepositoriesQuery,
  useGetRepositoryQuery,
  useRescanRepositoriesMutation,
} = repositoriesApi;
```

### 3. Register in Store

```typescript
// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { api } from './api';

// Import feature APIs to register their endpoints
import '@/features/repositories/store/repositoriesApi';
import '@/features/sessions/store/sessionsApi'; // When created
import '@/features/tasks/store/tasksApi';       // When created

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});
```

### 4. Use in Components

```typescript
// src/features/repositories/components/RepositorySelector.tsx
import {
  useGetRepositoriesQuery,
  useRescanRepositoriesMutation,
} from '../store/repositoriesApi'; // From feature!

export function RepositorySelector() {
  const { data, isLoading } = useGetRepositoriesQuery();
  const [rescan] = useRescanRepositoriesMutation();

  // ...
}
```

## Current Implementation

### File Structure

```
src/
├── store/
│   ├── api.ts              # Base API only (EMPTY endpoints)
│   └── index.ts            # Store config + imports
│
├── features/
│   ├── repositories/
│   │   └── store/
│   │       └── repositoriesApi.ts  # Injects endpoints ✅
│   │
│   ├── sessions/
│   │   └── store/
│   │       ├── sessionsApi.ts      # Will inject when created
│   │       └── sessionSlice.ts     # Redux slice
│   │
│   └── tasks/
│       └── store/
│           └── tasksApi.ts         # Will inject when created
│
└── shared/
    └── store/
        └── uiSlice.ts              # Shared Redux slice
```

### Benefits Achieved

1. ✅ **Feature Isolation** - Each feature owns its API code
2. ✅ **No Central File** - Base API never grows
3. ✅ **Easy to Add** - Create new feature API file
4. ✅ **Easy to Remove** - Delete feature folder
5. ✅ **No Conflicts** - Teams work in separate files
6. ✅ **Clear Ownership** - Feature owns everything
7. ✅ **Type Safety** - Full TypeScript inference

## Adding a New Feature API

Template for new features:

```typescript
// src/features/myFeature/store/myFeatureApi.ts
import { api } from '@/store/api';

export const myFeatureApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // GET query
    getItems: builder.query({
      query: () => '/items',
      providesTags: ['MyFeature'],
    }),

    // GET by ID
    getItem: builder.query({
      query: (id) => `/items/${id}`,
      providesTags: (result, error, id) => [{ type: 'MyFeature', id }],
    }),

    // POST mutation
    createItem: builder.mutation({
      query: (data) => ({
        url: '/items',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['MyFeature'],
    }),

    // PUT mutation
    updateItem: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/items/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'MyFeature', id },
      ],
    }),

    // DELETE mutation
    deleteItem: builder.mutation({
      query: (id) => ({
        url: `/items/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'MyFeature', id },
      ],
    }),
  }),
});

// Export ALL hooks from this feature
export const {
  useGetItemsQuery,
  useGetItemQuery,
  useCreateItemMutation,
  useUpdateItemMutation,
  useDeleteItemMutation,
} = myFeatureApi;
```

Then register in store:

```typescript
// src/store/index.ts
import '@/features/myFeature/store/myFeatureApi'; // Add this line
```

And add tag type:

```typescript
// src/store/api.ts
export const api = createApi({
  tagTypes: ['Repository', 'Session', 'Task', 'QAGate', 'MyFeature'], // Add tag
  // ...
});
```

## Rules

### ✅ DO

1. **Keep base API empty** - Only setup, no endpoints
2. **Inject from features** - Use `api.injectEndpoints()`
3. **Export hooks from feature** - Not from base API
4. **Import in store/index.ts** - To register endpoints
5. **One feature API per feature** - Keep it organized

### ❌ DON'T

1. **Don't add endpoints to base API** - Always inject
2. **Don't export hooks from base API** - Export from feature
3. **Don't skip registration** - Must import in store
4. **Don't mix features** - Each feature = separate file
5. **Don't duplicate endpoints** - One source of truth

## Testing

All tests passing:

```bash
✅ pnpm type-check  # TypeScript compilation
✅ pnpm lint        # ESLint
✅ API working      # /api/repositories returns data
```

## Migration Checklist

When converting existing endpoints:

- [ ] Create `src/features/{feature}/store/{feature}Api.ts`
- [ ] Use `api.injectEndpoints()`
- [ ] Export hooks from feature file
- [ ] Import in `src/store/index.ts`
- [ ] Remove from base `src/store/api.ts`
- [ ] Update component imports
- [ ] Test functionality
- [ ] Run type-check and lint

## References

- [RTK Query Code Splitting](https://redux-toolkit.js.org/rtk-query/usage/code-splitting)
- `ARCHITECTURE.md` - Full architecture guide
- `src/features/repositories/store/repositoriesApi.ts` - Reference implementation

---

**Remember**: Base API should NEVER have endpoints defined. Always inject! 🎯
