import { execAsync, getContainerPath } from '@/lib/qa-gates/command-executor';

export async function getFileContent(
  repoPath: string,
  filePath: string,
  commit: string = 'HEAD'
): Promise<string> {
  try {
    // Convert host path to container path
    const containerPath = getContainerPath(repoPath);

    const { stdout } = await execAsync(`git show ${commit}:${filePath}`, {
      cwd: containerPath,
      timeout: 30000,
    });
    return stdout;
  } catch (_error) {
    // File might not exist at this commit (new file)
    return '';
  }
}

export async function getFileContentBeforeAndAfter(
  repoPath: string,
  filePath: string,
  fromCommit: string
): Promise<{ before: string; after: string }> {
  // Get the "before" content from the starting commit
  const before = await getFileContent(repoPath, filePath, fromCommit);

  // For "after", read from working directory to include uncommitted changes
  // First try to get from working directory, fall back to HEAD if that fails
  const containerPath = getContainerPath(repoPath);
  const fs = await import('fs/promises');
  const path = await import('path');

  let after: string;
  try {
    // Try reading from working directory first (includes uncommitted changes)
    const fullPath = path.join(containerPath, filePath);
    after = await fs.readFile(fullPath, 'utf-8');
  } catch {
    // If file doesn't exist in working directory, try HEAD
    // (file might have been deleted)
    after = await getFileContent(repoPath, filePath, 'HEAD');
  }

  return { before, after };
}
