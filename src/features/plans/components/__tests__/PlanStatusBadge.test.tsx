import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlanStatusBadge } from '../PlanStatusBadge';

describe('PlanStatusBadge', () => {
  it('should render draft status', () => {
    render(<PlanStatusBadge status="draft" />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('should render ready status', () => {
    render(<PlanStatusBadge status="ready" />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('should render running status', () => {
    render(<PlanStatusBadge status="running" />);
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('should render paused status', () => {
    render(<PlanStatusBadge status="paused" />);
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('should render completed status', () => {
    render(<PlanStatusBadge status="completed" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('should render failed status', () => {
    render(<PlanStatusBadge status="failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});
