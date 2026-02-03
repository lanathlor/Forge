# Autobot Architecture

## Core Principles

### 1. Feature-Based Architecture (CRITICAL)

**DO NOT organize by technical type (components/, lib/, api/)**
**DO organize by business feature**

This is a VERTICAL SLICE architecture where each feature contains all its layers.

### Correct Structure

```
src/
├── features/
│   ├── repositories/           # Repository discovery & management
│   │   ├── api/               # API route handlers
│   │   │   └── route.ts
│   │   ├── components/        # Feature UI components
│   │   │   └── RepositorySelector.tsx
│   │   ├── lib/               # Business logic
│   │   │   └── scanner.ts
│   │   ├── types/             # Feature-specific types
│   │   │   └── index.ts
│   │   └── store/             # RTK Query endpoints
│   │       └── repositoriesApi.ts
│   │
│   ├── sessions/              # Session management
│   │   ├── api/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── types/
│   │   └── store/
│   │
│   ├── tasks/                 # Task execution
│   │   ├── api/
│   │   ├── components/
│   │   ├── lib/
│   │   └── store/
│   │
│   └── qa-gates/              # QA gate system
│       ├── api/
│       ├── components/
│       ├── lib/
│       └── store/
│
├── shared/                    # Truly shared code ONLY
│   ├── components/            # Generic UI (Button, Card, etc.)
│   ├── hooks/                 # Generic hooks
│   ├── lib/                   # Generic utilities
│   └── types/                 # Shared types
│
├── db/                        # Database layer (Drizzle)
│   ├── schema/
│   ├── migrations/
│   └── index.ts
│
└── app/                       # Next.js App Router
    ├── api/                   # Re-exports from features
    ├── layout.tsx
    └── page.tsx
```

### Why Feature-Based?

1. **Colocation**: Related code lives together
2. **Encapsulation**: Feature boundaries are clear
3. **Scalability**: Easy to add/remove features
4. **Team Collaboration**: Teams can own features
5. **Maintenance**: Changes are localized

### Anti-Patterns (DO NOT DO THIS)

❌ **Wrong**:
```
src/
├── components/        # All components mixed together
├── lib/              # All business logic mixed
├── api/              # All API routes mixed
└── types/            # All types mixed
```

This creates:
- Tight coupling between unrelated features
- Merge conflicts
- Hard to navigate
- Difficult to delete features
- Unclear boundaries

### Migration Guide

When adding a new feature:

1. Create `src/features/{feature-name}/`
2. Add subdirectories: `api/`, `components/`, `lib/`, `types/`, `store/`
3. Implement vertically - complete one feature at a time
4. Only move to `shared/` if truly used by 3+ features

## Technology Stack

### Frontend
- **Next.js 15** (App Router)
- **React 19**
- **TypeScript** (strict mode)
- **Tailwind CSS** (dark mode by default)
- **shadcn/ui** (component library)

### State Management
- **Redux Toolkit** (global state)
- **RTK Query** (data fetching & caching)

### Database
- **SQLite** (dev) / **PostgreSQL** (prod)
- **Drizzle ORM** (type-safe queries)

### Deployment
- **Docker** (containerization)
- **Docker Compose** (local development)

## Dark Mode

**Default**: Dark mode is the PRIMARY theme.

- Use `dark` class by default in `layout.tsx`
- Light mode is secondary/optional
- All components must support dark mode first

## Data Flow

```
User Action
    ↓
React Component
    ↓
RTK Query Hook (useGetRepositoriesQuery)
    ↓
API Endpoint (/api/repositories)
    ↓
Feature Business Logic (scanner.ts)
    ↓
Database (Drizzle ORM)
    ↓
Response back up the chain
```

## API Routes

API routes in `app/api/` are THIN wrappers:

```typescript
// app/api/repositories/route.ts
import { handleGetRepositories } from '@/features/repositories/api/handlers';

export async function GET(request: Request) {
  return handleGetRepositories(request);
}
```

All logic lives in the feature's `api/handlers.ts`.

## Testing Strategy

- **Unit Tests**: Feature `lib/` functions
- **Integration Tests**: API endpoints
- **E2E Tests**: Critical user flows
- **Component Tests**: Complex UI components

## Docker Volume Mounts

**CRITICAL**: Repository workspace must be READ-WRITE

