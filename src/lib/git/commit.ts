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

export function generateBasicCommitMessage(taskPrompt: string, filesChanged: FileChange[]): string {
  const fileCount = filesChanged.length;
  const insertions = filesChanged.reduce((sum, f) => sum + f.additions, 0);
  const deletions = filesChanged.reduce((sum, f) => sum + f.deletions, 0);
  const subject = taskPrompt.length > 50 ? taskPrompt.substring(0, 50) + '...' : taskPrompt;
  const body = [
    '',
    `${fileCount} file${fileCount === 1 ? '' : 's'} changed`,
    `+${insertions} insertions, -${deletions} deletions`,
    '',
    'Files modified:',
    ...filesChanged.map(f => `- ${f.path} (${f.status})`),
  ].join('\n');
  return `${subject}\n${body}`;
}

async function stageFiles(containerPath: string, filesChanged: FileChange[]) {
  for (const file of filesChanged) {
    const cmd = file.status === 'deleted' ? `git rm "${file.path}"` : `git add "${file.path}"`;
    await execAsync(cmd, { cwd: containerPath, timeout: 10000 });
  }
}

async function createCommit(containerPath: string, message: string): Promise<string> {
  const escapedMessage = message.replace(/'/g, "'\\''");
  const commitCmd = `git commit -F - <<'EOF'\n${escapedMessage}\nEOF`;
  await execAsync(commitCmd, { cwd: containerPath, timeout: 10000 });
  const { stdout: sha } = await execAsync('git rev-parse HEAD', { cwd: containerPath, timeout: 5000 });
  return sha.trim();
}

export async function commitTaskChanges(repoPath: string, filesChanged: FileChange[], message: string): Promise<CommitResult> {
  const containerPath = getContainerPath(repoPath);
  console.log(`[commitTaskChanges] Committing ${filesChanged.length} files in ${containerPath}`);

  try {
    await stageFiles(containerPath, filesChanged);
    console.log(`[commitTaskChanges] Files staged successfully`);

    const sha = await createCommit(containerPath, message);
    console.log(`[commitTaskChanges] Commit SHA: ${sha}`);

    return { sha, message, filesCommitted: filesChanged.map(f => f.path), timestamp: new Date() };
  } catch (error) {
    console.error(`[commitTaskChanges] Error:`, error);
    throw new Error(`Failed to commit changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getTaskWithRepository(taskId: string) {
  return db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { session: { with: { repository: true } } },
  });
}

function validateTaskForApproval(task: Awaited<ReturnType<typeof getTaskWithRepository>>) {
  if (!task) throw new Error('Task not found');
  if (task.status !== 'waiting_approval') throw new Error(`Task status is ${task.status}, expected waiting_approval`);
  if (!task.filesChanged || task.filesChanged.length === 0) throw new Error('No files changed to commit');
}

export async function approveAndCommitTask(taskId: string): Promise<CommitResult> {
  console.log(`[approveAndCommitTask] Approving task: ${taskId}`);

  const task = await getTaskWithRepository(taskId);
  validateTaskForApproval(task);

  const repoPath = task!.session.repository.path;
  const commitMessage = generateBasicCommitMessage(task!.prompt, task!.filesChanged!);
  console.log(`[approveAndCommitTask] Generated commit message: ${commitMessage.substring(0, 100)}...`);

  const result = await commitTaskChanges(repoPath, task!.filesChanged!, commitMessage);

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

  console.log(`[approveAndCommitTask] Task approved and committed successfully`);
  return result;
}
