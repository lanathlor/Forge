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
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('renders Try Again button even when rescanning', () => {
    render(
      <RepositoryErrorState onRescan={mockOnRescan} isRescanning={true} />
    );
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('calls onRescan when button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <RepositoryErrorState onRescan={mockOnRescan} isRescanning={false} />
    );

    const button = screen.getByRole('button', { name: /try again/i });
    await user.click(button);

    expect(mockOnRescan).toHaveBeenCalledTimes(1);
  });

  it('renders button when rescanning', () => {
    render(
      <RepositoryErrorState onRescan={mockOnRescan} isRescanning={true} />
    );

    const button = screen.getByRole('button', { name: /try again/i });
    expect(button).toBeInTheDocument();
  });

  it('enables button when not rescanning', () => {
    render(
      <RepositoryErrorState onRescan={mockOnRescan} isRescanning={false} />
    );

    const button = screen.getByRole('button', { name: /try again/i });
    expect(button).not.toBeDisabled();
  });
});
