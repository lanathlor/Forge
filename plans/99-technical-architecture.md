# Technical Architecture

## Stack Overview

### Frontend + Backend (Monolith)

- **Framework**: Next.js 15 (App Router, React Server Components)
- **Language**: TypeScript 5.x (strict mode)
- **UI Library**: Tailwind CSS + shadcn/ui + Radix UI
- **State Management**: Redux Toolkit (RTK) + RTK Query
- **Code Editor**: Monaco Editor (@monaco-editor/react)
- **Date Handling**: date-fns
- **Validation**: Zod

### Database & ORM

- **ORM**: Drizzle ORM
- **Development**: SQLite (file-based, zero setup)
- **Production**: PostgreSQL (migration-ready)
- **Migration Strategy**: Drizzle Kit

### Real-time Communication

- **Protocol**: Server-Sent Events (SSE)
- **Implementation**: Native Next.js API routes + ReadableStream
- **Client**: EventSource API (native browser)
- **Fallback**: Polling (if SSE unavailable)

### Development Environment

- **Container**: Docker + Docker Compose
- **Package Manager**: pnpm
- **Node**: 20 LTS
- **Hot Reload**: Next.js Fast Refresh

### Code Quality

- **Linting**: ESLint + @next/eslint-plugin + @typescript-eslint
- **Formatting**: Prettier + prettier-plugin-tailwindcss
- **Type Checking**: TypeScript strict mode
- **Git Hooks**: Husky (optional)

### Testing

- **Unit**: Vitest
- **E2E**: Playwright
- **Coverage**: Vitest coverage

---

## Project Structure

```
autobot/
├── plans/                          # This documentation
│   ├── 00-overview.md
│   ├── 01-feature-*.md
│   └── 99-technical-architecture.md
│
├── src/
│   ├── db/
│   │   ├── schema.ts               # Drizzle schema definitions
│   │   ├── migrations/             # Version-controlled migrations
│   │   └── seed.ts                 # Default data (QA gates)
│
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Dashboard home
│   │   ├── globals.css
│   │   ├── providers.tsx          # Redux Provider wrapper
│   │   ├── api/                   # API Routes
│   │   │   ├── repositories/
│   │   │   │   └── route.ts       # GET, POST repositories
│   │   │   ├── sessions/
│   │   │   │   ├── route.ts       # GET, POST sessions
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts   # GET session details
│   │   │   │       ├── end/
│   │   │   │       ├── pause/
│   │   │   │       └── resume/
│   │   │   ├── tasks/
│   │   │   │   ├── route.ts       # POST create task
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts   # GET task details
│   │   │   │       ├── approve/
│   │   │   │       ├── commit/
│   │   │   │       ├── reject/
│   │   │   │       ├── cancel/
│   │   │   │       ├── diff/
│   │   │   │       └── qa-gates/
│   │   │   ├── qa-gates/
│   │   │   │   ├── route.ts       # GET, POST gate configs
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts   # PUT, DELETE gate
│   │   │   └── stream/
│   │   │       └── route.ts       # SSE endpoint
│   │   └── tasks/
│   │       └── [id]/
│   │           └── page.tsx       # Task detail page
│   │
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── badge.tsx
│   │   │   └── ...
│   │   └── dashboard/
│   │       ├── RepositorySelector.tsx
│   │       ├── SessionHeader.tsx
│   │       ├── TaskTimeline.tsx
│   │       ├── PromptInput.tsx
│   │       ├── DiffViewer.tsx
│   │       ├── QAGateResults.tsx
│   │       ├── ApprovalPanel.tsx
│   │       ├── RejectButton.tsx
│   │       └── TaskDetails.tsx
│   │
│   ├── lib/
│   │   ├── db.ts                  # Drizzle client instance
│   │   ├── workspace/
│   │   │   ├── scanner.ts         # Recursive git repo discovery
│   │   │   └── types.ts
│   │   ├── git/
│   │   │   ├── pre-flight.ts      # Pre-task checks
│   │   │   ├── commit.ts          # Commit workflow
│   │   │   ├── diff.ts            # Diff parsing
│   │   │   ├── content.ts         # File content retrieval
│   │   │   ├── revert.ts          # Surgical revert
│   │   │   └── types.ts
│   │   ├── claude/
│   │   │   ├── wrapper.ts         # CLI subprocess wrapper
│   │   │   ├── commit-message.ts  # Commit message generation
│   │   │   └── types.ts
│   │   ├── qa-gates/
│   │   │   ├── runner.ts          # Gate execution engine
│   │   │   ├── gates/
│   │   │   │   ├── eslint.ts
│   │   │   │   ├── typescript.ts
│   │   │   │   ├── tests.ts
│   │   │   │   └── custom.ts
│   │   │   └── types.ts
│   │   ├── sessions/
│   │   │   ├── manager.ts         # Session CRUD
│   │   │   ├── cleanup.ts         # Auto-abandon inactive
│   │   │   └── types.ts
│   │   ├── tasks/
│   │   │   ├── orchestrator.ts    # Main task execution flow
│   │   │   └── types.ts
│   │   └── utils.ts
│   │
│   ├── hooks/
│   │   ├── useTaskStream.ts       # SSE client hook
│   │   └── index.ts               # Re-export custom hooks
│   │
│   ├── store/
│   │   ├── index.ts               # Redux store configuration
│   │   ├── api.ts                 # RTK Query API setup
│   │   └── slices/
│   │       ├── sessionSlice.ts    # Current session state
│   │       └── uiSlice.ts         # UI state (modals, etc.)
│   │
│   ├── types/
│   │   └── index.ts               # Global TypeScript types
│   │
│   └── config/
│       └── qa-gates.ts            # Default gate configurations
│
├── tests/
│   ├── unit/
│   │   ├── git/
│   │   ├── qa-gates/
│   │   ├── claude/
│   │   └── sessions/
│   └── e2e/
│       └── workflows/
│           ├── task-approval.spec.ts
│           ├── task-rejection.spec.ts
│           └── session-management.spec.ts
│
├── docker-compose.yml
├── Dockerfile
├── .dockerignore
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── .eslintrc.json
├── prettier.config.js
├── tailwind.config.ts
├── next.config.js
├── .env
└── README.md
```

