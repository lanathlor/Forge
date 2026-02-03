import { exec } from 'child_process';
import { promisify } from 'util';
import type { FileChange } from '@/db/schema/tasks';

const execAsync = promisify(exec);

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

export async function captureDiff(
  repoPath: string,
  fromCommit: string
): Promise<DiffResult> {
  // Get full diff
  const { stdout: fullDiff } = await execAsync(
    `git diff ${fromCommit} HEAD`,
    { cwd: repoPath }
  );

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
