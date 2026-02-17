import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepositoryCollapsedView } from '../RepositoryCollapsedView';

describe('RepositoryCollapsedView', () => {
  const mockOnToggleCollapse = vi.fn();
  const mockOnRescan = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Content Display', () => {
    it('displays repository count', () => {
      render(
        <RepositoryCollapsedView
          repoCount={5}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      expect(screen.getByText('5 repos')).toBeInTheDocument();
    });

    it('displays zero repositories', () => {
      render(
        <RepositoryCollapsedView
          repoCount={0}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      expect(screen.getByText('0 repos')).toBeInTheDocument();
    });

    it('displays large repository count', () => {
      render(
        <RepositoryCollapsedView
          repoCount={42}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      expect(screen.getByText('42 repos')).toBeInTheDocument();
    });

    it('rotates text 90 degrees', () => {
      render(
        <RepositoryCollapsedView
          repoCount={5}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      const text = screen.getByText('5 repos');
      expect(text).toHaveClass('rotate-90');
    });
  });

  describe('Expand Button', () => {
    it('renders expand button', () => {
      render(
        <RepositoryCollapsedView
          repoCount={5}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      const expandButton = screen.getByTitle('Expand sidebar');
      expect(expandButton).toBeInTheDocument();
    });

    it('calls onToggleCollapse when expand button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <RepositoryCollapsedView
          repoCount={5}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );

      const expandButton = screen.getByTitle('Expand sidebar');
      await user.click(expandButton);

      expect(mockOnToggleCollapse).toHaveBeenCalledTimes(1);
    });

    it('does not disable expand button when rescanning', () => {
      render(
        <RepositoryCollapsedView
          repoCount={5}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={true}
        />
      );

      const expandButton = screen.getByTitle('Expand sidebar');
      expect(expandButton).not.toBeDisabled();
    });
  });

  describe('Rescan Button', () => {
    it('renders rescan button', () => {
      render(
        <RepositoryCollapsedView
          repoCount={5}
          onToggleCollapse={mockOnToggleCollapse}
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
        <RepositoryCollapsedView
          repoCount={5}
          onToggleCollapse={mockOnToggleCollapse}
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
        <RepositoryCollapsedView
          repoCount={5}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={true}
        />
      );

      const rescanButton = screen.getByTitle('Rescan repositories');
      expect(rescanButton).toBeDisabled();
    });

    it('enables rescan button when not rescanning', () => {
      render(
        <RepositoryCollapsedView
          repoCount={5}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );

      const rescanButton = screen.getByTitle('Rescan repositories');
      expect(rescanButton).not.toBeDisabled();
    });

    it('shows spinning icon when rescanning', () => {
      const { container } = render(
        <RepositoryCollapsedView
          repoCount={5}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={true}
        />
      );

      const spinningIcon = container.querySelector('.animate-spin');
      expect(spinningIcon).toBeInTheDocument();
    });

    it('does not show spinning icon when not rescanning', () => {
      const { container } = render(
        <RepositoryCollapsedView
          repoCount={5}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );

      const spinningIcon = container.querySelector('.animate-spin');
      expect(spinningIcon).not.toBeInTheDocument();
    });
  });

  describe('Layout', () => {
    it('renders within a Card component', () => {
      const { container } = render(
        <RepositoryCollapsedView
          repoCount={5}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      const card = container.querySelector('.h-full.flex.flex-col');
      expect(card).toBeInTheDocument();
    });

    it('renders buttons in vertical layout', () => {
      const { container } = render(
        <RepositoryCollapsedView
          repoCount={5}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      const buttonContainer = container.querySelector(
        '.flex.flex-col.items-center'
      );
      expect(buttonContainer).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides accessible title for expand button', () => {
      render(
        <RepositoryCollapsedView
          repoCount={5}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      expect(screen.getByTitle('Expand sidebar')).toBeInTheDocument();
    });

    it('provides accessible title for rescan button', () => {
      render(
        <RepositoryCollapsedView
          repoCount={5}
          onToggleCollapse={mockOnToggleCollapse}
          onRescan={mockOnRescan}
          isRescanning={false}
        />
      );
      expect(screen.getByTitle('Rescan repositories')).toBeInTheDocument();
    });
  });
});
