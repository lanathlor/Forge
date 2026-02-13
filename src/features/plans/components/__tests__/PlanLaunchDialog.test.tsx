import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlanLaunchDialog } from '../PlanLaunchDialog';
import type { Plan } from '@/db/schema';

// Mock the preflight checks hook
const mockRerunChecks = vi.fn();
vi.mock('../../hooks/usePreflightChecks', () => ({
  usePreflightChecks: vi.fn(() => ({
    checks: [
      { id: 'repo', label: 'Repository accessible', status: 'pass', detail: 'my-repo' },
      { id: 'clean', label: 'Working tree clean', status: 'pass', detail: 'No uncommitted changes' },
      { id: 'gates', label: 'QA gates configured', status: 'pass', detail: '2 gates active' },
      { id: 'plan', label: 'Plan is ready', status: 'pass', detail: '5 tasks across 2 phases' },
    ],
    isReady: true,
    isChecking: false,
    rerunChecks: mockRerunChecks,
  })),
}));

// Mock the RTK Query mutations
const mockExecuteUnwrap = vi.fn();
const mockUpdateUnwrap = vi.fn();
vi.mock('../../store/plansApi', () => ({
  useExecutePlanMutation: vi.fn(() => [
    vi.fn(() => ({ unwrap: mockExecuteUnwrap })),
    { isLoading: false },
  ]),
  useUpdatePlanMutation: vi.fn(() => [
    vi.fn(() => ({ unwrap: mockUpdateUnwrap })),
    { isLoading: false },
  ]),
}));

