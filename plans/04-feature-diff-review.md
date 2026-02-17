# Feature: Diff Viewing & Review

## What is this feature?

A visual code comparison tool that shows exactly what Claude changed, with syntax highlighting, file tree navigation, and side-by-side diff viewing.

## User Problem

**Without this feature**:

- Run `git diff` manually in terminal
- Hard to review multiple file changes
- No syntax highlighting
- Can't easily navigate between files
- Missing context of surrounding code

**With this feature**:

- Visual side-by-side comparison
- Syntax-highlighted code
- File tree with change indicators
- One-click navigation
- Full context view

## User Stories

### Story 1: Visual Diff Review

```
AS A developer
I WANT to see before/after code side-by-side
SO THAT I can quickly understand what changed
```

### Story 2: Multi-file Navigation

```
AS A developer
I WANT to navigate between changed files easily
SO THAT I can review all changes efficiently
```

### Story 3: Context Understanding

```
AS A developer
I WANT to see surrounding code context
SO THAT I understand the change in full context
```

## User Flow

```
1. Task completes with status "waiting_approval"
   ↓
2. User clicks on task in timeline
   ↓
3. Diff viewer opens showing:
   - File tree (left sidebar)
   - Side-by-side diff (main area)
   - Change statistics (top)
   ↓
4. User sees file tree:

   📁 src/
   ├─ 📁 api/
   │  ├─ 📄 routes.ts        [+25 -12]  Modified
   │  └─ 📄 middleware.ts    [+8 -3]    Modified
   ├─ 📁 lib/
   │  └─ 📄 errors.ts        [+45 -0]   New file
   └─ 📁 types/
      └─ 📄 api.ts           [+12 -0]   Modified

   ↓
5. User clicks "routes.ts"
   ↓
6. Diff viewer shows:

   routes.ts (Before)          |  routes.ts (After)
   ────────────────────────────|──────────────────────────
   1  import { Router } from   |  1  import { Router } from
   2  'express';               |  2  'express';
   3                            |  3  import { handleError }
                                |     from '@/lib/errors';
   4                            |  4
   5  const router = Router(); |  5  const router = Router();
   6                            |  6
   7  router.get('/users',     |  7  router.get('/users',
   8    (req, res) => {         |  8    async (req, res) => {
   9      const users =         |  9      try {
   10       getUsers();         | 10        const users = await
                                |           getUsers();
   11     res.json(users);      | 11        res.json(users);
                                | 12      } catch (error) {
                                | 13        handleError(error, res);
                                | 14      }
   12   }                       | 15    }
   13 );                        | 16  );

   [Legend: Green = Added, Red = Removed, Yellow = Modified]

   ↓
7. User reviews all files
   ↓
8. User clicks "Approve" or "Reject"
```

## UI Components

### Change Statistics Bar

```
┌────────────────────────────────────────────────────┐
│  Changes Summary                                   │
├────────────────────────────────────────────────────┤
│  4 files changed                                   │
│  +90 insertions, -15 deletions                    │
│  1 file added                                      │
│                                                    │
│  [Expand All]  [Collapse All]  [View Raw Diff]    │
└────────────────────────────────────────────────────┘
```

### File Tree (Left Sidebar)

```
┌─────────────────────────────────┐
│  Changed Files (4)              │
├─────────────────────────────────┤
│                                 │
│  📁 src/                        │
│  ├─ 📁 api/                     │
│  │  ├─ ✏️ routes.ts      +25 -12│
│  │  └─ ✏️ middleware.ts  +8  -3 │
│  ├─ 📁 lib/                     │
│  │  └─ ✨ errors.ts      +45 -0 │
│  └─ 📁 types/                   │
│     └─ ✏️ api.ts         +12 -0 │
│                                 │
│  Legend:                        │
│  ✨ New file                    │
│  ✏️ Modified                    │
│  🗑️ Deleted                     │
└─────────────────────────────────┘
```

### Monaco Diff Viewer (Main Area)

```
┌───────────────────────────────────────────────────────────┐
│  src/api/routes.ts                              [✏️ Modified]│
├───────────────────────────────────────────────────────────┤
│  Hunk 1 of 3                            [Prev] [Next]     │
│                                                           │
│  BEFORE                    │  AFTER                       │
│  ──────────────────────────┼────────────────────────────  │
│                            │                              │
│  import { Router } from    │  import { Router } from      │
│  'express';                │  'express';                  │
│                            │ +import { handleError }      │
│                            │ +from '@/lib/errors';        │
│                            │                              │
│  const router = Router();  │  const router = Router();    │
│                            │                              │
│  router.get('/users',      │  router.get('/users',        │
│ -  (req, res) => {          │ +  async (req, res) => {     │
│ -    const users =          │ +    try {                   │
│ -      getUsers();          │ +      const users = await   │
│ -    res.json(users);       │ +        getUsers();         │
│                            │ +      res.json(users);      │
│                            │ +    } catch (error) {       │
│                            │ +      handleError(error,    │
│                            │ +        res);               │
│                            │ +    }                       │
│    }                       │    }                         │
│  );                        │  );                          │
│                            │                              │
│  [Monaco Editor with TypeScript syntax highlighting]     │
└───────────────────────────────────────────────────────────┘
```