---

## Database Schema (Complete)

```typescript
// src/db/schema.ts

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';
import { relations } from 'drizzle-orm';

// Repository Discovery
export const repositories = sqliteTable(
  'repositories',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text('name').notNull(),
    path: text('path').notNull().unique(),
    lastScanned: integer('last_scanned', { mode: 'timestamp' }).$defaultFn(
      () => new Date()
    ),
    lastCommitSha: text('last_commit_sha'),
    lastCommitMsg: text('last_commit_msg'),
    currentBranch: text('current_branch'),
    isClean: integer('is_clean', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
      () => new Date()
    ),
  },
  (table) => ({
    pathIdx: index('path_idx').on(table.path),
  })
);

// Session Management
export const sessionStatusEnum = [
  'active',
  'paused',
  'completed',
  'abandoned',
] as const;

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    repositoryId: text('repository_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    status: text('status', { enum: sessionStatusEnum })
      .notNull()
      .default('active'),
    startedAt: integer('started_at', { mode: 'timestamp' }).$defaultFn(
      () => new Date()
    ),
    endedAt: integer('ended_at', { mode: 'timestamp' }),
    lastActivity: integer('last_activity', { mode: 'timestamp' }).$defaultFn(
      () => new Date()
    ),
    startBranch: text('start_branch'),
    endBranch: text('end_branch'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
      () => new Date()
    ),
  },
  (table) => ({
    repoStatusIdx: index('session_repo_status_idx').on(
      table.repositoryId,
      table.status
    ),
    activityIdx: index('session_activity_idx').on(table.lastActivity),
  })
);

// Task Execution
export const taskStatusEnum = [
  'pending',
  'pre_flight',
  'running',
  'waiting_qa',
  'qa_running',
  'qa_failed',
  'waiting_approval',
  'approved',
  'completed',
  'rejected',
  'failed',
  'cancelled',
] as const;

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    prompt: text('prompt').notNull(),
    status: text('status', { enum: taskStatusEnum })
      .notNull()
      .default('pending'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
      () => new Date()
    ),
    startedAt: integer('started_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    claudeOutput: text('claude_output'),
    startingCommit: text('starting_commit'),
    startingBranch: text('starting_branch'),
    filesChanged: text('files_changed'), // JSON string
    diffContent: text('diff_content'),
    committedSha: text('committed_sha'),
    commitMessage: text('commit_message'),
    approvedAt: integer('approved_at', { mode: 'timestamp' }),
    rejectedAt: integer('rejected_at', { mode: 'timestamp' }),
    rejectionReason: text('rejection_reason'),
  },
  (table) => ({
    sessionIdx: index('task_session_idx').on(table.sessionId),
    statusIdx: index('task_status_idx').on(table.status),
  })
);

// QA Gates
export const qaGateConfigs = sqliteTable(
  'qa_gate_configs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text('name').notNull().unique(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    command: text('command').notNull(),
    timeout: integer('timeout').notNull().default(60000),
    failOnError: integer('fail_on_error', { mode: 'boolean' })
      .notNull()
      .default(true),
    order: integer('order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
      () => new Date()
    ),
  },
  (table) => ({
    enabledOrderIdx: index('qa_gate_enabled_order_idx').on(
      table.enabled,
      table.order
    ),
  })
);

export const qaGateResults = sqliteTable(
  'qa_gate_results',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    gateName: text('gate_name').notNull(),
    status: text('status').notNull(),
    output: text('output'),
    errors: text('errors'), // JSON string[]
    duration: integer('duration'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
      () => new Date()
    ),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
  },
  (table) => ({
    taskIdx: index('qa_gate_result_task_idx').on(table.taskId),
    gateNameIdx: index('qa_gate_result_gate_name_idx').on(table.gateName),
  })
);

// Relations
export const repositoriesRelations = relations(repositories, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [sessions.repositoryId],
    references: [repositories.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  session: one(sessions, {
    fields: [tasks.sessionId],
    references: [sessions.id],
  }),
  qaGateResults: many(qaGateResults),
}));

export const qaGateResultsRelations = relations(qaGateResults, ({ one }) => ({
  task: one(tasks, {
    fields: [qaGateResults.taskId],
    references: [tasks.id],
  }),
}));
```

