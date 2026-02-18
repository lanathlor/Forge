import { execAsync, getContainerPath } from '@/lib/qa-gates/command-executor';
import { db } from '@/db';
import { tasks } from '@/db/schema/tasks';
import { eq } from 'drizzle-orm';
import type { FileChange } from '@/db/schema/tasks';

export interface CommitResult {
  sha: string;
  message: string;
  filesCommitted: string[];
  timestamp: Date;
}

export function generateBasicCommitMessage(
  taskPrompt: string,
  filesChanged: FileChange[]
): string {
  const fileCount = filesChanged.length;
  const insertions = filesChanged.reduce((sum, f) => sum + f.additions, 0);
  const deletions = filesChanged.reduce((sum, f) => sum + f.deletions, 0);
  const subject =
    taskPrompt.length > 50 ? taskPrompt.substring(0, 50) + '...' : taskPrompt;
  const body = [
    '',
    `${fileCount} file${fileCount === 1 ? '' : 's'} changed`,
    `+${insertions} insertions, -${deletions} deletions`,
    '',
    'Files modified:',
    ...filesChanged.map((f) => `- ${f.path} (${f.status})`),
  ].join('\n');
  return `${subject}\n${body}`;
}

async function stageFiles(containerPath: string, filesChanged: FileChange[]) {
  console.log(`[stageFiles] Staging ${filesChanged.length} files`);
  for (const file of filesChanged) {
    const cmd =
      file.status === 'deleted'
        ? `git rm "${file.path}"`
        : `git add "${file.path}"`;
    console.log(`[stageFiles] Executing: ${cmd}`);
    try {
      await execAsync(cmd, { cwd: containerPath, timeout: 10000 });
      console.log(`[stageFiles] Successfully staged: ${file.path}`);
    } catch (error: unknown) {
      console.error(`[stageFiles] Failed to stage ${file.path}:`, error);
      if (error && typeof error === 'object' && 'stderr' in error) {
        console.error(
          `[stageFiles] Git stderr:`,
          (error as { stderr: string }).stderr
        );
      }
      throw error;
    }
  }
}

async function createCommit(
  containerPath: string,
  message: string
): Promise<string> {
  const escapedMessage = message.replace(/'/g, "'\\''");
  const commitCmd = `git commit -F - <<'EOF'\n${escapedMessage}\nEOF`;
  console.log(
    `[createCommit] Executing git commit with message length: ${message.length}`
  );
  console.log(`[createCommit] Command: ${commitCmd.substring(0, 100)}...`);

  try {
    const result = await execAsync(commitCmd, {
      cwd: containerPath,
      timeout: 10000,
    });
    console.log(`[createCommit] Commit successful, stdout:`, result.stdout);

    const { stdout: sha } = await execAsync('git rev-parse HEAD', {
      cwd: containerPath,
      timeout: 5000,
    });
    return sha.trim();
  } catch (error: unknown) {
    console.error(`[createCommit] Git commit failed:`, error);
    if (error && typeof error === 'object') {
      if ('stderr' in error) {
        console.error(
          `[createCommit] Git stderr:`,
          (error as { stderr: string }).stderr
        );
      }
      if ('stdout' in error) {
        console.error(
          `[createCommit] Git stdout:`,
          (error as { stdout: string }).stdout
        );
      }
    }
    throw error;
  }
}

async function getHeadCommitInfo(
  containerPath: string
): Promise<{ sha: string; message: string }> {
  const { stdout: headSha } = await execAsync('git rev-parse HEAD', {
    cwd: containerPath,
    timeout: 5000,
  });
  const { stdout: existingMessage } = await execAsync(
    'git log -1 --format=%B',
    { cwd: containerPath, timeout: 5000 }
  );
  return { sha: headSha.trim(), message: existingMessage.trim() };
}

function isNothingToCommitError(error: unknown): boolean {
  if (error instanceof Error && error.message.includes('nothing to commit')) return true;
  if (!error || typeof error !== 'object') return false;
  const e = error as Record<string, unknown>;
  const stdout = typeof e['stdout'] === 'string' ? e['stdout'] : '';
  const stderr = typeof e['stderr'] === 'string' ? e['stderr'] : '';
  return stdout.includes('nothing to commit') || stderr.includes('nothing to commit');
}

async function resolveCommit(
  containerPath: string,
  filesChanged: FileChange[],
  message: string
): Promise<{ sha: string; commitMessage: string }> {
  // Stage all task files unconditionally — this is idempotent and avoids
  // fragile git status parsing. If a file is already staged or committed,
  // re-adding it is a no-op.
  console.log(`[commitTaskChanges] Staging ${filesChanged.length} task files`);
  await stageFiles(containerPath, filesChanged);

  // Attempt the commit. If git reports "nothing to commit" it means all task
  // files were already committed, so fall back to the existing HEAD.
  try {
    const sha = await createCommit(containerPath, message);
    console.log(`[commitTaskChanges] Created new commit: ${sha}`);
    return { sha, commitMessage: message };
  } catch (error) {
    if (isNothingToCommitError(error)) {
      console.log(
        `[commitTaskChanges] Nothing to commit — all task files already committed, using existing HEAD`
      );
      const { sha, message: commitMessage } = await getHeadCommitInfo(containerPath);
      console.log(`[commitTaskChanges] Using existing commit: ${sha}`);
      return { sha, commitMessage };
    }
    throw error;
  }
}

export async function commitTaskChanges(
  repoPath: string,
  filesChanged: FileChange[],
  message: string
): Promise<CommitResult> {
  const containerPath = getContainerPath(repoPath);
  console.log(`[commitTaskChanges] Committing ${filesChanged.length} files in ${containerPath}`);

  try {
    const { sha, commitMessage } = await resolveCommit(containerPath, filesChanged, message);
    return {
      sha,
      message: commitMessage,
      filesCommitted: filesChanged.map((f) => f.path),
      timestamp: new Date(),
    };
  } catch (error) {
    console.error(`[commitTaskChanges] Error:`, error);
    throw new Error(
      `Failed to commit changes: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function getTaskWithRepository(taskId: string) {
  return db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { session: { with: { repository: true } } },
  });
}

function validateTaskForApproval(
  task: Awaited<ReturnType<typeof getTaskWithRepository>>
) {
  if (!task) throw new Error('Task not found');
  if (task.status !== 'waiting_approval')
    throw new Error(`Task status is ${task.status}, expected waiting_approval`);
  if (!task.filesChanged || task.filesChanged.length === 0)
    throw new Error('No files changed to commit');
}

export async function approveAndCommitTask(
  taskId: string
): Promise<CommitResult> {
  console.log(`[approveAndCommitTask] Approving task: ${taskId}`);

  const task = await getTaskWithRepository(taskId);
  validateTaskForApproval(task);

  const repoPath = task!.session.repository.path;
  const commitMessage = generateBasicCommitMessage(
    task!.prompt,
    task!.filesChanged!
  );
  console.log(
    `[approveAndCommitTask] Generated commit message: ${commitMessage.substring(0, 100)}...`
  );

  const result = await commitTaskChanges(
    repoPath,
    task!.filesChanged!,
    commitMessage
  );

  await db
    .update(tasks)
    .set({
      status: 'approved',
      committedSha: result.sha,
      commitMessage: result.message,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  console.log(
    `[approveAndCommitTask] Task approved and committed successfully`
  );
  return result;
}
