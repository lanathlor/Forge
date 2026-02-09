import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateCommitMessage } from '../commit-message';
import type { FileChange } from '@/db/schema/tasks';

const mockClaudeWrapper = vi.hoisted(() => ({
  executeOneShot: vi.fn(),
}));

vi.mock('../wrapper', () => ({
  claudeWrapper: mockClaudeWrapper,
}));

const mockGetContainerPath = vi.hoisted(() => vi.fn((path: string) => path));

vi.mock('@/lib/qa-gates/command-executor', () => ({
  getContainerPath: mockGetContainerPath,
}));

describe('claude/commit-message', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateCommitMessage', () => {
    const defaultFilesChanged: FileChange[] = [
      { path: 'src/auth.ts', status: 'modified', additions: 15, deletions: 5, patch: '' },
      { path: 'src/utils.ts', status: 'added', additions: 30, deletions: 0, patch: '' },
    ];

    const defaultDiffContent = `diff --git a/src/auth.ts b/src/auth.ts
@@ -1,5 +1,15 @@
 export function login() {
-  // old implementation
+  // new implementation
+  validateToken();
 }`;

    it('should generate commit message using Claude wrapper', async () => {
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce('feat(auth): add token validation to login flow');

      const result = await generateCommitMessage(
        'Add token validation',
        defaultFilesChanged,
        defaultDiffContent,
        '/repo/path'
      );

      expect(result).toBe('feat(auth): add token validation to login flow');
      expect(mockClaudeWrapper.executeOneShot).toHaveBeenCalledTimes(1);
    });

    it('should pass correct working directory to Claude wrapper', async () => {
      mockGetContainerPath.mockReturnValueOnce('/container/repo');
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce('fix: test');

      await generateCommitMessage('Fix bug', defaultFilesChanged, defaultDiffContent, '/host/repo');

      expect(mockGetContainerPath).toHaveBeenCalledWith('/host/repo');
      expect(mockClaudeWrapper.executeOneShot).toHaveBeenCalledWith(
        expect.any(String),
        '/container/repo',
        30000
      );
    });

    it('should include task prompt in the request', async () => {
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce('feat: message');

      await generateCommitMessage(
        'Implement user authentication',
        defaultFilesChanged,
        defaultDiffContent,
        '/repo'
      );

      const prompt = mockClaudeWrapper.executeOneShot.mock.calls[0]?.[0] as string;
      expect(prompt).toContain('Task Context: Implement user authentication');
    });

    it('should include file change statistics in the prompt', async () => {
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce('feat: message');

      await generateCommitMessage('Test', defaultFilesChanged, defaultDiffContent, '/repo');

      const prompt = mockClaudeWrapper.executeOneShot.mock.calls[0]?.[0] as string;
      expect(prompt).toContain('Changed Files (2): 45 insertions, 5 deletions');
      expect(prompt).toContain('- src/auth.ts (modified, +15 -5)');
      expect(prompt).toContain('- src/utils.ts (added, +30 -0)');
    });

    it('should include diff content in the prompt', async () => {
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce('fix: message');

      await generateCommitMessage('Fix', defaultFilesChanged, defaultDiffContent, '/repo');

      const prompt = mockClaudeWrapper.executeOneShot.mock.calls[0]?.[0] as string;
      expect(prompt).toContain('Full Diff:');
      expect(prompt).toContain('diff --git a/src/auth.ts b/src/auth.ts');
    });

    it('should truncate long diff content', async () => {
      const longDiff = 'x'.repeat(10000);
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce('refactor: message');

      await generateCommitMessage('Refactor', defaultFilesChanged, longDiff, '/repo');

      const prompt = mockClaudeWrapper.executeOneShot.mock.calls[0]?.[0] as string;
      expect(prompt).toContain('... (diff truncated)');
      expect(prompt.length).toBeLessThan(longDiff.length + 2000); // Some extra for prompt text
    });

    it('should use 30 second timeout for Claude wrapper', async () => {
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce('chore: message');

      await generateCommitMessage('Update', defaultFilesChanged, defaultDiffContent, '/repo');

      expect(mockClaudeWrapper.executeOneShot).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        30000
      );
    });

    it('should throw error when Claude wrapper fails', async () => {
      mockClaudeWrapper.executeOneShot.mockRejectedValueOnce(new Error('API timeout'));

      await expect(
        generateCommitMessage('Test', defaultFilesChanged, defaultDiffContent, '/repo')
      ).rejects.toThrow('Failed to generate commit message: API timeout');
    });

    it('should throw error with unknown error message for non-Error objects', async () => {
      mockClaudeWrapper.executeOneShot.mockRejectedValueOnce('string error');

      await expect(
        generateCommitMessage('Test', defaultFilesChanged, defaultDiffContent, '/repo')
      ).rejects.toThrow('Failed to generate commit message: Unknown error');
    });

    it('should handle empty files changed array', async () => {
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce('chore: empty commit');

      await generateCommitMessage('Empty', [], defaultDiffContent, '/repo');

      const prompt = mockClaudeWrapper.executeOneShot.mock.calls[0]?.[0] as string;
      expect(prompt).toContain('Changed Files (0): 0 insertions, 0 deletions');
    });

    it('should handle single file change', async () => {
      const singleFile: FileChange[] = [
        { path: 'README.md', status: 'modified', additions: 5, deletions: 2, patch: '' },
      ];
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce('docs: update readme');

      await generateCommitMessage('Update docs', singleFile, 'diff content', '/repo');

      const prompt = mockClaudeWrapper.executeOneShot.mock.calls[0]?.[0] as string;
      expect(prompt).toContain('Changed Files (1): 5 insertions, 2 deletions');
      expect(prompt).toContain('- README.md (modified, +5 -2)');
    });

    it('should handle deleted files', async () => {
      const deletedFile: FileChange[] = [
        { path: 'old-file.ts', status: 'deleted', additions: 0, deletions: 100, patch: '' },
      ];
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce('chore: remove old file');

      await generateCommitMessage('Remove', deletedFile, 'diff content', '/repo');

      const prompt = mockClaudeWrapper.executeOneShot.mock.calls[0]?.[0] as string;
      expect(prompt).toContain('- old-file.ts (deleted, +0 -100)');
    });

    it('should include conventional commit instructions in the prompt', async () => {
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce('feat: new feature');

      await generateCommitMessage('Add feature', defaultFilesChanged, defaultDiffContent, '/repo');

      const prompt = mockClaudeWrapper.executeOneShot.mock.calls[0]?.[0] as string;
      expect(prompt).toContain('conventional commits format');
      expect(prompt).toContain('feat, fix, refactor, docs, test, chore, style, perf, ci, build');
      expect(prompt).toContain('Subject line under 72 chars');
    });
  });
});
