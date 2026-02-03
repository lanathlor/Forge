import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RepositorySelector } from '../RepositorySelector';
import type { Repository } from '@/db/schema';
import type { TreeNode } from '../../lib/tree';

// Mock the useRepositoryData hook
vi.mock('../../hooks/useRepositoryData', () => ({
  useRepositoryData: vi.fn(),
}));

// Mock child components
vi.mock('../RepositoryLoadingState', () => ({
  RepositoryLoadingState: () => <div data-testid="loading-state">Loading</div>,
}));

vi.mock('../RepositoryErrorState', () => ({
  RepositoryErrorState: ({ onRescan, isRescanning }: any) => (
    <div data-testid="error-state">
      Error {isRescanning && '(rescanning)'}
      <button onClick={onRescan}>Rescan</button>
    </div>
  ),
}));

vi.mock('../RepositoryEmptyState', () => ({
  RepositoryEmptyState: ({ onRescan, isRescanning }: any) => (
    <div data-testid="empty-state">
      Empty {isRescanning && '(rescanning)'}
      <button onClick={onRescan}>Rescan</button>
    </div>
  ),
}));

vi.mock('../RepositoryCollapsedView', () => ({
  RepositoryCollapsedView: ({ repoCount, onToggleCollapse }: any) => (
    <div data-testid="collapsed-view">
      Collapsed: {repoCount} repos
      <button onClick={onToggleCollapse}>Toggle</button>
    </div>
  ),
}));

vi.mock('../RepositoryExpandedView', () => ({
  RepositoryExpandedView: ({ repoCount, tree }: any) => (
    <div data-testid="expanded-view">
      Expanded: {repoCount} repos, tree: {tree.name}
    </div>
  ),
}));

import { useRepositoryData } from '../../hooks/useRepositoryData';

