# Feature: Repository Discovery & Selection

## What is this feature?

A system that automatically discovers all git repositories within a workspace root directory and lets users select which repository to work on.

## User Problem

**Without this feature**:

- Users manually navigate to each repository
- Hard to remember paths to all projects
- Can't see repository status at a glance
- Risk of working in wrong directory

**With this feature**:

- All repositories discovered automatically
- Visual list with status indicators
- One-click repository selection
- Always know where Claude is working

## User Stories

### Story 1: First-time User

```
AS A developer with multiple projects
I WANT to see all my git repositories in one place
SO THAT I can quickly select which project needs work
```

### Story 2: Checking Repository Status

```
AS A developer
I WANT to see if a repository has uncommitted changes
SO THAT I know if it's safe to start a Claude task
```

### Story 3: Switching Projects

```
AS A developer working on multiple projects
I WANT to easily switch between repositories
SO THAT I can manage different codebases from one dashboard
```

## User Flow

```
1. User opens Autobot dashboard
   ↓
2. System scans /home/lanath/Work recursively
   ↓
3. System displays list of discovered repositories

   Example display:

   📁 my-app                    [main ✓] Clean
   📁 api-server               [develop *] 3 uncommitted files
   📁 shared-components        [main ✓] Clean
   📁 tools/autobot           [main ✓] Clean

   ↓
4. User clicks on "my-app"
   ↓
5. Repository selected, ready for tasks
   ↓
6. User can switch anytime using repository selector
```

## UI Components

### Repository List (Sidebar or Dropdown)

```
┌─────────────────────────────────────┐
│  📍 Selected Repository             │
├─────────────────────────────────────┤
│                                     │
│  📁 my-app                          │
│     main • Clean • /Work/my-app    │
│     ────────────────────────────   │
│                                     │
│  Other Repositories (12)            │
│  ┌─────────────────────────────┐   │
│  │ 📁 api-server           [*] │   │
│  │    develop • 3 changes      │   │
│  ├─────────────────────────────┤   │
│  │ 📁 shared-components    [✓] │   │
│  │    main • Clean             │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘

Legend:
[✓] = Clean working directory
[*] = Uncommitted changes
[!] = Not a git repository (shouldn't happen)
```

### Repository Details (when selected)

```
┌─────────────────────────────────────────┐
│  Repository: my-app                     │
├─────────────────────────────────────────┤
│  Path: /home/lanath/Work/my-app        │
│  Branch: main                           │
│  Status: Clean ✓                        │
│  Last Commit: Fix auth bug (2h ago)    │
│  Uncommitted: None                      │
└─────────────────────────────────────────┘
```

## Technical Implementation

### Discovery Logic

**Scan Algorithm**:

```typescript
// src/lib/workspace/scanner.ts

interface Repository {
  id: string; // Generated unique ID
  name: string; // Directory name (e.g., "my-app")
  path: string; // Absolute path
  currentBranch: string;
  lastCommit: {
    sha: string;
    message: string;
    author: string;
    timestamp: Date;
  };
  isClean: boolean; // No uncommitted changes
  uncommittedFiles: string[];
}

async function discoverRepositories(rootDir: string): Promise<Repository[]> {
  // 1. Recursively find all .git directories
  const gitDirs = await findGitDirectories(rootDir);

  // 2. For each .git directory, extract info
  const repos = await Promise.all(
    gitDirs.map(async (gitDir) => {
      const repoPath = path.dirname(gitDir);
      return {
        id: generateId(),
        name: path.basename(repoPath),
        path: repoPath,
        currentBranch: await getCurrentBranch(repoPath),
        lastCommit: await getLastCommit(repoPath),
        isClean: await isWorkingDirectoryClean(repoPath),
        uncommittedFiles: await getUncommittedFiles(repoPath),
      };
    })
  );

  // 3. Sort by last modified
  return repos.sort(
    (a, b) =>
      b.lastCommit.timestamp.getTime() - a.lastCommit.timestamp.getTime()
  );
}

async function findGitDirectories(rootDir: string): Promise<string[]> {
  // Use fast directory traversal
  // Ignore: node_modules, .git subdirectories, hidden folders
  const gitDirs: string[] = [];

  async function traverse(dir: string, depth: number = 0) {
    // Limit recursion depth to avoid huge scans
    if (depth > 10) return;

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const fullPath = path.join(dir, entry.name);

      // Skip common ignore patterns
      if (entry.name === 'node_modules' || entry.name === '.git') {
        // But if it's .git, we found a repo!
        if (entry.name === '.git') {
          gitDirs.push(fullPath);
        }
        continue;
      }

      // Skip hidden directories (except .git which we caught above)
      if (entry.name.startsWith('.')) continue;

      await traverse(fullPath, depth + 1);
    }
  }

  await traverse(rootDir);
  return gitDirs;
}

async function getCurrentBranch(repoPath: string): Promise<string> {
  const result = await execCommand('git branch --show-current', repoPath);
  return result.trim();
}

async function getLastCommit(
  repoPath: string
): Promise<Repository['lastCommit']> {
  const sha = await execCommand('git rev-parse HEAD', repoPath);
  const message = await execCommand('git log -1 --pretty=%B', repoPath);
  const author = await execCommand('git log -1 --pretty=%an', repoPath);
  const timestamp = await execCommand('git log -1 --pretty=%at', repoPath);

  return {
    sha: sha.trim(),
    message: message.trim(),
    author: author.trim(),
    timestamp: new Date(parseInt(timestamp.trim()) * 1000),
  };
}

async function isWorkingDirectoryClean(repoPath: string): Promise<boolean> {
  const result = await execCommand('git status --porcelain', repoPath);
  return result.trim() === '';
}

async function getUncommittedFiles(repoPath: string): Promise<string[]> {
  const result = await execCommand('git status --porcelain', repoPath);
  if (!result.trim()) return [];

  return result
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.substring(3)); // Remove status prefix
}
```

