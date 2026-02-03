import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function getFileContent(
  repoPath: string,
  filePath: string,
  commit: string = 'HEAD'
): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `git show ${commit}:${filePath}`,
      { cwd: repoPath }
    );
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
  const [before, after] = await Promise.all([
    getFileContent(repoPath, filePath, fromCommit),
    getFileContent(repoPath, filePath, 'HEAD'),
  ]);

  return { before, after };
}
