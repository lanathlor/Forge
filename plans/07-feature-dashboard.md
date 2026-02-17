# Feature: Real-time Dashboard

## What is this feature?

A unified, real-time dashboard that provides a live view of all activities, including task execution, QA gate progress, and repository status, with automatic updates via Server-Sent Events.

## User Problem

**Without this feature**:

- Manual page refreshes to see updates
- Can't see Claude working in real-time
- Missed status changes
- No central overview of all activities
- Disconnected workflow

**With this feature**:

- Live updates without refresh
- Watch Claude work in real-time
- Instant status notifications
- Unified view of everything
- Seamless workflow

## User Stories

### Story 1: Real-time Updates

```
AS A developer
I WANT to see task updates in real-time
SO THAT I don't have to constantly refresh the page
```

### Story 2: Multi-tasking

```
AS A developer
I WANT to monitor Claude while doing other work
SO THAT I can be productive during execution
```

### Story 3: Status Overview

```
AS A developer
I WANT to see all tasks and their statuses at a glance
SO THAT I understand current system state
```

## User Flow

```
1. User opens dashboard (/)
   ↓
2. Dashboard loads with 3 main sections:
   - Repository Selector (left sidebar)
   - Task Timeline (center-left)
   - Main Content Area (center-right)
   ↓
3. User selects repository
   ↓
4. Active session loads (or new session created)
   ↓
5. User enters prompt and submits
   ↓
6. [Real-time via SSE] Task appears in timeline
   Status: "pending" → "running"
   ↓
7. [Real-time] Claude output streams to main area
   User sees:
   - Claude's thinking process
   - Files being read/written
   - Tool calls
   ↓
8. [Real-time] Status updates:
   "running" → "waiting_qa" → "qa_running"
   ↓
9. [Real-time] QA gate results appear
   Gate 1: ✅ ESLint passed
   Gate 2: ✅ TypeScript passed
   ↓
10. [Real-time] Status updates:
    "qa_running" → "waiting_approval"
    ↓
11. Notification: "Task ready for review"
    ↓
12. User reviews diff, approves or rejects
    ↓
13. [Real-time] Status updates:
    "waiting_approval" → "completed" (or "rejected")
    ↓
14. Timeline updates with final status
```

## UI Layout

### Overall Dashboard Structure

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 Autobot                    [Settings] [Help] [User]     │
├────────┬──────────────────┬───────────────────────────────┤
│        │                  │                                │
│  Repo  │  Task Timeline   │     Main Content Area         │
│  List  │  (Session)       │                                │
│        │                  │  ┌─────────────────────────┐  │
│ ┌────┐ │  🔄 Running      │  │  Task Output Stream     │  │
│ │ R1 │ │  Add error...    │  │                         │  │
│ └────┘ │  2m ago          │  │  Claude's output here   │  │
│        │  ───────────     │  │  scrolling in real-time │  │
│ ┌────┐ │                  │  │                         │  │
│ │ R2 │ │  ✅ Completed    │  └─────────────────────────┘  │
│ └────┘ │  Fix auth...     │                                │
│        │  10m ago         │  ┌─────────────────────────┐  │
│ ┌────┐ │  ───────────     │  │  QA Gate Results        │  │
│ │ R3 │ │                  │  │  ✅ ESLint passed       │  │
│ └────┘ │  ⏸️ Waiting      │  │  ✅ TypeScript passed   │  │
│        │  Update deps     │  └─────────────────────────┘  │
│        │  15m ago         │                                │
│        │                  │  ┌─────────────────────────┐  │
│        │  [New Task +]    │  │  Diff Viewer            │  │
│        │                  │  │  (Monaco Editor)        │  │
│        │                  │  └─────────────────────────┘  │
│        │                  │                                │
│        │                  │  [Approve] [Reject]           │
│        │                  │                                │
└────────┴──────────────────┴───────────────────────────────┘

