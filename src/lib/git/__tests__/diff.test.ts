import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as diffModule from '../diff';

const { mockExecAsync, mockGetContainerPath } = vi.hoisted(() => ({
  mockExecAsync: vi.fn(),
  mockGetContainerPath: vi.fn((path: string) => path),
}));

vi.mock('@/lib/qa-gates/command-executor', () => ({
  execAsync: mockExecAsync,
  getContainerPath: mockGetContainerPath,
}));

describe('git/diff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('captureDiff', () => {
    it('should capture diff with all file information', async () => {
      const fullDiff = `diff --git a/file.ts b/file.ts
@@ -1,2 +1,3 @@
 line 1
-line 2
+line 2 modified`;

      mockExecAsync
        .mockResolvedValueOnce({ stdout: fullDiff, stderr: '' }) // git diff
        .mockResolvedValueOnce({ stdout: '10\t5\tfile.ts', stderr: '' }) // --numstat
        .mockResolvedValueOnce({ stdout: 'M\tfile.ts', stderr: '' }) // --name-status
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // untracked files

      const result = await diffModule.captureDiff('/repo', 'abc123');

      expect(result.fullDiff).toBe(fullDiff);
      expect(result.changedFiles).toHaveLength(1);
      expect(result.changedFiles[0]?.path).toBe('file.ts');
      expect(result.changedFiles[0]?.status).toBe('modified');
      expect(result.changedFiles[0]?.additions).toBe(10);
      expect(result.changedFiles[0]?.deletions).toBe(5);
      expect(result.stats.filesChanged).toBe(1);
      expect(result.stats.insertions).toBe(10);
      expect(result.stats.deletions).toBe(5);
    });

    it('should handle added files', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'diff content', stderr: '' })
        .mockResolvedValueOnce({ stdout: '50\t0\tnew.ts', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'A\tnew.ts', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // untracked files

      const result = await diffModule.captureDiff('/repo', 'abc123');

      expect(result.changedFiles[0]?.status).toBe('added');
      expect(result.changedFiles[0]?.additions).toBe(50);
      expect(result.changedFiles[0]?.deletions).toBe(0);
    });

    it('should handle deleted files', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'diff content', stderr: '' })
        .mockResolvedValueOnce({ stdout: '0\t30\tdeleted.ts', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'D\tdeleted.ts', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // untracked files

      const result = await diffModule.captureDiff('/repo', 'abc123');

      expect(result.changedFiles[0]?.status).toBe('deleted');
      expect(result.changedFiles[0]?.deletions).toBe(30);
    });

    it('should handle renamed files', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'diff content', stderr: '' })
        .mockResolvedValueOnce({ stdout: '5\t2\tnew-name.ts', stderr: '' })
        .mockResolvedValueOnce({
          stdout: 'R100\told-name.ts\tnew-name.ts',
          stderr: '',
        })
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // untracked files

      const result = await diffModule.captureDiff('/repo', 'abc123');

      expect(result.changedFiles[0]?.status).toBe('renamed');
      expect(result.changedFiles[0]?.path).toBe('new-name.ts');
      expect(result.changedFiles[0]?.oldPath).toBe('old-name.ts');
    });

    it('should handle binary files', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'Binary files differ', stderr: '' })
        .mockResolvedValueOnce({ stdout: '-\t-\timage.png', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'M\timage.png', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // untracked files

      const result = await diffModule.captureDiff('/repo', 'abc123');

      expect(result.changedFiles[0]?.additions).toBe(0);
      expect(result.changedFiles[0]?.deletions).toBe(0);
    });

    it('should handle empty diff', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // untracked files

      const result = await diffModule.captureDiff('/repo', 'abc123');

      expect(result.fullDiff).toBe('');
      expect(result.changedFiles).toHaveLength(0);
      expect(result.stats.filesChanged).toBe(0);
    });

    it('should calculate correct stats for multiple files', async () => {
      const multiFileDiff = 'diff content for multiple files';
      const numstat = `10\t5\tfile1.ts
20\t3\tfile2.ts
5\t10\tfile3.ts`;
      const nameStatus = `M\tfile1.ts
A\tfile2.ts
M\tfile3.ts`;

      mockExecAsync
        .mockResolvedValueOnce({ stdout: multiFileDiff, stderr: '' })
        .mockResolvedValueOnce({ stdout: numstat, stderr: '' })
        .mockResolvedValueOnce({ stdout: nameStatus, stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // untracked files

      const result = await diffModule.captureDiff('/repo', 'abc123');

      expect(result.stats.filesChanged).toBe(3);
      expect(result.stats.insertions).toBe(35); // 10 + 20 + 5
      expect(result.stats.deletions).toBe(18); // 5 + 3 + 10
    });

    it('should call git commands with correct parameters', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // untracked files

      await diffModule.captureDiff('/repo/path', 'commit-abc');

      // Note: Implementation compares against working directory (no HEAD)
      // to capture both committed and uncommitted changes
      expect(mockExecAsync).toHaveBeenNthCalledWith(1, 'git diff commit-abc', {
        cwd: '/repo/path',
        timeout: 30000,
      });
      expect(mockExecAsync).toHaveBeenNthCalledWith(
        2,
        'git diff commit-abc --numstat',
        { cwd: '/repo/path', timeout: 30000 }
      );
      expect(mockExecAsync).toHaveBeenNthCalledWith(
        3,
        'git diff commit-abc --name-status',
        { cwd: '/repo/path', timeout: 30000 }
      );
      expect(mockExecAsync).toHaveBeenNthCalledWith(
        4,
        'git ls-files --others --exclude-standard',
        { cwd: '/repo/path', timeout: 30000 }
      );
    });

    it('should use empty tree hash for initial commit', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      await diffModule.captureDiff('/repo', 'initial');

      const EMPTY_TREE_HASH = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
      expect(mockExecAsync).toHaveBeenNthCalledWith(
        1,
        `git diff ${EMPTY_TREE_HASH}`,
        { cwd: '/repo', timeout: 30000 }
      );
    });

    it('should include untracked files in diff', async () => {
      const untrackedDiff = `diff --git a/dev/null b/newfile.ts
+line 1
+line 2
+line 3`;

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git diff
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // --numstat
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // --name-status
        .mockResolvedValueOnce({ stdout: 'newfile.ts', stderr: '' }) // untracked files
        .mockResolvedValueOnce({ stdout: untrackedDiff, stderr: '' }); // git diff --no-index for untracked

      const result = await diffModule.captureDiff('/repo', 'abc123');

      expect(result.changedFiles).toHaveLength(1);
      expect(result.changedFiles[0]?.path).toBe('newfile.ts');
      expect(result.changedFiles[0]?.status).toBe('added');
      expect(result.fullDiff).toContain(untrackedDiff);
    });

    it('should handle untracked file diff failure gracefully', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git diff
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // --numstat
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // --name-status
        .mockResolvedValueOnce({ stdout: 'newfile.ts', stderr: '' }) // untracked files
        .mockRejectedValueOnce(new Error('diff failed')); // git diff --no-index fails

      const result = await diffModule.captureDiff('/repo', 'abc123');

      expect(result.changedFiles).toHaveLength(1);
      expect(result.changedFiles[0]?.path).toBe('newfile.ts');
      expect(result.changedFiles[0]?.additions).toBe(0);
    });
  });

  describe('getDiffForFiles', () => {
    it('should generate diff for deleted files', async () => {
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'deleted file diff',
        stderr: '',
      });

      const result = await diffModule.getDiffForFiles('/repo', 'abc123', [
        { path: 'removed.ts', status: 'deleted', additions: 0, deletions: 10, patch: '' },
      ]);

      expect(result).toBe('deleted file diff');
      expect(mockExecAsync).toHaveBeenCalledWith(
        'git diff abc123 -- "removed.ts"',
        { cwd: '/repo', timeout: 15000 }
      );
    });

    it('should generate diff for added files using --no-index', async () => {
      mockExecAsync.mockRejectedValueOnce({
        stdout: 'new file diff',
      });

      const result = await diffModule.getDiffForFiles('/repo', 'abc123', [
        { path: 'new.ts', status: 'added', additions: 5, deletions: 0, patch: '' },
      ]);

      expect(result).toBe('new file diff');
      expect(mockExecAsync).toHaveBeenCalledWith(
        'git diff --no-index /dev/null "new.ts"',
        { cwd: '/repo', timeout: 15000 }
      );
    });

    it('should generate diff for modified files', async () => {
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'modified file diff',
        stderr: '',
      });

      const result = await diffModule.getDiffForFiles('/repo', 'abc123', [
        { path: 'file.ts', status: 'modified', additions: 3, deletions: 2, patch: 'existing' },
      ]);

      expect(result).toBe('modified file diff');
      expect(mockExecAsync).toHaveBeenCalledWith(
        'git diff abc123 -- "file.ts"',
        { cwd: '/repo', timeout: 15000 }
      );
    });

    it('should handle files with empty patch as added', async () => {
      mockExecAsync.mockRejectedValueOnce({
        stdout: 'untracked diff',
      });

      const result = await diffModule.getDiffForFiles('/repo', 'abc123', [
        { path: 'file.ts', status: 'modified', additions: 3, deletions: 0, patch: '' },
      ]);

      expect(result).toBe('untracked diff');
      expect(mockExecAsync).toHaveBeenCalledWith(
        'git diff --no-index /dev/null "file.ts"',
        { cwd: '/repo', timeout: 15000 }
      );
    });

    it('should handle multiple files', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'diff1', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'diff2', stderr: '' });

      const result = await diffModule.getDiffForFiles('/repo', 'abc123', [
        { path: 'a.ts', status: 'modified', additions: 1, deletions: 1, patch: 'p' },
        { path: 'b.ts', status: 'deleted', additions: 0, deletions: 5, patch: 'p' },
      ]);

      expect(result).toContain('diff1');
      expect(result).toContain('diff2');
    });

    it('should handle exec failure gracefully', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('git error'));

      const result = await diffModule.getDiffForFiles('/repo', 'abc123', [
        { path: 'file.ts', status: 'deleted', additions: 0, deletions: 5, patch: 'p' },
      ]);

      expect(result).toBe('');
    });

    it('should use empty tree hash for initial commit', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: 'diff', stderr: '' });

      await diffModule.getDiffForFiles('/repo', 'initial', [
        { path: 'file.ts', status: 'modified', additions: 1, deletions: 0, patch: 'p' },
      ]);

      const EMPTY_TREE_HASH = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
      expect(mockExecAsync).toHaveBeenCalledWith(
        `git diff ${EMPTY_TREE_HASH} -- "file.ts"`,
        { cwd: '/repo', timeout: 15000 }
      );
    });

    it('should handle added file exec failure with no stdout', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('no stdout'));

      const result = await diffModule.getDiffForFiles('/repo', 'abc123', [
        { path: 'new.ts', status: 'added', additions: 5, deletions: 0, patch: '' },
      ]);

      expect(result).toBe('');
    });
  });
});