describe('PlanLaunchDialog', () => {
  const basePlan: Plan = {
    id: 'plan-1',
    repositoryId: 'repo-1',
    title: 'Test Plan',
    description: 'Test description',
    status: 'ready',
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

  const mockOnOpenChange = vi.fn();
  const mockOnLaunched = vi.fn();
  const mockOnLaunchAndSwitch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteUnwrap.mockResolvedValue({});
    mockUpdateUnwrap.mockResolvedValue({});
  });

  it('should render dialog with plan title', () => {
    render(
      <PlanLaunchDialog
        plan={basePlan}
        repositoryId="repo-1"
        open={true}
        onOpenChange={mockOnOpenChange}
        onLaunched={mockOnLaunched}
      />,
    );
    expect(screen.getByText('Launch Plan')).toBeInTheDocument();
    expect(screen.getByText('Test Plan')).toBeInTheDocument();
  });

  it('should render preflight checks', () => {
    render(
      <PlanLaunchDialog
        plan={basePlan}
        repositoryId="repo-1"
        open={true}
        onOpenChange={mockOnOpenChange}
        onLaunched={mockOnLaunched}
      />,
    );
    expect(screen.getByText('Repository accessible')).toBeInTheDocument();
    expect(screen.getByText('Working tree clean')).toBeInTheDocument();
    expect(screen.getByText('QA gates configured')).toBeInTheDocument();
    expect(screen.getByText('Plan is ready')).toBeInTheDocument();
  });

  it('should show Launch & Monitor button', () => {
    render(
      <PlanLaunchDialog
        plan={basePlan}
        repositoryId="repo-1"
        open={true}
        onOpenChange={mockOnOpenChange}
        onLaunched={mockOnLaunched}
      />,
    );
    expect(screen.getByText('Launch & Monitor')).toBeInTheDocument();
  });

  it('should show Launch & Switch button when callback provided', () => {
    render(
      <PlanLaunchDialog
        plan={basePlan}
        repositoryId="repo-1"
        open={true}
        onOpenChange={mockOnOpenChange}
        onLaunched={mockOnLaunched}
        onLaunchAndSwitch={mockOnLaunchAndSwitch}
      />,
    );
    expect(screen.getByText('Launch & Switch')).toBeInTheDocument();
  });

  it('should not show Launch & Switch button when callback not provided', () => {
    render(
      <PlanLaunchDialog
        plan={basePlan}
        repositoryId="repo-1"
        open={true}
        onOpenChange={mockOnOpenChange}
        onLaunched={mockOnLaunched}
      />,
    );
    expect(screen.queryByText('Launch & Switch')).not.toBeInTheDocument();
  });

  it('should show plan summary stats', () => {
    render(
      <PlanLaunchDialog
        plan={basePlan}
        repositoryId="repo-1"
        open={true}
        onOpenChange={mockOnOpenChange}
        onLaunched={mockOnLaunched}
      />,
    );
    expect(screen.getAllByText(/2 phase/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/5 task/).length).toBeGreaterThan(0);
  });

  it('should show singular phase text', () => {
    render(
      <PlanLaunchDialog
        plan={{ ...basePlan, totalPhases: 1 }}
        repositoryId="repo-1"
        open={true}
        onOpenChange={mockOnOpenChange}
        onLaunched={mockOnLaunched}
      />,
    );
    // The summary section should display "1 phase" (singular, no trailing "s")
    const summaryStats = screen.getByText((_, element) => {
      return element?.tagName === 'SPAN' && element?.textContent?.trim() === '1 phase';
    });
    expect(summaryStats).toBeInTheDocument();
  });

  it('should show singular task text', () => {
    render(
      <PlanLaunchDialog
        plan={{ ...basePlan, totalTasks: 1 }}
        repositoryId="repo-1"
        open={true}
        onOpenChange={mockOnOpenChange}
        onLaunched={mockOnLaunched}
      />,
    );
    const taskSpan = screen.getByText((_, element) => {
      return element?.tagName === 'SPAN' && element?.textContent?.trim() === '1 task';
    });
    expect(taskSpan).toBeInTheDocument();
  });

  it('should show progress percentage when > 0', () => {
    render(
      <PlanLaunchDialog
        plan={{ ...basePlan, completedTasks: 3, totalTasks: 10 }}
        repositoryId="repo-1"
        open={true}
        onOpenChange={mockOnOpenChange}
        onLaunched={mockOnLaunched}
      />,
    );
    expect(screen.getByText('30% done')).toBeInTheDocument();
  });

  it('should not show progress when 0%', () => {
    render(
      <PlanLaunchDialog
        plan={basePlan}
        repositoryId="repo-1"
        open={true}
        onOpenChange={mockOnOpenChange}
        onLaunched={mockOnLaunched}
      />,
    );
    expect(screen.queryByText('0% done')).not.toBeInTheDocument();
  });

  it('should have recheck button', () => {
    render(
      <PlanLaunchDialog
        plan={basePlan}
        repositoryId="repo-1"
        open={true}
        onOpenChange={mockOnOpenChange}
        onLaunched={mockOnLaunched}
      />,
    );
    const recheckButton = screen.getByText('Recheck');
    fireEvent.click(recheckButton);
    expect(mockRerunChecks).toHaveBeenCalled();
  });

  it('should call onLaunched on successful launch', async () => {
    render(
      <PlanLaunchDialog
        plan={basePlan}
        repositoryId="repo-1"
        open={true}
        onOpenChange={mockOnOpenChange}
        onLaunched={mockOnLaunched}
      />,
    );

    fireEvent.click(screen.getByText('Launch & Monitor'));

    await waitFor(() => {
      expect(mockOnLaunched).toHaveBeenCalledWith('plan-1');
    });
  });

  it('should call onLaunchAndSwitch when Launch & Switch clicked', async () => {
    render(
      <PlanLaunchDialog
        plan={basePlan}
        repositoryId="repo-1"
        open={true}
        onOpenChange={mockOnOpenChange}
        onLaunched={mockOnLaunched}
        onLaunchAndSwitch={mockOnLaunchAndSwitch}
      />,
    );

    fireEvent.click(screen.getByText('Launch & Switch'));

    await waitFor(() => {
      expect(mockOnLaunchAndSwitch).toHaveBeenCalledWith('plan-1');
    });
  });
});
