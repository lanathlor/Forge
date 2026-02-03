import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as contentModule from '../content';

const { mockExecAsync } = vi.hoisted(() => ({
  mockExecAsync: vi.fn(),
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
  default: { exec: vi.fn() },
}));

vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecAsync),
  default: { promisify: vi.fn(() => mockExecAsync) },
}));

describe('git/content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFileContent', () => {
    it('should retrieve file content from git at specified commit', async () => {
      const mockStdout = 'file content from git';
      mockExecAsync.mockResolvedValue({ stdout: mockStdout, stderr: '' });

      const content = await contentModule.getFileContent(
        '/repo/path',
        'src/file.ts',
        'abc123'
      );

      expect(content).toBe(mockStdout);
      expect(mockExecAsync).toHaveBeenCalledWith('git show abc123:src/file.ts', {
        cwd: '/repo/path',
      });
    });

    it('should use HEAD as default commit', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'current content',
        stderr: '',
      });

      await contentModule.getFileContent('/repo/path', 'src/file.ts');

      expect(mockExecAsync).toHaveBeenCalledWith('git show HEAD:src/file.ts', {
        cwd: '/repo/path',
      });
    });

    it('should return empty string when file does not exist', async () => {
      mockExecAsync.mockRejectedValue(new Error('fatal: Path does not exist'));

      const content = await contentModule.getFileContent(
        '/repo/path',
        'missing.ts',
        'abc123'
      );

      expect(content).toBe('');
    });

    it('should handle empty file content', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const content = await contentModule.getFileContent(
        '/repo',
        'empty.txt',
        'HEAD'
      );

      expect(content).toBe('');
    });
  });

  describe('getFileContentBeforeAndAfter', () => {
    it('should retrieve content before and after commit', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'before', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'after', stderr: '' });

      const result = await contentModule.getFileContentBeforeAndAfter(
        '/repo',
        'file.ts',
        'abc123'
      );

      expect(result.before).toBe('before');
      expect(result.after).toBe('after');
      expect(mockExecAsync).toHaveBeenCalledTimes(2);
    });

    it('should handle new files (no before content)', async () => {
      mockExecAsync
        .mockRejectedValueOnce(new Error('Path does not exist'))
        .mockResolvedValueOnce({ stdout: 'new content', stderr: '' });

      const result = await contentModule.getFileContentBeforeAndAfter(
        '/repo',
        'new-file.ts',
        'abc123'
      );

      expect(result.before).toBe('');
      expect(result.after).toBe('new content');
    });

    it('should handle deleted files (no after content)', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'old content', stderr: '' })
        .mockRejectedValueOnce(new Error('Path does not exist'));

      const result = await contentModule.getFileContentBeforeAndAfter(
        '/repo',
        'deleted.ts',
        'abc123'
      );

      expect(result.before).toBe('old content');
      expect(result.after).toBe('');
    });
  });
});
