import { execAsync, getContainerPath } from '@/lib/qa-gates/command-executor';
import type { FileChange } from '@/db/schema/tasks';

export type { FileChange } from '@/db/schema/tasks';

export interface DiffResult {
  fullDiff: string;
  changedFiles: FileChange[];
  stats: DiffStats;
}

export interface DiffStats {
  filesChanged: number;
  insertions: number;
  deletions: number;
}

function getDiffBase(fromCommit: string): string {
  // Handle special case: repository had no commits when task started
  // Use the empty tree hash (Git's special hash for an empty repository)
  const EMPTY_TREE_HASH = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
  return fromCommit === 'initial' ? EMPTY_TREE_HASH : fromCommit;
}

/**
 * Generate diff content only for specific files already known to belong to the task.
 * Use this instead of captureDiff when you need to avoid picking up unrelated
 * untracked files that happen to exist in the workspace.
 */
export async function getDiffForFiles(
  repoPath: string,
  fromCommit: string,
  files: FileChange[]
): Promise<string> {
  const containerPath = getContainerPath(repoPath);
  const diffBase = getDiffBase(fromCommit);
  const patches: string[] = [];

  await Promise.all(
    files.map(async (file) => {
      if (file.status === 'deleted') {
        const result = await execAsync(
          `git diff ${diffBase} -- "${file.path}"`,
          { cwd: containerPath, timeout: 15000 }
        ).catch(() => ({ stdout: '' }));
        if (result.stdout) patches.push(result.stdout);
      } else if (file.status === 'added' || file.patch === '') {
        // Untracked or newly added file — use --no-index against /dev/null
        const result = await execAsync(
          `git diff --no-index /dev/null "${file.path}"`,
          { cwd: containerPath, timeout: 15000 }
        ).catch((err: { stdout?: string }) => ({ stdout: err.stdout ?? '' }));
        if (result.stdout) patches.push(result.stdout);
      } else {
        const result = await execAsync(
          `git diff ${diffBase} -- "${file.path}"`,
          { cwd: containerPath, timeout: 15000 }
        ).catch(() => ({ stdout: '' }));
        if (result.stdout) patches.push(result.stdout);
      }
    })
  );

  return patches.join('\n');
}

async function getUntrackedFileDiff(
  containerPath: string,
  filePath: string
): Promise<{ diff: string; additions: number }> {
  try {
    // git diff --no-index generates a unified diff for files not tracked by git
    // It exits with code 1 when differences are found (normal), so we ignore the error
    const result = await execAsync(
      `git diff --no-index /dev/null ${filePath}`,
      { cwd: containerPath, timeout: 30000 }
    ).catch((err: { stdout?: string }) => ({ stdout: err.stdout ?? '' }));
    const diff = result.stdout ?? '';
    const additions = diff.split('\n').filter((l) => l.startsWith('+')).length - 1; // subtract header line
    return { diff, additions: Math.max(0, additions) };
  } catch {
    return { diff: '', additions: 0 };
  }
}

async function getGitDiffOutputs(containerPath: string, diffBase: string) {
  // Compare against working directory (includes both committed and uncommitted changes)
  // Using just `git diff ${diffBase}` instead of `git diff ${diffBase} HEAD`
  // This captures all changes since the starting commit, even if not committed
  const [fullDiffResult, statResult, nameStatusResult, untrackedFilesResult] =
    await Promise.all([
      execAsync(`git diff ${diffBase}`, { cwd: containerPath, timeout: 30000 }),
      execAsync(`git diff ${diffBase} --numstat`, {
        cwd: containerPath,
        timeout: 30000,
      }),
      execAsync(`git diff ${diffBase} --name-status`, {
        cwd: containerPath,
        timeout: 30000,
      }),
      execAsync(`git ls-files --others --exclude-standard`, {
        cwd: containerPath,
        timeout: 30000,
      }),
    ]);

  // For untracked (new) files, git diff produces no output.
  // Use `git diff --no-index /dev/null <file>` to generate a proper patch.
  const untrackedPaths = untrackedFilesResult.stdout
    .trim()
    .split('\n')
    .filter(Boolean);
  const untrackedDiffs = await Promise.all(
    untrackedPaths.map((p) => getUntrackedFileDiff(containerPath, p))
  );
  const untrackedFullDiff = untrackedDiffs.map((d) => d.diff).join('\n');

  return {
    fullDiff: [fullDiffResult.stdout, untrackedFullDiff].filter(Boolean).join('\n'),
    statOutput: statResult.stdout,
    nameStatusOutput: nameStatusResult.stdout,
    untrackedFiles: untrackedFilesResult.stdout,
    untrackedDiffs,
    untrackedPaths,
  };
}

export async function captureDiff(
  repoPath: string,
  fromCommit: string
): Promise<DiffResult> {
  const containerPath = getContainerPath(repoPath);
  console.log(`[captureDiff] Capturing diff from commit: ${fromCommit}`);

  const diffBase = getDiffBase(fromCommit);
  console.log(`[captureDiff] Using diff base: ${diffBase}`);

  const { fullDiff, statOutput, nameStatusOutput, untrackedFiles, untrackedDiffs, untrackedPaths } =
    await getGitDiffOutputs(containerPath, diffBase);
  const changedFiles = parseChangedFiles(
    statOutput,
    nameStatusOutput,
    fullDiff,
    untrackedFiles,
    untrackedDiffs,
    untrackedPaths
  );
  const stats = calculateStats(changedFiles);

  console.log(
    `[captureDiff] Found ${changedFiles.length} changed files (${changedFiles.filter((f) => f.status === 'added').length} new, ${changedFiles.filter((f) => f.status === 'modified').length} modified, ${changedFiles.filter((f) => f.status === 'deleted').length} deleted)`
  );

  return { fullDiff, changedFiles, stats };
}

/* eslint-disable max-lines-per-function, complexity */
function parseChangedFiles(
  statOutput: string,
  nameStatusOutput: string,
  fullDiff: string,
  untrackedFiles: string,
  untrackedDiffs: { diff: string; additions: number }[] = [],
  untrackedPaths: string[] = []
): FileChange[] {
  const statLines = statOutput.trim().split('\n').filter(Boolean);
  const nameStatusLines = nameStatusOutput.trim().split('\n').filter(Boolean);

  // Parse tracked file changes (from git diff)
  const trackedChanges = statLines.map((statLine, index) => {
    const parts = statLine.split('\t');
    const addStr = parts[0] || '0';
    const delStr = parts[1] || '0';
    const path = parts[2] || '';

    const nameStatusLine = nameStatusLines[index] || '';
    const statusParts = nameStatusLine.split('\t');
    const statusCode = statusParts[0] || 'M';
    const pathParts = statusParts.slice(1);

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

  // Parse untracked files (new files that git diff doesn't show)
  // Use pre-computed diffs when available (from getUntrackedFileDiff)
  const untrackedLines = untrackedFiles.trim().split('\n').filter(Boolean);
  const untrackedChanges: FileChange[] = untrackedLines.map((path) => {
    const idx = untrackedPaths.indexOf(path);
    const diffData = idx !== -1 ? untrackedDiffs[idx] : undefined;
    return {
      path,
      status: 'added' as const,
      additions: diffData?.additions ?? 0,
      deletions: 0,
      patch: diffData?.diff ?? '',
    };
  });

  // Combine both tracked and untracked changes
  return [...trackedChanges, ...untrackedChanges];
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
