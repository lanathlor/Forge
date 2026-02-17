# Implementation Plan

## Development Roadmap

**Target**: 8-10 days for MVP
**Approach**: Build features vertically (full stack per feature)
**Testing**: Write tests alongside implementation

---

## Phase 1: Project Foundation (Days 1-2)

### Day 1 Morning: Initial Setup

- [ ] Initialize Next.js project with TypeScript
  ```bash
  pnpx create-next-app@latest autobot \
    --typescript --tailwind --app --src-dir \
    --import-alias "@/*"
  ```
- [ ] Install core dependencies
  ```bash
  pnpm add drizzle-orm better-sqlite3 @paralleldrive/cuid2 zod date-fns
  pnpm add -D drizzle-kit @types/better-sqlite3 tsx vitest @playwright/test
  ```
- [ ] Setup Drizzle with SQLite
  ```bash
  mkdir -p src/db
  touch src/db/schema.ts drizzle.config.ts
  ```
- [ ] Configure tsconfig.json (strict mode)
- [ ] Configure ESLint + Prettier
- [ ] Create `.env` file with defaults

### Day 1 Afternoon: Database Schema

- [ ] Define complete Drizzle schema in `src/db/schema.ts`
  - repositories table
  - sessions table (with status enum)
  - tasks table (with status enum)
  - qaGateConfigs table
  - qaGateResults table
  - Relations between tables
- [ ] Create Drizzle config (`drizzle.config.ts`)
- [ ] Generate initial migration
  ```bash
  pnpm db:generate
  ```
- [ ] Run migration
  ```bash
  pnpm db:migrate
  ```
- [ ] Create Drizzle client instance (`src/lib/db.ts`)
- [ ] Create seed script (`src/db/seed.ts`) with default QA gates
- [ ] Run seed
  ```bash
  pnpm db:seed
  ```

### Day 1 Evening: Docker Setup

- [ ] Create Dockerfile (multi-stage: dev + prod)
- [ ] Create docker-compose.yml
  - App service with volume mounts
  - Optional postgres service (profile)
- [ ] Test Docker build and run
  ```bash
  docker-compose up
  ```
- [ ] Verify hot reload works in container

### Day 2 Morning: shadcn/ui Setup

- [ ] Initialize shadcn/ui
  ```bash
  pnpx shadcn@latest init
  ```
- [ ] Add required components
  ```bash
  pnpx shadcn@latest add button card dialog textarea badge select tabs toast
  ```
- [ ] Install Monaco Editor
  ```bash
  pnpm add @monaco-editor/react
  ```
- [ ] Create dashboard layout structure

### Day 2 Afternoon: Redux Toolkit & RTK Query Setup

- [ ] Install Redux dependencies
  ```bash
  pnpm add @reduxjs/toolkit react-redux
  ```
- [ ] Create store configuration (`src/store/index.ts`)
- [ ] Create RTK Query API setup (`src/store/api.ts`)
- [ ] Create Redux Provider wrapper (`src/app/providers.tsx`)
- [ ] Update root layout to include Provider
- [ ] Create custom hooks (`src/hooks/index.ts`)
  - `useAppDispatch`
  - `useAppSelector`
- [ ] Create initial slices
  - `sessionSlice.ts` - current session state
  - `uiSlice.ts` - UI state (modals, loading, etc.)

### Day 2 Evening: Basic Types & Utils

- [ ] Create TypeScript types (`src/types/index.ts`)
- [ ] Create utility functions (`src/lib/utils.ts`)
- [ ] Setup basic error handling
- [ ] Create initial test structure

**Milestone 1**: ✅ Project scaffolded, RTK Query configured, shadcn/ui installed, Docker works

---

## Phase 2: Repository Discovery (Day 2-3)

### Day 2 Evening: Git Workspace Scanner

- [ ] Implement `src/lib/workspace/scanner.ts`
  - `findGitDirectories()` - recursive search
  - `discoverRepositories()` - extract repo info
  - `getCurrentBranch()`
  - `getLastCommit()`
  - `isWorkingDirectoryClean()`
- [ ] Write unit tests for scanner
- [ ] Test with `/home/lanath/Work` directory

### Day 3 Morning: Repository API

- [ ] Create `GET /api/repositories` endpoint
  - Scan workspace
  - Update/create in database
  - Return repository list
