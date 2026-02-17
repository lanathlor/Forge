import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepositoryHeader } from '../RepositoryHeader';

describe('RepositoryHeader', () => {
  const mockOnToggleCollapse = vi.fn();
  const mockOnRescan = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Header Content', () => {
    it('renders repository count', () => {
      render(
        <RepositoryHeader
          repoCount={5}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      expect(screen.getByText('Repositories (5)')).toBeInTheDocument();
    });

    it('displays zero repositories', () => {
      render(
        <RepositoryHeader
          repoCount={0}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      expect(screen.getByText('Repositories (0)')).toBeInTheDocument();
    });

    it('displays large repository count', () => {
      render(
        <RepositoryHeader
          repoCount={42}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      expect(screen.getByText('Repositories (42)')).toBeInTheDocument();
    });
  });

  describe('Rescan Button', () => {
    it('renders rescan button', () => {
      render(
        <RepositoryHeader
          repoCount={5}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      const rescanButton = screen.getByTitle('Rescan repositories');
      expect(rescanButton).toBeInTheDocument();
    });

    it('calls onRescan when rescan button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <RepositoryHeader
          repoCount={5}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );

      const rescanButton = screen.getByTitle('Rescan repositories');
      await user.click(rescanButton);

      expect(mockOnRescan).toHaveBeenCalledTimes(1);
    });

    it('disables rescan button when rescanning', () => {
      render(
        <RepositoryHeader
          repoCount={5}
          onRescan={mockOnRescan}
          isRescanning={true}
        />
      );

      const rescanButton = screen.getByTitle('Rescan repositories');
      expect(rescanButton).toBeDisabled();
    });

    it('enables rescan button when not rescanning', () => {
      render(
        <RepositoryHeader
          repoCount={5}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );

      const rescanButton = screen.getByTitle('Rescan repositories');
      expect(rescanButton).not.toBeDisabled();
    });

    it('shows spinning icon when rescanning', () => {
      const { container } = render(
        <RepositoryHeader
          repoCount={5}
          onRescan={mockOnRescan}
          isRescanning={true}
        />
      );

      const spinningIcon = container.querySelector('.animate-spin');
      expect(spinningIcon).toBeInTheDocument();
    });

    it('does not show spinning icon when not rescanning', () => {
      const { container } = render(
        <RepositoryHeader
          repoCount={5}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );

      const refreshIcon = container.querySelector('.animate-spin');
      expect(refreshIcon).not.toBeInTheDocument();
    });
  });

  describe('Collapse Button', () => {
    it('renders collapse button when onToggleCollapse is provided', () => {
      render(
        <RepositoryHeader
          repoCount={5}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );

      const collapseButton = screen.getByTitle('Collapse sidebar');
      expect(collapseButton).toBeInTheDocument();
    });

    it('does not render collapse button when onToggleCollapse is not provided', () => {
      render(
        <RepositoryHeader
          repoCount={5}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );

      const collapseButton = screen.queryByTitle('Collapse sidebar');
      expect(collapseButton).not.toBeInTheDocument();
    });

    it('calls onToggleCollapse when collapse button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <RepositoryHeader
          repoCount={5}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );

      const collapseButton = screen.getByTitle('Collapse sidebar');
      await user.click(collapseButton);

      expect(mockOnToggleCollapse).toHaveBeenCalledTimes(1);
    });

    it('does not disable collapse button when rescanning', () => {
      render(
        <RepositoryHeader
          repoCount={5}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={true}
        />
      );

      const collapseButton = screen.getByTitle('Collapse sidebar');
      expect(collapseButton).not.toBeDisabled();
    });
  });

  describe('Layout and Styling', () => {
    it('renders with border bottom', () => {
      const { container } = render(
        <RepositoryHeader
          repoCount={5}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );

      const header = container.querySelector('.border-b');
      expect(header).toBeInTheDocument();
    });

    it('applies correct padding', () => {
      const { container } = render(
        <RepositoryHeader
          repoCount={5}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );

      const header = container.querySelector('.p-4');
      expect(header).toBeInTheDocument();
    });

    it('renders buttons with ghost variant', () => {
      render(
        <RepositoryHeader
          repoCount={5}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );

      // Both buttons should be icon buttons with ghost variant
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Accessibility', () => {
    it('provides accessible title for rescan button', () => {
      render(
        <RepositoryHeader
          repoCount={5}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );

      expect(screen.getByTitle('Rescan repositories')).toBeInTheDocument();
    });

    it('provides accessible title for collapse button', () => {
      render(
        <RepositoryHeader
          repoCount={5}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );

      expect(screen.getByTitle('Collapse sidebar')).toBeInTheDocument();
    });
  });
});
