import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanCard } from '../PlanCard';
import type { Plan } from '@/db/schema';

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '5 minutes'),
}));

describe('PlanCard', () => {
  const mockPlan: Plan = {
    id: 'plan-1',
    repositoryId: 'repo-1',
    title: 'Test Plan',
    description: 'Test description',
    status: 'draft',
    totalPhases: 2,
    totalTasks: 5,
    completedTasks: 0,
    completedPhases: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    startedAt: null,
    startingCommit: null,
    completedAt: null,
    createdBy: 'user',
    sourceFile: null,
    currentPhaseId: null,
    currentTaskId: null,
  };

  const mockOnView = vi.fn();
  const mockOnExecute = vi.fn();
  const mockOnPause = vi.fn();
  const mockOnResume = vi.fn();
  const mockOnMarkReady = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render plan title and description', () => {
    render(<PlanCard plan={mockPlan} onView={mockOnView} />);

    expect(screen.getByText('Test Plan')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('should show "No description" when description is empty', () => {
    const planWithoutDesc = { ...mockPlan, description: null };
    render(<PlanCard plan={planWithoutDesc as any} onView={mockOnView} />);

    expect(screen.getByText('No description')).toBeInTheDocument();
  });

  it('should render phase and task counts', () => {
    render(<PlanCard plan={mockPlan} onView={mockOnView} />);

    expect(screen.getByText('2 phases')).toBeInTheDocument();
    expect(screen.getByText('5 tasks')).toBeInTheDocument();
    expect(screen.getByText('0/5 complete')).toBeInTheDocument();
  });

  it('should call onView when title is clicked', () => {
    render(<PlanCard plan={mockPlan} onView={mockOnView} />);

    fireEvent.click(screen.getByText('Test Plan'));
    expect(mockOnView).toHaveBeenCalledWith('plan-1');
  });

  it('should show "Mark as Ready" button for draft status', () => {
    render(
      <PlanCard
        plan={mockPlan}
        onView={mockOnView}
        onMarkReady={mockOnMarkReady}
      />
    );

    const button = screen.getByText('Mark as Ready');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(mockOnMarkReady).toHaveBeenCalledWith('plan-1');
  });

  it('should show "Execute Plan" button for ready status', () => {
    const readyPlan = { ...mockPlan, status: 'ready' as const };
    render(
      <PlanCard
        plan={readyPlan}
        onView={mockOnView}
        onExecute={mockOnExecute}
      />
    );

    const button = screen.getByText('Execute Plan');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(mockOnExecute).toHaveBeenCalledWith('plan-1');
  });

  it('should show "Pause" button for running status', () => {
    const runningPlan = { ...mockPlan, status: 'running' as const };
    render(
      <PlanCard
        plan={runningPlan}
        onView={mockOnView}
        onPause={mockOnPause}
      />
    );

    const button = screen.getByText('Pause');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(mockOnPause).toHaveBeenCalledWith('plan-1');
  });

  it('should show progress bar for running status', () => {
    const runningPlan = {
      ...mockPlan,
      status: 'running' as const,
      completedTasks: 2,
      totalTasks: 5,
    };
    render(<PlanCard plan={runningPlan} onView={mockOnView} />);

    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('should show "Resume" button for paused status', () => {
    const pausedPlan = { ...mockPlan, status: 'paused' as const };
    render(
      <PlanCard
        plan={pausedPlan}
        onView={mockOnView}
        onResume={mockOnResume}
      />
    );

    const button = screen.getByText('Resume');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(mockOnResume).toHaveBeenCalledWith('plan-1');
  });

  it('should show "View Details" button for completed status', () => {
    const completedPlan = { ...mockPlan, status: 'completed' as const };
    render(
      <PlanCard
        plan={completedPlan}
        onView={mockOnView}
      />
    );

    const button = screen.getByText('View Details');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(mockOnView).toHaveBeenCalledWith('plan-1');
  });

  it('should show "View Details" button for failed status', () => {
    const failedPlan = { ...mockPlan, status: 'failed' as const };
    render(
      <PlanCard
        plan={failedPlan}
        onView={mockOnView}
      />
    );

    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('should show "Delete" button when onDelete is provided', () => {
    render(
      <PlanCard
        plan={mockPlan}
        onView={mockOnView}
        onDelete={mockOnDelete}
      />
    );

    const button = screen.getByText('Delete');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(mockOnDelete).toHaveBeenCalledWith('plan-1');
  });

  it('should render status badge', () => {
    render(<PlanCard plan={mockPlan} onView={mockOnView} />);

    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('should show creation time', () => {
    render(<PlanCard plan={mockPlan} onView={mockOnView} />);

    expect(screen.getByText(/Created 5 minutes ago/)).toBeInTheDocument();
  });

  it('should handle 0 total tasks for progress calculation', () => {
    const emptyPlan = {
      ...mockPlan,
      status: 'running' as const,
      totalTasks: 0,
      completedTasks: 0,
    };
    render(<PlanCard plan={emptyPlan} onView={mockOnView} />);

    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