Widths: 15% | 25% | 60%
```

### Repository Selector (Collapsible Sidebar)

```
┌──────────────────────┐
│  📁 Repositories     │
├──────────────────────┤
│                      │
│  ✓ my-app            │
│    main • Clean      │
│    ──────────        │
│                      │
│  📁 api-server   [*] │
│    develop           │
│                      │
│  📁 shared-lib   [✓] │
│    main              │
│                      │
│  [Rescan Workspace]  │
│  [+ Add Repo]        │
└──────────────────────┘
```

### Task Timeline

```
┌────────────────────────────┐
│  Session: my-app           │
│  [End Session] [New]       │
├────────────────────────────┤
│                            │
│  🔄 RUNNING                │
│  Add error handling to...  │
│  ┌──────────────────────┐  │
│  │ Started: 2m ago      │  │
│  │ Claude is working... │  │
│  │ [View Output →]      │  │
│  └──────────────────────┘  │
│  ────────────────────────  │
│                            │
│  ✅ COMPLETED              │
│  Fix authentication bug    │
│  ┌──────────────────────┐  │
│  │ 10m ago • 3 files    │  │
│  │ Commit: a3f2c1d      │  │
│  │ [View Details →]     │  │
│  └──────────────────────┘  │
│  ────────────────────────  │
│                            │
│  ⏸️ WAITING APPROVAL       │
│  Update dependencies       │
│  ┌──────────────────────┐  │
│  │ 15m ago • 12 files   │  │
│  │ QA: ✅ All passed    │  │
│  │ [Review Now →]       │  │
│  └──────────────────────┘  │
│  ────────────────────────  │
│                            │
│  ❌ REJECTED               │
│  Refactor user service     │
│  ┌──────────────────────┐  │
│  │ 30m ago              │  │
│  │ Reason: Type errors  │  │
│  │ [View Details →]     │  │
│  └──────────────────────┘  │
│                            │
│  ┌──────────────────────┐  │
│  │ + New Task           │  │
│  └──────────────────────┘  │
└────────────────────────────┘
```

### Main Content Area (Dynamic)

**State 1: Task Running**

```
┌─────────────────────────────────────────────────────┐
│  Task: Add error handling to API endpoints          │
│  Status: 🔄 Running • 2m 15s                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Claude Output:                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ > Reading src/api/routes.ts                   │ │
│  │ > Reading src/api/middleware.ts               │ │
│  │                                               │ │
│  │ I'll add comprehensive error handling to the │ │
│  │ API endpoints with try-catch blocks...       │ │
│  │                                               │ │
│  │ > Editing src/api/routes.ts                   │ │
│  │ > Creating src/lib/errors.ts                  │ │
│  │                                               │ │
│  │ [Auto-scrolls as new output arrives...]      │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [Cancel Task]                                      │
└─────────────────────────────────────────────────────┘
```

**State 2: QA Running**

```
┌─────────────────────────────────────────────────────┐
│  Task: Add error handling to API endpoints          │
│  Status: 🧪 Running QA Gates                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ✅ ESLint                              3.2s       │
│     No errors or warnings                          │
│                                                     │
│  🔄 TypeScript                          ...        │
│     Running type checks...                         │
│                                                     │
│  ⏳ Tests                               Pending    │
│     Waiting for previous gates...                  │
└─────────────────────────────────────────────────────┘
```

**State 3: Waiting Approval**

```
┌─────────────────────────────────────────────────────┐
│  Task: Add error handling to API endpoints          │
│  Status: ⏸️ Waiting for Approval                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Tabs: [Diff] [Output] [QA Results]                │
│                                                     │
│  [Diff View - Monaco Editor shown here]            │
│                                                     │
│  ✅ All QA gates passed                            │
│  📝 4 files changed (+90, -15)                     │
│                                                     │
│  [Reject & Revert]              [Approve Changes]  │
└─────────────────────────────────────────────────────┘
```

## Technical Implementation

### Server-Sent Events (SSE)

```typescript
// src/app/api/stream/route.ts

import { EventEmitter } from 'events';

// Global event emitter for server-sent events
export const taskEvents = new EventEmitter();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return new Response('Missing sessionId', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
      );

      // Event handlers
      const onTaskUpdate = (data: any) => {
        if (data.sessionId === sessionId) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'task_update', ...data })}\n\n`
            )
          );
        }
      };

      const onTaskOutput = (data: any) => {
        if (data.sessionId === sessionId) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'task_output', ...data })}\n\n`
            )
          );
        }
      };

      const onQAGateUpdate = (data: any) => {
        if (data.sessionId === sessionId) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'qa_gate_update', ...data })}\n\n`
            )
          );
        }
      };

      // Register listeners
      taskEvents.on('task:update', onTaskUpdate);
      taskEvents.on('task:output', onTaskOutput);
      taskEvents.on('qa:update', onQAGateUpdate);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        taskEvents.off('task:update', onTaskUpdate);
        taskEvents.off('task:output', onTaskOutput);
        taskEvents.off('qa:update', onQAGateUpdate);
        controller.close();
      });

      // Keep-alive ping every 30s
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(': keep-alive\n\n'));
      }, 30000);

      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
```

### Emit Events from Task Orchestrator

```typescript
// src/lib/tasks/orchestrator.ts (updated)

import { taskEvents } from '@/app/api/stream/route';

export async function executeTask(taskId: string): Promise<void> {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: {
      session: true,
    },
  });

  // Emit status update
  function emitUpdate(status: string, data?: any) {
    taskEvents.emit('task:update', {
      sessionId: task.session.id,
      taskId: task.id,
      status,
      ...data,
    });
  }

  try {
    emitUpdate('pre_flight');

    const preFlightResult = await runPreFlightChecks(repoPath);
    if (!preFlightResult.passed) {
      emitUpdate('failed', { error: preFlightResult.error });
      return;
    }

    emitUpdate('running');

    // Stream output as it arrives
    claudeWrapper.on('output', (data) => {
      taskEvents.emit('task:output', {
        sessionId: task.session.id,
        taskId: task.id,
        output: data.data,
      });
    });

    const result = await claudeWrapper.executeTask({...});

    emitUpdate('waiting_qa');

    // Run QA gates with events
    await runQAGatesWithEvents(taskId, repoPath);

  } catch (error) {
    emitUpdate('failed', { error: error.message });
  }
}
```