- [ ] Create `GET /api/repositories/:id` endpoint
- [ ] Create `POST /api/repositories/rescan` endpoint
- [ ] Test APIs with curl/Postman

### Day 3 Afternoon: Repository UI

- [ ] Add RTK Query endpoints for repositories
  - `getRepositories` query
  - `rescanRepositories` mutation
- [ ] Build `RepositorySelector` component
  - Use `useGetRepositoriesQuery` hook
  - Display list with status indicators
  - Handle selection with local state or Redux slice
  - Show loading/error states from RTK Query
- [ ] Integrate into dashboard layout
- [ ] Test repository selection flow

**Milestone 2**: ✅ Can discover and select repositories

---

## Phase 3: Session Management (Day 3-4)

### Day 3 Evening: Session Logic

- [ ] Implement `src/lib/sessions/manager.ts`
  - `getActiveSession()`
  - `createSession()`
  - `getOrCreateActiveSession()`
  - `endSession()`
  - `getSessionSummary()`
  - `listSessions()`
- [ ] Implement session cleanup
  - Auto-abandon inactive sessions (24h)
- [ ] Write unit tests

### Day 4 Morning: Session API & RTK Query

- [ ] Create `GET /api/sessions?repositoryId=xxx` endpoint
- [ ] Create `GET /api/sessions/:id` endpoint
- [ ] Create `POST /api/sessions` endpoint
- [ ] Create `POST /api/sessions/:id/end` endpoint
- [ ] Add RTK Query endpoints for sessions
  - `getSessions` query
  - `getSession` query
  - `createSession` mutation
  - `endSession` mutation
- [ ] Test session lifecycle

### Day 4 Afternoon: Session UI

- [ ] Build `SessionHeader` component (use RTK Query hooks)
- [ ] Build session summary modal
- [ ] Integrate with dashboard
- [ ] Test session creation/ending with automatic cache updates

**Milestone 3**: ✅ Sessions work end-to-end

---

## Phase 4: Claude Integration (Day 4-5)

### Day 4 Evening: Claude Wrapper

- [ ] Implement `src/lib/claude/wrapper.ts`
  - `ClaudeCodeWrapper` class with EventEmitter
  - `executeTask()` - spawn claude-code CLI
  - Handle stdout/stderr streaming
  - Detect completion/errors
- [ ] Test with dummy claude-code commands
- [ ] Handle edge cases (timeout, error, cancel)

### Day 5 Morning: Pre-flight Checks

- [ ] Implement `src/lib/git/pre-flight.ts`
  - `runPreFlightChecks()`
  - Check if repo is clean
  - Capture starting commit/branch
- [ ] Write unit tests
- [ ] Test with dirty repository

### Day 5 Afternoon: Task Orchestrator

- [ ] Implement `src/lib/tasks/orchestrator.ts`
  - `executeTask()` - main workflow
  - Run pre-flight checks
  - Execute Claude Code
  - Capture diff
  - Trigger QA gates
- [ ] Handle errors at each step
- [ ] Write integration tests

**Milestone 4**: ✅ Can execute Claude tasks end-to-end

---

## Phase 5: QA Gate System (Day 5-6)

### Day 5 Evening: Gate Runner

- [ ] Implement `src/lib/qa-gates/runner.ts`
  - `runQAGates()` - orchestrate all gates
  - `runSingleGate()` - execute one gate
  - Handle sequential execution
  - Stop on failure (if configured)
- [ ] Implement built-in gates
  - ESLint gate with output parsing
  - TypeScript gate with error extraction
  - Test runner gate
- [ ] Write unit tests

### Day 6 Morning: QA Gate API

- [ ] Create `GET /api/qa-gates` endpoint (list configs)
- [ ] Create `PUT /api/qa-gates/:id` endpoint (update config)
- [ ] Create `POST /api/tasks/:id/qa-gates/run` endpoint (re-run)
- [ ] Test gate execution and results

### Day 6 Afternoon: QA Gate UI

- [ ] Build `QAGateResults` component
  - Display gate status (pending/running/passed/failed)
  - Show errors with formatting
  - Expand/collapse output
- [ ] Build gate configuration UI (settings page)
- [ ] Test QA gate flow

**Milestone 5**: ✅ QA gates run automatically and block approval

---

## Phase 6: Diff Review (Day 6-7)

### Day 6 Evening: Diff Capture

