# Feature: Claude Task Execution

## What is this feature?

The ability to send prompts to Claude Code and monitor task execution in real-time, capturing all output, file changes, and completion status.

## User Problem

**Without this feature**:
- Run Claude Code manually in terminal
- Can't see what's happening from dashboard
- No record of what Claude did
- Hard to review multiple tasks
- Can't pause/resume work

**With this feature**:
- Send prompts from UI
- Real-time output streaming
- Complete task history
- Status tracking (running, done, failed)
- Context for approval decisions

## User Stories

### Story 1: Starting a Task
```
AS A developer
I WANT to send a prompt to Claude from the dashboard
SO THAT I can initiate work without leaving the UI
```

### Story 2: Monitoring Progress
```
AS A developer
I WANT to see Claude's output in real-time
SO THAT I know what's happening during execution
```

### Story 3: Reviewing History
```
AS A developer
I WANT to see all past tasks in a session
SO THAT I can understand what led to current state
```

## User Flow

```
1. User selects repository
   ↓
2. User types prompt in text area
   Example: "Add error handling to the API endpoints"
   ↓
3. User clicks "Send to Claude"
   ↓
4. System creates Task record in database
   Status: "pending"
   ↓
5. System runs pre-flight checks
   - Is repository clean?
   - Is git working?
   ↓
6. [If checks fail] → Show error, abort
   [If checks pass] → Continue
   ↓
7. System spawns Claude Code CLI process
   Command: claude-code --working-directory /path/to/repo --prompt "..."
   ↓
8. Task status updates to "running"
   ↓
9. [Real-time] Claude output streams to UI
   - User sees Claude's thinking
   - User sees tool calls
   - User sees file changes
   ↓
10. Claude finishes (exit code 0)
    ↓
11. System captures final state
    - Git diff
    - Changed files list
    ↓
12. Task status updates to "waiting_qa"
    ↓
13. QA gates trigger automatically
    (See 03-feature-qa-gates.md)
```

## UI Components

### Prompt Input Panel

```
┌─────────────────────────────────────────────────────┐
│  New Task                                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ What should Claude do?                        │ │
│  │                                               │ │
│  │ Add error handling to the API endpoints      │ │
│  │                                               │ │
│  │                                               │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [Cancel]                      [Send to Claude] ─→  │
└─────────────────────────────────────────────────────┘
```

### Task Timeline (Sidebar)

```
┌─────────────────────────────────────┐
│  Tasks (Current Session)            │
├─────────────────────────────────────┤
│                                     │
│  🔄 RUNNING                         │
│  Add error handling...              │
│  Started 2m ago                     │
│  ─────────────────────────────────  │
│                                     │
│  ✅ COMPLETED                       │
│  Fix auth bug                       │
│  5m ago • 3 files changed          │
│  ─────────────────────────────────  │
│                                     │
│  ❌ REJECTED                        │
│  Refactor user service              │
│  15m ago • Reverted                │
│  ─────────────────────────────────  │
│                                     │
│  ⏸️ WAITING APPROVAL                │
│  Update dependencies                │
│  20m ago • QA passed               │
└─────────────────────────────────────┘

Status Icons:
🔄 = Running
⏸️ = Waiting approval
✅ = Completed (approved & committed)
❌ = Rejected (reverted)
⚠️ = Failed (error during execution)
🚫 = QA failed
```

### Task Output Stream

```
┌──────────────────────────────────────────────────────┐
│  Task: Add error handling to API endpoints          │
│  Status: Running • Started 2m 15s ago               │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Claude Code Output:                                │
│  ┌────────────────────────────────────────────────┐ │
│  │ I'll add comprehensive error handling to the  │ │
│  │ API endpoints. Let me start by analyzing the  │ │
│  │ current error handling patterns...            │ │
│  │                                               │ │
│  │ Reading: src/api/routes.ts                    │ │
│  │ Reading: src/api/middleware.ts                │ │
│  │                                               │ │
│  │ I'll add try-catch blocks and proper error   │ │
│  │ responses. Making changes...                  │ │
│  │                                               │ │
│  │ Editing: src/api/routes.ts                    │ │
│  │ Editing: src/api/middleware.ts                │ │
│  │ Writing: src/api/errors.ts (new file)         │ │
│  │                                               │ │
│  │ ✓ Task completed successfully                 │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  [Auto-scrolls to bottom as new output arrives]     │
└──────────────────────────────────────────────────────┘
```

## Technical Implementation

### Claude Code Wrapper

