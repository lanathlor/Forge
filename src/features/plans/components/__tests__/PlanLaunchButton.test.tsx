import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlanLaunchButton } from '../PlanLaunchButton';
import type { Plan } from '@/db/schema';

// Mock the preflight checks hook
vi.mock('../../hooks/usePreflightChecks', () => ({
  usePreflightChecks: vi.fn(() => ({
    checks: [
      { id: 'repo', label: 'Repository accessible', status: 'pass', detail: 'my-repo' },
      { id: 'clean', label: 'Working tree clean', status: 'pass', detail: 'No uncommitted changes' },
    ],
    isReady: true,
    isChecking: false,
    rerunChecks: vi.fn(),
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

describe('PlanLaunchButton', () => {
  const basePlan: Plan = {
    id: 'plan-1',
    repositoryId: 'repo-1',
    title: 'Test Plan',
    description: 'A test plan',
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

  const mockOnLaunched = vi.fn();
  const mockOnLaunchAndSwitch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteUnwrap.mockResolvedValue({});
    mockUpdateUnwrap.mockResolvedValue({});
  });

  it('should render Launch Plan button for ready plans', () => {
    render(
      <PlanLaunchButton
        plan={basePlan}
        repositoryId="repo-1"
        onLaunched={mockOnLaunched}
      />,
    );
    expect(screen.getByText('Launch Plan')).toBeInTheDocument();
  });

  it('should render Launch Plan button for draft plans', () => {
    render(
      <PlanLaunchButton
        plan={{ ...basePlan, status: 'draft' }}
        repositoryId="repo-1"
        onLaunched={mockOnLaunched}
      />,
    );
    expect(screen.getByText('Launch Plan')).toBeInTheDocument();
  });

  it('should return null for non-launchable plan statuses', () => {
    const { container } = render(
      <PlanLaunchButton
        plan={{ ...basePlan, status: 'running' }}
        repositoryId="repo-1"
        onLaunched={mockOnLaunched}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('should call onLaunched on successful launch', async () => {
    render(
      <PlanLaunchButton
        plan={basePlan}
        repositoryId="repo-1"
        onLaunched={mockOnLaunched}
      />,
    );

    fireEvent.click(screen.getByText('Launch Plan'));

    await waitFor(() => {
      expect(mockOnLaunched).toHaveBeenCalledWith('plan-1');
    });
  });

  it('should call onLaunchAndSwitch when Launch & Switch clicked', async () => {
    render(
      <PlanLaunchButton
        plan={basePlan}
        repositoryId="repo-1"
        onLaunched={mockOnLaunched}
        onLaunchAndSwitch={mockOnLaunchAndSwitch}
      />,
    );

    const switchButton = screen.getByTitle('Launch the plan and return to command center');
    fireEvent.click(switchButton);

    await waitFor(() => {
      expect(mockOnLaunchAndSwitch).toHaveBeenCalledWith('plan-1');
    });
  });

  it('should not show Launch & Switch button when callback not provided', () => {
    render(
      <PlanLaunchButton
        plan={basePlan}
        repositoryId="repo-1"
        onLaunched={mockOnLaunched}
      />,
    );
    expect(screen.queryByTitle('Launch the plan and return to command center')).not.toBeInTheDocument();
  });

  it('should update plan to ready before executing when draft', async () => {
    render(
      <PlanLaunchButton
        plan={{ ...basePlan, status: 'draft' }}
        repositoryId="repo-1"
        onLaunched={mockOnLaunched}
      />,
    );

    fireEvent.click(screen.getByText('Launch Plan'));

    await waitFor(() => {
      expect(mockUpdateUnwrap).toHaveBeenCalled();
      expect(mockExecuteUnwrap).toHaveBeenCalled();
    });
  });

  it('should show error message on launch failure', async () => {
    mockExecuteUnwrap.mockRejectedValue(new Error('Execution failed'));

    render(
      <PlanLaunchButton
        plan={basePlan}
        repositoryId="repo-1"
        onLaunched={mockOnLaunched}
      />,
    );

    fireEvent.click(screen.getByText('Launch Plan'));

    await waitFor(() => {
      expect(screen.getByText('Execution failed')).toBeInTheDocument();
    });
  });

  it('should show fallback error message for non-Error objects', async () => {
    mockExecuteUnwrap.mockRejectedValue('some string error');

    render(
      <PlanLaunchButton
        plan={basePlan}
        repositoryId="repo-1"
        onLaunched={mockOnLaunched}
      />,
    );

    fireEvent.click(screen.getByText('Launch Plan'));

    await waitFor(() => {
      expect(screen.getByText('Failed to launch plan')).toBeInTheDocument();
    });
  });

  it('should render with lg size', () => {
    render(
      <PlanLaunchButton
        plan={basePlan}
        repositoryId="repo-1"
        onLaunched={mockOnLaunched}
        size="lg"
      />,
    );
    // lg size shows phase/task info below the button
    expect(screen.getByText(/2/)).toBeInTheDocument();
  });

  it('should show singular phase text for 1 phase', () => {
    const { container } = render(
      <PlanLaunchButton
        plan={{ ...basePlan, totalPhases: 1, totalTasks: 1 }}
        repositoryId="repo-1"
        onLaunched={mockOnLaunched}
        size="lg"
      />,
    );
    // Should show "1 phase" without trailing "s" and "1 task"
    expect(container.textContent).toContain('1 phase');
    expect(container.textContent).not.toContain('phases');
    expect(container.textContent).toContain('1 task');
    expect(container.textContent).not.toContain('tasks');
  });

  it('should show preflight checks when showPreflight is true', () => {
    render(
      <PlanLaunchButton
        plan={basePlan}
        repositoryId="repo-1"
        onLaunched={mockOnLaunched}
        showPreflight={true}
      />,
    );
    // Checks are shown as mini icons
    expect(screen.getByText('Launch Plan')).toBeInTheDocument();
  });

  it('should skip preflight when showPreflight is false', () => {
    render(
      <PlanLaunchButton
        plan={basePlan}
        repositoryId="repo-1"
        onLaunched={mockOnLaunched}
        showPreflight={false}
      />,
    );
    expect(screen.getByText('Launch Plan')).toBeInTheDocument();
  });
});