- [ ] Implement `src/lib/git/diff.ts`
  - `captureDiff()` - get full diff
  - `parseChangedFiles()` - extract file list with stats
  - `extractFilePatch()` - individual file diffs
- [ ] Implement `src/lib/git/content.ts`
  - `getFileContent()` - retrieve file at specific commit
  - `getFileContentBeforeAndAfter()`
- [ ] Write unit tests with sample repos

### Day 7 Morning: Diff API

- [ ] Create `GET /api/tasks/:id/diff` endpoint
- [ ] Create `GET /api/tasks/:id/files/:path` endpoint
- [ ] Cache diff in database
- [ ] Test with large diffs

### Day 7 Afternoon: Diff Viewer UI

- [ ] Build `DiffViewer` component
  - File tree with change indicators
  - Monaco DiffEditor integration
  - File selection handling
  - Syntax highlighting by language
- [ ] Handle edge cases (binary files, large files)
- [ ] Test with various file types

**Milestone 6**: ✅ Can review diffs visually

---

## Phase 7: Approval & Commit Workflow (Day 7-8)

### Day 7 Evening: Commit Message Generation

- [ ] Implement `src/lib/claude/commit-message.ts`
  - `generateCommitMessage()` - call Claude for commit msg
  - Format prompt with diff and context
- [ ] Test with sample diffs
- [ ] Handle errors and timeouts

### Day 8 Morning: Commit Logic

- [ ] Implement `src/lib/git/commit.ts`
  - `commitChanges()` - stage files and commit
  - `approveTask()` - generate commit message
  - `finalizeCommit()` - commit with message
- [ ] Write unit tests
- [ ] Test in real repository

### Day 8 Afternoon: Approval API & UI

- [ ] Create `POST /api/tasks/:id/approve` endpoint
- [ ] Create `POST /api/tasks/:id/commit` endpoint
- [ ] Create `POST /api/tasks/:id/regenerate-message` endpoint
- [ ] Add RTK Query endpoints
  - `approveTask` mutation
  - `commitTask` mutation
  - `regenerateCommitMessage` mutation
- [ ] Build `ApprovalPanel` component (using RTK Query)
  - Use mutation hooks for approve/commit
  - Approve button with loading states
  - Commit message editor
  - Regenerate option
  - Optimistic updates for better UX
- [ ] Test full approval workflow

**Milestone 7**: ✅ Can approve and auto-commit changes

---

## Phase 8: Reject & Revert Workflow (Day 8)

### Day 8 Evening: Revert Logic

- [ ] Implement `src/lib/git/revert.ts`
  - `revertChanges()` - surgical revert
  - `validateRevertSafety()` - pre-revert checks
  - Handle modified/deleted/new files separately
- [ ] Write unit tests
- [ ] Test with sample changes

### Day 8 Night: Reject API & UI

- [ ] Create `GET /api/tasks/:id/revert-preview` endpoint
- [ ] Create `POST /api/tasks/:id/reject` endpoint
- [ ] Build `RejectButton` component
  - Confirmation modal
  - Preview files to revert
  - Reason input
- [ ] Test reject workflow

**Milestone 8**: ✅ Can safely reject and revert changes

---

## Phase 9: Real-time Dashboard (Day 9)

### Day 9 Morning: Server-Sent Events

- [ ] Create `GET /api/stream` endpoint
  - Setup SSE stream
  - Implement event filtering by sessionId
  - Keep-alive pings
- [ ] Create global event emitter (`taskEvents`)
- [ ] Emit events from task orchestrator
  - Task status updates
  - Claude output
  - QA gate updates
- [ ] Test SSE connection

### Day 9 Afternoon: SSE Client

- [ ] Create `useTaskStream` hook
  - Connect to SSE endpoint
  - Handle events
  - Auto-reconnect on error
- [ ] Update `TaskTimeline` to use real-time updates
- [ ] Update `TaskDetails` to stream output
- [ ] Test real-time updates

### Day 9 Evening: Task UI Components

- [ ] Build `TaskTimeline` component
  - List tasks in session
  - Show status indicators
  - Handle selection
  - Update on SSE events
- [ ] Build `TaskDetails` component
  - Tabbed interface (Output, Diff, QA Results)
  - Integrate all sub-components
- [ ] Build `PromptInput` component
- [ ] Integrate all components in dashboard