## Technical Implementation

### Diff Capture & Parsing

```typescript
// src/lib/git/diff.ts

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DiffResult {
  fullDiff: string;
  changedFiles: FileChange[];
  stats: DiffStats;
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  oldPath?: string; // For renamed files
  patch: string; // Individual file diff
}

export interface DiffStats {
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export async function captureDiff(
  repoPath: string,
  fromCommit: string
): Promise<DiffResult> {
  // Get full diff
  const { stdout: fullDiff } = await execAsync(`git diff ${fromCommit} HEAD`, {
    cwd: repoPath,
  });

  // Get file stats
  const { stdout: statOutput } = await execAsync(
    `git diff ${fromCommit} HEAD --numstat`,
    { cwd: repoPath }
  );

  // Get changed file names with status
  const { stdout: nameStatusOutput } = await execAsync(
    `git diff ${fromCommit} HEAD --name-status`,
    { cwd: repoPath }
  );

  // Parse changed files
  const changedFiles = parseChangedFiles(
    statOutput,
    nameStatusOutput,
    fullDiff
  );

  // Calculate stats
  const stats = calculateStats(changedFiles);

  return {
    fullDiff,
    changedFiles,
    stats,
  };
}

function parseChangedFiles(
  statOutput: string,
  nameStatusOutput: string,
  fullDiff: string
): FileChange[] {
  const statLines = statOutput.trim().split('\n').filter(Boolean);
  const nameStatusLines = nameStatusOutput.trim().split('\n').filter(Boolean);

  return statLines.map((statLine, index) => {
    const [addStr, delStr, path] = statLine.split('\t');
    const nameStatusLine = nameStatusLines[index];
    const [statusCode, ...pathParts] = nameStatusLine.split('\t');

    const additions = addStr === '-' ? 0 : parseInt(addStr);
    const deletions = delStr === '-' ? 0 : parseInt(delStr);

    let status: FileChange['status'];
    let oldPath: string | undefined;

    switch (statusCode[0]) {
      case 'A':
        status = 'added';
        break;
      case 'D':
        status = 'deleted';
        break;
      case 'M':
        status = 'modified';
        break;
      case 'R':
        status = 'renamed';
        oldPath = pathParts[0];
        break;
      default:
        status = 'modified';
    }

    // Extract individual file patch from full diff
    const patch = extractFilePatch(fullDiff, path);

    return {
      path,
      status,
      additions,
      deletions,
      oldPath,
      patch,
    };
  });
}

function extractFilePatch(fullDiff: string, filePath: string): string {
  const fileHeader = `diff --git a/${filePath} b/${filePath}`;
  const startIndex = fullDiff.indexOf(fileHeader);

  if (startIndex === -1) return '';

  // Find next file header or end of diff
  const nextFileIndex = fullDiff.indexOf('diff --git', startIndex + 1);
  const endIndex = nextFileIndex === -1 ? fullDiff.length : nextFileIndex;

  return fullDiff.substring(startIndex, endIndex).trim();
}

function calculateStats(files: FileChange[]): DiffStats {
  return {
    filesChanged: files.length,
    insertions: files.reduce((sum, f) => sum + f.additions, 0),
    deletions: files.reduce((sum, f) => sum + f.deletions, 0),
  };
}
```

### File Content Retrieval

```typescript
// src/lib/git/content.ts

export async function getFileContent(
  repoPath: string,
  filePath: string,
  commit: string = 'HEAD'
): Promise<string> {
  try {
    const { stdout } = await execAsync(`git show ${commit}:${filePath}`, {
      cwd: repoPath,
    });
    return stdout;
  } catch (error) {
    // File might not exist at this commit (new file)
    return '';
  }
}

export async function getFileContentBeforeAndAfter(
  repoPath: string,
  filePath: string,
  fromCommit: string
): Promise<{ before: string; after: string }> {
  const [before, after] = await Promise.all([
    getFileContent(repoPath, filePath, fromCommit),
    getFileContent(repoPath, filePath, 'HEAD'),
  ]);

  return { before, after };
}
```

### API Endpoints

**GET /api/tasks/:id/diff**

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

  // Return cached diff if available
  if (task.diffContent && task.filesChanged) {
    return Response.json({
      fullDiff: task.diffContent,
      changedFiles: JSON.parse(task.filesChanged),
    });
  }

  // Otherwise generate fresh
  const repoPath = task.session.repository.path;
  const diff = await captureDiff(repoPath, task.startingCommit!);

  // Cache in database
  await db
    .update(tasks)
    .set({
      diffContent: diff.fullDiff,
      filesChanged: JSON.stringify(diff.changedFiles),
    })
    .where(eq(tasks.id, task.id));

  return Response.json(diff);
}
```

**GET /api/tasks/:id/files/:path**

```typescript
// Get before/after content for specific file

import { db } from '@/lib/db';
import { tasks } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: { id: string; path: string } }
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

  const repoPath = task.session.repository.path;
  const filePath = decodeURIComponent(params.path);

  const content = await getFileContentBeforeAndAfter(
    repoPath,
    filePath,
    task.startingCommit!
  );

  return Response.json(content);
}
```

### Client Components

```typescript
// src/components/dashboard/DiffViewer.tsx

