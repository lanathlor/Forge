# Feature: Session Management

## What is this feature?

A session system that groups related tasks together, providing context and organization for work on a specific repository, with full history and the ability to resume work later.

## User Problem

**Without this feature**:
- Tasks scattered without context
- Hard to review what was accomplished
- Can't resume work after break
- No logical grouping of related changes
- Lost track of decision-making process

**With this feature**:
- Related tasks grouped together
- Clear work sessions with start/end
- Resume work anytime
- Review complete session history
- Understand context of decisions

## User Stories

### Story 1: Organized Work
```
AS A developer
I WANT to group related tasks into sessions
SO THAT I can organize my work logically
```

### Story 2: Resume Work
```
AS A developer
I WANT to resume a previous session
SO THAT I can continue where I left off
```

### Story 3: Review History
```
AS A developer
I WANT to see all tasks in a session
SO THAT I understand what was accomplished
```

## User Flow

```
1. User selects repository
   ↓
2. System checks for active session for this repo
   ↓
3. [If active session exists]
   → Load session and all tasks
   → User continues in same session

   [If no active session]
   → Create new session
   → Session status: "active"
   ↓
4. User works on multiple tasks in session:
   - Task 1: Fix bug → Completed
   - Task 2: Add feature → Rejected
   - Task 3: Refactor → Completed
   ↓
5. User clicks "End Session"
   ↓
6. Session summary shown:

   ┌────────────────────────────────────────┐
   │  Session Summary                       │
   ├────────────────────────────────────────┤
   │  Repository: my-app                    │
   │  Duration: 2h 15m                      │
   │  Started: Today at 2:30 PM            │
   │  Ended: Today at 4:45 PM              │
   │                                        │
   │  Tasks: 3                              │
   │  ✅ Completed: 2                      │
   │  ❌ Rejected: 1                       │
   │                                        │
   │  Files Changed: 8                      │
   │  Commits: 2                            │
   │                                        │
   │  [View Full History]  [Close]         │
   └────────────────────────────────────────┘

   ↓
7. Session status → "completed"
   ↓
8. Next time user selects this repo:
   New session created automatically
```

## UI Components

### Session Header

```
┌─────────────────────────────────────────────────────┐
│  Session: my-app                                    │
│  Started: Today at 2:30 PM (1h 15m ago)            │
│  Tasks: 3 (2 completed, 1 pending)                 │
│                                                     │
│  [View History] [End Session] [Session Settings]   │
└─────────────────────────────────────────────────────┘
```

### Session Selector (Dropdown)

```
┌──────────────────────────────────────┐
│  Current Session ▼                   │
├──────────────────────────────────────┤
│  ● Active Session                    │
│    my-app • 3 tasks • 1h 15m ago    │
│    ──────────────────────────────    │
│                                      │
│  Recent Sessions:                    │
│  ┌────────────────────────────────┐  │
│  │ my-app                         │  │
│  │ Yesterday • 5 tasks • Ended    │  │
│  ├────────────────────────────────┤  │
│  │ api-server                     │  │
│  │ 2 days ago • 2 tasks • Ended   │  │
│  └────────────────────────────────┘  │
│                                      │
│  [New Session]  [View All]          │
└──────────────────────────────────────┘
```

### Session History View

```
┌─────────────────────────────────────────────────────┐
│  Sessions for my-app                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ● Today, 2:30 PM - 4:45 PM (2h 15m)               │
│    3 tasks • 2 completed • 1 rejected              │
│    8 files changed • 2 commits                     │
│    [View Details →]                                │
│    ─────────────────────────────────────────────   │
│                                                     │
│  ○ Yesterday, 10:00 AM - 12:30 PM (2h 30m)        │
│    5 tasks • 5 completed • 0 rejected              │
│    12 files changed • 5 commits                    │
│    [View Details →]                                │
│    ─────────────────────────────────────────────   │
│                                                     │
│  ○ 3 days ago, 3:15 PM - 3:45 PM (30m)            │
│    1 task • 1 completed • 0 rejected               │
│    2 files changed • 1 commit                      │
│    [View Details →]                                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Session Details Modal

```
┌─────────────────────────────────────────────────────┐
│  Session Details                                    │
├─────────────────────────────────────────────────────┤
│  Repository: my-app                                 │
│  Branch: main                                       │
│  Started: Today at 2:30 PM                         │
│  Ended: Today at 4:45 PM                           │
│  Duration: 2h 15m                                   │
│                                                     │
│  Tasks (3):                                         │
│  ┌───────────────────────────────────────────────┐ │
│  │ ✅ Fix authentication bug         2:35 PM    │ │
│  │    3 files • Commit a3f2c1d                  │ │
│  ├───────────────────────────────────────────────┤ │
│  │ ❌ Refactor user service          3:10 PM    │ │
│  │    Rejected: Type errors                     │ │
│  ├───────────────────────────────────────────────┤ │
│  │ ✅ Add error handling             4:20 PM    │ │
│  │    5 files • Commit b7e9d2a                  │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Summary:                                           │
│  • 8 total files changed                           │
│  • 2 commits created                               │
│  • 1 task rejected                                 │
│                                                     │
│  [Export Session]  [Delete Session]  [Close]       │
└─────────────────────────────────────────────────────┘
```

## Technical Implementation

### Database Schema

```typescript
// src/db/schema.ts