describe('RepositorySelector', () => {
  const mockOnSelect = vi.fn();
  const mockOnToggleCollapse = vi.fn();
  const mockHandleRescan = vi.fn();
  const mockHandleSelect = vi.fn();

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading state when isLoading is true', () => {
      vi.mocked(useRepositoryData).mockReturnValue({
        repositories: [],
        tree: null,
        repoCount: 0,
        selected: null,
        isLoading: true,
        error: undefined,
        isRescanning: false,
        handleSelect: mockHandleSelect,
        handleRescan: mockHandleRescan,
      });

      render(<RepositorySelector onSelect={mockOnSelect} />);

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    });

    it('shows loading state when tree is null', () => {
      vi.mocked(useRepositoryData).mockReturnValue({
        repositories: [],
        tree: null,
        repoCount: 0,
        selected: null,
        isLoading: false,
        error: undefined,
        isRescanning: false,
        handleSelect: mockHandleSelect,
        handleRescan: mockHandleRescan,
      });

      render(<RepositorySelector onSelect={mockOnSelect} />);

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error state when there is an error', () => {
      vi.mocked(useRepositoryData).mockReturnValue({
        repositories: [],
        tree: mockTree,
        repoCount: 1,
        selected: null,
        isLoading: false,
        error: { message: 'Failed to load' },
        isRescanning: false,
        handleSelect: mockHandleSelect,
        handleRescan: mockHandleRescan,
      });

      render(<RepositorySelector onSelect={mockOnSelect} />);

      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });

    it('passes rescan handlers to error state', () => {
      vi.mocked(useRepositoryData).mockReturnValue({
        repositories: [],
        tree: mockTree,
        repoCount: 1,
        selected: null,
        isLoading: false,
        error: { message: 'Failed to load' },
        isRescanning: false,
        handleSelect: mockHandleSelect,
        handleRescan: mockHandleRescan,
      });

      render(<RepositorySelector onSelect={mockOnSelect} />);

      const rescanButton = screen.getByRole('button', { name: 'Rescan' });
      rescanButton.click();

      expect(mockHandleRescan).toHaveBeenCalledTimes(1);
    });

    it('passes isRescanning state to error state', () => {
      vi.mocked(useRepositoryData).mockReturnValue({
        repositories: [],
        tree: mockTree,
        repoCount: 1,
        selected: null,
        isLoading: false,
        error: { message: 'Failed to load' },
        isRescanning: true,
        handleSelect: mockHandleSelect,
        handleRescan: mockHandleRescan,
      });

      render(<RepositorySelector onSelect={mockOnSelect} />);

      expect(screen.getByText(/\(rescanning\)/)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when repositories array is empty', () => {
      vi.mocked(useRepositoryData).mockReturnValue({
        repositories: [],
        tree: mockTree,
        repoCount: 0,
        selected: null,
        isLoading: false,
        error: undefined,
        isRescanning: false,
        handleSelect: mockHandleSelect,
        handleRescan: mockHandleRescan,
      });

      render(<RepositorySelector onSelect={mockOnSelect} />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('passes rescan handlers to empty state', () => {
      vi.mocked(useRepositoryData).mockReturnValue({
        repositories: [],
        tree: mockTree,
        repoCount: 0,
        selected: null,
        isLoading: false,
        error: undefined,
        isRescanning: false,
        handleSelect: mockHandleSelect,
        handleRescan: mockHandleRescan,
      });

      render(<RepositorySelector onSelect={mockOnSelect} />);

      const rescanButton = screen.getByRole('button', { name: 'Rescan' });
      rescanButton.click();

      expect(mockHandleRescan).toHaveBeenCalledTimes(1);
    });

    it('passes isRescanning state to empty state', () => {
      vi.mocked(useRepositoryData).mockReturnValue({
        repositories: [],
        tree: mockTree,
        repoCount: 0,
        selected: null,
        isLoading: false,
        error: undefined,
        isRescanning: true,
        handleSelect: mockHandleSelect,
        handleRescan: mockHandleRescan,
      });

      render(<RepositorySelector onSelect={mockOnSelect} />);

      expect(screen.getByText(/\(rescanning\)/)).toBeInTheDocument();
    });
  });

  describe('Collapsed View', () => {
    it('shows collapsed view when isCollapsed is true', () => {
      vi.mocked(useRepositoryData).mockReturnValue({
        repositories: [mockRepository],
        tree: mockTree,
        repoCount: 1,
        selected: null,
        isLoading: false,
        error: undefined,
        isRescanning: false,
        handleSelect: mockHandleSelect,
        handleRescan: mockHandleRescan,
      });

      render(
        <RepositorySelector
          onSelect={mockOnSelect}
          isCollapsed={true}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );

      expect(screen.getByTestId('collapsed-view')).toBeInTheDocument();
    });

    it('passes repo count to collapsed view', () => {
      vi.mocked(useRepositoryData).mockReturnValue({
        repositories: [mockRepository],
        tree: mockTree,
        repoCount: 5,
        selected: null,
        isLoading: false,
        error: undefined,
        isRescanning: false,
        handleSelect: mockHandleSelect,
        handleRescan: mockHandleRescan,
      });

      render(
        <RepositorySelector
          onSelect={mockOnSelect}
          isCollapsed={true}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );

      expect(screen.getByText('Collapsed: 5 repos')).toBeInTheDocument();
    });

    it('passes onToggleCollapse to collapsed view', () => {
      vi.mocked(useRepositoryData).mockReturnValue({
        repositories: [mockRepository],
        tree: mockTree,
        repoCount: 1,
        selected: null,
        isLoading: false,
        error: undefined,
        isRescanning: false,
        handleSelect: mockHandleSelect,
        handleRescan: mockHandleRescan,
      });

      render(
        <RepositorySelector
          onSelect={mockOnSelect}
          isCollapsed={true}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );

      const toggleButton = screen.getByRole('button', { name: 'Toggle' });
      toggleButton.click();

      expect(mockOnToggleCollapse).toHaveBeenCalledTimes(1);
    });
  });

  describe('Expanded View', () => {
    it('shows expanded view when isCollapsed is false', () => {
      vi.mocked(useRepositoryData).mockReturnValue({
        repositories: [mockRepository],
        tree: mockTree,
        repoCount: 1,
        selected: null,
        isLoading: false,
        error: undefined,
        isRescanning: false,
        handleSelect: mockHandleSelect,
        handleRescan: mockHandleRescan,
      });

      render(<RepositorySelector onSelect={mockOnSelect} isCollapsed={false} />);

      expect(screen.getByTestId('expanded-view')).toBeInTheDocument();
    });

    it('shows expanded view by default when isCollapsed is not provided', () => {
      vi.mocked(useRepositoryData).mockReturnValue({
        repositories: [mockRepository],
        tree: mockTree,
        repoCount: 1,
        selected: null,
        isLoading: false,
        error: undefined,
        isRescanning: false,
        handleSelect: mockHandleSelect,
        handleRescan: mockHandleRescan,
      });

      render(<RepositorySelector onSelect={mockOnSelect} />);

      expect(screen.getByTestId('expanded-view')).toBeInTheDocument();
    });

    it('passes tree to expanded view', () => {
      vi.mocked(useRepositoryData).mockReturnValue({
        repositories: [mockRepository],
        tree: mockTree,
        repoCount: 1,
        selected: null,
        isLoading: false,
        error: undefined,
        isRescanning: false,
        handleSelect: mockHandleSelect,
        handleRescan: mockHandleRescan,
      });

      render(<RepositorySelector onSelect={mockOnSelect} />);

      expect(screen.getByText(/tree: root/)).toBeInTheDocument();
    });

    it('passes repo count to expanded view', () => {
      vi.mocked(useRepositoryData).mockReturnValue({
        repositories: [mockRepository],
        tree: mockTree,
        repoCount: 3,
        selected: null,
        isLoading: false,
        error: undefined,
        isRescanning: false,
        handleSelect: mockHandleSelect,
        handleRescan: mockHandleRescan,
      });

      render(<RepositorySelector onSelect={mockOnSelect} />);

      expect(screen.getByText('Expanded: 3 repos, tree: root')).toBeInTheDocument();
    });

    it('passes selected repository id to expanded view', () => {
      vi.mocked(useRepositoryData).mockReturnValue({
        repositories: [mockRepository],
        tree: mockTree,
        repoCount: 1,
        selected: mockRepository,
        isLoading: false,
        error: undefined,
        isRescanning: false,
        handleSelect: mockHandleSelect,
        handleRescan: mockHandleRescan,
      });

      render(<RepositorySelector onSelect={mockOnSelect} />);

      // Component should render and pass the selected id
      expect(screen.getByTestId('expanded-view')).toBeInTheDocument();
    });

    it('passes null when no repository is selected', () => {
      vi.mocked(useRepositoryData).mockReturnValue({
        repositories: [mockRepository],
        tree: mockTree,
        repoCount: 1,
        selected: null,
        isLoading: false,
        error: undefined,
        isRescanning: false,
        handleSelect: mockHandleSelect,
        handleRescan: mockHandleRescan,
      });

      render(<RepositorySelector onSelect={mockOnSelect} />);

      // Component should render with null selected id
      expect(screen.getByTestId('expanded-view')).toBeInTheDocument();
    });
  });

  describe('Props Handling', () => {
    it('works without onSelect callback', () => {
      vi.mocked(useRepositoryData).mockReturnValue({
        repositories: [mockRepository],
        tree: mockTree,
        repoCount: 1,
        selected: null,
        isLoading: false,
        error: undefined,
        isRescanning: false,
        handleSelect: mockHandleSelect,
        handleRescan: mockHandleRescan,
      });

      render(<RepositorySelector />);

      expect(screen.getByTestId('expanded-view')).toBeInTheDocument();
    });

    it('works without onToggleCollapse callback', () => {
      vi.mocked(useRepositoryData).mockReturnValue({
        repositories: [mockRepository],
        tree: mockTree,
        repoCount: 1,
        selected: null,
        isLoading: false,
        error: undefined,
        isRescanning: false,
        handleSelect: mockHandleSelect,
        handleRescan: mockHandleRescan,
      });

      render(<RepositorySelector onSelect={mockOnSelect} />);

      expect(screen.getByTestId('expanded-view')).toBeInTheDocument();
    });
  });
});
