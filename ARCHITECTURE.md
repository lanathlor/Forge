# Architecture

## Overview

Forge is a Next.js 15 application using the App Router. It follows a **vertical-slice (feature-based)** architecture: each feature owns its API handlers, UI components, business logic, types, and state — all co-located in one directory.

## Directory structure

```
src/
├── app/                          # Next.js App Router
│   ├── api/                      # Thin API route wrappers → delegate to features
│   ├── layout.tsx
│   └── page.tsx
│
├── features/                     # One directory per product feature
│   ├── repositories/             # Repository discovery & management
│   │   ├── api/                  # Request handlers
│   │   ├── components/           # Feature-specific UI
│   │   ├── lib/                  # Business logic (scanner, etc.)
│   │   ├── types/
│   │   └── store/                # RTK Query endpoints
│   ├── sessions/                 # Claude Code session tracking
│   ├── dashboard/                # Main task dashboard
│   ├── qa-gates/                 # Gate runner + results UI
│   ├── diff-viewer/              # Monaco-based diff display
│   ├── activity/                 # Activity feed
│   ├── settings/                 # App settings
│   └── plans/                   # Plans feature
│
├── shared/                       # Code used by 3+ features
│   ├── components/               # Generic UI primitives (Button, Card, etc.)
│   ├── hooks/                    # Reusable hooks
│   ├── services/                 # GlobalSSEManager, etc.
│   ├── store/                    # Shared Redux slices
│   └── lib/                     # Generic utilities
│
├── db/                           # Database layer
│   ├── schema/                   # Drizzle ORM table definitions
│   ├── migrations/               # Generated SQL migrations
│   └── index.ts                  # DB client
│
├── store/
│   ├── api.ts                    # RTK Query base API (empty endpoints)
│   └── index.ts                  # configureStore + slice registration
│
└── types/                        # Global shared TypeScript types
```

## Feature structure

Each feature follows the same internal layout:

```
src/features/{feature}/
├── api/
│   └── handlers.ts       # All business logic for API routes
├── components/
│   └── FeatureName.tsx   # UI components
├── lib/
│   └── core.ts           # Pure business logic (no HTTP, no React)
├── types/
│   └── index.ts          # Feature-specific TypeScript types
└── store/
    └── featureApi.ts     # RTK Query endpoint injection
```

API routes in `src/app/api/` are thin wrappers:

```typescript
// src/app/api/repositories/route.ts
import { handleGetRepositories } from '@/features/repositories/api/handlers';

export async function GET(request: Request) {
  return handleGetRepositories(request);
}
```

All logic lives in the feature's `handlers.ts`, not in the route file.

## State management

| State type | Tool | Location |
|---|---|---|
| Server/API data | RTK Query | `features/{feature}/store/` |
| Global client state | Redux slices | `features/{feature}/store/` or `shared/store/` |
| Local UI state | `useState` | Component |
| URL state | `searchParams` | Next.js router |

### RTK Query: inject pattern

The base API in `src/store/api.ts` has **no endpoints**:

```typescript
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Repository', 'Session', 'Task', 'QAGate'],
  endpoints: () => ({}),
});
```

Each feature injects its own endpoints:

```typescript
// src/features/repositories/store/repositoriesApi.ts
import { api } from '@/store/api';

export const repositoriesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getRepositories: builder.query({
      query: () => '/repositories',
      providesTags: ['Repository'],
    }),
  }),
});

export const { useGetRepositoriesQuery } = repositoriesApi;
```

Features are registered in `src/store/index.ts` by importing them (side-effect import):

```typescript
import '@/features/repositories/store/repositoriesApi';
```

### Optimistic updates

Mutations that need instant UI feedback follow the patch/undo pattern:

```typescript
async onQueryStarted(args, { dispatch, queryFulfilled }) {
  const patch = dispatch(
    featureApi.util.updateQueryData('getItems', args.id, (draft) => {
      // mutate draft
    })
  );
  try {
    await queryFulfilled;
  } catch {
    patch.undo();
  }
}
```

Always use the **feature's own API** (`featureApi.util.updateQueryData`), not the base `api` — the base API doesn't know about injected endpoint types.

## Data flow

```
User action
  → React component
  → RTK Query hook
  → Next.js API route
  → Feature handler
  → Drizzle ORM
  → SQLite / PostgreSQL
```

Real-time updates travel the reverse path via **Server-Sent Events** (`GlobalSSEManager`).

## Database

- **Dev**: SQLite via `better-sqlite3`
- **Prod**: PostgreSQL (set `DATABASE_URL` to a postgres connection string)
- **ORM**: Drizzle — schema in `src/db/schema/`, migrations in `src/db/migrations/`

Key tables: `repositories`, `sessions`, `tasks`, `qa_gate_configs`, `qa_gate_results`, `activity_logs`

### Migrations

```bash
# After changing src/db/schema/
pnpm db:generate   # generate SQL migration
pnpm db:push       # apply to database
```

## Conventions

### Naming

- Components: `PascalCase.tsx`
- Utilities / handlers: `camelCase.ts`
- Constants: `UPPER_SNAKE_CASE`
- Types file per directory: `index.ts` or `types.ts`

### Imports

Use `@/` for all absolute imports:

```typescript
import { db } from '@/db';
import { Button } from '@/shared/components/ui/button';
import { useGetRepositoriesQuery } from '@/features/repositories/store/repositoriesApi';
```

### Theme

Dark mode is the primary theme. The `dark` class is set on `<html>` in `layout.tsx`. All components must work correctly in dark mode.

## Docker

Development:

```bash
docker-compose up
```

The workspace directory is mounted **read-write** — Forge needs write access to create commits and revert changes.

Production:

```bash
docker build --target runner -t forge:prod .
docker run -p 3000:3000 \
  -v ./forge.db:/app/forge.db \
  -v /path/to/workspace:/workspace \
  forge:prod
```

## Testing

- **Unit tests**: `src/features/{feature}/lib/` — pure functions, no React
- **Component tests**: complex UI components with Testing Library
- **E2E tests**: critical user flows with Playwright

```bash
pnpm test          # unit + component (Vitest)
pnpm test:e2e      # E2E (Playwright)
pnpm test:coverage # coverage report
```

## Adding a new feature

1. Create `src/features/{feature}/` with subdirs: `api/`, `components/`, `lib/`, `types/`, `store/`
2. Implement business logic in `lib/`
3. Add API handlers in `api/handlers.ts`
4. Create RTK Query endpoints in `store/{feature}Api.ts`
5. Register in `src/store/index.ts`
6. Wire up the Next.js route in `src/app/api/{feature}/route.ts`
7. Build UI components in `components/`
8. Only move code to `shared/` if genuinely needed by 3+ features
