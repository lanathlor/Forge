import { describe, it, expect } from 'vitest';
import type {
  DiscoveredRepository,
  RepositoryFilters,
} from '../index';

describe('Repository Types', () => {
  describe('DiscoveredRepository', () => {
    it('should have valid structure', () => {
      const repo: DiscoveredRepository = {
        id: 'test-id',
        name: 'test-repo',
        path: '/home/user/test-repo',
        currentBranch: 'main',
        lastCommit: {
          sha: 'abc123',
          message: 'Initial commit',
          author: 'Test Author',
          timestamp: new Date(),
        },
        isClean: true,
        uncommittedFiles: [],
      };

      expect(repo.id).toBe('test-id');
      expect(repo.name).toBe('test-repo');
      expect(repo.lastCommit.sha).toBe('abc123');
      expect(repo.isClean).toBe(true);
    });

    it('should handle uncommitted files', () => {
      const repo: DiscoveredRepository = {
        id: 'test-id',
        name: 'test-repo',
        path: '/home/user/test-repo',
        currentBranch: 'feature/test',
        lastCommit: {
          sha: 'abc123',
          message: 'WIP',
          author: 'Test Author',
          timestamp: new Date(),
        },
        isClean: false,
        uncommittedFiles: ['src/file1.ts', 'src/file2.ts'],
      };

      expect(repo.isClean).toBe(false);
      expect(repo.uncommittedFiles).toHaveLength(2);
    });
  });

  describe('RepositoryFilters', () => {
    it('should allow all optional fields', () => {
      const filters: RepositoryFilters = {};
      expect(filters).toBeDefined();
    });

    it('should support search filter', () => {
      const filters: RepositoryFilters = {
        search: 'test-repo',
      };
      expect(filters.search).toBe('test-repo');
    });

    it('should support isClean filter', () => {
      const filters: RepositoryFilters = {
        isClean: true,
      };
      expect(filters.isClean).toBe(true);
    });

    it('should support branch filter', () => {
      const filters: RepositoryFilters = {
        branch: 'main',
      };
      expect(filters.branch).toBe('main');
    });

    it('should support multiple filters', () => {
      const filters: RepositoryFilters = {
        search: 'test',
        isClean: false,
        branch: 'develop',
      };
      expect(filters.search).toBe('test');
      expect(filters.isClean).toBe(false);
      expect(filters.branch).toBe('develop');
    });
  });
});
