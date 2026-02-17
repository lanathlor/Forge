# Gatekeeper - Product Overview

**Note**: "Gatekeeper" is the recommended name. See alternative suggestions in project name section below.

## What is Gatekeeper?

Gatekeeper is a quality assurance dashboard for Claude Code. It sits between you and Claude Code, providing oversight, automated quality gates with intelligent retry, and a streamlined commit workflow - all from a mobile-friendly interface.

## The Problem

When using Claude Code directly:

- You don't know what changed until Claude is done
- No automated quality checks before changes land
- Manual commit message writing
- Hard to review diffs across multiple files
- No rollback mechanism if Claude makes mistakes
- Can't see what's happening in real-time
- No way to execute multi-step plans systematically
- Missing notifications when working on other tasks

## The Solution

Gatekeeper provides:

1. **Repository Management** - Work across multiple repos from one dashboard
2. **Task Oversight** - See Claude's work in real-time as it happens
3. **Automated QA Gates with Retry** - Lint, type-check, test - Claude auto-fixes failures (3 attempts)
4. **Visual Diff Review** - Side-by-side code comparison with syntax highlighting
5. **Smart Commits** - Claude writes commit messages, you approve
6. **Safe Rollbacks** - Reject changes and revert with one click
7. **PRD Plan Execution** - Execute multi-step markdown plans with context clearing
8. **Discord Notifications** - Stay informed on mobile with real-time alerts
9. **Audit Trail** - Complete history of all tasks and decisions
10. **Mobile-First UI** - Full functionality on phone/tablet

## Core Features

### 1. Repository Discovery & Selection

**What**: Automatically find all git repos in your workspace
**Why**: Work across multiple projects without manual configuration
**See**: `01-feature-repository-discovery.md`

### 2. Claude Task Execution

**What**: Send prompts to Claude Code and monitor execution
**Why**: Keep Claude working while you maintain oversight
**See**: `02-feature-task-execution.md`

### 3. QA Gate System with Intelligent Retry

**What**: Automated quality checks (ESLint, TypeScript, tests) with auto-retry
**Why**: Claude fixes its own errors automatically (up to 3 attempts)
**See**: `03-feature-qa-gates.md`

### 4. Diff Viewing & Review

**What**: Visual code comparison with file tree navigation
**Why**: Understand exactly what changed before approving
**See**: `04-feature-diff-review.md`

### 5. Approval & Commit Workflow

**What**: Approve changes → Claude writes commit msg → You review → Auto-commit
**Why**: Maintain clean git history without manual work
**See**: `05-feature-approval-commit.md`

### 6. Reject & Revert Workflow

**What**: Reject changes and surgically revert Claude's modifications
**Why**: Safe escape hatch when Claude goes wrong
**See**: `06-feature-reject-revert.md`

### 7. Real-time Mobile Dashboard

**What**: Live updates of task status, output, and progress - mobile-responsive
**Why**: Monitor and control from any device
**See**: `07-feature-dashboard.md`

### 8. Session Management

**What**: Group related tasks into sessions with history
**Why**: Organize work and review past decisions
**See**: `08-feature-sessions.md`

### 9. PRD Plan Execution ⭐ NEW

**What**: Execute multi-step markdown plans with context clearing between steps
**Why**: Systematic execution of complex features without context pollution
**See**: `09-feature-prd-plan-execution.md`

### 10. Discord Notifications ⭐ NEW

**What**: Real-time notifications to Discord for all important events
**Why**: Stay informed on mobile without watching dashboard
**See**: `10-feature-discord-notifications.md`

## 📚 Essential Reading Before Implementation

**Must Read First**:

1. **STATE-MANAGEMENT-UI-GUIDE.md** - RTK Query patterns and shadcn/ui usage (CRITICAL)
2. **99-technical-architecture.md** - Full technical stack and patterns
3. **100-implementation-plan.md** OR **IMPLEMENTATION-ROADMAP.md** - Development roadmap

These documents explain how to use RTK Query for all API calls (never use `fetch` directly) and how to properly use shadcn/ui components throughout the application.

## User Journey

