import { describe, it, expect } from 'vitest';
import {
  buildRepositoryTree,
  countRepositories,
  findRepositoryNode,
  type TreeNode,
} from '../tree';
import type { Repository } from '@/db/schema';

// Helper function to create mock repositories
function createMockRepository(
  id: string,
  name: string,
  path: string
): Repository {
  return {
    id,
    name,
    path,
    currentBranch: 'main',
    lastCommitSha: 'abc123',
    lastCommitMsg: 'Initial commit',
    lastCommitAuthor: 'Test Author',
    lastCommitTimestamp: new Date(),
    isClean: true,
    uncommittedFiles: '[]',
    lastScanned: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('Repository Tree', () => {
  describe('buildRepositoryTree', () => {
    it('should build tree from single repository', () => {
      const repos = [createMockRepository('1', 'repo1', '/home/user/repo1')];

      const tree = buildRepositoryTree(repos);

      expect(tree.name).toBe('workspace');
      expect(tree.type).toBe('folder');
      expect(tree.isExpanded).toBe(true);
      expect(tree.children).toHaveLength(1);
      expect(tree.children[0]?.name).toBe('repo1');
      expect(tree.children[0]?.type).toBe('repository');
    });

    it('should build tree from multiple repositories in same directory', () => {
      const repos = [
        createMockRepository('1', 'repo1', '/home/user/projects/repo1'),
        createMockRepository('2', 'repo2', '/home/user/projects/repo2'),
        createMockRepository('3', 'repo3', '/home/user/projects/repo3'),
      ];

      const tree = buildRepositoryTree(repos);

      expect(tree.children).toHaveLength(3);
      expect(tree.children.map((c) => c.name).sort()).toEqual([
        'repo1',
        'repo2',
        'repo3',
      ]);
    });

    it('should build nested tree structure', () => {
      const repos = [
        createMockRepository('1', 'repo1', '/home/user/work/client-a/repo1'),
        createMockRepository('2', 'repo2', '/home/user/work/client-a/repo2'),
        createMockRepository('3', 'repo3', '/home/user/work/client-b/repo3'),
      ];

      const tree = buildRepositoryTree(repos);

      expect(tree.children).toHaveLength(2); // Two folders: client-a and client-b

      const clientA = tree.children.find((c) => c.name === 'client-a');
      const clientB = tree.children.find((c) => c.name === 'client-b');

      expect(clientA?.type).toBe('folder');
      expect(clientA?.children).toHaveLength(2);
      expect(clientB?.type).toBe('folder');
      expect(clientB?.children).toHaveLength(1);
    });

    it('should sort folders before repositories', () => {
      const repos = [
        createMockRepository('1', 'repo1', '/home/user/work/repo1'),
        createMockRepository('2', 'repo2', '/home/user/work/folder/repo2'),
        createMockRepository('3', 'repo3', '/home/user/work/repo3'),
      ];

      const tree = buildRepositoryTree(repos);

      expect(tree.children[0]?.type).toBe('folder'); // folder comes first
      expect(tree.children[0]?.name).toBe('folder');
      expect(tree.children[1]?.type).toBe('repository');
      expect(tree.children[2]?.type).toBe('repository');
    });

    it('should sort alphabetically within same type', () => {
      const repos = [
        createMockRepository('1', 'zebra', '/home/user/work/zebra'),
        createMockRepository('2', 'alpha', '/home/user/work/alpha'),
        createMockRepository('3', 'beta', '/home/user/work/beta'),
      ];

      const tree = buildRepositoryTree(repos);

      expect(tree.children.map((c) => c.name)).toEqual([
        'alpha',
        'beta',
        'zebra',
      ]);
    });

    it('should handle empty repository list', () => {
      const tree = buildRepositoryTree([]);

      expect(tree.name).toBe('workspace');
      expect(tree.children).toHaveLength(0);
    });

    it('should handle deeply nested paths', () => {
      const repos = [
        createMockRepository(
          '1',
          'repo1',
          '/home/user/projects/work/company/team/repo1'
        ),
      ];

      const tree = buildRepositoryTree(repos);

      // The common base path calculation will be /home/user/projects/work/company/team
      // So for a single deep repo, it should be directly at root
      expect(tree.children).toHaveLength(1);
      expect(tree.children[0]?.name).toBe('repo1');

      // Verify the entire tree structure is created
      const totalRepos = countRepositories(tree);
      expect(totalRepos).toBe(1);
    });

    it('should set folder expanded state correctly', () => {
      const repos = [
        createMockRepository('1', 'repo1', '/home/user/work/folder/repo1'),
      ];

      const tree = buildRepositoryTree(repos);

      expect(tree.isExpanded).toBe(true); // Root is expanded
      const folderNode = tree.children[0];
      if (folderNode?.type === 'folder') {
        expect(folderNode.isExpanded).toBe(false); // Nested folders not expanded
      }
    });

    it('should preserve repository data in tree nodes', () => {
      const repo = createMockRepository('test-id', 'test-repo', '/home/test');
      const tree = buildRepositoryTree([repo]);

      expect(tree.children[0]?.repository).toEqual(repo);
      expect(tree.children[0]?.repository?.id).toBe('test-id');
    });

    it('should handle repository at root path (no subdirectories)', () => {
      // This tests the processRepositoryPath early return when parts.length === 0
      const repos = [createMockRepository('1', 'repo1', '/repo1')];
      const tree = buildRepositoryTree(repos);

      // Should still build the tree properly
      expect(tree.children).toHaveLength(1);
    });

    it('should handle paths with empty segments', () => {
      // This tests the empty part check in processRepositoryPath
      const repos = [
        createMockRepository('1', 'repo1', '/home//user//repo1'), // Double slashes
      ];
      const tree = buildRepositoryTree(repos);

      // Should filter out empty segments and build tree correctly
      expect(countRepositories(tree)).toBe(1);
    });

    it('should handle single repository with complex path', () => {
      // This tests the single path case in findCommonBasePath (lines 116-117)
      const repos = [
        createMockRepository('1', 'repo1', '/home/user/projects/repo1'),
      ];
      const tree = buildRepositoryTree(repos);

      // For a single repo, common base should be parent directory
      expect(tree.children).toHaveLength(1);
      expect(tree.children[0]?.name).toBe('repo1');
    });

    it('should handle repositories with no common base path', () => {
      // This tests edge cases in findCommonBasePath
      const repos = [
        createMockRepository('1', 'repo1', '/home/repo1'),
        createMockRepository('2', 'repo2', '/opt/repo2'),
      ];
      const tree = buildRepositoryTree(repos);

      // Should still build a valid tree even with no common base
      expect(countRepositories(tree)).toBe(2);
    });

    it('should handle repository at very short path', () => {
      // Edge case for common base path calculation
      const repos = [createMockRepository('1', 'r', '/r')];
      const tree = buildRepositoryTree(repos);

      expect(tree.children).toHaveLength(1);
      expect(tree.children[0]?.name).toBe('r');
    });
  });

  describe('countRepositories', () => {
    it('should count single repository', () => {
      const repos = [createMockRepository('1', 'repo1', '/home/user/repo1')];
      const tree = buildRepositoryTree(repos);

      expect(countRepositories(tree)).toBe(1);
    });

    it('should count multiple repositories at root', () => {
      const repos = [
        createMockRepository('1', 'repo1', '/home/user/work/repo1'),
        createMockRepository('2', 'repo2', '/home/user/work/repo2'),
        createMockRepository('3', 'repo3', '/home/user/work/repo3'),
      ];
      const tree = buildRepositoryTree(repos);

      expect(countRepositories(tree)).toBe(3);
    });

    it('should count repositories in nested folders', () => {
      const repos = [
        createMockRepository('1', 'repo1', '/home/user/work/client-a/repo1'),
        createMockRepository('2', 'repo2', '/home/user/work/client-a/repo2'),
        createMockRepository('3', 'repo3', '/home/user/work/client-b/repo3'),
        createMockRepository('4', 'repo4', '/home/user/work/repo4'),
      ];
      const tree = buildRepositoryTree(repos);

      expect(countRepositories(tree)).toBe(4);
    });

    it('should return 0 for empty tree', () => {
      const tree = buildRepositoryTree([]);

      expect(countRepositories(tree)).toBe(0);
    });

    it('should count repository node as 1', () => {
      const node: TreeNode = {
        name: 'repo',
        path: '/home/repo',
        type: 'repository',
        children: [],
      };

      expect(countRepositories(node)).toBe(1);
    });

    it('should not count folder nodes', () => {
      const node: TreeNode = {
        name: 'folder',
        path: '/home/folder',
        type: 'folder',
        children: [],
      };

      expect(countRepositories(node)).toBe(0);
    });
  });

  describe('findRepositoryNode', () => {
    it('should find repository at root level', () => {
      const repos = [
        createMockRepository('target-id', 'repo1', '/home/user/work/repo1'),
        createMockRepository('2', 'repo2', '/home/user/work/repo2'),
      ];
      const tree = buildRepositoryTree(repos);

      const found = findRepositoryNode(tree, 'target-id');

      expect(found).not.toBeNull();
      expect(found?.repository?.id).toBe('target-id');
      expect(found?.name).toBe('repo1');
    });

    it('should find repository in nested folder', () => {
      const repos = [
        createMockRepository(
          'target-id',
          'repo1',
          '/home/user/work/folder/repo1'
        ),
        createMockRepository('2', 'repo2', '/home/user/work/repo2'),
      ];
      const tree = buildRepositoryTree(repos);

      const found = findRepositoryNode(tree, 'target-id');

      expect(found).not.toBeNull();
      expect(found?.repository?.id).toBe('target-id');
    });

    it('should return null when repository not found', () => {
      const repos = [
        createMockRepository('1', 'repo1', '/home/user/work/repo1'),
        createMockRepository('2', 'repo2', '/home/user/work/repo2'),
      ];
      const tree = buildRepositoryTree(repos);

      const found = findRepositoryNode(tree, 'nonexistent-id');

      expect(found).toBeNull();
    });

    it('should return null for empty tree', () => {
      const tree = buildRepositoryTree([]);

      const found = findRepositoryNode(tree, 'any-id');

      expect(found).toBeNull();
    });

    it('should find repository in deeply nested structure', () => {
      const repos = [
        createMockRepository(
          'target-id',
          'repo1',
          '/home/user/projects/work/company/team/repo1'
        ),
        createMockRepository(
          '2',
          'repo2',
          '/home/user/projects/work/company/repo2'
        ),
      ];
      const tree = buildRepositoryTree(repos);

      const found = findRepositoryNode(tree, 'target-id');

      expect(found).not.toBeNull();
      expect(found?.repository?.id).toBe('target-id');
      expect(found?.name).toBe('repo1');
    });
  });
});