'use client';

import { useState, useEffect } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import type { DiffResult, FileChange } from '@/lib/git/diff';

interface DiffViewerProps {
  taskId: string;
}

export function DiffViewer({ taskId }: DiffViewerProps) {
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null);
  const [fileContent, setFileContent] = useState<{
    before: string;
    after: string;
  } | null>(null);

  useEffect(() => {
    loadDiff();
  }, [taskId]);

  useEffect(() => {
    if (selectedFile) {
      loadFileContent(selectedFile.path);
    }
  }, [selectedFile]);

  async function loadDiff() {
    const res = await fetch(`/api/tasks/${taskId}/diff`);
    const data = await res.json();
    setDiff(data);

    // Auto-select first file
    if (data.changedFiles.length > 0) {
      setSelectedFile(data.changedFiles[0]);
    }
  }

  async function loadFileContent(path: string) {
    const res = await fetch(
      `/api/tasks/${taskId}/files/${encodeURIComponent(path)}`
    );
    const data = await res.json();
    setFileContent(data);
  }

  if (!diff) return <div>Loading diff...</div>;

  return (
    <div className="diff-viewer">
      {/* Stats Bar */}
      <div className="stats-bar">
        <p>
          {diff.stats.filesChanged} files changed,
          <span className="text-green-600"> +{diff.stats.insertions}</span>
          <span className="text-red-600"> -{diff.stats.deletions}</span>
        </p>
      </div>

      <div className="diff-content">
        {/* File Tree */}
        <aside className="file-tree">
          <h3>Changed Files ({diff.changedFiles.length})</h3>
          <ul>
            {diff.changedFiles.map((file) => (
              <li
                key={file.path}
                onClick={() => setSelectedFile(file)}
                className={selectedFile?.path === file.path ? 'active' : ''}
              >
                <span className="status-icon">
                  {file.status === 'added' && '✨'}
                  {file.status === 'modified' && '✏️'}
                  {file.status === 'deleted' && '🗑️'}
                </span>
                <span className="path">{file.path}</span>
                <span className="stats">
                  <span className="text-green-600">+{file.additions}</span>
                  {' '}
                  <span className="text-red-600">-{file.deletions}</span>
                </span>
              </li>
            ))}
          </ul>
        </aside>

        {/* Monaco Diff Editor */}
        <main className="diff-editor">
          {selectedFile && fileContent && (
            <>
              <header>
                <h3>{selectedFile.path}</h3>
                <span className="badge">{selectedFile.status}</span>
              </header>

              <DiffEditor
                height="600px"
                language={getLanguageFromPath(selectedFile.path)}
                original={fileContent.before}
                modified={fileContent.after}
                options={{
                  readOnly: true,
                  renderSideBySide: true,
                  minimap: { enabled: false },
                }}
                theme="vs-dark"
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop();
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
    py: 'python',
    rs: 'rust',
    go: 'go',
  };
  return langMap[ext || ''] || 'plaintext';
}
```

## Performance Considerations

- **Lazy Loading**: Only load file content when file is selected
- **Caching**: Store diff in database, don't regenerate
- **Large Files**: Warn if file > 1MB, offer raw view instead
- **Monaco Loading**: Code-split Monaco editor (it's ~5MB)
- **Virtual Scrolling**: For file lists with 100+ files

## Edge Cases

### Scenario: Binary File Changed

**Handling**: Show "Binary file changed" message, no diff view

### Scenario: File Too Large (> 1MB)

**Handling**: Show warning, offer "Download" instead of inline view

### Scenario: File Deleted

**Handling**: Only show "before" content in Monaco

### Scenario: New File Added

**Handling**: Only show "after" content in Monaco

### Scenario: File Renamed

**Handling**: Show both paths, display diff if content also changed

### Scenario: No Changes (empty diff)

**Handling**: Show "No changes detected" message

### Scenario: Merge Conflict Markers

**Handling**: Highlight conflict markers in Monaco, warn user

## Acceptance Criteria

- [ ] Diff displays after task completes
- [ ] File tree shows all changed files with stats
- [ ] User can click file to view diff
- [ ] Monaco editor shows side-by-side comparison
- [ ] Syntax highlighting works for common languages
- [ ] New files show as empty on left side
- [ ] Deleted files show as empty on right side
- [ ] Change statistics accurate (+/- counts)
- [ ] Large files handled gracefully
- [ ] Binary files show appropriate message
- [ ] UI responsive and loads quickly

## Dependencies

**Required for**:

- Approval decision (need to see changes)
- Understanding what Claude did

**Depends on**:

- Task execution completed
- Git diff available
- Starting commit recorded

## Future Enhancements

- Inline diff view (unified, not side-by-side)
- Collapse unchanged sections
- Search within diff
- Comment on specific lines
- Syntax validation highlighting (errors in diff)
- Diff download as patch file
- Email diff to team
- Diff comparison across tasks
- File blame integration
- Link to GitHub/GitLab for PR view