```typescript
// src/lib/claude/wrapper.ts

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

interface ClaudeTaskOptions {
  workingDirectory: string;
  prompt: string;
  taskId: string;
}

interface ClaudeTaskResult {
  exitCode: number;
  output: string;
  error?: string;
}

class ClaudeCodeWrapper extends EventEmitter {
  private process: ChildProcess | null = null;
  private output: string[] = [];

  async executeTask(options: ClaudeTaskOptions): Promise<ClaudeTaskResult> {
    const { workingDirectory, prompt, taskId } = options;

    return new Promise((resolve, reject) => {
      // Spawn Claude Code CLI
      this.process = spawn(
        process.env.CLAUDE_CODE_PATH || 'claude-code',
        [
          '--working-directory', workingDirectory,
          '--prompt', prompt,
        ],
        {
          cwd: workingDirectory,
          env: process.env,
        }
      );

      // Capture stdout
      this.process.stdout?.on('data', (data) => {
        const text = data.toString();
        this.output.push(text);

        // Emit for real-time streaming
        this.emit('output', {
          taskId,
          type: 'stdout',
          data: text,
          timestamp: new Date(),
        });

        // Store in database
        this.appendTaskOutput(taskId, text);
      });

      // Capture stderr
      this.process.stderr?.on('data', (data) => {
        const text = data.toString();
        this.emit('error', {
          taskId,
          type: 'stderr',
          data: text,
          timestamp: new Date(),
        });

        this.appendTaskOutput(taskId, text);
      });

      // Handle completion
      this.process.on('close', (exitCode) => {
        const result: ClaudeTaskResult = {
          exitCode: exitCode || 0,
          output: this.output.join(''),
        };

        if (exitCode === 0) {
          this.emit('complete', { taskId, result });
          resolve(result);
        } else {
          const error = `Claude exited with code ${exitCode}`;
          this.emit('failed', { taskId, error });
          reject(new Error(error));
        }

        this.cleanup();
      });

      // Handle errors
      this.process.on('error', (err) => {
        this.emit('failed', { taskId, error: err.message });
        reject(err);
        this.cleanup();
      });
    });
  }

  async cancel(taskId: string): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.emit('cancelled', { taskId });
      this.cleanup();
    }
  }

  private async appendTaskOutput(taskId: string, output: string): Promise<void> {
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    const existingOutput = task?.claudeOutput || '';
    await db.update(tasks)
      .set({
        claudeOutput: existingOutput + output,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));
  }

  private cleanup(): void {
    this.process = null;
    this.output = [];
  }
}

// Singleton instance
export const claudeWrapper = new ClaudeCodeWrapper();
```

### Task Orchestrator

```typescript
// src/lib/tasks/orchestrator.ts

import { claudeWrapper } from '@/lib/claude/wrapper';
import { runPreFlightChecks } from '@/lib/git/pre-flight';
import { captureDiff } from '@/lib/git/diff';
import { runQAGates } from '@/lib/qa-gates/runner';
import { db } from '@/lib/db';
import { tasks, sessions, repositories } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function executeTask(taskId: string): Promise<void> {
  try {
    // 1. Get task from database with related data
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: {
        session: {
          with: {
            repository: true,
          },
        },
      },
    });

    if (!task) throw new Error('Task not found');

    const repoPath = task.session.repository.path;

    // 2. Run pre-flight checks
    await db.update(tasks)
      .set({ status: 'pre_flight' })
      .where(eq(tasks.id, taskId));

    const preFlightResult = await runPreFlightChecks(repoPath);

    if (!preFlightResult.passed) {
      await db.update(tasks)
        .set({
          status: 'failed',
          claudeOutput: `Pre-flight check failed: ${preFlightResult.error}`,
        })
        .where(eq(tasks.id, taskId));
      return;
    }

    // 3. Capture starting state
    await db.update(tasks)
      .set({
        startingCommit: preFlightResult.currentCommit,
        startingBranch: preFlightResult.currentBranch,
      })
      .where(eq(tasks.id, taskId));

    // 4. Execute Claude Code
    await db.update(tasks)
      .set({ status: 'running' })
      .where(eq(tasks.id, taskId));

    const result = await claudeWrapper.executeTask({
      workingDirectory: repoPath,
      prompt: task.prompt,
      taskId: task.id,
    });

    // 5. Capture diff
    const diff = await captureDiff(repoPath, task.startingCommit!);

    await db.update(tasks)
      .set({
        diffContent: diff.fullDiff,
        filesChanged: JSON.stringify(diff.changedFiles),
        status: 'waiting_qa',
      })
      .where(eq(tasks.id, taskId));

    // 6. Run QA gates (automatic)
    await runQAGates(taskId, repoPath);

  } catch (error) {
    await db.update(tasks)
      .set({
        status: 'failed',
        claudeOutput: error instanceof Error ? error.message : 'Unknown error',
      })
      .where(eq(tasks.id, taskId));
  }
}
```

### Database Schema

