import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RepositorySelector } from '../RepositorySelector';
import type { Repository } from '@/db/schema';

// Mock the useRepositoryData hook
vi.mock('../../hooks/useRepositoryData', () => ({
  useRepositoryData: vi.fn(),
}));

// Mock useMultiRepoStream
vi.mock('@/shared/hooks/useMultiRepoStream', () => ({
  useMultiRepoStream: vi.fn(() => ({
    repositories: [],
    connected: true,
    error: null,
    reconnect: vi.fn(),
    lastUpdated: null,
  })),
}));

// Mock useStuckDetection
vi.mock('@/shared/hooks/useStuckDetection', () => ({
  useStuckDetection: vi.fn(() => ({
    status: { totalStuckCount: 0, alerts: [] },
    connected: true,
    error: null,
    reconnect: vi.fn(),
    acknowledgeAlert: vi.fn(),
    getAlertForRepo: vi.fn(() => null),
  })),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Search: (props: Record<string, unknown>) => (
    <svg data-testid="search-icon" {...props} />
  ),
  Zap: (props: Record<string, unknown>) => (
    <svg data-testid="zap-icon" {...props} />
  ),
  Clock: (props: Record<string, unknown>) => (
    <svg data-testid="clock-icon" {...props} />
  ),
  AlertTriangle: (props: Record<string, unknown>) => (
    <svg data-testid="alert-icon" {...props} />
  ),
  Circle: (props: Record<string, unknown>) => (
    <svg data-testid="circle-icon" {...props} />
  ),
  Pause: (props: Record<string, unknown>) => (
    <svg data-testid="pause-icon" {...props} />
  ),
  GitBranch: (props: Record<string, unknown>) => (
    <svg data-testid="git-branch-icon" {...props} />
  ),
  ChevronRight: (props: Record<string, unknown>) => (
    <svg data-testid="chevron-right-icon" {...props} />
  ),
  Command: (props: Record<string, unknown>) => (
    <svg data-testid="command-icon" {...props} />
  ),
  RefreshCw: (props: Record<string, unknown>) => (
    <svg data-testid="refresh-icon" {...props} />
  ),
  Activity: (props: Record<string, unknown>) => (
    <svg data-testid="activity-icon" {...props} />
  ),
}));

