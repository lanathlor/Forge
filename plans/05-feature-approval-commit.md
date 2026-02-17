# Feature: Approval & Commit Workflow

## What is this feature?

An intelligent commit workflow where users approve Claude's changes, Claude generates a commit message, users review/edit it, and the tool automatically commits to git.

## User Problem

**Without this feature**:

- Manually stage files after Claude finishes
- Write commit messages from scratch
- Remember what changed and why
- Risk inconsistent commit message style
- Time spent on commit housekeeping

**With this feature**:

- One-click approval
- AI-generated commit messages
- Consistent message format
- Automatic staging and committing
- Clean git history

## User Stories

### Story 1: Easy Approval

```
AS A developer
I WANT to approve Claude's changes with one click
SO THAT I don't waste time on manual git commands
```

### Story 2: AI Commit Messages

```
AS A developer
I WANT Claude to write commit messages for me
SO THAT I get consistent, descriptive messages
```

### Story 3: Message Editing

```
AS A developer
I WANT to review and edit commit messages before committing
SO THAT I maintain control over git history
```

## User Flow

```
1. Task status: "waiting_approval"
   QA gates: ✅ All passed
   ↓
2. User reviews diff
   ↓
3. User clicks "Approve"
   ↓
4. System sends prompt to Claude:

   "Generate a concise git commit message for these changes:

   <diff>
   [Full diff content]
   </diff>

   Follow conventional commit format (feat/fix/refactor/etc).
   Be specific about what changed and why.
   Keep first line under 72 characters.
   Add detailed description if needed."

   ↓
5. Claude generates commit message:

   "feat(api): add error handling to user endpoints

   - Wrap route handlers in try-catch blocks
   - Add custom error response middleware
   - Create centralized error types
   - Handle async errors properly

   This improves reliability and provides consistent error
   responses across all API endpoints."

   ↓
6. System shows commit message to user (editable)

   ┌──────────────────────────────────────────────┐
   │  Commit Message                              │
   ├──────────────────────────────────────────────┤
   │  ┌────────────────────────────────────────┐  │
   │  │ feat(api): add error handling to user  │  │
   │  │ endpoints                              │  │
   │  │                                        │  │
   │  │ - Wrap route handlers in try-catch    │  │
   │  │ - Add custom error response middleware│  │
   │  │ - Create centralized error types      │  │
   │  │ - Handle async errors properly        │  │
   │  │                                        │  │
   │  │ This improves reliability and provides│  │
   │  │ consistent error responses across all │  │
   │  │ API endpoints.                        │  │
   │  └────────────────────────────────────────┘  │
   │                                              │
   │  [Edit] [Cancel]          [Commit Changes]  │
   └──────────────────────────────────────────────┘

   ↓
7. User reviews, optionally edits
   ↓
8. User clicks "Commit Changes"
   ↓
9. System executes:

   a) git add <file1> <file2> <file3> ...
   b) git commit -m "<commit-message>"

   ↓
10. System captures commit SHA
    ↓
11. Task status → "completed"
    ↓
12. Success notification shown
    ↓
13. Task marked as completed in timeline
```

## UI Components

### Approval Panel (Before Commit Message)

```
┌────────────────────────────────────────────────────┐
│  Review & Approve                                  │
├────────────────────────────────────────────────────┤
│                                                    │
│  ✅ All QA gates passed                           │
│  📝 4 files changed (+90, -15)                    │
│                                                    │
│  This task is ready for approval.                 │
│                                                    │
│  [Reject & Revert]              [Approve Changes] │
└────────────────────────────────────────────────────┘
```

### Commit Message Editor

```
┌────────────────────────────────────────────────────┐
│  Commit Message                                    │
├────────────────────────────────────────────────────┤
│                                                    │
│  Claude suggested:                                 │
│  ┌──────────────────────────────────────────────┐ │
│  │ [Editable Textarea]                          │ │
│  │                                              │ │
│  │ feat(api): add error handling to user       │ │
│  │ endpoints                                    │ │
│  │                                              │ │
│  │ - Wrap route handlers in try-catch blocks   │ │
│  │ - Add custom error response middleware      │ │
│  │ - Create centralized error types            │ │
│  │ - Handle async errors properly              │ │
│  │                                              │ │
│  │ This improves reliability and provides      │ │
│  │ consistent error responses across all API   │ │
│  │ endpoints.                                   │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  💡 Tip: Follow conventional commits format       │
│                                                    │
│  [Regenerate Message]  [Cancel]  [Commit Changes] │
└────────────────────────────────────────────────────┘
```

### Success Confirmation

```
┌────────────────────────────────────────────────────┐
│  ✅ Changes Committed                             │
├────────────────────────────────────────────────────┤
│                                                    │
│  Commit: a3f2c1d                                   │
│  Message: feat(api): add error handling...        │
│                                                    │
│  4 files committed to main branch                 │
│                                                    │
│  [View Commit] [Start Next Task]                  │
└────────────────────────────────────────────────────┘
```

