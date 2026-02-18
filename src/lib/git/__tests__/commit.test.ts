import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as commitModule from '../commit';
import type { FileChange } from '@/db/schema/tasks';

const { mockExecAsync, mockGetContainerPath } = vi.hoisted(() => ({
  mockExecAsync: vi.fn(),
  mockGetContainerPath: vi.fn((path: string) => path),
}));

vi.mock('@/lib/qa-gates/command-executor', () => ({
  execAsync: mockExecAsync,
  getContainerPath: mockGetContainerPath,
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

describe('git/commit', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetContainerPath.mockImplementation((path: string) => path);
  });

  describe('generateBasicCommitMessage', () => {
    it('should generate a basic commit message with file stats', () => {
      const filesChanged: FileChange[] = [
        {
          path: 'src/index.ts',
          status: 'modified',
          additions: 10,
          deletions: 5,
          patch: '',
        },
        {
          path: 'src/utils.ts',
          status: 'added',
          additions: 20,
          deletions: 0,
          patch: '',
        },
      ];

      const message = commitModule.generateBasicCommitMessage(
        'Add new feature',
        filesChanged
      );

      expect(message).toContain('Add new feature');
      expect(message).toContain('2 files changed');
      expect(message).toContain('+30 insertions, -5 deletions');
      expect(message).toContain('- src/index.ts (modified)');
      expect(message).toContain('- src/utils.ts (added)');
    });

    it('should truncate long task prompts', () => {
      const longPrompt =
        'This is a very long task prompt that exceeds the 50 character limit';
      const filesChanged: FileChange[] = [
        {
          path: 'file.ts',
          status: 'modified',
          additions: 1,
          deletions: 1,
          patch: '',
        },
      ];

      const message = commitModule.generateBasicCommitMessage(
        longPrompt,
        filesChanged
      );

      expect(message.split('\n')[0]).toBe(
        'This is a very long task prompt that exceeds the 5...'
      );
    });

    it('should handle single file correctly', () => {
      const filesChanged: FileChange[] = [
        {
          path: 'file.ts',
          status: 'modified',
          additions: 5,
          deletions: 3,
          patch: '',
        },
      ];

      const message = commitModule.generateBasicCommitMessage(
        'Fix bug',
        filesChanged
      );

      expect(message).toContain('1 file changed');
    });

    it('should handle deleted files', () => {
      const filesChanged: FileChange[] = [
        {
          path: 'old-file.ts',
          status: 'deleted',
          additions: 0,
          deletions: 50,
          patch: '',
        },
      ];

      const message = commitModule.generateBasicCommitMessage(
        'Remove unused file',
        filesChanged
      );

      expect(message).toContain('- old-file.ts (deleted)');
      expect(message).toContain('+0 insertions, -50 deletions');
    });

    it('should handle renamed files', () => {
      const filesChanged: FileChange[] = [
        {
          path: 'new-name.ts',
          status: 'renamed',
          additions: 2,
          deletions: 2,
          oldPath: 'old-name.ts',
          patch: '',
        },
      ];

      const message = commitModule.generateBasicCommitMessage(
        'Rename file',
        filesChanged
      );

      expect(message).toContain('- new-name.ts (renamed)');
    });

    it('should handle empty files changed array', () => {
      const filesChanged: FileChange[] = [];

      const message = commitModule.generateBasicCommitMessage(
        'Empty commit',
        filesChanged
      );

      expect(message).toContain('0 files changed');
      expect(message).toContain('+0 insertions, -0 deletions');
    });
  });

  describe('commitTaskChanges', () => {
    it('should stage and commit files successfully', async () => {
      const filesChanged: FileChange[] = [
        {
          path: 'src/index.ts',
          status: 'modified',
          additions: 10,
          deletions: 5,
          patch: '',
        },
        {
          path: 'src/new.ts',
          status: 'added',
          additions: 20,
          deletions: 0,
          patch: '',
        },
      ];

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git add for first file
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git add for second file
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git commit
        .mockResolvedValueOnce({ stdout: 'abc123def456\n', stderr: '' }); // git rev-parse HEAD

      const result = await commitModule.commitTaskChanges(
        '/repo',
        filesChanged,
        'Test commit message'
      );

      expect(result.sha).toBe('abc123def456');
      expect(result.message).toBe('Test commit message');
      expect(result.filesCommitted).toEqual(['src/index.ts', 'src/new.ts']);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should use git rm for deleted files', async () => {
      const filesChanged: FileChange[] = [
        {
          path: 'deleted-file.ts',
          status: 'deleted',
          additions: 0,
          deletions: 50,
          patch: '',
        },
      ];

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git rm
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git commit
        .mockResolvedValueOnce({ stdout: 'sha123\n', stderr: '' }); // git rev-parse HEAD

      await commitModule.commitTaskChanges(
        '/repo',
        filesChanged,
        'Delete file'
      );

      expect(mockExecAsync).toHaveBeenCalledWith('git rm "deleted-file.ts"', {
        cwd: '/repo',
        timeout: 10000,
      });
    });

    it('should use git add for modified files', async () => {
      const filesChanged: FileChange[] = [
        {
          path: 'modified-file.ts',
          status: 'modified',
          additions: 5,
          deletions: 3,
          patch: '',
        },
      ];

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git add
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git commit
        .mockResolvedValueOnce({ stdout: 'sha456\n', stderr: '' }); // git rev-parse HEAD

      await commitModule.commitTaskChanges(
        '/repo',
        filesChanged,
        'Modify file'
      );

      expect(mockExecAsync).toHaveBeenCalledWith('git add "modified-file.ts"', {
        cwd: '/repo',
        timeout: 10000,
      });
    });

    it('should throw error when staging fails', async () => {
      const filesChanged: FileChange[] = [
        {
          path: 'file.ts',
          status: 'modified',
          additions: 5,
          deletions: 3,
          patch: '',
        },
      ];

      mockExecAsync
        .mockRejectedValueOnce(new Error('Failed to stage file')); // git add fails

      await expect(
        commitModule.commitTaskChanges('/repo', filesChanged, 'Test')
      ).rejects.toThrow('Failed to commit changes: Failed to stage file');
    });

    it('should throw error when commit fails with a real git error', async () => {
      const filesChanged: FileChange[] = [
        {
          path: 'file.ts',
          status: 'modified',
          additions: 5,
          deletions: 3,
          patch: '',
        },
      ];

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git add
        .mockRejectedValueOnce(new Error('Permission denied')); // git commit fails

      await expect(
        commitModule.commitTaskChanges('/repo', filesChanged, 'Test')
      ).rejects.toThrow('Failed to commit changes: Permission denied');
    });

    it('should fall back to HEAD when nothing to commit (Error with message)', async () => {
      const filesChanged: FileChange[] = [
        {
          path: 'file.ts',
          status: 'modified',
          additions: 5,
          deletions: 3,
          patch: '',
        },
      ];

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git add
        .mockRejectedValueOnce(new Error('nothing to commit, working tree clean')) // git commit
        .mockResolvedValueOnce({ stdout: 'headsha\n', stderr: '' }) // git rev-parse HEAD
        .mockResolvedValueOnce({ stdout: 'existing message\n', stderr: '' }); // git log -1

      const result = await commitModule.commitTaskChanges('/repo', filesChanged, 'Test');

      expect(result.sha).toBe('headsha');
      expect(result.message).toBe('existing message');
    });

    it('should fall back to HEAD when nothing to commit (object with stdout)', async () => {
      const filesChanged: FileChange[] = [
        { path: 'file.ts', status: 'modified', additions: 1, deletions: 1, patch: '' },
      ];

      // git sometimes exits non-zero with output in stdout (not stderr)
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git add
        .mockRejectedValueOnce({ stdout: 'nothing to commit', stderr: '', code: 1 }) // git commit
        .mockResolvedValueOnce({ stdout: 'abc\n', stderr: '' }) // git rev-parse HEAD
        .mockResolvedValueOnce({ stdout: 'head message\n', stderr: '' }); // git log -1

      const result = await commitModule.commitTaskChanges('/repo', filesChanged, 'Test');

      expect(result.sha).toBe('abc');
      expect(result.message).toBe('head message');
    });

    it('should fall back to HEAD when nothing to commit (object with stderr)', async () => {
      const filesChanged: FileChange[] = [
        { path: 'file.ts', status: 'modified', additions: 1, deletions: 1, patch: '' },
      ];

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git add
        .mockRejectedValueOnce({ stdout: '', stderr: 'nothing to commit', code: 1 }) // git commit
        .mockResolvedValueOnce({ stdout: 'def\n', stderr: '' }) // git rev-parse HEAD
        .mockResolvedValueOnce({ stdout: 'another message\n', stderr: '' }); // git log -1

      const result = await commitModule.commitTaskChanges('/repo', filesChanged, 'Test');

      expect(result.sha).toBe('def');
    });

    it('should escape single quotes in commit message', async () => {
      const filesChanged: FileChange[] = [
        {
          path: 'file.ts',
          status: 'modified',
          additions: 1,
          deletions: 1,
          patch: '',
        },
      ];

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git add
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git commit
        .mockResolvedValueOnce({ stdout: 'sha789\n', stderr: '' }); // git rev-parse HEAD

      await commitModule.commitTaskChanges(
        '/repo',
        filesChanged,
        "Fix user's profile bug"
      );

      // Check that the commit command was called with escaped message (call index 1 after add)
      const commitCall = mockExecAsync.mock.calls[1];
      expect(commitCall?.[0]).toContain("Fix user'\\''s profile bug");
    });

    it('should use container path from getContainerPath', async () => {
      mockGetContainerPath.mockReturnValueOnce('/container/path');

      const filesChanged: FileChange[] = [
        {
          path: 'file.ts',
          status: 'modified',
          additions: 1,
          deletions: 1,
          patch: '',
        },
      ];

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git add
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git commit
        .mockResolvedValueOnce({ stdout: 'sha\n', stderr: '' }); // git rev-parse HEAD

      await commitModule.commitTaskChanges('/host/path', filesChanged, 'Test');

      expect(mockGetContainerPath).toHaveBeenCalledWith('/host/path');
      // Verify container path is used - the first call (git add) uses the container path with timeout 10000
      expect(mockExecAsync).toHaveBeenCalledWith('git add "file.ts"', {
        cwd: '/container/path',
        timeout: 10000,
      });
    });
  });

  describe('approveAndCommitTask', () => {
    const mockTask = {
      id: 'task-123',
      prompt: 'Fix authentication bug',
      status: 'waiting_approval',
      filesChanged: [
        {
          path: 'src/auth.ts',
          status: 'modified',
          additions: 15,
          deletions: 5,
          patch: '',
        },
      ],
      startingCommit: 'abc123',
      session: {
        repository: {
          path: '/repo/path',
        },
      },
    };

    it('should approve and commit task successfully', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(mockTask);
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git add
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git commit
        .mockResolvedValueOnce({ stdout: 'commit-sha\n', stderr: '' }); // git rev-parse HEAD

      const result = await commitModule.approveAndCommitTask('task-123');

      expect(result.sha).toBe('commit-sha');
      expect(result.filesCommitted).toEqual(['src/auth.ts']);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should throw error when task not found', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(null);

      await expect(
        commitModule.approveAndCommitTask('nonexistent')
      ).rejects.toThrow('Task not found');
    });

    it('should throw error when task status is not waiting_approval', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce({
        ...mockTask,
        status: 'running',
      });

      await expect(
        commitModule.approveAndCommitTask('task-123')
      ).rejects.toThrow('Task status is running, expected waiting_approval');
    });

    it('should throw error when no files changed', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce({
        ...mockTask,
        filesChanged: [],
      });

      await expect(
        commitModule.approveAndCommitTask('task-123')
      ).rejects.toThrow('No files changed to commit');
    });

    it('should throw error when filesChanged is null', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce({
        ...mockTask,
        filesChanged: null,
      });

      await expect(
        commitModule.approveAndCommitTask('task-123')
      ).rejects.toThrow('No files changed to commit');
    });
  });
});