import { useRepositoryData } from '../../hooks/useRepositoryData';
import { useMultiRepoStream } from '@/shared/hooks/useMultiRepoStream';

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

  const mockRepository2: Repository = {
    ...mockRepository,
    id: 'repo-2',
    name: 'another-repo',
    path: '/path/to/another-repo',
  };

  function setupMockData(
    overrides: Partial<ReturnType<typeof useRepositoryData>> = {}
  ) {
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
      ...overrides,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setupMockData();
  });

  describe('Loading State', () => {
    it('shows loading state when isLoading is true', () => {
      setupMockData({ isLoading: true });
      const { container } = render(<RepositorySelector onSelect={mockOnSelect} />);
      // Loading state renders skeleton shimmer elements
      const skeletons = container.querySelectorAll('.animate-skeleton-shimmer');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Error State', () => {
    it('shows error state when there is an error', () => {
      setupMockData({ error: { message: 'Failed to load' } });
      render(<RepositorySelector onSelect={mockOnSelect} />);
      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });

    it('shows retry button on error', () => {
      setupMockData({ error: { message: 'Failed to load' } });
      render(<RepositorySelector onSelect={mockOnSelect} />);
      const retryButton = screen.getByText('Retry');
      retryButton.click();
      expect(mockHandleRescan).toHaveBeenCalledTimes(1);
    });

    it('shows scanning state on retry button', () => {
      setupMockData({ error: { message: 'Failed' }, isRescanning: true });
      render(<RepositorySelector onSelect={mockOnSelect} />);
      expect(screen.getByText('Scanning...')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when repositories array is empty', () => {
      setupMockData({ repositories: [] });
      render(<RepositorySelector onSelect={mockOnSelect} />);
      expect(screen.getByText('No repositories found')).toBeInTheDocument();
    });

    it('shows scan button on empty state', () => {
      setupMockData({ repositories: [] });
      render(<RepositorySelector onSelect={mockOnSelect} />);
      const scanButton = screen.getByText('Scan for repos');
      scanButton.click();
      expect(mockHandleRescan).toHaveBeenCalledTimes(1);
    });
  });

  describe('Collapsed View', () => {
    it('shows collapsed view when isCollapsed is true', () => {
      setupMockData({ repositories: [mockRepository] });
      render(
        <RepositorySelector
          onSelect={mockOnSelect}
          isCollapsed={true}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      expect(screen.getByText('1 repos')).toBeInTheDocument();
    });

    it('has expand button in collapsed view', () => {
      setupMockData({ repositories: [mockRepository] });
      render(
        <RepositorySelector
          onSelect={mockOnSelect}
          isCollapsed={true}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      const expandButton = screen.getByTitle('Expand repository selector');
      expandButton.click();
      expect(mockOnToggleCollapse).toHaveBeenCalledTimes(1);
    });
  });

  describe('Expanded View', () => {
    it('shows repository list when repos exist', () => {
      setupMockData({ repositories: [mockRepository, mockRepository2] });
      render(<RepositorySelector onSelect={mockOnSelect} />);
      expect(screen.getByText('Repositories')).toBeInTheDocument();
      expect(screen.getByText('test-repo')).toBeInTheDocument();
      expect(screen.getByText('another-repo')).toBeInTheDocument();
    });

    it('shows repo count', () => {
      setupMockData({ repositories: [mockRepository, mockRepository2] });
      render(<RepositorySelector onSelect={mockOnSelect} />);
      // Repo count is shown next to "Repositories" header
      expect(screen.getByText('Repositories')).toBeInTheDocument();
      // Both repos are displayed
      expect(screen.getByText('test-repo')).toBeInTheDocument();
      expect(screen.getByText('another-repo')).toBeInTheDocument();
    });

    it('has search input', () => {
      setupMockData({ repositories: [mockRepository] });
      render(<RepositorySelector onSelect={mockOnSelect} />);
      expect(
        screen.getByPlaceholderText('Search repos...')
      ).toBeInTheDocument();
    });

    it('filters repos on search', () => {
      setupMockData({ repositories: [mockRepository, mockRepository2] });
      render(<RepositorySelector onSelect={mockOnSelect} />);
      const searchInput = screen.getByPlaceholderText('Search repos...');
      fireEvent.change(searchInput, { target: { value: 'another' } });
      expect(screen.getByText('another-repo')).toBeInTheDocument();
      expect(screen.queryByText('test-repo')).not.toBeInTheDocument();
    });

    it('shows no results message when search matches nothing', () => {
      setupMockData({ repositories: [mockRepository] });
      render(<RepositorySelector onSelect={mockOnSelect} />);
      const searchInput = screen.getByPlaceholderText('Search repos...');
      fireEvent.change(searchInput, { target: { value: 'zzzzz' } });
      expect(screen.getByText(/No repos match/)).toBeInTheDocument();
    });

    it('calls onSelect when clicking a repo', () => {
      setupMockData({ repositories: [mockRepository] });
      render(<RepositorySelector onSelect={mockOnSelect} />);
      const repoButton = screen.getByText('test-repo');
      repoButton.click();
      expect(mockOnSelect).toHaveBeenCalledWith(mockRepository);
    });
  });

  describe('Active Work Section', () => {
    it('shows active work section when repos have active sessions', () => {
      setupMockData({ repositories: [mockRepository] });
      vi.mocked(useMultiRepoStream).mockReturnValue({
        repositories: [
          {
            repositoryId: 'repo-1',
            repositoryName: 'test-repo',
            sessionId: 'session-1',
            sessionStatus: 'active',
            claudeStatus: 'writing',
            currentTask: null,
            timeElapsed: 100,
            lastActivity: new Date().toISOString(),
            needsAttention: false,
          },
        ],
        connected: true,
        error: null,
        reconnect: vi.fn(),
        lastUpdated: null,
      });
      render(<RepositorySelector onSelect={mockOnSelect} />);
      expect(screen.getByText('Active Work')).toBeInTheDocument();
    });
  });

  describe('Props Handling', () => {
    it('works without onSelect callback', () => {
      setupMockData({ repositories: [mockRepository] });
      render(<RepositorySelector />);
      expect(screen.getByText('test-repo')).toBeInTheDocument();
    });

    it('works without onToggleCollapse callback', () => {
      setupMockData({ repositories: [mockRepository] });
      render(<RepositorySelector onSelect={mockOnSelect} />);
      expect(screen.getByText('test-repo')).toBeInTheDocument();
    });

    it('has rescan button', () => {
      setupMockData({ repositories: [mockRepository] });
      render(<RepositorySelector onSelect={mockOnSelect} />);
      const rescanButton = screen.getByTitle('Rescan repositories');
      rescanButton.click();
      expect(mockHandleRescan).toHaveBeenCalledTimes(1);
    });
  });
});
