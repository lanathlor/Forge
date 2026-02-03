import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepositoryErrorState } from '../RepositoryErrorState';

describe('RepositoryErrorState', () => {
  const mockOnRescan = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders error message', () => {
    render(
      <RepositoryErrorState onRescan={mockOnRescan} isRescanning={false} />
    );
    expect(screen.getByText('Failed to load repositories')).toBeInTheDocument();
  });

  it('renders Try Again button when not rescanning', () => {
    render(
      <RepositoryErrorState onRescan={mockOnRescan} isRescanning={false} />
    );
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('renders Rescanning... button when rescanning', () => {
    render(
      <RepositoryErrorState onRescan={mockOnRescan} isRescanning={true} />
    );
    expect(screen.getByRole('button', { name: 'Rescanning...' })).toBeInTheDocument();
  });

  it('calls onRescan when button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <RepositoryErrorState onRescan={mockOnRescan} isRescanning={false} />
    );

    const button = screen.getByRole('button', { name: 'Try Again' });
    await user.click(button);

    expect(mockOnRescan).toHaveBeenCalledTimes(1);
  });

  it('disables button when rescanning', () => {
    render(
      <RepositoryErrorState onRescan={mockOnRescan} isRescanning={true} />
    );

    const button = screen.getByRole('button', { name: 'Rescanning...' });
    expect(button).toBeDisabled();
  });

  it('enables button when not rescanning', () => {
    render(
      <RepositoryErrorState onRescan={mockOnRescan} isRescanning={false} />
    );

    const button = screen.getByRole('button', { name: 'Try Again' });
    expect(button).not.toBeDisabled();
  });

  it('applies destructive styling to error message', () => {
    render(
      <RepositoryErrorState onRescan={mockOnRescan} isRescanning={false} />
    );
    const errorText = screen.getByText('Failed to load repositories');
    expect(errorText).toHaveClass('text-destructive');
  });
});