export const sessionStatusEnum = ['active', 'paused', 'completed', 'abandoned'] as const;

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  repositoryId: text('repository_id').notNull().references(() => repositories.id, { onDelete: 'cascade' }),

  status: text('status', { enum: sessionStatusEnum }).notNull().default('active'),

  startedAt: integer('started_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  lastActivity: integer('last_activity', { mode: 'timestamp' }).$defaultFn(() => new Date()),

  // Metadata
  startBranch: text('start_branch'),
  endBranch: text('end_branch'),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
  repoStatusIdx: index('session_repo_status_idx').on(table.repositoryId, table.status),
  activityIdx: index('session_activity_idx').on(table.lastActivity),
}));
```

### Session Management Logic

```typescript
// src/lib/sessions/manager.ts

import { db } from '@/lib/db';
import { sessions, repositories, tasks } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function getActiveSession(
  repositoryId: string
): Promise<Session | null> {
  const activeSession = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.repositoryId, repositoryId),
      eq(sessions.status, 'active')
    ),
    with: {
      tasks: {
        orderBy: [desc(tasks.createdAt)],
      },
      repository: true,
    },
  });

  if (activeSession) {
    // Update last activity
    await db.update(sessions)
      .set({ lastActivity: new Date() })
      .where(eq(sessions.id, activeSession.id));
  }

  return activeSession;
}

export async function createSession(
  repositoryId: string
): Promise<Session> {
  // Get current branch
  const repository = await db.query.repositories.findFirst({
    where: eq(repositories.id, repositoryId),
  });

  if (!repository) {
    throw new Error('Repository not found');
  }

  const [session] = await db.insert(sessions)
    .values({
      repositoryId,
      status: 'active',
      startBranch: repository.currentBranch,
    })
    .returning();

  return session;
}

export async function getOrCreateActiveSession(
  repositoryId: string
): Promise<Session> {
  const existing = await getActiveSession(repositoryId);

  if (existing) {
    return existing;
  }

  return createSession(repositoryId);
}

export async function endSession(sessionId: string): Promise<Session> {
  // Get session with tasks
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
    with: {
      tasks: true,
      repository: true,
    },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  // Get current branch
  const { stdout: currentBranch } = await execAsync(
    'git branch --show-current',
    { cwd: session.repository.path }
  );

  // Update session
  const [updatedSession] = await db.update(sessions)
    .set({
      status: 'completed',
      endedAt: new Date(),
      endBranch: currentBranch.trim(),
    })
    .where(eq(sessions.id, sessionId))
    .returning();

  return updatedSession;
}

export async function pauseSession(sessionId: string): Promise<Session> {
  const [session] = await db.update(sessions)
    .set({ status: 'paused' })
    .where(eq(sessions.id, sessionId))
    .returning();

  return session;
}

export async function resumeSession(sessionId: string): Promise<Session> {
  const [session] = await db.update(sessions)
    .set({
      status: 'active',
      lastActivity: new Date(),
    })
    .where(eq(sessions.id, sessionId))
    .returning();

  return session;
}

export async function getSessionSummary(sessionId: string) {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
    with: {
      tasks: true,
      repository: true,
    },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const totalTasks = session.tasks.length;
  const completedTasks = session.tasks.filter(t => t.status === 'completed').length;
  const rejectedTasks = session.tasks.filter(t => t.status === 'rejected').length;
  const failedTasks = session.tasks.filter(t => t.status === 'failed').length;

  // Count unique files changed
  const allFiles = new Set<string>();
  session.tasks.forEach(task => {
    const files = JSON.parse(task.filesChanged || '[]') as string[];
    files?.forEach(f => allFiles.add(f));
  });

  // Count commits
  const commits = session.tasks.filter(t => t.committedSha).length;

  // Calculate duration
  const duration = session.endedAt
    ? session.endedAt.getTime() - session.startedAt.getTime()
    : Date.now() - session.startedAt.getTime();

  return {
    session,
    stats: {
      totalTasks,
      completedTasks,
      rejectedTasks,
      failedTasks,
      filesChanged: allFiles.size,
      commits,
      duration,
    },
  };
}

