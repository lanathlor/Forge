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

async function getGitDiffOutputs(containerPath: string, diffBase: string) {
  // Compare against working directory (includes both committed and uncommitted changes)
  // Using just `git diff ${diffBase}` instead of `git diff ${diffBase} HEAD`
  // This captures all changes since the starting commit, even if not committed
  const [fullDiffResult, statResult, nameStatusResult] = await Promise.all([
    execAsync(`git diff ${diffBase}`, { cwd: containerPath, timeout: 30000 }),
    execAsync(`git diff ${diffBase} --numstat`, { cwd: containerPath, timeout: 30000 }),
    execAsync(`git diff ${diffBase} --name-status`, { cwd: containerPath, timeout: 30000 }),
  ]);
  return {
    fullDiff: fullDiffResult.stdout,
    statOutput: statResult.stdout,
    nameStatusOutput: nameStatusResult.stdout,
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

  const { fullDiff, statOutput, nameStatusOutput } = await getGitDiffOutputs(containerPath, diffBase);
  const changedFiles = parseChangedFiles(statOutput, nameStatusOutput, fullDiff);
  const stats = calculateStats(changedFiles);

  return { fullDiff, changedFiles, stats };
}

/* eslint-disable max-lines-per-function, complexity */
function parseChangedFiles(
  statOutput: string,
  nameStatusOutput: string,
  fullDiff: string
): FileChange[] {
  const statLines = statOutput.trim().split('\n').filter(Boolean);
  const nameStatusLines = nameStatusOutput.trim().split('\n').filter(Boolean);

  return statLines.map((statLine, index) => {
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
