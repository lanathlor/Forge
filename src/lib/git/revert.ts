import { execAsync, getContainerPath } from '@/lib/qa-gates/command-executor';
import { db } from '@/db';
import { tasks, planTasks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { FileChange } from '@/db/schema/tasks';
import fs from 'fs/promises';
import path from 'path';

export interface RevertResult {
  filesReverted: string[];
  filesDeleted: string[];
  success: boolean;
  errors?: string[];
}

async function revertModifiedFiles(containerPath: string, files: FileChange[], startingCommit: string) {
  const filesReverted: string[] = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      await execAsync(`git checkout ${startingCommit} -- "${file.path}"`, { cwd: containerPath, timeout: 10000 });
      filesReverted.push(file.path);
      console.log(`[revertTaskChanges] Reverted: ${file.path}`);
    } catch (error) {
      errors.push(`Failed to revert ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  return { filesReverted, errors };
}

async function deleteNewFiles(containerPath: string, files: FileChange[]) {
  const filesDeleted: string[] = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      await fs.unlink(path.join(containerPath, file.path));
      filesDeleted.push(file.path);
      console.log(`[revertTaskChanges] Deleted: ${file.path}`);
    } catch (error) {
      errors.push(`Failed to delete ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  return { filesDeleted, errors };
}

export async function revertTaskChanges(repoPath: string, startingCommit: string, filesChanged: FileChange[]): Promise<RevertResult> {
  const containerPath = getContainerPath(repoPath);
  console.log(`[revertTaskChanges] Reverting ${filesChanged.length} files from ${startingCommit} in ${containerPath}`);

  try {
    const modifiedOrDeleted = filesChanged.filter(f => f.status === 'modified' || f.status === 'deleted');
    const newFiles = filesChanged.filter(f => f.status === 'added');

    const revertResult = await revertModifiedFiles(containerPath, modifiedOrDeleted, startingCommit);
    const deleteResult = await deleteNewFiles(containerPath, newFiles);

    try {
      await execAsync('git reset HEAD', { cwd: containerPath, timeout: 5000 });
    } catch (error) {
      console.warn(`[revertTaskChanges] Failed to unstage:`, error);
    }

    const allErrors = [...revertResult.errors, ...deleteResult.errors];
    return {
      filesReverted: revertResult.filesReverted,
      filesDeleted: deleteResult.filesDeleted,
      success: allErrors.length === 0,
      errors: allErrors.length > 0 ? allErrors : undefined,
    };
  } catch (error) {
    console.error(`[revertTaskChanges] Fatal error:`, error);
    return { filesReverted: [], filesDeleted: [], success: false, errors: [error instanceof Error ? error.message : 'Unknown error during revert'] };
  }
}

async function getTaskWithRepository(taskId: string) {
  return db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { session: { with: { repository: true } } },
  });
}

function validateTaskForReject(task: Awaited<ReturnType<typeof getTaskWithRepository>>) {
  if (!task) throw new Error('Task not found');
  if (!['waiting_approval', 'qa_failed'].includes(task.status)) throw new Error(`Task cannot be rejected from status: ${task.status}`);
  if (!task.startingCommit) throw new Error('Task has no starting commit');
  if (!task.filesChanged || task.filesChanged.length === 0) throw new Error('No files changed to revert');
}

export async function rejectAndRevertTask(taskId: string, reason?: string): Promise<RevertResult> {
  console.log(`[rejectAndRevertTask] Rejecting task: ${taskId}, reason: ${reason || 'No reason provided'}`);

  const task = await getTaskWithRepository(taskId);
  validateTaskForReject(task);

  const result = await revertTaskChanges(task!.session.repository.path, task!.startingCommit!, task!.filesChanged!);

  await db
    .update(tasks)
    .set({ status: 'rejected', rejectedAt: new Date(), rejectionReason: reason, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  // Sync plan task status
  const planTask = await db.query.planTasks.findFirst({
    where: eq(planTasks.taskId, taskId),
  });

  if (planTask) {
    await db
      .update(planTasks)
      .set({
        status: 'failed',
        updatedAt: new Date(),
      })
      .where(eq(planTasks.id, planTask.id));

    console.log(`[Reject] Plan task ${planTask.id} synced to 'failed' status`);
  }

  console.log(`[rejectAndRevertTask] Task rejected successfully`);
  return result;
}