### Client-side SSE Hook

```typescript
// src/hooks/useTaskStream.ts

'use client';

import { useEffect, useState } from 'react';

interface TaskUpdate {
  type: string;
  taskId: string;
  status?: string;
  output?: string;
  [key: string]: any;
}

export function useTaskStream(sessionId: string) {
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource(`/api/stream?sessionId=${sessionId}`);

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'connected') {
        setConnected(true);
        return;
      }

      setUpdates((prev) => [...prev, data]);
    };

    eventSource.onerror = () => {
      setConnected(false);
      eventSource.close();

      // Auto-reconnect after 3s
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId]);

  return { updates, connected };
}
```

### Dashboard Main Component

```typescript
// src/app/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { RepositorySelector } from '@/components/dashboard/RepositorySelector';
import { TaskTimeline } from '@/components/dashboard/TaskTimeline';
import { TaskDetails } from '@/components/dashboard/TaskDetails';
import { useTaskStream } from '@/hooks/useTaskStream';

export default function DashboardPage() {
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const { updates, connected } = useTaskStream(currentSession?.id);

  useEffect(() => {
    if (selectedRepo) {
      loadOrCreateSession(selectedRepo.id);
    }
  }, [selectedRepo]);

  // Update UI based on SSE updates
  useEffect(() => {
    if (updates.length > 0) {
      const latestUpdate = updates[updates.length - 1];

      // Refresh timeline if task status changed
      if (latestUpdate.type === 'task_update') {
        refreshTimeline();
      }
    }
  }, [updates]);

  return (
    <div className="dashboard-layout">
      {/* Connection Status */}
      <div className="status-bar">
        {connected ? (
          <span>🟢 Connected</span>
        ) : (
          <span>🔴 Reconnecting...</span>
        )}
      </div>

      {/* Main Layout */}
      <div className="flex h-screen">
        {/* Repository Selector */}
        <aside className="w-64 bg-gray-50">
          <RepositorySelector
            selected={selectedRepo}
            onSelect={setSelectedRepo}
          />
        </aside>

        {/* Task Timeline */}
        <aside className="w-80 border-r">
          {currentSession && (
            <TaskTimeline
              sessionId={currentSession.id}
              selectedTask={selectedTask}
              onSelectTask={setSelectedTask}
              updates={updates}
            />
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          {selectedTask ? (
            <TaskDetails
              taskId={selectedTask.id}
              updates={updates.filter(u => u.taskId === selectedTask.id)}
            />
          ) : (
            <div className="empty-state">
              Select a task or create a new one
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
```

## Performance Considerations

- **SSE Connection**: One connection per session, reused for all updates
- **Event Filtering**: Filter events by sessionId server-side
- **Keep-alive**: Prevent connection timeout with periodic pings
- **Auto-reconnect**: Reconnect automatically if connection drops
- **Batching**: Batch rapid updates (e.g., Claude output) to avoid UI thrashing

## Edge Cases

### Scenario: Connection Drops

**Handling**: Auto-reconnect after 3s, show "Reconnecting..." indicator

### Scenario: Multiple Browser Tabs

**Handling**: Each tab gets its own SSE connection, all receive same updates

### Scenario: User Closes Tab During Task

**Handling**: Task continues on server, user can reconnect later

### Scenario: Server Restart

**Handling**: Clients auto-reconnect, resume from database state

### Scenario: Rapid Status Changes

**Handling**: Debounce UI updates to avoid flickering

## Acceptance Criteria

- [ ] Dashboard loads with all sections visible
- [ ] User can select repository from sidebar
- [ ] Task timeline shows all tasks in session
- [ ] Real-time updates arrive without refresh
- [ ] Connection status indicator shows connected/disconnected
- [ ] Claude output streams in real-time
- [ ] QA gate progress updates live
- [ ] Task status changes reflect immediately
- [ ] Auto-reconnect works after connection loss
- [ ] Multiple tabs receive same updates
- [ ] Performance remains smooth with 10+ tasks

## Dependencies

**Required for**:

- User experience
- Monitoring tasks
- Quick feedback

**Depends on**:

- SSE endpoint working
- Event emitters in task orchestrator
- Client-side EventSource API

## Future Enhancements

- WebSocket option (bidirectional communication)
- Desktop notifications
- Sound alerts on task completion
- Dashboard customization (hide/show panels)
- Keyboard shortcuts
- Dark mode toggle
- Mobile responsive layout
- Multi-session view
- Dashboard export/sharing
- Real-time collaboration (multi-user)