```typescript
// src/db/schema.ts

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';
import { relations } from 'drizzle-orm';

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

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),

  // Task details
  prompt: text('prompt').notNull(),
  status: text('status', { enum: taskStatusEnum }).notNull().default('pending'),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),

  // Claude output
  claudeOutput: text('claude_output'),

  // Git state
  startingCommit: text('starting_commit'),
  startingBranch: text('starting_branch'),
  filesChanged: text('files_changed'), // JSON string
  diffContent: text('diff_content'),

  // Commit info (if approved)
  committedSha: text('committed_sha'),
  commitMessage: text('commit_message'),

  // Rejection info
  rejectedAt: integer('rejected_at', { mode: 'timestamp' }),
  rejectionReason: text('rejection_reason'),
}, (table) => ({
  sessionIdx: index('task_session_idx').on(table.sessionId),
  statusIdx: index('task_status_idx').on(table.status),
}));
```

### API Endpoints

**POST /api/tasks**
```typescript
// src/app/api/tasks/route.ts

import { db } from '@/lib/db';
import { tasks } from '@/db/schema';

export async function POST(request: Request) {
  const { sessionId, prompt } = await request.json();

  // Validate
  if (!prompt || !sessionId) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Create task
  const [task] = await db.insert(tasks)
    .values({
      sessionId,
      prompt,
      status: 'pending',
    })
    .returning();

  // Start execution (async, don't await)
  executeTask(task.id).catch(console.error);

  return Response.json({ task });
}
```

**GET /api/tasks/:id**
```typescript
import { db } from '@/lib/db';
import { tasks } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, params.id),
    with: {
      qaGateResults: true,
      session: {
        with: {
          repository: true,
        },
      },
    },
  });

  if (!task) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  return Response.json({ task });
}
```

**POST /api/tasks/:id/cancel**
```typescript
import { db } from '@/lib/db';
import { tasks } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  await claudeWrapper.cancel(params.id);

  await db.update(tasks)
    .set({ status: 'cancelled' })
    .where(eq(tasks.id, params.id));

  return Response.json({ success: true });
}
```

### Real-time Updates (SSE)

```typescript
// src/app/api/stream/route.ts

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Listen to Claude wrapper events
      const onOutput = (data: any) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'output', ...data })}\n\n`)
        );
      };

      const onComplete = (data: any) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'complete', ...data })}\n\n`)
        );
      };

      const onFailed = (data: any) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'failed', ...data })}\n\n`)
        );
      };

      claudeWrapper.on('output', onOutput);
      claudeWrapper.on('complete', onComplete);
      claudeWrapper.on('failed', onFailed);

      // Cleanup
      request.signal.addEventListener('abort', () => {
        claudeWrapper.off('output', onOutput);
        claudeWrapper.off('complete', onComplete);
        claudeWrapper.off('failed', onFailed);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### Client Component

```typescript
// src/components/dashboard/PromptInput.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function PromptInput({ sessionId }: { sessionId: string }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!prompt.trim()) return;

    setLoading(true);

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, prompt }),
      });

      const { task } = await res.json();

      // Reset form
      setPrompt('');

      // Navigate to task detail or refresh timeline
      // (handled by parent component via SSE)

    } catch (error) {
      console.error('Failed to submit task:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="prompt-input">
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="What should Claude do?"
        rows={4}
        disabled={loading}
      />

      <div className="actions">
        <Button onClick={handleSubmit} disabled={loading || !prompt.trim()}>
          {loading ? 'Sending...' : 'Send to Claude'}
        </Button>
      </div>
    </div>
  );
}
```

## Performance Considerations

- Output streaming keeps UI responsive during long tasks
- Database writes are batched (append output every 500ms, not per line)
- SSE auto-reconnects if connection drops
- Task execution happens in background (non-blocking)

## Edge Cases

### Scenario: Claude Hangs
**Handling**: Implement timeout (default 10 minutes), show warning at 8 minutes, auto-cancel at 10

### Scenario: Multiple Tasks Submitted
**Handling**: Queue tasks, only one runs at a time per repository

### Scenario: User Closes Browser
**Handling**: Task continues in background, state persists, user can reconnect

### Scenario: Claude Asks for Input
**Handling**: Detect input prompt in output, show modal, send stdin to process (future enhancement)

### Scenario: Claude Code Not Installed
**Handling**: Pre-flight check detects, shows error with installation instructions

## Acceptance Criteria

- [ ] User can submit prompt from UI
- [ ] Task appears in timeline immediately
- [ ] Pre-flight checks run before execution
- [ ] Claude output streams in real-time
- [ ] Task status updates accurately
- [ ] Diff captured after completion
- [ ] All data persists in database
- [ ] User can cancel running task
- [ ] Errors handled gracefully with user feedback
- [ ] Timeline shows all tasks in session

## Dependencies

**Required for**:
- QA gates (need completed task to test)
- Diff review (need changes to review)
- Approval workflow (need task to approve)

**Depends on**:
- Repository selected
- Pre-flight checks passing
- Claude Code CLI available
- Git working in repository

## Future Enhancements

- Interactive mode (respond to Claude's questions)
- Task templates (common prompts)
- Parallel task execution (different repos)
- Task retry on failure
- Estimated time remaining
- Task dependencies (run B after A completes)
- Scheduled tasks
