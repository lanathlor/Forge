import { describe, it, expect } from 'vitest';
import type { FileChange, DiffResult } from '../index';

describe('Type Definitions', () => {
  describe('FileChange', () => {
    it('should create valid FileChange object', () => {
      const fileChange: FileChange = {
        path: 'src/app/page.tsx',
        status: 'modified',
        additions: 10,
        deletions: 5,
        patch: 'diff content here',
      };

      expect(fileChange.path).toBe('src/app/page.tsx');
      expect(fileChange.status).toBe('modified');
      expect(fileChange.additions).toBe(10);
      expect(fileChange.deletions).toBe(5);
      expect(fileChange.patch).toBeTruthy();
    });

    it('should support all status types', () => {
      const statuses: Array<FileChange['status']> = [
        'added',
        'modified',
        'deleted',
        'renamed',
      ];

      statuses.forEach((status) => {
        const change: FileChange = {
          path: 'test.ts',
          status,
          additions: 0,
          deletions: 0,
          patch: '',
        };
        expect(change.status).toBe(status);
      });
    });

    it('should handle renamed files with oldPath', () => {
      const fileChange: FileChange = {
        path: 'src/new-name.ts',
        oldPath: 'src/old-name.ts',
        status: 'renamed',
        additions: 0,
        deletions: 0,
        patch: 'diff content',
      };

      expect(fileChange.oldPath).toBe('src/old-name.ts');
      expect(fileChange.status).toBe('renamed');
    });
  });

  describe('DiffResult', () => {
    it('should create valid DiffResult object', () => {
      const diffResult: DiffResult = {
        fullDiff: 'complete diff content',
        changedFiles: [
          {
            path: 'file1.ts',
            status: 'modified',
            additions: 5,
            deletions: 2,
            patch: 'patch1',
          },
          {
            path: 'file2.ts',
            status: 'added',
            additions: 10,
            deletions: 0,
            patch: 'patch2',
          },
        ],
        stats: {
          filesChanged: 2,
          insertions: 15,
          deletions: 2,
        },
      };

      expect(diffResult.fullDiff).toBeTruthy();
      expect(diffResult.changedFiles).toHaveLength(2);
      expect(diffResult.stats.filesChanged).toBe(2);
      expect(diffResult.stats.insertions).toBe(15);
      expect(diffResult.stats.deletions).toBe(2);
    });

    it('should handle empty diff result', () => {
      const emptyDiff: DiffResult = {
        fullDiff: '',
        changedFiles: [],
        stats: {
          filesChanged: 0,
          insertions: 0,
          deletions: 0,
        },
      };

      expect(emptyDiff.changedFiles).toHaveLength(0);
      expect(emptyDiff.stats.filesChanged).toBe(0);
    });

    it('should calculate correct stats from changed files', () => {
      const files: FileChange[] = [
        {
          path: 'file1.ts',
          status: 'modified',
          additions: 10,
          deletions: 5,
          patch: '',
        },
        {
          path: 'file2.ts',
          status: 'modified',
          additions: 8,
          deletions: 3,
          patch: '',
        },
      ];

      const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
      const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

      expect(totalAdditions).toBe(18);
      expect(totalDeletions).toBe(8);
      expect(files.length).toBe(2);
    });
  });
});
