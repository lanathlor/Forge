# Feature: Reject & Revert Workflow

## What is this feature?

A safe rollback mechanism that allows users to reject Claude's changes and surgically revert only the files Claude modified, preserving the repository's previous state.

## User Problem

**Without this feature**:

- Manually undo changes with git reset
- Risk of losing other work
- No record of what was rejected
- Hard to know which files to revert
- Fear of breaking repository state

**With this feature**:

- One-click rejection
- Surgical revert (only Claude's files)
- Reason tracking for decisions
- Safe rollback mechanism
- Audit trail of rejections

## User Stories

### Story 1: Easy Rejection

```
AS A developer
I WANT to reject Claude's changes with one click
SO THAT I can quickly undo work I don't want
```

### Story 2: Safe Rollback

```
AS A developer
I WANT only Claude's files to be reverted
SO THAT I don't lose any other work I might have done
```

### Story 3: Rejection Tracking

```
AS A developer
I WANT to record why I rejected changes
SO THAT I have an audit trail of decisions
```

## User Flow

```
1. Task status: "waiting_approval" or "qa_failed"
   ↓
2. User reviews changes and decides to reject
   ↓
3. User clicks "Reject Changes"
   ↓
4. Rejection modal appears:

   ┌──────────────────────────────────────────┐
   │  Reject Changes                          │
   ├──────────────────────────────────────────┤
   │                                          │
   │  This will revert all changes made by   │
   │  Claude in this task.                   │
   │                                          │
   │  Files to be reverted:                  │
   │  • src/api/routes.ts                    │
   │  • src/api/middleware.ts                │
   │  • src/lib/errors.ts (will be deleted)  │
   │  • src/types/api.ts                     │
   │                                          │
   │  Reason for rejection (optional):       │
   │  ┌────────────────────────────────────┐ │
   │  │ Type checking errors too complex   │ │
   │  │ to fix, need different approach    │ │
   │  └────────────────────────────────────┘ │
   │                                          │
   │  [Cancel]          [Confirm Rejection]  │
   └──────────────────────────────────────────┘

   ↓
5. User optionally adds rejection reason
   ↓
6. User clicks "Confirm Rejection"
   ↓
7. System executes revert:

   For modified/deleted files:
   git checkout <startingCommit> -- <file1> <file2> ...

   For new files (added by Claude):
   rm <new-file1> <new-file2> ...
   (or git clean if safer)

   ↓
8. System updates database:
   - Task status → "rejected"
   - Store rejection reason
   - Store rejection timestamp
   ↓
9. Success notification:

   ┌──────────────────────────────────────────┐
   │  ✅ Changes Reverted                    │
   ├──────────────────────────────────────────┤
   │                                          │
   │  4 files restored to previous state     │
   │  Task marked as rejected                │
   │                                          │
   │  [Start New Task]                       │
   └──────────────────────────────────────────┘

   ↓
10. Repository is back to state before task started
    Task appears in timeline as "REJECTED"
```

## UI Components

### Reject Button (Initial)

```
┌────────────────────────────────────────────────────┐
│  Review & Approve                                  │
├────────────────────────────────────────────────────┤
│                                                    │
│  ❌ QA gates failed                               │
│  📝 4 files changed (+90, -15)                    │
│                                                    │
│  Cannot approve due to failed QA gates.           │
│                                                    │
│  [Reject & Revert]        [Override & Approve]    │
└────────────────────────────────────────────────────┘
```

### Rejection Confirmation Modal

```
┌─────────────────────────────────────────────────────┐
│  ⚠️ Reject Changes                                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  This will revert all changes made by Claude.      │
│                                                     │
│  📁 Files to be reverted (4):                      │
│  ┌───────────────────────────────────────────────┐ │
│  │ ✏️ src/api/routes.ts           (modified)    │ │
│  │ ✏️ src/api/middleware.ts       (modified)    │ │
│  │ ✨ src/lib/errors.ts           (will delete) │ │
│  │ ✏️ src/types/api.ts            (modified)    │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  💭 Reason for rejection (optional):               │
│  ┌───────────────────────────────────────────────┐ │
│  │                                               │ │
│  │                                               │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ⚠️ This action cannot be undone                   │
│                                                     │
│  [Cancel]                      [Confirm Rejection] │
└─────────────────────────────────────────────────────┘
```

### Success Notification

```
┌────────────────────────────────────────────────────┐
│  ✅ Changes Successfully Reverted                 │
├────────────────────────────────────────────────────┤
│                                                    │
│  4 files restored to state before task            │
│  Repository is now clean                          │
│                                                    │
│  Task marked as rejected in history               │
│                                                    │
│  [View Task History]  [Start New Task]            │
└────────────────────────────────────────────────────┘
```

### Timeline (Rejected Task)

```
┌─────────────────────────────────────┐
│  Tasks (Current Session)            │
├─────────────────────────────────────┤
│                                     │
│  ❌ REJECTED                        │
│  Add error handling...              │
│  10m ago • Reverted                │
│  Reason: Type errors too complex    │
│  ─────────────────────────────────  │
│                                     │
│  ✅ COMPLETED                       │
│  Fix auth bug                       │
│  30m ago • 3 files changed         │
└─────────────────────────────────────┘
```

## Technical Implementation

### Revert Logic

```typescript
// src/lib/git/revert.ts

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export interface RevertOptions {
  repoPath: string;
  startingCommit: string;
  changedFiles: FileChange[];
}

export interface RevertResult {
  filesReverted: string[];
  filesDeleted: string[];
  success: boolean;
  errors?: string[];
}

export async function revertChanges(
  options: RevertOptions
): Promise<RevertResult> {
  const { repoPath, startingCommit, changedFiles } = options;

  const filesReverted: string[] = [];
  const filesDeleted: string[] = [];
  const errors: string[] = [];

  try {
    // Separate files by status
    const modifiedOrDeleted = changedFiles.filter(
      (f) => f.status === 'modified' || f.status === 'deleted'
    );

    const newFiles = changedFiles.filter((f) => f.status === 'added');

    // 1. Revert modified/deleted files using git checkout
    if (modifiedOrDeleted.length > 0) {
      const filePaths = modifiedOrDeleted.map((f) => f.path).join(' ');

      try {
        await execAsync(`git checkout ${startingCommit} -- ${filePaths}`, {
          cwd: repoPath,
        });

        filesReverted.push(...modifiedOrDeleted.map((f) => f.path));
      } catch (error) {
        errors.push(
          `Failed to revert modified files: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    // 2. Delete new files added by Claude
    for (const file of newFiles) {
      try {
        const fullPath = path.join(repoPath, file.path);
        await fs.unlink(fullPath);
        filesDeleted.push(file.path);
      } catch (error) {
        errors.push(
          `Failed to delete ${file.path}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    // 3. Clean up any empty directories
    await cleanEmptyDirectories(repoPath);

    return {
      filesReverted,
      filesDeleted,
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    return {
      filesReverted,
      filesDeleted,
      success: false,
      errors: [
        error instanceof Error ? error.message : 'Unknown error during revert',
      ],
    };
  }
}

async function cleanEmptyDirectories(repoPath: string): Promise<void> {
  // Recursively remove empty directories
  // This is a simple implementation - production version should be more robust

  async function removeIfEmpty(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir);

      if (entries.length === 0) {
        await fs.rmdir(dir);
      }
    } catch {
      // Ignore errors
    }
  }

  // Walk through common source directories
  const dirs = ['src', 'lib', 'app', 'pages', 'components'];

  for (const dir of dirs) {
    const fullPath = path.join(repoPath, dir);
    try {
      await removeIfEmpty(fullPath);
    } catch {
      // Ignore
    }
  }
}

export async function rejectTask(
  taskId: string,
  reason?: string
): Promise<RevertResult> {
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

  if (!['waiting_approval', 'qa_failed'].includes(task.status)) {
    throw new Error('Task cannot be rejected in current state');
  }

  const repoPath = task.session.repository.path;
  const changedFiles = JSON.parse(task.filesChanged || '[]') as FileChange[];

  // 2. Revert changes
  const result = await revertChanges({
    repoPath,
    startingCommit: task.startingCommit!,
    changedFiles,
  });

  // 3. Update task
  await db
    .update(tasks)
    .set({
      status: 'rejected',
      rejectedAt: new Date(),
      rejectionReason: reason,
    })
    .where(eq(tasks.id, taskId));

  return result;
}
```

### Pre-Rejection Validation

```typescript
// src/lib/git/pre-revert-check.ts

export async function validateRevertSafety(
  repoPath: string,
  startingCommit: string
): Promise<{ safe: boolean; warnings: string[] }> {
  const warnings: string[] = [];

  // 1. Check if starting commit still exists
  try {
    await execAsync(`git cat-file -e ${startingCommit}`, { cwd: repoPath });
  } catch {
    warnings.push('Starting commit no longer exists in repository');
    return { safe: false, warnings };
  }

  // 2. Check for uncommitted changes outside of task files
  const { stdout: statusOutput } = await execAsync('git status --porcelain', {
    cwd: repoPath,
  });

  if (statusOutput.trim()) {
    warnings.push('Repository has uncommitted changes outside of this task');
  }

  // 3. Check if branch has changed
  const { stdout: currentBranch } = await execAsync(
    'git branch --show-current',
    { cwd: repoPath }
  );

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.startingCommit, startingCommit),
  });

  if (task && currentBranch.trim() !== task.startingBranch) {
    warnings.push(
      `Branch changed from ${task.startingBranch} to ${currentBranch.trim()}`
    );
  }

  return {
    safe: warnings.length === 0,
    warnings,
  };
}
```

### API Endpoints

**POST /api/tasks/:id/reject**

```typescript
import { db } from '@/lib/db';
import { tasks } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { reason } = await request.json();

  try {
    // Validate safety
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, params.id),
      with: {
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

    const validation = await validateRevertSafety(
      task.session.repository.path,
      task.startingCommit!
    );

    if (!validation.safe) {
      return Response.json(
        {
          error: 'Revert not safe',
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }

    // Perform rejection
    const result = await rejectTask(params.id, reason);

    if (!result.success) {
      return Response.json(
        {
          error: 'Revert failed',
          details: result.errors,
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      filesReverted: result.filesReverted,
      filesDeleted: result.filesDeleted,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

**GET /api/tasks/:id/revert-preview**

```typescript
// Show what will happen before confirming

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

  const changedFiles = JSON.parse(task.filesChanged || '[]') as FileChange[];

  const preview = {
    filesToRevert: changedFiles.filter(
      (f) => f.status === 'modified' || f.status === 'deleted'
    ),
    filesToDelete: changedFiles.filter((f) => f.status === 'added'),
    warnings: [] as string[],
  };

  // Add safety check warnings
  const validation = await validateRevertSafety(
    task.session.repository.path,
    task.startingCommit!
  );

  preview.warnings = validation.warnings;

  return Response.json(preview);
}
```

### Client Components

```typescript
// src/components/dashboard/RejectButton.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface RejectButtonProps {
  taskId: string;
  onSuccess?: () => void;
}

export function RejectButton({ taskId, onSuccess }: RejectButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setShowModal(true);

    // Load revert preview
    const res = await fetch(`/api/tasks/${taskId}/revert-preview`);
    const data = await res.json();
    setPreview(data);
  }

  async function handleConfirm() {
    setLoading(true);

    try {
      const res = await fetch(`/api/tasks/${taskId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      const data = await res.json();

      if (data.success) {
        setShowModal(false);
        onSuccess?.();
      } else {
        alert(`Rejection failed: ${data.error}`);
      }

    } catch (error) {
      console.error('Failed to reject:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="destructive" onClick={handleOpen}>
        Reject & Revert
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚠️ Reject Changes</DialogTitle>
          </DialogHeader>

          {preview && (
            <div className="space-y-4">
              <p>This will revert all changes made by Claude.</p>

              {preview.warnings.length > 0 && (
                <div className="bg-yellow-50 p-3 rounded">
                  <p className="font-semibold">⚠️ Warnings:</p>
                  <ul className="list-disc pl-5">
                    {preview.warnings.map((w: string, i: number) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="font-semibold">Files to be reverted:</p>
                <ul className="list-disc pl-5">
                  {preview.filesToRevert.map((f: any) => (
                    <li key={f.path}>✏️ {f.path} (modified)</li>
                  ))}
                  {preview.filesToDelete.map((f: any) => (
                    <li key={f.path}>✨ {f.path} (will delete)</li>
                  ))}
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Reason for rejection (optional):
                </label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="e.g., Type checking errors, different approach needed..."
                />
              </div>

              <p className="text-sm text-red-600">
                ⚠️ This action cannot be undone
              </p>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirm}
                  disabled={loading}
                >
                  {loading ? 'Reverting...' : 'Confirm Rejection'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
```

## Performance Considerations

- **Git Checkout**: Fast operation (< 1 second for most repos)
- **File Deletion**: Synchronous, but typically < 100ms per file
- **Validation Checks**: Run before showing modal (avoid blocking)
- **Directory Cleanup**: Low priority, can be async

## Edge Cases

### Scenario: Starting Commit No Longer Exists

**Handling**: Show error, prevent rejection, suggest manual cleanup

### Scenario: Files Modified Outside of Task

**Handling**: Warn user, proceed only if they confirm

### Scenario: New File Already Deleted

**Handling**: Skip deletion, log warning, continue with other files

### Scenario: Permission Denied on File Deletion

**Handling**: Collect errors, show to user, mark revert as partial success

### Scenario: Branch Changed After Task

**Handling**: Warn user, allow override with confirmation

### Scenario: Uncommitted Changes Elsewhere

**Handling**: Warn that they might be affected, require explicit confirmation

## Acceptance Criteria

- [ ] User can reject task from waiting_approval state
- [ ] User can reject task from qa_failed state
- [ ] Rejection modal shows files to be reverted
- [ ] User can add optional rejection reason
- [ ] Modified files revert to startingCommit state
- [ ] New files deleted completely
- [ ] Empty directories cleaned up
- [ ] Task status updates to "rejected"
- [ ] Rejection reason and timestamp stored
- [ ] Timeline shows rejected tasks
- [ ] Warnings shown for unsafe revert conditions
- [ ] Success notification after revert completes

## Dependencies

**Required for**:

- User control over AI changes
- Safe experimentation
- Quality control

**Depends on**:

- Task execution completed
- Starting commit recorded
- File changes tracked
- Git repository valid

## Future Enhancements

- Stash changes instead of delete (allow un-reject)
- Partial rejection (select specific files to revert)
- Rejection templates (common reasons)
- Rejection analytics (most common reasons)
- Auto-create branch before revert (backup)
- Revert preview diff
- Undo rejection (restore from backup)
- Email notification on rejection
- Rejection comments/notes
- Compare rejected vs approved tasks
