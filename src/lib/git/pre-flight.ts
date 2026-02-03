import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface PreFlightResult {
  passed: boolean;
  error?: string;
  currentCommit?: string;
  currentBranch?: string;
  isClean?: boolean;
}

export async function runPreFlightChecks(
  repoPath: string
): Promise<PreFlightResult> {
  try {
    // Check if git is working
    await execAsync('git status', { cwd: repoPath });

    // Get current commit
    const { stdout: commitSha } = await execAsync('git rev-parse HEAD', {
      cwd: repoPath,
    });
    const currentCommit = commitSha.trim();

    // Get current branch
    const { stdout: branch } = await execAsync('git branch --show-current', {
      cwd: repoPath,
    });
    const currentBranch = branch.trim();

    // Check if working directory is clean
    const { stdout: status } = await execAsync('git status --porcelain', {
      cwd: repoPath,
    });
    const isClean = status.trim() === '';

    return {
      passed: true,
      currentCommit,
      currentBranch,
      isClean,
    };
  } catch (error) {
    return {
      passed: false,
      error:
        error instanceof Error
          ? error.message
          : 'Pre-flight checks failed: unknown error',
    };
  }
}
