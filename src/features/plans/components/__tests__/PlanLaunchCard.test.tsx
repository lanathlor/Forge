import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanLaunchCard } from '../PlanLaunchCard';
import type { Plan } from '@/db/schema';

vi.mock('@/shared/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    formatRelativeTime: vi.fn(() => '5 minutes ago'),
  };
});

describe('PlanLaunchCard', () => {
  const basePlan: Plan = {
    id: 'plan-1',
    repositoryId: 'repo-1',
    title: 'Test Plan',
    description: 'A test plan description',
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
    warnings: null,
    currentPhaseId: null,
    currentTaskId: null,
  };

  const mockOnLaunch = vi.fn();
  const mockOnView = vi.fn();
  const mockOnResume = vi.fn();
  const mockOnPause = vi.fn();

  it('should render plan title and description', () => {
    render(
      <PlanLaunchCard
        plan={basePlan}
        onLaunch={mockOnLaunch}
        onView={mockOnView}
      />
    );
    expect(screen.getByText('Test Plan')).toBeInTheDocument();
    expect(screen.getByText('A test plan description')).toBeInTheDocument();
  });

  it('should show Launch Plan button for draft plans', () => {
    render(
      <PlanLaunchCard
        plan={basePlan}
        onLaunch={mockOnLaunch}
        onView={mockOnView}
      />
    );
    expect(screen.getByText('Launch Plan')).toBeInTheDocument();
  });

  it('should show Launch Plan button for ready plans', () => {
    render(
      <PlanLaunchCard
        plan={{ ...basePlan, status: 'ready' }}
        onLaunch={mockOnLaunch}
        onView={mockOnView}
      />
    );
    expect(screen.getByText('Launch Plan')).toBeInTheDocument();
  });

  it('should call onLaunch when Launch button clicked', () => {
    render(
      <PlanLaunchCard
        plan={basePlan}
        onLaunch={mockOnLaunch}
        onView={mockOnView}
      />
    );
    fireEvent.click(screen.getByText('Launch Plan'));
    expect(mockOnLaunch).toHaveBeenCalledWith('plan-1');
  });

  it('should show Pause button for running plans', () => {
    render(
      <PlanLaunchCard
        plan={{ ...basePlan, status: 'running' }}
        onLaunch={mockOnLaunch}
        onView={mockOnView}
        onPause={mockOnPause}
      />
    );
    expect(screen.getByText('Pause')).toBeInTheDocument();
  });

  it('should call onPause when Pause clicked', () => {
    render(
      <PlanLaunchCard
        plan={{ ...basePlan, status: 'running' }}
        onLaunch={mockOnLaunch}
        onView={mockOnView}
        onPause={mockOnPause}
      />
    );
    fireEvent.click(screen.getByText('Pause'));
    expect(mockOnPause).toHaveBeenCalledWith('plan-1');
  });

  it('should show Resume button for paused plans', () => {
    render(
      <PlanLaunchCard
        plan={{ ...basePlan, status: 'paused' }}
        onLaunch={mockOnLaunch}
        onView={mockOnView}
        onResume={mockOnResume}
      />
    );
    expect(screen.getByText('Resume')).toBeInTheDocument();
  });

  it('should call onResume when Resume clicked', () => {
    render(
      <PlanLaunchCard
        plan={{ ...basePlan, status: 'paused' }}
        onLaunch={mockOnLaunch}
        onView={mockOnView}
        onResume={mockOnResume}
      />
    );
    fireEvent.click(screen.getByText('Resume'));
    expect(mockOnResume).toHaveBeenCalledWith('plan-1');
  });

  it('should show View Details button for completed plans', () => {
    render(
      <PlanLaunchCard
        plan={{ ...basePlan, status: 'completed', completedTasks: 5 }}
        onLaunch={mockOnLaunch}
        onView={mockOnView}
      />
    );
    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('should show View Details for running plans without onPause', () => {
    render(
      <PlanLaunchCard
        plan={{ ...basePlan, status: 'running' }}
        onLaunch={mockOnLaunch}
        onView={mockOnView}
      />
    );
    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('should show View Details for paused plans without onResume', () => {
    render(
      <PlanLaunchCard
        plan={{ ...basePlan, status: 'paused' }}
        onLaunch={mockOnLaunch}
        onView={mockOnView}
      />
    );
    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('should call onView when View Details clicked', () => {
    render(
      <PlanLaunchCard
        plan={{ ...basePlan, status: 'completed', completedTasks: 5 }}
        onLaunch={mockOnLaunch}
        onView={mockOnView}
      />
    );
    fireEvent.click(screen.getByText('View Details'));
    expect(mockOnView).toHaveBeenCalledWith('plan-1');
  });

  it('should render progress bar when tasks exist', () => {
    const { container } = render(
      <PlanLaunchCard
        plan={{ ...basePlan, totalTasks: 10, completedTasks: 5 }}
        onLaunch={mockOnLaunch}
        onView={mockOnView}
      />
    );
    const progressBar = container.querySelector('[style*="width: 50%"]');
    expect(progressBar).toBeInTheDocument();
  });

  it('should not render progress bar when no tasks', () => {
    const { container } = render(
      <PlanLaunchCard
        plan={{ ...basePlan, totalTasks: 0, completedTasks: 0 }}
        onLaunch={mockOnLaunch}
        onView={mockOnView}
      />
    );
    const progressBar = container.querySelector('.bg-secondary.rounded-full');
    expect(progressBar).not.toBeInTheDocument();
  });

  it('should show stats (phases and tasks)', () => {
    render(
      <PlanLaunchCard
        plan={basePlan}
        onLaunch={mockOnLaunch}
        onView={mockOnView}
      />
    );
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('0/5')).toBeInTheDocument();
  });

  it('should not render description when missing', () => {
    render(
      <PlanLaunchCard
        plan={{ ...basePlan, description: null }}
        onLaunch={mockOnLaunch}
        onView={mockOnView}
      />
    );
    expect(
      screen.queryByText('A test plan description')
    ).not.toBeInTheDocument();
  });

  it('should apply failed progress bar color', () => {
    const { container } = render(
      <PlanLaunchCard
        plan={{
          ...basePlan,
          status: 'failed',
          totalTasks: 10,
          completedTasks: 3,
        }}
        onLaunch={mockOnLaunch}
        onView={mockOnView}
      />
    );
    const bar = container.querySelector('.bg-red-500');
    expect(bar).toBeInTheDocument();
  });

  it('should apply completed progress bar color', () => {
    const { container } = render(
      <PlanLaunchCard
        plan={{
          ...basePlan,
          status: 'completed',
          totalTasks: 10,
          completedTasks: 10,
        }}
        onLaunch={mockOnLaunch}
        onView={mockOnView}
      />
    );
    const bar = container.querySelector('.bg-emerald-500');
    expect(bar).toBeInTheDocument();
  });

  it('should apply running progress bar color', () => {
    const { container } = render(
      <PlanLaunchCard
        plan={{
          ...basePlan,
          status: 'running',
          totalTasks: 10,
          completedTasks: 5,
        }}
        onLaunch={mockOnLaunch}
        onView={mockOnView}
        onPause={mockOnPause}
      />
    );
    const bar = container.querySelector('.bg-blue-500');
    expect(bar).toBeInTheDocument();
  });
});
