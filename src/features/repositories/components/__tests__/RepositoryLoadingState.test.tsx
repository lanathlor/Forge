import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RepositoryLoadingState } from '../RepositoryLoadingState';

describe('RepositoryLoadingState', () => {
  it('renders loading message', () => {
    render(<RepositoryLoadingState />);
    expect(screen.getByText('Scanning workspace...')).toBeInTheDocument();
  });

  it('renders within a Card component', () => {
    const { container } = render(<RepositoryLoadingState />);
    const card = container.querySelector('.p-6');
    expect(card).toBeInTheDocument();
  });

  it('applies correct text styling', () => {
    render(<RepositoryLoadingState />);
    const text = screen.getByText('Scanning workspace...');
    expect(text).toHaveClass('text-muted-foreground');
  });
});