## Technical Implementation

### Commit Message Generation

```typescript
// src/lib/claude/commit-message.ts

import { claudeWrapper } from './wrapper';

export async function generateCommitMessage(
  diff: string,
  taskPrompt: string
): Promise<string> {
  const prompt = `
You are a git commit message expert. Generate a concise, professional commit message for these changes.

Original task: "${taskPrompt}"

Changes made:
<diff>
${diff}
</diff>

Requirements:
1. Follow conventional commit format: type(scope): subject
2. Types: feat, fix, refactor, docs, test, chore, style, perf
3. Keep subject line under 72 characters
4. Add bullet points describing key changes
5. Include a brief explanation of why (not just what)
6. Be specific and descriptive

Generate ONLY the commit message, nothing else.
`.trim();

  // Option A: Use Claude API directly
  // const response = await anthropic.messages.create({
  //   model: 'claude-3-5-sonnet-20241022',
  //   max_tokens: 500,
  //   messages: [{ role: 'user', content: prompt }],
  // });
  // return response.content[0].text;

  // Option B: Use Claude Code CLI in single-shot mode
  const result = await claudeWrapper.executeTask({
    workingDirectory: '/tmp', // Doesn't matter
    prompt: prompt,
    taskId: 'commit-msg-gen',
  });

  return result.output.trim();
}
```

### Commit Workflow Orchestrator

```typescript
// src/lib/git/commit.ts

import { exec } from 'child_process';
import { promisify } from 'util';
import { generateCommitMessage } from '@/lib/claude/commit-message';

const execAsync = promisify(exec);

export interface CommitResult {
  sha: string;
  message: string;
  filesCommitted: string[];
  timestamp: Date;
}

export async function commitChanges(
  repoPath: string,
  files: string[],
  message: string
): Promise<CommitResult> {
  try {
    // 1. Stage files
    await execAsync(`git add ${files.map((f) => `"${f}"`).join(' ')}`, {
      cwd: repoPath,
    });

    // 2. Commit
    await execAsync(`git commit -m ${JSON.stringify(message)}`, {
      cwd: repoPath,
    });

    // 3. Get commit SHA
    const { stdout: sha } = await execAsync('git rev-parse HEAD', {
      cwd: repoPath,
    });

    return {
      sha: sha.trim(),
      message,
      filesCommitted: files,
      timestamp: new Date(),
    };
  } catch (error) {
    throw new Error(
      `Failed to commit: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function approveTask(taskId: string): Promise<CommitResult> {
  // 1. Get task
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
  if (task.status !== 'waiting_approval') {
    throw new Error('Task not ready for approval');
  }

  const repoPath = task.session.repository.path;

  // 2. Generate commit message
  const commitMessage = await generateCommitMessage(
    task.diffContent!,
    task.prompt
  );

  // Store generated message
  await db.update(tasks).set({ commitMessage }).where(eq(tasks.id, taskId));

  return { message: commitMessage } as any; // Return for user review
}