---

## Configuration Files

### package.json

```json
{
  "name": "autobot",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "format": "prettier --write .",
    "type-check": "tsc --noEmit",
    "check": "pnpm type-check && pnpm lint",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx src/db/seed.ts",
    "test": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@reduxjs/toolkit": "^2.2.0",
    "react-redux": "^9.1.0",
    "drizzle-orm": "^0.30.0",
    "better-sqlite3": "^9.4.0",
    "@paralleldrive/cuid2": "^2.2.0",
    "@monaco-editor/react": "^4.6.0",
    "@radix-ui/react-dialog": "^1.0.0",
    "@radix-ui/react-dropdown-menu": "^2.0.0",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-tabs": "^1.0.0",
    "@radix-ui/react-toast": "^1.1.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "lucide-react": "^0.344.0",
    "zod": "^3.22.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/better-sqlite3": "^7.6.0",
    "typescript": "^5",
    "drizzle-kit": "^0.20.0",
    "eslint": "^8",
    "eslint-config-next": "^15.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "prettier": "^3.2.0",
    "prettier-plugin-tailwindcss": "^0.5.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8",
    "autoprefixer": "^10",
    "vitest": "^1.2.0",
    "@playwright/test": "^1.41.0",
    "tsx": "^4.7.0"
  }
}
```

### .env

```bash
# Database
DATABASE_URL="file:./dev.db"

# For PostgreSQL:
# DATABASE_URL="postgresql://user:password@localhost:5432/autobot?schema=public"

# Workspace
WORKSPACE_ROOT="/home/lanath/Work"

# Claude Code
CLAUDE_CODE_PATH="claude-code"

# Authentication (simple LAN token)
AUTH_TOKEN="your-secret-token-here"

# Environment
NODE_ENV="development"
PORT="3000"
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    },
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### .eslintrc.json

```json
{
  "extends": ["next/core-web-vitals", "plugin:@typescript-eslint/recommended"],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }
    ],
    "@typescript-eslint/consistent-type-imports": "error",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

### prettier.config.js

```js
module.exports = {
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  plugins: ['prettier-plugin-tailwindcss'],
};
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      target: dev
    ports:
      - '3000:3000'
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
      - /home/lanath/Work:/workspace:ro
    environment:
      - DATABASE_URL=file:./dev.db
      - NODE_ENV=development
      - WORKSPACE_ROOT=/workspace
      - CLAUDE_CODE_PATH=claude-code
    command: pnpm dev
    stdin_open: true
    tty: true

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: autobot
      POSTGRES_USER: autobot
      POSTGRES_PASSWORD: autobot
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    profiles:
      - postgres

volumes:
  postgres_data:
```

### Dockerfile

```dockerfile
FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat git
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Development
FROM base AS dev
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache git
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm db:generate
EXPOSE 3000
CMD ["pnpm", "dev"]

# Production build
FROM base AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm db:generate
RUN pnpm build

# Production runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

---

## RTK Query Setup

### Store Configuration

```typescript
// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { api } from './api';
import sessionReducer from './slices/sessionSlice';
import uiReducer from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    session: sessionReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### RTK Query API

