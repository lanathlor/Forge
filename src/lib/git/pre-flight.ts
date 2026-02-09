import {
  execAsync,
  getContainerPath,
  type CommandError,
} from '@/lib/qa-gates/command-executor';

export interface PreFlightResult {
  passed: boolean;
  error?: string;
  currentCommit?: string;
  currentBranch?: string;
  isClean?: boolean;
}

async function getCurrentCommit(containerPath: string): Promise<string> {
  try {
    const { stdout } = await execAsync('git rev-parse HEAD', {
      cwd: containerPath,
      timeout: 10000,
    });
    return stdout.trim();
  } catch (_error) {
    console.log('Repository has no commits yet, using "initial" as commit');
    return 'initial';
  }
}

async function getGitInfo(containerPath: string) {
  const { stdout: branch } = await execAsync('git branch --show-current', {
    cwd: containerPath,
    timeout: 10000,
  });
  const { stdout: status } = await execAsync('git status --porcelain', {
    cwd: containerPath,
    timeout: 10000,
  });
  return {
    currentBranch: branch.trim() || 'main',
    isClean: status.trim() === '',
  };
}

function formatPreFlightError(error: unknown): string {
  const commandError = error as CommandError;
  let errorMessage = 'Pre-flight checks failed: unknown error';
  if (commandError.message) {
    errorMessage = commandError.message;
    if (commandError.stderr) errorMessage += `\nstderr: ${commandError.stderr}`;
    if (commandError.stdout) errorMessage += `\nstdout: ${commandError.stdout}`;
  }
  return errorMessage;
}

export async function runPreFlightChecks(
  repoPath: string
): Promise<PreFlightResult> {
  try {
    const containerPath = getContainerPath(repoPath);
    console.log(`[Pre-flight] Checking repository at: ${containerPath}`);
    console.log(`[Pre-flight] Running: git status in ${containerPath}`);
    await execAsync('git status', { cwd: containerPath, timeout: 10000 });

    const currentCommit = await getCurrentCommit(containerPath);
    const { currentBranch, isClean } = await getGitInfo(containerPath);

    return { passed: true, currentCommit, currentBranch, isClean };
  } catch (error) {
    const errorMessage = formatPreFlightError(error);
    console.error('[Pre-flight] Error:', errorMessage);
    return { passed: false, error: errorMessage };
  }
}