```yaml
volumes:
  - /home/lanath/Work:/workspace  # NO :ro flag!
```

The app needs write access to:
- Create commits
- Revert changes
- Update git state

## File Naming Conventions

- **Components**: PascalCase (`RepositorySelector.tsx`)
- **Utilities**: camelCase (`scanner.ts`)
- **Types**: `index.ts` or `types.ts`
- **API handlers**: `handlers.ts` or `route.ts`
- **Constants**: UPPER_SNAKE_CASE in `constants.ts`

## Import Aliases

Use `@/` for absolute imports:

```typescript
import { db } from '@/db';
import { RepositorySelector } from '@/features/repositories/components/RepositorySelector';
import { Button } from '@/shared/components/ui/button';
```

## State Management Rules

1. **Server State**: Use RTK Query (API data)
2. **Global Client State**: Use Redux slices (UI state, current session)
3. **Local State**: Use React useState (form inputs, toggles)
4. **URL State**: Use Next.js searchParams (filters, pagination)

### RTK Query Inject Pattern (CRITICAL)

**DO NOT define endpoints in `src/store/api.ts`**
**DO inject endpoints from feature files**

The base API file should be minimal:

```typescript
// src/store/api.ts
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Repository', 'Session', 'Task', 'QAGate'],
  endpoints: () => ({}), // EMPTY!
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
    rescanRepositories: builder.mutation({
      query: () => ({
        url: '/repositories/rescan',
        method: 'POST',
      }),
      invalidatesTags: ['Repository'],
    }),
  }),
});

// Export hooks from the feature
export const {
  useGetRepositoriesQuery,
  useRescanRepositoriesMutation,
} = repositoriesApi;
```

Import feature APIs in store to register them:

```typescript
// src/store/index.ts
import { api } from './api';
import '@/features/repositories/store/repositoriesApi'; // Registers endpoints

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});
```

**Benefits**:
- Features are self-contained
- Endpoints live with their feature
- Easy to add/remove features
- No central file that grows forever

### Redux Slices Organization

**Feature-specific slices** → `src/features/{feature}/store/`
```typescript
// src/features/sessions/store/sessionSlice.ts
export default sessionSlice.reducer;
```

**Shared slices** → `src/shared/store/`
```typescript
// src/shared/store/uiSlice.ts
export default uiSlice.reducer;
```

## Security Considerations

1. Never commit `.env` files
2. Validate all API inputs with Zod
3. Sanitize git commands (no command injection)
4. Rate limit API endpoints
5. Use CSRF protection in production

## Performance

1. Use React.memo for expensive components
2. Implement virtual scrolling for long lists
3. Lazy load Monaco Editor
4. Use Next.js Image component
5. Enable output: 'standalone' in next.config.js

## Git Workflow

1. Feature branches: `feature/{feature-name}`
2. Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
3. PR per feature
4. Squash merge to main

## Deployment

### Development
```bash
docker compose up -d
```

### Production
```bash
docker build --target runner -t autobot:prod .
docker run -p 3000:3000 -v ./data:/app/data autobot:prod
```

## Error Handling

All errors should be handled gracefully:

```typescript
try {
  // Operation
} catch (error) {
  console.error('Context:', error);
  return NextResponse.json(
    { error: 'User-friendly message' },
    { status: 500 }
  );
}
```

## Database Migrations

1. Update schema in `src/db/schema/`
2. Generate migration: `pnpm db:generate`
3. Review migration SQL
4. Apply migration: `pnpm db:push`
5. Update seed script if needed

## Adding a New Feature

**Template Checklist**:

```bash
# 1. Create feature directory
mkdir -p src/features/{feature}/{{api,components,lib,types,store}}

# 2. Implement business logic
touch src/features/{feature}/lib/core.ts

# 3. Create API handlers
touch src/features/{feature}/api/handlers.ts

# 4. Add RTK Query endpoints
touch src/features/{feature}/store/{feature}Api.ts

# 5. Build UI components
touch src/features/{feature}/components/{Feature}Component.tsx

# 6. Wire up API route
touch src/app/api/{feature}/route.ts

# 7. Add to main store
# Import and add to src/store/index.ts

# 8. Write tests
touch src/features/{feature}/__tests__/

# 9. Update documentation
```

## Questions?

See implementation plan: `plans/100-implementation-plan.md`
See technical architecture: `plans/99-technical-architecture.md`