```typescript
// src/store/api.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Repository', 'Session', 'Task', 'QAGate'],
  endpoints: (builder) => ({
    // Repositories
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

    // Sessions
    getSessions: builder.query({
      query: (repositoryId) => `/sessions?repositoryId=${repositoryId}`,
      providesTags: ['Session'],
    }),
    getSession: builder.query({
      query: (id) => `/sessions/${id}`,
      providesTags: (result, error, id) => [{ type: 'Session', id }],
    }),
    createSession: builder.mutation({
      query: (data) => ({
        url: '/sessions',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Session'],
    }),
    endSession: builder.mutation({
      query: (id) => ({
        url: `/sessions/${id}/end`,
        method: 'POST',
      }),
      invalidatesTags: ['Session'],
    }),

    // Tasks
    createTask: builder.mutation({
      query: (data) => ({
        url: '/tasks',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Task'],
    }),
    getTask: builder.query({
      query: (id) => `/tasks/${id}`,
      providesTags: (result, error, id) => [{ type: 'Task', id }],
    }),
    approveTask: builder.mutation({
      query: (id) => ({
        url: `/tasks/${id}/approve`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Task', id }],
    }),
    commitTask: builder.mutation({
      query: ({ id, message }) => ({
        url: `/tasks/${id}/commit`,
        method: 'POST',
        body: { message },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Task', id },
        'Session',
      ],
    }),
    rejectTask: builder.mutation({
      query: ({ id, reason }) => ({
        url: `/tasks/${id}/reject`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Task', id },
        'Session',
      ],
    }),

    // QA Gates
    getQAGates: builder.query({
      query: () => '/qa-gates',
      providesTags: ['QAGate'],
    }),
    updateQAGate: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/qa-gates/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['QAGate'],
    }),
  }),
});

export const {
  useGetRepositoriesQuery,
  useRescanRepositoriesMutation,
  useGetSessionsQuery,
  useGetSessionQuery,
  useCreateSessionMutation,
  useEndSessionMutation,
  useCreateTaskMutation,
  useGetTaskQuery,
  useApproveTaskMutation,
  useCommitTaskMutation,
  useRejectTaskMutation,
  useGetQAGatesQuery,
  useUpdateQAGateMutation,
} = api;
```

### Redux Provider Setup

```typescript
// src/app/providers.tsx
'use client';

import { Provider } from 'react-redux';
import { store } from '@/store';

export function Providers({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}
```

```typescript
// src/app/layout.tsx
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### Custom Hooks

```typescript
// src/hooks/index.ts
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

## Key Design Patterns

### 1. Repository Pattern

All database access goes through Drizzle ORM, abstracted in service modules.

### 2. Event-Driven Architecture

SSE emits events for task updates, enabling real-time UI without polling.

### 3. Orchestrator Pattern

`tasks/orchestrator.ts` coordinates all steps of task execution lifecycle.

### 4. Singleton Pattern

Drizzle client, Claude wrapper use singletons to avoid multiple instances.

### 5. Factory Pattern

Session manager creates/retrieves sessions based on state.

### 6. RTK Query Pattern

All API calls use RTK Query for automatic caching, invalidation, and optimistic updates.

---

## Security Considerations

- **Input Validation**: All user inputs validated with Zod
- **SQL Injection**: Prevented by Drizzle ORM (parameterized queries)
- **Command Injection**: Git/shell commands use execAsync with sanitized inputs
- **Path Traversal**: File paths validated, restricted to workspace
- **XSS**: React auto-escapes, Monaco Editor sandboxed
- **CSRF**: Next.js built-in protection for mutations
- **Authentication**: Simple token-based (upgrade for multi-user)

---

## Performance Optimizations

- **Database Indexes**: On frequently queried fields (repositoryId, status)
- **SSE Keep-alive**: Prevent connection timeout
- **Lazy Loading**: Monaco Editor code-split
- **Caching**: Repository scan results cached
- **Parallel Execution**: Git commands run in parallel where possible
- **Debouncing**: UI updates debounced to prevent thrashing

---

## Migration from SQLite to PostgreSQL

### Step 1: Update DATABASE_URL

```bash
# .env.production
DATABASE_URL="postgresql://user:password@host:5432/autobot"
```

### Step 2: Update Drizzle Config

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  driver: 'pg', // Changed from 'better-sqlite'
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
});
```

### Step 3: Update Schema Imports

```typescript
// src/db/schema.ts
// Change from:
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
// To:
import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
```

### Step 4: Generate and Run Migrations

```bash
pnpm db:generate
pnpm db:migrate
```

Minimal code changes required - just schema imports and config!

---

## Deployment

### Development

```bash
docker-compose up
```

### Production (Docker)

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Production (Bare Metal)

```bash
pnpm install --prod
pnpm db:migrate
pnpm build
pnpm start
```

---

## Monitoring & Logging

- **Application Logs**: Console.log (upgrade to Winston/Pino)
- **Database Logs**: Drizzle query logging (dev only)
- **Error Tracking**: Console errors (upgrade to Sentry)
- **Performance**: Next.js built-in analytics

---

## Backup Strategy

- **SQLite**: Copy `dev.db` file
- **PostgreSQL**: `pg_dump` for backups
- **Git Repos**: Already version controlled
- **Frequency**: Daily automated backups (production)
