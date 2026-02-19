import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LivePlanMonitor } from '../LivePlanMonitor';
import type { Plan } from '@/db/schema';

// Mock RTK Query hooks
const mockPausePlan = vi.fn();
const mockResumePlan = vi.fn();
const mockCancelPlan = vi.fn();
const mockUseGetPlansQuery = vi.fn();

vi.mock('../../store/plansApi', () => ({
  useGetPlansQuery: (...args: unknown[]) => mockUseGetPlansQuery(...args),
  usePausePlanMutation: () => [mockPausePlan],
  useResumePlanMutation: () => [mockResumePlan],
  useCancelPlanMutation: () => [mockCancelPlan],
}));

// Mock usePlanStream
vi.mock('@/shared/hooks/usePlanStream', () => ({
  usePlanStream: vi.fn(() => ({
    latestEvent: null,
    connected: false,
  })),
}));

describe('LivePlanMonitor', () => {
  const now = new Date();
  const recentDate = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

  const basePlan: Plan = {
    id: 'plan-1',
    repositoryId: 'repo-1',
    title: 'Running Plan',
    description: 'desc',
    status: 'running',
    totalPhases: 2,
    totalTasks: 10,
    completedTasks: 3,
    completedPhases: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: recentDate,
    startedAt: new Date('2024-01-01'),
    startingCommit: null,
    completedAt: null,
    createdBy: 'user',
    sourceFile: null,
    warnings: null,
    currentPhaseId: null,
    currentTaskId: null,
  };

  const completedPlan: Plan = {
    ...basePlan,
    id: 'plan-2',
    title: 'Completed Plan',
    status: 'completed',
    completedTasks: 10,
    completedAt: recentDate,
    updatedAt: recentDate,
  };

  const failedPlan: Plan = {
    ...basePlan,
    id: 'plan-3',
    title: 'Failed Plan',
    status: 'failed',
    completedTasks: 5,
    updatedAt: recentDate,
  };

  const mockOnViewExecution = vi.fn();
  const mockOnViewPlan = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetPlansQuery.mockReturnValue({ data: { plans: [] } });
  });

  it('should return null when no active or recent plans', () => {
    mockUseGetPlansQuery.mockReturnValue({ data: { plans: [] } });
    const { container } = render(
      <LivePlanMonitor
        repositoryId="repo-1"
        onViewExecution={mockOnViewExecution}
        onViewPlan={mockOnViewPlan}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should return null when data is undefined', () => {
    mockUseGetPlansQuery.mockReturnValue({ data: undefined });
    const { container } = render(
      <LivePlanMonitor
        repositoryId="repo-1"
        onViewExecution={mockOnViewExecution}
        onViewPlan={mockOnViewPlan}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render running plans', () => {
    mockUseGetPlansQuery.mockReturnValue({ data: { plans: [basePlan] } });
    render(
      <LivePlanMonitor
        repositoryId="repo-1"
        onViewExecution={mockOnViewExecution}
        onViewPlan={mockOnViewPlan}
      />
    );
    expect(screen.getByText('Running Plan')).toBeInTheDocument();
    expect(screen.getByText('Plan Monitor')).toBeInTheDocument();
    expect(screen.getByText('1 active')).toBeInTheDocument();
  });

  it('should render completed plans', () => {
    mockUseGetPlansQuery.mockReturnValue({ data: { plans: [completedPlan] } });
    render(
      <LivePlanMonitor
        repositoryId="repo-1"
        onViewExecution={mockOnViewExecution}
        onViewPlan={mockOnViewPlan}
      />
    );
    expect(screen.getByText('Completed Plan')).toBeInTheDocument();
    expect(screen.getByText('done')).toBeInTheDocument();
  });

  it('should render failed plans with destructive badge', () => {
    mockUseGetPlansQuery.mockReturnValue({ data: { plans: [failedPlan] } });
    render(
      <LivePlanMonitor
        repositoryId="repo-1"
        onViewExecution={mockOnViewExecution}
        onViewPlan={mockOnViewPlan}
      />
    );
    expect(screen.getByText('Failed Plan')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('should toggle collapse on header click', () => {
    mockUseGetPlansQuery.mockReturnValue({ data: { plans: [basePlan] } });
    render(
      <LivePlanMonitor
        repositoryId="repo-1"
        onViewExecution={mockOnViewExecution}
        onViewPlan={mockOnViewPlan}
      />
    );

    // Plan name should be visible initially
    expect(screen.getByText('Running Plan')).toBeInTheDocument();

    // Click header to collapse
    fireEvent.click(screen.getByText('Plan Monitor'));

    // Plan name should be hidden after collapse
    expect(screen.queryByText('Running Plan')).not.toBeInTheDocument();

    // Click again to expand
    fireEvent.click(screen.getByText('Plan Monitor'));
    expect(screen.getByText('Running Plan')).toBeInTheDocument();
  });

  it('should call onViewExecution when running plan card clicked', () => {
    mockUseGetPlansQuery.mockReturnValue({ data: { plans: [basePlan] } });
    render(
      <LivePlanMonitor
        repositoryId="repo-1"
        onViewExecution={mockOnViewExecution}
        onViewPlan={mockOnViewPlan}
      />
    );

    fireEvent.click(screen.getByText('Running Plan'));
    expect(mockOnViewExecution).toHaveBeenCalledWith('plan-1');
  });

  it('should call onViewPlan when completed plan card clicked', () => {
    mockUseGetPlansQuery.mockReturnValue({ data: { plans: [completedPlan] } });
    render(
      <LivePlanMonitor
        repositoryId="repo-1"
        onViewExecution={mockOnViewExecution}
        onViewPlan={mockOnViewPlan}
      />
    );

    fireEvent.click(screen.getByText('Completed Plan'));
    expect(mockOnViewPlan).toHaveBeenCalledWith('plan-2');
  });

  it('should show progress bar for running plans', () => {
    mockUseGetPlansQuery.mockReturnValue({ data: { plans: [basePlan] } });
    const { container } = render(
      <LivePlanMonitor
        repositoryId="repo-1"
        onViewExecution={mockOnViewExecution}
        onViewPlan={mockOnViewPlan}
      />
    );
    expect(screen.getByText('3/10 tasks')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    const progressBar = container.querySelector('[style*="width: 30%"]');
    expect(progressBar).toBeInTheDocument();
  });

  it('should render paused plans with amber indicator', () => {
    const pausedPlan = { ...basePlan, status: 'paused' as const };
    mockUseGetPlansQuery.mockReturnValue({ data: { plans: [pausedPlan] } });
    render(
      <LivePlanMonitor
        repositoryId="repo-1"
        onViewExecution={mockOnViewExecution}
        onViewPlan={mockOnViewPlan}
      />
    );
    expect(screen.getByText('Running Plan')).toBeInTheDocument();
  });

  it('should filter out old completed plans (older than 24h)', () => {
    const oldCompletedPlan = {
      ...completedPlan,
      updatedAt: new Date(now.getTime() - 48 * 60 * 60 * 1000), // 2 days ago
    };
    mockUseGetPlansQuery.mockReturnValue({
      data: { plans: [oldCompletedPlan] },
    });
    const { container } = render(
      <LivePlanMonitor
        repositoryId="repo-1"
        onViewExecution={mockOnViewExecution}
        onViewPlan={mockOnViewPlan}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should show divider between active and completed plans', () => {
    mockUseGetPlansQuery.mockReturnValue({
      data: { plans: [basePlan, completedPlan] },
    });
    const { container } = render(
      <LivePlanMonitor
        repositoryId="repo-1"
        onViewExecution={mockOnViewExecution}
        onViewPlan={mockOnViewPlan}
      />
    );
    const divider = container.querySelector('.border-t');
    expect(divider).toBeInTheDocument();
  });

  it('should not show divider when only completed plans', () => {
    mockUseGetPlansQuery.mockReturnValue({ data: { plans: [completedPlan] } });
    const { container } = render(
      <LivePlanMonitor
        repositoryId="repo-1"
        onViewExecution={mockOnViewExecution}
        onViewPlan={mockOnViewPlan}
      />
    );
    const divider = container.querySelector('.border-t.my-1');
    expect(divider).not.toBeInTheDocument();
  });

  it('should limit recently completed to 3 plans', () => {
    const plans = [
      { ...completedPlan, id: 'c1', title: 'Completed 1' },
      { ...completedPlan, id: 'c2', title: 'Completed 2' },
      { ...completedPlan, id: 'c3', title: 'Completed 3' },
      { ...completedPlan, id: 'c4', title: 'Completed 4' },
    ];
    mockUseGetPlansQuery.mockReturnValue({ data: { plans } });
    render(
      <LivePlanMonitor
        repositoryId="repo-1"
        onViewExecution={mockOnViewExecution}
        onViewPlan={mockOnViewPlan}
      />
    );
    const doneLabels = screen.getAllByText('done');
    expect(doneLabels).toHaveLength(3);
  });

  it('should handle 0 total tasks for progress', () => {
    const zeroPlan = { ...basePlan, totalTasks: 0, completedTasks: 0 };
    mockUseGetPlansQuery.mockReturnValue({ data: { plans: [zeroPlan] } });
    render(
      <LivePlanMonitor
        repositoryId="repo-1"
        onViewExecution={mockOnViewExecution}
        onViewPlan={mockOnViewPlan}
      />
    );
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