### Database Schema

```typescript
// src/db/schema.ts

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';

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
```

### API Endpoints

**GET /api/repositories**

- Scans workspace and returns all repositories
- Caches results for 5 minutes
- Returns fresh git status for each repo

```typescript
// src/app/api/repositories/route.ts

import { db } from '@/lib/db';
import { repositories } from '@/db/schema';

export async function GET() {
  const workspaceRoot = process.env.WORKSPACE_ROOT || '/home/lanath/Work';

  // Discover repositories
  const repos = await discoverRepositories(workspaceRoot);

  // Update database
  await Promise.all(
    repos.map((repo) =>
      db
        .insert(repositories)
        .values({
          name: repo.name,
          path: repo.path,
          currentBranch: repo.currentBranch,
          lastCommitSha: repo.lastCommit.sha,
          lastCommitMsg: repo.lastCommit.message,
          isClean: repo.isClean,
          lastScanned: new Date(),
        })
        .onConflictDoUpdate({
          target: repositories.path,
          set: {
            name: repo.name,
            currentBranch: repo.currentBranch,
            lastCommitSha: repo.lastCommit.sha,
            lastCommitMsg: repo.lastCommit.message,
            isClean: repo.isClean,
            lastScanned: new Date(),
            updatedAt: new Date(),
          },
        })
    )
  );

  return Response.json({ repositories: repos });
}
```

**GET /api/repositories/:id**

- Returns detailed info about specific repository
- Fresh git status (no cache)

**POST /api/repositories/rescan**

- Forces immediate workspace rescan
- Returns updated repository list

### Client Components

```typescript
// src/components/dashboard/RepositorySelector.tsx

'use client';

import { useState, useEffect } from 'react';
import { Repository } from '@/types';

export function RepositorySelector() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selected, setSelected] = useState<Repository | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRepositories() {
      const res = await fetch('/api/repositories');
      const data = await res.json();
      setRepositories(data.repositories);
      setLoading(false);
    }

    loadRepositories();
  }, []);

  if (loading) return <div>Scanning workspace...</div>;

  return (
    <div className="repository-selector">
      <h2>Repositories ({repositories.length})</h2>

      {selected && (
        <div className="selected-repo">
          <h3>{selected.name}</h3>
          <p>{selected.path}</p>
          <p>{selected.currentBranch} • {selected.isClean ? 'Clean ✓' : 'Uncommitted changes *'}</p>
        </div>
      )}

      <div className="repo-list">
        {repositories.map(repo => (
          <button
            key={repo.id}
            onClick={() => setSelected(repo)}
            className={selected?.id === repo.id ? 'active' : ''}
          >
            <div className="repo-item">
              <span className="repo-name">{repo.name}</span>
              <span className="repo-branch">{repo.currentBranch}</span>
              <span className="repo-status">
                {repo.isClean ? '✓' : '*'}
              </span>
            </div>
          </button>
        ))}
      </div>

      <button onClick={() => rescan()}>
        Rescan Workspace
      </button>
    </div>
  );
}
```

## Performance Considerations

### Optimization Strategies

1. **Depth Limiting**: Don't recurse more than 10 levels deep
2. **Ignore Patterns**: Skip node_modules, .git subdirectories, hidden folders
3. **Caching**: Cache repository list for 5 minutes
4. **Lazy Loading**: Only load git details when repository is selected
5. **Parallel Processing**: Use Promise.all for git commands across repos

### Expected Performance

- **Small workspace** (< 10 repos): < 1 second
- **Medium workspace** (10-50 repos): 1-3 seconds
- **Large workspace** (50+ repos): 3-10 seconds

## Edge Cases

### Scenario: Nested Repositories

**Situation**: Git repo inside another git repo (submodules)
**Handling**: Only detect top-level .git directories, ignore nested .git

### Scenario: Non-git Directories

**Situation**: Directory exists but isn't a git repository
**Handling**: Ignore during scan, only show git repos

### Scenario: Permission Denied

**Situation**: Can't read certain directories
**Handling**: Log warning, skip directory, continue scan

### Scenario: Workspace Root Doesn't Exist

**Situation**: WORKSPACE_ROOT points to non-existent path
**Handling**: Show error, prompt user to configure

### Scenario: Empty Workspace

**Situation**: No git repositories found
**Handling**: Show empty state with instructions

## Acceptance Criteria

- [ ] System discovers all git repos in WORKSPACE_ROOT
- [ ] Repositories display with name, branch, and clean status
- [ ] User can select a repository to work on
- [ ] Selected repository persists in session
- [ ] Scan completes in < 10 seconds for typical workspace
- [ ] UI shows loading state during scan
- [ ] Manual rescan button works
- [ ] Error handling for missing/invalid paths
- [ ] Repository status updates when switching

## Dependencies

**Required for**:

- Task execution (need to know where to run Claude)
- Pre-flight checks (need to validate repo state)
- Session management (associate session with repo)

**Depends on**:

- Git installed on system
- Read access to workspace directory
- Environment variable WORKSPACE_ROOT configured

## Future Enhancements

- Search/filter repositories by name
- Favorite repositories (pin to top)
- Hide/ignore specific repositories
- Custom workspace roots (multiple)
- Repository groups/tags
- Recently used repositories
- Git remote information (origin URL)
- Uncommitted files preview
