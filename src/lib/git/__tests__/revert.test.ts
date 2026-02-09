import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as revertModule from '../revert';
import type { FileChange } from '@/db/schema/tasks';

const { mockExecAsync, mockGetContainerPath } = vi.hoisted(() => ({
  mockExecAsync: vi.fn(),
  mockGetContainerPath: vi.fn((path: string) => path),
}));

vi.mock('@/lib/qa-gates/command-executor', () => ({
  execAsync: mockExecAsync,
  getContainerPath: mockGetContainerPath,
}));

const mockFsUnlink = vi.hoisted(() => vi.fn());

vi.mock('fs/promises', () => ({
  default: {
    unlink: mockFsUnlink,
  },
}));

const mockDb = vi.hoisted(() => ({
  query: {
    tasks: {
      findFirst: vi.fn(),
    },
  },
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(),
    })),
  })),
}));

vi.mock('@/db', () => ({
  db: mockDb,
}));

vi.mock('@/db/schema/tasks', () => ({
  tasks: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
}));

describe('git/revert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('revertTaskChanges', () => {
    it('should revert modified files using git checkout', async () => {
      const filesChanged: FileChange[] = [
        { path: 'src/modified.ts', status: 'modified', additions: 10, deletions: 5, patch: '' },
      ];

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git checkout
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // git reset HEAD

      const result = await revertModule.revertTaskChanges('/repo', 'abc123', filesChanged);

      expect(result.filesReverted).toEqual(['src/modified.ts']);
      expect(result.filesDeleted).toEqual([]);
      expect(result.success).toBe(true);
      expect(result.errors).toBeUndefined();

      expect(mockExecAsync).toHaveBeenCalledWith(
        'git checkout abc123 -- "src/modified.ts"',
        { cwd: '/repo', timeout: 10000 }
      );
    });

    it('should delete newly added files using fs.unlink', async () => {
      const filesChanged: FileChange[] = [
        { path: 'src/new-file.ts', status: 'added', additions: 50, deletions: 0, patch: '' },
      ];

      mockFsUnlink.mockResolvedValueOnce(undefined);
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' }); // git reset HEAD

      const result = await revertModule.revertTaskChanges('/repo', 'abc123', filesChanged);

      expect(result.filesDeleted).toEqual(['src/new-file.ts']);
      expect(result.filesReverted).toEqual([]);
      expect(result.success).toBe(true);

      expect(mockFsUnlink).toHaveBeenCalledWith('/repo/src/new-file.ts');
    });

    it('should revert deleted files using git checkout', async () => {
      const filesChanged: FileChange[] = [
        { path: 'src/deleted.ts', status: 'deleted', additions: 0, deletions: 30, patch: '' },
      ];

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git checkout
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // git reset HEAD

      const result = await revertModule.revertTaskChanges('/repo', 'abc123', filesChanged);

      expect(result.filesReverted).toEqual(['src/deleted.ts']);
      expect(result.success).toBe(true);
    });

    it('should handle mixed file types', async () => {
      const filesChanged: FileChange[] = [
        { path: 'src/modified.ts', status: 'modified', additions: 5, deletions: 3, patch: '' },
        { path: 'src/added.ts', status: 'added', additions: 20, deletions: 0, patch: '' },
        { path: 'src/deleted.ts', status: 'deleted', additions: 0, deletions: 10, patch: '' },
      ];

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git checkout for modified
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git checkout for deleted
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // git reset HEAD

      mockFsUnlink.mockResolvedValueOnce(undefined); // delete added file

      const result = await revertModule.revertTaskChanges('/repo', 'abc123', filesChanged);

      expect(result.filesReverted).toEqual(['src/modified.ts', 'src/deleted.ts']);
      expect(result.filesDeleted).toEqual(['src/added.ts']);
      expect(result.success).toBe(true);
    });

    it('should collect errors when git checkout fails', async () => {
      const filesChanged: FileChange[] = [
        { path: 'src/file1.ts', status: 'modified', additions: 5, deletions: 3, patch: '' },
        { path: 'src/file2.ts', status: 'modified', additions: 10, deletions: 2, patch: '' },
      ];

      mockExecAsync
        .mockRejectedValueOnce(new Error('File not found')) // git checkout fails for file1
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git checkout succeeds for file2
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // git reset HEAD

      const result = await revertModule.revertTaskChanges('/repo', 'abc123', filesChanged);

      expect(result.filesReverted).toEqual(['src/file2.ts']);
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Failed to revert src/file1.ts: File not found');
    });

    it('should collect errors when fs.unlink fails', async () => {
      const filesChanged: FileChange[] = [
        { path: 'src/new-file.ts', status: 'added', additions: 20, deletions: 0, patch: '' },
      ];

      mockFsUnlink.mockRejectedValueOnce(new Error('Permission denied'));
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' }); // git reset HEAD

      const result = await revertModule.revertTaskChanges('/repo', 'abc123', filesChanged);

      expect(result.filesDeleted).toEqual([]);
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Failed to delete src/new-file.ts: Permission denied');
    });

    it('should handle git reset failure gracefully', async () => {
      const filesChanged: FileChange[] = [
        { path: 'src/file.ts', status: 'modified', additions: 5, deletions: 3, patch: '' },
      ];

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git checkout
        .mockRejectedValueOnce(new Error('Reset failed')); // git reset HEAD fails

      // Should not throw, just log warning
      const result = await revertModule.revertTaskChanges('/repo', 'abc123', filesChanged);

      expect(result.filesReverted).toEqual(['src/file.ts']);
      expect(result.success).toBe(true);
    });

    it('should handle empty files array', async () => {
      const filesChanged: FileChange[] = [];

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' }); // git reset HEAD

      const result = await revertModule.revertTaskChanges('/repo', 'abc123', filesChanged);

      expect(result.filesReverted).toEqual([]);
      expect(result.filesDeleted).toEqual([]);
      expect(result.success).toBe(true);
    });

    it('should use container path from getContainerPath', async () => {
      mockGetContainerPath.mockReturnValueOnce('/container/repo');

      const filesChanged: FileChange[] = [
        { path: 'file.ts', status: 'modified', additions: 1, deletions: 1, patch: '' },
      ];

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      await revertModule.revertTaskChanges('/host/repo', 'abc123', filesChanged);

      expect(mockGetContainerPath).toHaveBeenCalledWith('/host/repo');
      expect(mockExecAsync).toHaveBeenCalledWith(
        'git checkout abc123 -- "file.ts"',
        { cwd: '/container/repo', timeout: 10000 }
      );
    });

    it('should return fatal error when git checkout throws unexpected error', async () => {
      const filesChanged: FileChange[] = [
        { path: 'file.ts', status: 'modified', additions: 1, deletions: 1, patch: '' },
      ];

      // Make all git operations fail
      mockExecAsync
        .mockRejectedValueOnce(new Error('Fatal error'))
        .mockRejectedValueOnce(new Error('Reset also failed'));

      const result = await revertModule.revertTaskChanges('/repo', 'abc123', filesChanged);

      expect(result.success).toBe(false);
      expect(result.filesReverted).toEqual([]);
      expect(result.errors).toContain('Failed to revert file.ts: Fatal error');
    });
  });

  describe('rejectAndRevertTask', () => {
    const mockTask = {
      id: 'task-123',
      prompt: 'Fix bug',
      status: 'waiting_approval',
      filesChanged: [
        { path: 'src/file.ts', status: 'modified', additions: 10, deletions: 5, patch: '' },
      ],
      startingCommit: 'abc123',
      session: {
        repository: {
          path: '/repo/path',
        },
      },
    };

    it('should reject and revert task successfully', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(mockTask);
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git checkout
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // git reset HEAD

      const result = await revertModule.rejectAndRevertTask('task-123', 'Code quality issues');

      expect(result.filesReverted).toEqual(['src/file.ts']);
      expect(result.success).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should reject task without reason', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(mockTask);
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await revertModule.rejectAndRevertTask('task-123');

      expect(result.success).toBe(true);
    });

    it('should throw error when task not found', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(null);

      await expect(revertModule.rejectAndRevertTask('nonexistent'))
        .rejects.toThrow('Task not found');
    });

    it('should throw error when task status is invalid for rejection', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce({
        ...mockTask,
        status: 'approved',
      });

      await expect(revertModule.rejectAndRevertTask('task-123'))
        .rejects.toThrow('Task cannot be rejected from status: approved');
    });

    it('should allow rejection from qa_failed status', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce({
        ...mockTask,
        status: 'qa_failed',
      });
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await revertModule.rejectAndRevertTask('task-123');

      expect(result.success).toBe(true);
    });

    it('should throw error when task has no starting commit', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce({
        ...mockTask,
        startingCommit: null,
      });

      await expect(revertModule.rejectAndRevertTask('task-123'))
        .rejects.toThrow('Task has no starting commit');
    });

    it('should throw error when no files changed', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce({
        ...mockTask,
        filesChanged: [],
      });

      await expect(revertModule.rejectAndRevertTask('task-123'))
        .rejects.toThrow('No files changed to revert');
    });

    it('should throw error when filesChanged is null', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce({
        ...mockTask,
        filesChanged: null,
      });

      await expect(revertModule.rejectAndRevertTask('task-123'))
        .rejects.toThrow('No files changed to revert');
    });
  });
});