export async function finalizeCommit(
  taskId: string,
  editedMessage?: string
): Promise<CommitResult> {
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
  const message = editedMessage || task.commitMessage!;
  const files = JSON.parse(task.filesChanged || '[]') as string[];

  // Commit
  const result = await commitChanges(repoPath, files, message);

  // Update task
  await db
    .update(tasks)
    .set({
      status: 'completed',
      committedSha: result.sha,
      commitMessage: message,
      completedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  return result;
}
```

### API Endpoints

**POST /api/tasks/:id/approve**

```typescript
// Step 1: Generate commit message

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const result = await approveTask(params.id);

    return Response.json({
      message: result.message,
      status: 'awaiting_commit_confirmation',
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    );
  }
}
```

**POST /api/tasks/:id/commit**

```typescript
// Step 2: Finalize commit with optional edited message

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { message } = await request.json();

  try {
    const result = await finalizeCommit(params.id, message);

    return Response.json({
      success: true,
      commitSha: result.sha,
      message: result.message,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    );
  }
}
```

**POST /api/tasks/:id/regenerate-message**

```typescript
// Regenerate commit message if user doesn't like first attempt

import { db } from '@/lib/db';
import { tasks } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, params.id),
  });

  if (!task) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  const newMessage = await generateCommitMessage(
    task.diffContent!,
    task.prompt
  );

  await db
    .update(tasks)
    .set({ commitMessage: newMessage })
    .where(eq(tasks.id, params.id));

  return Response.json({ message: newMessage });
}
```

### Client Components

```typescript
// src/components/dashboard/ApprovalPanel.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ApprovalPanelProps {
  taskId: string;
  qaStatus: 'passed' | 'failed';
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export function ApprovalPanel({
  taskId,
  qaStatus,
  filesChanged,
  insertions,
  deletions,
}: ApprovalPanelProps) {
  const [step, setStep] = useState<'review' | 'commit'>('review');
  const [commitMessage, setCommitMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    setLoading(true);

    try {
      // Generate commit message
      const res = await fetch(`/api/tasks/${taskId}/approve`, {
        method: 'POST',
      });

      const data = await res.json();
      setCommitMessage(data.message);
      setStep('commit');

    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    setLoading(true);

    try {
      const res = await fetch(`/api/tasks/${taskId}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commitMessage }),
      });

      const data = await res.json();

      if (data.success) {
        // Show success, refresh UI
        alert(`Committed: ${data.commitSha}`);
      }

    } catch (error) {
      console.error('Failed to commit:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerate() {
    setLoading(true);

    try {
      const res = await fetch(`/api/tasks/${taskId}/regenerate-message`, {
        method: 'POST',
      });

      const data = await res.json();
      setCommitMessage(data.message);

    } catch (error) {
      console.error('Failed to regenerate:', error);
    } finally {
      setLoading(false);
    }
  }

  if (qaStatus === 'failed') {
    return (
      <div className="approval-panel blocked">
        <p>❌ QA gates failed. Cannot approve.</p>
        <Button variant="destructive">Reject & Revert</Button>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="approval-panel">
        <div className="status">
          <p>✅ All QA gates passed</p>
          <p>📝 {filesChanged} files changed (+{insertions}, -{deletions})</p>
        </div>

        <div className="actions">
          <Button variant="outline" onClick={() => {}}>
            Reject & Revert
          </Button>
          <Button onClick={handleApprove} disabled={loading}>
            {loading ? 'Generating commit message...' : 'Approve Changes'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="commit-panel">
      <h3>Commit Message</h3>
      <p className="text-sm text-muted-foreground">
        Claude suggested (editable):
      </p>

      <Textarea
        value={commitMessage}
        onChange={(e) => setCommitMessage(e.target.value)}
        rows={10}
        className="font-mono"
      />

      <div className="actions">
        <Button variant="ghost" onClick={handleRegenerate} disabled={loading}>
          Regenerate Message
        </Button>
        <Button variant="outline" onClick={() => setStep('review')}>
          Cancel
        </Button>
        <Button onClick={handleCommit} disabled={loading || !commitMessage}>
          {loading ? 'Committing...' : 'Commit Changes'}
        </Button>
      </div>
    </div>
  );
}
```

### Database Schema Updates

```typescript
// Already covered in previous schemas, but for reference:

// src/db/schema.ts - tasks table includes:
export const tasks = sqliteTable('tasks', {
  // ... existing fields

  committedSha: text('committed_sha'),
  commitMessage: text('commit_message'),
  approvedAt: integer('approved_at', { mode: 'timestamp' }),
  // approvedBy: text('approved_by'), // Future: auth

  // ... rest
});
```

## Performance Considerations

- **Commit Message Generation**: ~2-5 seconds (Claude API call)
- **Git Operations**: < 1 second for staging + commit
- **Show Loading States**: Critical for commit message generation
- **Timeout**: 30 second timeout for commit message generation

## Edge Cases

### Scenario: Commit Message Generation Fails

**Handling**: Show error, allow manual message input

### Scenario: Git Commit Fails (e.g., hooks reject)

**Handling**: Show git error, keep task in waiting_approval state, user can retry

### Scenario: User Edits to Empty Message

**Handling**: Disable "Commit" button if message is empty

### Scenario: Files Changed After Approval

**Handling**: Pre-commit check detects, abort with warning, ask user to review again

### Scenario: Branch Changed After Task Started

**Handling**: Warning shown, ask user to confirm commit to current branch

### Scenario: Commit Message Too Long (> 5000 chars)

**Handling**: Warn user, truncate or ask Claude to shorten

## Acceptance Criteria

- [ ] User can approve task after QA passes
- [ ] Claude generates commit message automatically
- [ ] Commit message follows conventional commit format
- [ ] User can edit commit message before committing
- [ ] User can regenerate commit message
- [ ] Commit executes successfully with all changed files
- [ ] Commit SHA stored in database
- [ ] Task status updates to "completed"
- [ ] Success message shown after commit
- [ ] Timeline reflects completed status
- [ ] Errors handled gracefully with clear messages

## Dependencies

**Required for**:

- Clean git history
- Task completion
- Audit trail

**Depends on**:

- Task execution completed
- QA gates passed
- Diff captured
- Git repository clean

## Future Enhancements

- Co-authored commits (add user as co-author)
- Custom commit message templates
- Commit message validation (enforce format)
- GPG signing support
- Commit message history (learn from past messages)
- Multi-commit support (split large changes)
- Branch creation before commit
- Automatic push to remote (optional)
- Commit hooks integration
- Amend previous commit option
- Squash multiple task commits
