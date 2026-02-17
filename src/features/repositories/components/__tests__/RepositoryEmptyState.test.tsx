import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepositoryEmptyState } from '../RepositoryEmptyState';

describe('RepositoryEmptyState', () => {
  const mockOnRescan = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state message', () => {
    render(
      <RepositoryEmptyState onRescan={mockOnRescan} isRescanning={false} />
    );
    expect(
      screen.getByText('No git repositories found in workspace')
    ).toBeInTheDocument();
  });

  it('renders Rescan Workspace button when not rescanning', () => {
    render(
      <RepositoryEmptyState onRescan={mockOnRescan} isRescanning={false} />
    );
    expect(
      screen.getByRole('button', { name: 'Rescan Workspace' })
    ).toBeInTheDocument();
  });

  it('renders Rescanning... button when rescanning', () => {
    render(
      <RepositoryEmptyState onRescan={mockOnRescan} isRescanning={true} />
    );
    expect(
      screen.getByRole('button', { name: 'Rescanning...' })
    ).toBeInTheDocument();
  });

  it('calls onRescan when button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <RepositoryEmptyState onRescan={mockOnRescan} isRescanning={false} />
    );

    const button = screen.getByRole('button', { name: 'Rescan Workspace' });
    await user.click(button);

    expect(mockOnRescan).toHaveBeenCalledTimes(1);
  });

  it('disables button when rescanning', () => {
    render(
      <RepositoryEmptyState onRescan={mockOnRescan} isRescanning={true} />
    );

    const button = screen.getByRole('button', { name: 'Rescanning...' });
    expect(button).toBeDisabled();
  });

  it('enables button when not rescanning', () => {
    render(
      <RepositoryEmptyState onRescan={mockOnRescan} isRescanning={false} />
    );

    const button = screen.getByRole('button', { name: 'Rescan Workspace' });
    expect(button).not.toBeDisabled();
  });

  it('applies correct text styling', () => {
    render(
      <RepositoryEmptyState onRescan={mockOnRescan} isRescanning={false} />
    );
    const text = screen.getByText('No git repositories found in workspace');
    expect(text).toHaveClass('text-muted-foreground');
  });
});