```
1. Open Gatekeeper Dashboard (mobile or desktop)
   ↓
2. Select Repository from workspace
   ↓
3. Start new Session (or continue existing)
   ↓
4. Choose execution mode:

   Option A: Single Task
   ├─ Enter prompt for Claude
   └─ [Real-time] Watch Claude work

   Option B: PRD Plan
   ├─ Select or create .md plan file
   ├─ Review steps
   └─ Execute plan step-by-step

   ↓
5. [Automatic] QA gates run after Claude finishes
   ↓
   [If QA fails]
   ├─ Claude automatically re-invoked with error feedback
   ├─ Retry attempt 1/3
   ├─ [If still fails] Retry 2/3
   ├─ [If still fails] Retry 3/3
   └─ [If 3 retries fail] Task marked "qa_failed"

   [If QA passes]
   └─ Continue to approval

   ↓
6. Review diff in visual editor
   ↓
7. Discord notification: "Task awaiting approval"
   ↓
8. Decision point:

   APPROVE PATH:                 REJECT PATH:
   ↓                            ↓
   Click "Approve"              Click "Reject"
   ↓                            ↓
   Claude generates             Confirm revert
   commit message               ↓
   ↓                            Changes reverted
   Review/edit message          ↓
   ↓                            Discord: "Task rejected"
   Confirm commit
   ↓
   Changes committed
   ↓
   Discord: "Task completed"

9. Continue with next task/step or end session
```

## Target User

**Who**: Developers using Claude Code for software engineering tasks

**Use Cases**:

- Solo developers wanting quality control over AI changes
- Teams needing audit trails for AI-assisted development
- Projects with strict quality gates (linting, testing)
- Developers managing multiple repositories
- Anyone executing multi-step feature plans
- Remote workers needing mobile notifications

## Project Name Options

**Recommended: Gatekeeper** ✅

Rationale:

- Reflects core functionality (QA gates)
- Implies oversight and quality control
- Professional and memorable
- .com domain available variants

**Alternatives**:

1. **Vigil** - Constant watching/monitoring
2. **Shepherd** - Guiding Claude to quality
3. **Sentinel** - Guardian of your codebase
4. **Conductor** - Orchestrating Claude's work

Choose your preferred name and I'll update all documentation accordingly!

## Technical Stack (Summary)

- **Frontend/Backend**: Next.js 15 + TypeScript (monolith)
- **Database**: Drizzle ORM (SQLite → PostgreSQL ready)
- **UI**: Tailwind + shadcn/ui + Monaco Editor
- **Real-time**: Server-Sent Events
- **Notifications**: Discord webhooks
- **Development**: Docker Compose
- **Quality**: ESLint, Prettier, Vitest, Playwright
- **Mobile**: Responsive design, touch-optimized

**See**: `99-technical-architecture.md` for details

## Success Metrics

**MVP is successful when**:

1. ✅ Can discover and select repos from workspace
2. ✅ Can send prompts to Claude and see real-time updates
3. ✅ QA gates run automatically with 3-retry logic
4. ✅ Claude auto-fixes QA failures
5. ✅ Can review diffs visually before approving
6. ✅ Approved changes auto-commit with Claude-generated messages
7. ✅ Rejected changes revert cleanly
8. ✅ Can execute multi-step PRD plans
9. ✅ Context clears between plan steps
10. ✅ Discord notifications work on mobile
11. ✅ Full UI works on phone/tablet
12. ✅ All tasks and sessions persist across restarts
13. ✅ Docker dev environment works out of the box

## Out of Scope (Future)

- Multi-user authentication (basic LAN auth only for MVP)
- Team collaboration features
- CI/CD integration
- GitHub/GitLab PR automation
- Plugin system for custom gates
- Advanced diff commenting
- Task scheduling/queuing
- Performance metrics/analytics
- Slack/Teams integrations (Discord only for MVP)

## Documentation Index

**Product Features** (read these first):

1. `01-feature-repository-discovery.md` - Find and select repos
2. `02-feature-task-execution.md` - Run Claude tasks
3. `03-feature-qa-gates.md` - Automated quality checks with retry
4. `04-feature-diff-review.md` - Visual code review
5. `05-feature-approval-commit.md` - Commit workflow
6. `06-feature-reject-revert.md` - Rollback mechanism
7. `07-feature-dashboard.md` - Real-time mobile-friendly UI
8. `08-feature-sessions.md` - Session management
9. `09-feature-prd-plan-execution.md` - ⭐ Multi-step plan execution
10. `10-feature-discord-notifications.md` - ⭐ Mobile notifications

**Technical Documentation**:

- `99-technical-architecture.md` - Stack, structure, Drizzle setup
- `100-implementation-plan.md` - Development roadmap

---

**Next**: Choose your project name, then review feature documents. When ready, we start Phase 1!
