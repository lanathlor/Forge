import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RepositoryExpandedView } from '../RepositoryExpandedView';
import type { Repository } from '@/db/schema';
import type { TreeNode } from '../../lib/tree';

// Mock child components
vi.mock('../RepositoryHeader', () => ({
  RepositoryHeader: ({
    repoCount,
    isRescanning,
  }: {
    repoCount: number;
    isRescanning: boolean;
  }) => (
    <div data-testid="repository-header">
      Header: {repoCount} repos {isRescanning && '(rescanning)'}
    </div>
  ),
}));

vi.mock('../RepositoryTree', () => ({
  RepositoryTree: ({
    node,
    selectedId,
  }: {
    node: TreeNode;
    selectedId: string | null;
  }) => (
    <div data-testid="repository-tree">
      Tree: {node.name} (selected: {selectedId || 'none'})
    </div>
  ),
}));

describe('RepositoryExpandedView', () => {
  const mockOnSelect = vi.fn();
  const mockOnToggleCollapse = vi.fn();
  const mockOnRescan = vi.fn();

  const mockRepository: Repository = {
    id: 'repo-1',
    name: 'test-repo',
    path: '/path/to/repo',
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

  const mockTree: TreeNode = {
    type: 'folder',
    name: 'root',
    path: '/workspace',
    children: [
      {
        type: 'repository',
        name: 'test-repo',
        path: '/workspace/test-repo',
        repository: mockRepository,
        children: [],
      },
    ],
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders RepositoryHeader component', () => {
      render(
        <RepositoryExpandedView
          tree={mockTree}
          selectedId={null}
          repoCount={1}
          onSelect={mockOnSelect}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      expect(screen.getByTestId('repository-header')).toBeInTheDocument();
    });

    it('renders RepositoryTree component', () => {
      render(
        <RepositoryExpandedView
          tree={mockTree}
          selectedId={null}
          repoCount={1}
          onSelect={mockOnSelect}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      expect(screen.getByTestId('repository-tree')).toBeInTheDocument();
    });

    it('passes correct props to RepositoryHeader', () => {
      render(
        <RepositoryExpandedView
          tree={mockTree}
          selectedId={null}
          repoCount={5}
          onSelect={mockOnSelect}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      expect(screen.getByText(/Header: 5 repos/)).toBeInTheDocument();
    });

    it('passes rescanning state to RepositoryHeader', () => {
      render(
        <RepositoryExpandedView
          tree={mockTree}
          selectedId={null}
          repoCount={1}
          onSelect={mockOnSelect}
          onRescan={mockOnRescan}
          isRescanning={true}
        />
      );
      expect(screen.getByText(/\(rescanning\)/)).toBeInTheDocument();
    });

    it('passes correct props to RepositoryTree', () => {
      render(
        <RepositoryExpandedView
          tree={mockTree}
          selectedId="repo-1"
          repoCount={1}
          onSelect={mockOnSelect}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      expect(
        screen.getByText(/Tree: root \(selected: repo-1\)/)
      ).toBeInTheDocument();
    });

    it('passes null selectedId to RepositoryTree when none selected', () => {
      render(
        <RepositoryExpandedView
          tree={mockTree}
          selectedId={null}
          repoCount={1}
          onSelect={mockOnSelect}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      expect(
        screen.getByText(/Tree: root \(selected: none\)/)
      ).toBeInTheDocument();
    });
  });

  describe('Layout', () => {
    it('renders within a Card component with full height', () => {
      const { container } = render(
        <RepositoryExpandedView
          tree={mockTree}
          selectedId={null}
          repoCount={1}
          onSelect={mockOnSelect}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      const card = container.querySelector('.h-full.flex.flex-col');
      expect(card).toBeInTheDocument();
    });

    it('renders tree within scrollable container', () => {
      const { container } = render(
        <RepositoryExpandedView
          tree={mockTree}
          selectedId={null}
          repoCount={1}
          onSelect={mockOnSelect}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer).toBeInTheDocument();
    });

    it('applies flex-1 to make tree container fill available space', () => {
      const { container } = render(
        <RepositoryExpandedView
          tree={mockTree}
          selectedId={null}
          repoCount={1}
          onSelect={mockOnSelect}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      const treeContainer = container.querySelector('.flex-1.overflow-y-auto');
      expect(treeContainer).toBeInTheDocument();
    });
  });

  describe('Props Handling', () => {
    it('handles optional onToggleCollapse prop', () => {
      render(
        <RepositoryExpandedView
          tree={mockTree}
          selectedId={null}
          repoCount={1}
          onSelect={mockOnSelect}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      // Should render without errors
      expect(screen.getByTestId('repository-header')).toBeInTheDocument();
    });

    it('renders without onToggleCollapse prop', () => {
      render(
        <RepositoryExpandedView
          tree={mockTree}
          selectedId={null}
          repoCount={1}
          onSelect={mockOnSelect}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      // Should render without errors
      expect(screen.getByTestId('repository-header')).toBeInTheDocument();
    });
  });
});