export async function listSessions(
  repositoryId: string,
  options?: {
    limit?: number;
    status?: typeof sessionStatusEnum[number];
  }
) {
  const whereConditions = options?.status
    ? and(eq(sessions.repositoryId, repositoryId), eq(sessions.status, options.status))
    : eq(sessions.repositoryId, repositoryId);

  return await db.query.sessions.findMany({
    where: whereConditions,
    with: {
      tasks: {
        columns: {
          id: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: [desc(sessions.startedAt)],
    limit: options?.limit,
  });
}
```

### Auto-abandon Inactive Sessions

```typescript
// src/lib/sessions/cleanup.ts

const INACTIVITY_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours

export async function cleanupInactiveSessions(): Promise<void> {
  const threshold = new Date(Date.now() - INACTIVITY_THRESHOLD);

  const inactiveSessions = await db.query.sessions.findMany({
    where: and(
      eq(sessions.status, 'active'),
      lt(sessions.lastActivity, threshold)
    ),
  });

  for (const session of inactiveSessions) {
    await db.update(sessions)
      .set({
        status: 'abandoned',
        endedAt: new Date(),
      })
      .where(eq(sessions.id, session.id));
  }
}

// Run as cron job or on server start
setInterval(cleanupInactiveSessions, 60 * 60 * 1000); // Every hour
```

### API Endpoints

**GET /api/sessions?repositoryId=xxx**
```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const repositoryId = searchParams.get('repositoryId');

  if (!repositoryId) {
    return Response.json({ error: 'Missing repositoryId' }, { status: 400 });
  }

  const sessions = await listSessions(repositoryId, { limit: 10 });

  return Response.json({ sessions });
}
```

**GET /api/sessions/:id**
```typescript
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const summary = await getSessionSummary(params.id);

  return Response.json(summary);
}
```

**POST /api/sessions**
```typescript
export async function POST(request: Request) {
  const { repositoryId } = await request.json();

  const session = await createSession(repositoryId);

  return Response.json({ session });
}
```

**POST /api/sessions/:id/end**
```typescript
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await endSession(params.id);

  return Response.json({ session });
}
```

**POST /api/sessions/:id/pause**
```typescript
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await pauseSession(params.id);

  return Response.json({ session });
}
```

**POST /api/sessions/:id/resume**
```typescript
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await resumeSession(params.id);

  return Response.json({ session });
}
```

### Client Components

```typescript
// src/components/dashboard/SessionHeader.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface SessionHeaderProps {
  session: Session;
  onEndSession: () => void;
}

export function SessionHeader({ session, onEndSession }: SessionHeaderProps) {
  const [showSummary, setShowSummary] = useState(false);

  const duration = formatDistanceToNow(new Date(session.startedAt), {
    addSuffix: true,
  });

  const taskCounts = {
    total: session.tasks.length,
    completed: session.tasks.filter(t => t.status === 'completed').length,
    pending: session.tasks.filter(t =>
      ['pending', 'running', 'waiting_approval'].includes(t.status)
    ).length,
  };

  async function handleEndSession() {
    if (confirm('End this session?')) {
      await fetch(`/api/sessions/${session.id}/end`, {
        method: 'POST',
      });

      onEndSession();
    }
  }

  return (
    <div className="session-header">
      <div className="session-info">
        <h2>Session: {session.repository.name}</h2>
        <p>Started {duration}</p>
        <p>
          {taskCounts.total} tasks ({taskCounts.completed} completed,{' '}
          {taskCounts.pending} pending)
        </p>
      </div>

      <div className="session-actions">
        <Button variant="outline" onClick={() => setShowSummary(true)}>
          View Summary
        </Button>
        <Button variant="destructive" onClick={handleEndSession}>
          End Session
        </Button>
      </div>
    </div>
  );
}
```

## Performance Considerations

- **Active Session Query**: Indexed by repositoryId + status
- **Last Activity Updates**: Batched every 5 minutes, not on every action
- **Session History**: Paginated, default 10 sessions
- **Cleanup Job**: Runs hourly, not on every request

## Edge Cases

### Scenario: User Forgets to End Session
**Handling**: Auto-abandon after 24h inactivity

### Scenario: Multiple Sessions Active
**Handling**: Only allow one active session per repository

### Scenario: Session Started on Branch A, User Switches to Branch B
**Handling**: Track both startBranch and endBranch for reference

### Scenario: Session with No Tasks
**Handling**: Allow empty sessions, show "No tasks yet" in history

### Scenario: User Deletes Session
**Handling**: Cascade delete all associated tasks (warn user first)

## Acceptance Criteria

- [ ] New session created when user selects repo (if none active)
- [ ] Active session loads when user returns to repo
- [ ] User can view session summary
- [ ] User can end session
- [ ] Session history shows past sessions
- [ ] Session stats calculated correctly
- [ ] Inactive sessions auto-abandoned after 24h
- [ ] Only one active session per repository
- [ ] Session persists across browser refreshes
- [ ] Task count and file count accurate

## Dependencies

**Required for**:
- Work organization
- Task context
- History tracking

**Depends on**:
- Repository selected
- Database schema
- Task management

## Future Enhancements

- Session notes/description
- Session tags (bug-fix, feature, refactor)
- Session export (JSON, PDF report)
- Session templates
- Session sharing/collaboration
- Session comparison (diff between sessions)
- Session branching (fork session)
- Session goals/objectives tracking
- Time tracking per task
- Session analytics (productivity metrics)
- Session notifications (daily summary email)