**Milestone 9**: ✅ Dashboard shows real-time updates

---

## Phase 10: Polish & Testing (Day 10)

### Day 10 Morning: Integration Testing

- [ ] Write E2E tests with Playwright
  - Full task approval workflow
  - Full task rejection workflow
  - Session management
  - Repository switching
- [ ] Fix bugs discovered in testing

### Day 10 Afternoon: Error Handling & UX

- [ ] Add loading states everywhere
- [ ] Add error boundaries
- [ ] Add user-friendly error messages
- [ ] Add success notifications
- [ ] Add keyboard shortcuts (optional)
- [ ] Improve responsive design

### Day 10 Evening: Documentation & Cleanup

- [ ] Write README.md
  - Installation instructions
  - Configuration guide
  - Usage examples
  - Troubleshooting
- [ ] Write CONTRIBUTING.md
- [ ] Add inline code comments
- [ ] Clean up console.logs
- [ ] Run final lint/type-check
- [ ] Test Docker build

**Milestone 10**: ✅ MVP complete and production-ready

---

## Post-MVP (Future Iterations)

### Iteration 1: Stability

- Monitoring and logging (Winston, Sentry)
- Performance optimizations
- Database indexes tuning
- Automated backups

### Iteration 2: Enhanced UX

- Keyboard shortcuts
- Dark mode
- Desktop notifications
- Better mobile support

### Iteration 3: Multi-user

- Real authentication (OAuth, JWT)
- User roles and permissions
- Audit trail per user

### Iteration 4: Advanced Features

- GitHub/GitLab integration
- CI/CD integration
- Custom QA gate plugins
- Branch management
- Multi-repo sessions

---

## Development Best Practices

### During Implementation

1. **Commit Often**: Commit after each completed checkbox
2. **Test First**: Write tests before or alongside code
3. **Types First**: Define TypeScript types before implementation
4. **One Feature at a Time**: Complete vertically (API + UI)
5. **Review PRD**: Re-read feature docs before implementing

### Code Quality

- Run `pnpm check` before each commit
- Use `@/` import alias consistently
- Follow conventional commits
- Keep functions small (< 50 lines)
- Document complex logic

### Testing Strategy

- **Unit Tests**: All lib/ functions
- **Integration Tests**: API endpoints
- **E2E Tests**: Critical user flows
- **Manual Testing**: Full workflow after each phase

---

## Risk Mitigation

### Risk 1: Claude Code CLI Issues

**Mitigation**: Test wrapper early, create mock for development

### Risk 2: Git Operations Complexity

**Mitigation**: Use well-tested git commands, extensive unit tests

### Risk 3: SSE Connection Stability

**Mitigation**: Implement auto-reconnect, fallback to polling

### Risk 4: Large Diffs Performance

**Mitigation**: Implement size limits, lazy loading

### Risk 5: Scope Creep

**Mitigation**: Stick to MVP feature list, defer enhancements

---

## Success Criteria Checklist

### Core Functionality

- [ ] Discover git repositories in workspace
- [ ] Create and manage sessions
- [ ] Execute Claude Code tasks
- [ ] Run QA gates automatically
- [ ] Display diffs visually
- [ ] Approve and auto-commit changes
- [ ] Reject and revert changes
- [ ] Real-time dashboard updates

### Quality Metrics

- [ ] TypeScript strict mode (no errors)
- [ ] ESLint passes with zero warnings
- [ ] All unit tests pass
- [ ] All E2E tests pass
- [ ] Docker build succeeds
- [ ] Can switch SQLite → PostgreSQL

### User Experience

- [ ] Dashboard loads in < 2 seconds
- [ ] Real-time updates arrive within 1 second
- [ ] No UI freezes during operations
- [ ] Clear error messages for all failures
- [ ] Intuitive workflow (no manual required)

---

## Getting Started

```bash
# Day 1 - Start here!
pnpx create-next-app@latest autobot --typescript --tailwind --app --src-dir
cd autobot
pnpm install
pnpm add drizzle-orm better-sqlite3 @paralleldrive/cuid2
pnpm add -D drizzle-kit @types/better-sqlite3
mkdir -p src/db
touch src/db/schema.ts drizzle.config.ts

# Then follow Phase 1 checklist above
```

---

**Ready to build? Start with Phase 1, Day 1 Morning!**
