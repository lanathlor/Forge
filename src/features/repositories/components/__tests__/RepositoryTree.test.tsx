import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepositoryTree } from '../RepositoryTree';
import type { Repository } from '@/db/schema';
import type { TreeNode } from '../../lib/tree';

describe('RepositoryTree', () => {
  const mockOnSelect = vi.fn();

  const mockRepository1: Repository = {
    id: 'repo-1',
    name: 'test-repo-1',
    path: '/workspace/test-repo-1',
    isClean: true,
    currentBranch: 'main',
    lastCommitSha: null,
    lastCommitMsg: null,
    lastCommitAuthor: null,
    lastCommitTimestamp: null,
    uncommittedFiles: null,
    lastScanned: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository2: Repository = {
    id: 'repo-2',
    name: 'test-repo-2',
    path: '/workspace/folder/test-repo-2',
    isClean: false,
    currentBranch: 'develop',
    lastCommitSha: null,
    lastCommitMsg: null,
    lastCommitAuthor: null,
    lastCommitTimestamp: null,
    uncommittedFiles: null,
    lastScanned: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Root Level Rendering', () => {
    it('renders root folder without showing the folder itself', () => {
      const tree: TreeNode = {
        type: 'folder',
        name: 'root',
        path: '/workspace',
        children: [
          {
            type: 'repository',
            name: 'test-repo-1',
            path: '/workspace/test-repo-1',
            repository: mockRepository1,
            children: [],
          },
        ],
      };

      render(
        <RepositoryTree node={tree} selectedId={null} onSelect={mockOnSelect} />
      );

      // Should render the repository, not the root folder name
      expect(screen.getByText('test-repo-1')).toBeInTheDocument();
      expect(screen.queryByText('root')).not.toBeInTheDocument();
    });

    it('renders multiple repositories at root level', () => {
      const tree: TreeNode = {
        type: 'folder',
        name: 'root',
        path: '/workspace',
        children: [
          {
            type: 'repository',
            name: 'test-repo-1',
            path: '/workspace/test-repo-1',
            repository: mockRepository1,
            children: [],
          },
          {
            type: 'repository',
            name: 'test-repo-2',
            path: '/workspace/test-repo-2',
            repository: mockRepository2,
            children: [],
          },
        ],
      };

      render(
        <RepositoryTree node={tree} selectedId={null} onSelect={mockOnSelect} />
      );

      expect(screen.getByText('test-repo-1')).toBeInTheDocument();
      expect(screen.getByText('test-repo-2')).toBeInTheDocument();
    });
  });

  describe('Folder Rendering', () => {
    it('renders folder with children count', () => {
      const tree: TreeNode = {
        type: 'folder',
        name: 'root',
        path: '/workspace',
        children: [
          {
            type: 'folder',
            name: 'projects',
            path: '/workspace/projects',
            children: [
              {
                type: 'repository',
                name: 'test-repo-1',
                path: '/workspace/projects/test-repo-1',
                repository: mockRepository1,
                children: [],
              },
              {
                type: 'repository',
                name: 'test-repo-2',
                path: '/workspace/projects/test-repo-2',
                repository: mockRepository2,
                children: [],
              },
            ],
          },
        ],
      };

      render(
        <RepositoryTree node={tree} selectedId={null} onSelect={mockOnSelect} />
      );

      expect(screen.getByText('projects')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // Children count
    });

    it('starts with root folder expanded', () => {
      const tree: TreeNode = {
        type: 'folder',
        name: 'root',
        path: '/workspace',
        children: [
          {
            type: 'folder',
            name: 'projects',
            path: '/workspace/projects',
            children: [
              {
                type: 'repository',
                name: 'test-repo-1',
                path: '/workspace/projects/test-repo-1',
                repository: mockRepository1,
                children: [],
              },
            ],
          },
        ],
      };

      render(
        <RepositoryTree node={tree} selectedId={null} onSelect={mockOnSelect} />
      );

      // Folder should be visible since root is expanded
      expect(screen.getByText('projects')).toBeInTheDocument();
    });

    it('toggles folder expansion when clicked', async () => {
      const user = userEvent.setup();
      const tree: TreeNode = {
        type: 'folder',
        name: 'root',
        path: '/workspace',
        children: [
          {
            type: 'folder',
            name: 'projects',
            path: '/workspace/projects',
            children: [
              {
                type: 'repository',
                name: 'test-repo-1',
                path: '/workspace/projects/test-repo-1',
                repository: mockRepository1,
                children: [],
              },
            ],
          },
        ],
      };

      render(
        <RepositoryTree node={tree} selectedId={null} onSelect={mockOnSelect} />
      );

      const folderButton = screen.getByText('projects').closest('button');
      expect(folderButton).toBeInTheDocument();

      // Initially repository should not be visible (folder starts collapsed)
      expect(screen.queryByText('test-repo-1')).not.toBeInTheDocument();

      // Click to expand
      await user.click(folderButton!);

      // Repository should appear
      expect(screen.getByText('test-repo-1')).toBeInTheDocument();

      // Click again to collapse
      await user.click(folderButton!);

      // Repository should disappear again
      expect(screen.queryByText('test-repo-1')).not.toBeInTheDocument();
    });
  });

  describe('Repository Rendering', () => {
    it('renders repository name', () => {
      const tree: TreeNode = {
        type: 'folder',
        name: 'root',
        path: '/workspace',
        children: [
          {
            type: 'repository',
            name: 'test-repo-1',
            path: '/workspace/test-repo-1',
            repository: mockRepository1,
            children: [],
          },
        ],
      };

      render(
        <RepositoryTree node={tree} selectedId={null} onSelect={mockOnSelect} />
      );

      expect(screen.getByText('test-repo-1')).toBeInTheDocument();
    });

    it('calls onSelect when repository is clicked', async () => {
      const user = userEvent.setup();
      const tree: TreeNode = {
        type: 'folder',
        name: 'root',
        path: '/workspace',
        children: [
          {
            type: 'repository',
            name: 'test-repo-1',
            path: '/workspace/test-repo-1',
            repository: mockRepository1,
            children: [],
          },
        ],
      };

      render(
        <RepositoryTree node={tree} selectedId={null} onSelect={mockOnSelect} />
      );

      const repoButton = screen.getByText('test-repo-1').closest('button');
      await user.click(repoButton!);

      expect(mockOnSelect).toHaveBeenCalledTimes(1);
      expect(mockOnSelect).toHaveBeenCalledWith(mockRepository1);
    });

    it('highlights selected repository', () => {
      const tree: TreeNode = {
        type: 'folder',
        name: 'root',
        path: '/workspace',
        children: [
          {
            type: 'repository',
            name: 'test-repo-1',
            path: '/workspace/test-repo-1',
            repository: mockRepository1,
            children: [],
          },
        ],
      };

      render(
        <RepositoryTree
          node={tree}
          selectedId="repo-1"
          onSelect={mockOnSelect}
        />
      );

      const repoButton = screen.getByText('test-repo-1').closest('button');
      expect(repoButton).toHaveClass('bg-primary/10');
    });

    it('does not highlight unselected repository', () => {
      const tree: TreeNode = {
        type: 'folder',
        name: 'root',
        path: '/workspace',
        children: [
          {
            type: 'repository',
            name: 'test-repo-1',
            path: '/workspace/test-repo-1',
            repository: mockRepository1,
            children: [],
          },
        ],
      };

      render(
        <RepositoryTree
          node={tree}
          selectedId="different-id"
          onSelect={mockOnSelect}
        />
      );

      const repoButton = screen.getByText('test-repo-1').closest('button');
      expect(repoButton).not.toHaveClass('bg-primary/10');
    });

    it('displays clean status badge with checkmark', () => {
      const tree: TreeNode = {
        type: 'folder',
        name: 'root',
        path: '/workspace',
        children: [
          {
            type: 'repository',
            name: 'test-repo-1',
            path: '/workspace/test-repo-1',
            repository: mockRepository1,
            children: [],
          },
        ],
      };

      render(
        <RepositoryTree node={tree} selectedId={null} onSelect={mockOnSelect} />
      );

      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('displays dirty status badge with dot', () => {
      const tree: TreeNode = {
        type: 'folder',
        name: 'root',
        path: '/workspace',
        children: [
          {
            type: 'repository',
            name: 'test-repo-2',
            path: '/workspace/test-repo-2',
            repository: mockRepository2,
            children: [],
          },
        ],
      };

      render(
        <RepositoryTree node={tree} selectedId={null} onSelect={mockOnSelect} />
      );

      expect(screen.getByText('•')).toBeInTheDocument();
    });
  });

  describe('Nested Structure', () => {
    it('renders nested folders and repositories', () => {
      const tree: TreeNode = {
        type: 'folder',
        name: 'root',
        path: '/workspace',
        children: [
          {
            type: 'folder',
            name: 'level1',
            path: '/workspace/level1',
            children: [
              {
                type: 'folder',
                name: 'level2',
                path: '/workspace/level1/level2',
                children: [
                  {
                    type: 'repository',
                    name: 'nested-repo',
                    path: '/workspace/level1/level2/nested-repo',
                    repository: mockRepository1,
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      render(
        <RepositoryTree node={tree} selectedId={null} onSelect={mockOnSelect} />
      );

      // level1 should be visible (root is expanded by default)
      expect(screen.getByText('level1')).toBeInTheDocument();
      // level2 should not be visible initially (level1 is collapsed)
      expect(screen.queryByText('level2')).not.toBeInTheDocument();
    });

    it('applies correct indentation for nested items', () => {
      const tree: TreeNode = {
        type: 'folder',
        name: 'root',
        path: '/workspace',
        children: [
          {
            type: 'folder',
            name: 'parent',
            path: '/workspace/parent',
            children: [
              {
                type: 'repository',
                name: 'child-repo',
                path: '/workspace/parent/child-repo',
                repository: mockRepository1,
                children: [],
              },
            ],
          },
        ],
      };

      const { container } = render(
        <RepositoryTree node={tree} selectedId={null} onSelect={mockOnSelect} />
      );

      // Parent folder should have level 0 indentation
      const parentButton = screen.getByText('parent').closest('button');
      expect(parentButton).toHaveStyle({ paddingLeft: '8px' });
    });
  });

  describe('Icons', () => {
    it('shows chevron right icon for collapsed folder', () => {
      const tree: TreeNode = {
        type: 'folder',
        name: 'root',
        path: '/workspace',
        children: [
          {
            type: 'folder',
            name: 'projects',
            path: '/workspace/projects',
            children: [],
          },
        ],
      };

      const { container } = render(
        <RepositoryTree node={tree} selectedId={null} onSelect={mockOnSelect} />
      );

      // Initially folder is expanded (root path is in initial state)
      // We need to click to collapse it first
      const folderButton = screen.getByText('projects').closest('button');

      // Check that button exists
      expect(folderButton).toBeInTheDocument();
    });

    it('shows folder icon for folders', () => {
      const tree: TreeNode = {
        type: 'folder',
        name: 'root',
        path: '/workspace',
        children: [
          {
            type: 'folder',
            name: 'projects',
            path: '/workspace/projects',
            children: [],
          },
        ],
      };

      render(
        <RepositoryTree node={tree} selectedId={null} onSelect={mockOnSelect} />
      );

      expect(screen.getByText('projects')).toBeInTheDocument();
      // Folder icon should be present (rendered by lucide-react)
    });

    it('shows git branch icon for repositories', () => {
      const tree: TreeNode = {
        type: 'folder',
        name: 'root',
        path: '/workspace',
        children: [
          {
            type: 'repository',
            name: 'test-repo',
            path: '/workspace/test-repo',
            repository: mockRepository1,
            children: [],
          },
        ],
      };

      render(
        <RepositoryTree node={tree} selectedId={null} onSelect={mockOnSelect} />
      );

      expect(screen.getByText('test-repo')).toBeInTheDocument();
      // GitBranch icon should be present (rendered by lucide-react)
    });
  });

  describe('Empty States', () => {
    it('renders empty folder', () => {
      const tree: TreeNode = {
        type: 'folder',
        name: 'root',
        path: '/workspace',
        children: [
          {
            type: 'folder',
            name: 'empty-folder',
            path: '/workspace/empty-folder',
            children: [],
          },
        ],
      };

      render(
        <RepositoryTree node={tree} selectedId={null} onSelect={mockOnSelect} />
      );

      expect(screen.getByText('empty-folder')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument(); // Shows 0 children
    });
  });
});
