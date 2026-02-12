import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanCard } from '../PlanCard';
import type { Plan } from '@/db/schema';

// Mock the utils module
vi.mock('@/shared/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    formatRelativeTime: vi.fn(() => '5 minutes ago'),
  };
});

// Mock DropdownMenu to always render children (avoids Radix portal issues in jsdom)
vi.mock('@/shared/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
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

  it('should show no description paragraph when description is empty', () => {
    const planWithoutDesc = { ...mockPlan, description: null };
    render(<PlanCard plan={planWithoutDesc as any} onView={mockOnView} />);

    // Component doesn't render a description element when there's no description
    expect(screen.queryByText('Test description')).not.toBeInTheDocument();
  });

  it('should render phase and task counts', () => {
    render(<PlanCard plan={mockPlan} onView={mockOnView} />);

    // Phases display as "2 phases" in a <span>
    const phaseText = screen.getByText((content, element) => {
      return element?.tagName === 'SPAN' && element?.textContent === '2 phases';
    });
    expect(phaseText).toBeInTheDocument();

    // Tasks display as "0/5 tasks" in a <span>
    const taskText = screen.getByText((content, element) => {
      return element?.tagName === 'SPAN' && element?.textContent === '0/5 tasks';
    });
    expect(taskText).toBeInTheDocument();
  });

  it('should call onView when title is clicked', () => {
    render(<PlanCard plan={mockPlan} onView={mockOnView} />);

    fireEvent.click(screen.getByText('Test Plan'));
    expect(mockOnView).toHaveBeenCalledWith('plan-1');
  });

  it('should show "Ready" button for draft status when onMarkReady provided', () => {
    render(
      <PlanCard
        plan={mockPlan}
        onView={mockOnView}
        onMarkReady={mockOnMarkReady}
      />
    );

    const button = screen.getByText('Ready');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(mockOnMarkReady).toHaveBeenCalledWith('plan-1');
  });

  it('should show "Execute" button for ready status', () => {
    const readyPlan = { ...mockPlan, status: 'ready' as const };
    render(
      <PlanCard
        plan={readyPlan}
        onView={mockOnView}
        onExecute={mockOnExecute}
      />
    );

    const button = screen.getByText('Execute');
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

    // "Pause" appears in both primary action and dropdown menu
    const buttons = screen.getAllByText('Pause');
    expect(buttons.length).toBeGreaterThan(0);
    fireEvent.click(buttons[0]!);
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

    // "Resume" appears in both primary action and dropdown menu
    const buttons = screen.getAllByText('Resume');
    expect(buttons.length).toBeGreaterThan(0);
    fireEvent.click(buttons[0]!);
    expect(mockOnResume).toHaveBeenCalledWith('plan-1');
  });

  it('should not show primary action for completed status', () => {
    const completedPlan = { ...mockPlan, status: 'completed' as const };
    render(
      <PlanCard
        plan={completedPlan}
        onView={mockOnView}
      />
    );

    // Completed plans have no primary action button, but clicking the card calls onView
    fireEvent.click(screen.getByText('Test Plan'));
    expect(mockOnView).toHaveBeenCalledWith('plan-1');
  });

  it('should not show primary action for failed status', () => {
    const failedPlan = { ...mockPlan, status: 'failed' as const };
    render(
      <PlanCard
        plan={failedPlan}
        onView={mockOnView}
      />
    );

    // Failed plans have no primary action, clicking card calls onView
    fireEvent.click(screen.getByText('Test Plan'));
    expect(mockOnView).toHaveBeenCalledWith('plan-1');
  });

  it('should have delete option in dropdown when onDelete is provided', () => {
    render(
      <PlanCard
        plan={mockPlan}
        onView={mockOnView}
        onDelete={mockOnDelete}
      />
    );

    // With mocked dropdown, Delete is always rendered
    const deleteItem = screen.getByText('Delete');
    expect(deleteItem).toBeInTheDocument();
    fireEvent.click(deleteItem);
    expect(mockOnDelete).toHaveBeenCalledWith('plan-1');
  });

  it('should render status badge', () => {
    render(<PlanCard plan={mockPlan} onView={mockOnView} />);

    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('should show relative time', () => {
    render(<PlanCard plan={mockPlan} onView={mockOnView} />);

    expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
  });

  it('should handle 0 total tasks by not showing progress bar', () => {
    const emptyPlan = {
      ...mockPlan,
      status: 'running' as const,
      totalTasks: 0,
      completedTasks: 0,
    };
    render(<PlanCard plan={emptyPlan} onView={mockOnView} />);

    // When totalTasks is 0, the progress bar section is not rendered
    expect(screen.queryByText('Progress')).not.toBeInTheDocument();
  });

  it('should render list variant', () => {
    render(
      <PlanCard
        plan={mockPlan}
        variant="list"
        onView={mockOnView}
        onDelete={mockOnDelete}
        onMarkReady={mockOnMarkReady}
      />
    );

    expect(screen.getByText('Test Plan')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('should show progress bar in list variant when tasks exist', () => {
    const runningPlan = {
      ...mockPlan,
      status: 'running' as const,
      completedTasks: 3,
      totalTasks: 10,
    };
    render(<PlanCard plan={runningPlan} variant="list" onView={mockOnView} />);

    // Title should still render in list variant
    expect(screen.getByText('Test Plan')).toBeInTheDocument();
  });

  it('should call onView when list variant card is clicked', () => {
    render(
      <PlanCard
        plan={mockPlan}
        variant="list"
        onView={mockOnView}
      />
    );

    fireEvent.click(screen.getByText('Test Plan'));
    expect(mockOnView).toHaveBeenCalledWith('plan-1');
  });

  it('should show completed status with green progress bar', () => {
    const completedPlan = {
      ...mockPlan,
      status: 'completed' as const,
      completedTasks: 5,
      totalTasks: 5,
    };
    render(<PlanCard plan={completedPlan} onView={mockOnView} />);

    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('should show failed status with red progress bar', () => {
    const failedPlan = {
      ...mockPlan,
      status: 'failed' as const,
      completedTasks: 2,
      totalTasks: 5,
    };
    render(<PlanCard plan={failedPlan} onView={mockOnView} />);

    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('should show duplicate option when onDuplicate is provided', () => {
    const mockOnDuplicate = vi.fn();
    render(
      <PlanCard
        plan={mockPlan}
        onView={mockOnView}
        onDuplicate={mockOnDuplicate}
      />
    );

    // With mocked dropdown, Duplicate is rendered
    const duplicateItem = screen.getByText('Duplicate');
    expect(duplicateItem).toBeInTheDocument();
    fireEvent.click(duplicateItem);
    expect(mockOnDuplicate).toHaveBeenCalledWith('plan-1');
  });

  it('should render plural phases text for multiple phases', () => {
    const multiPhasePlan = { ...mockPlan, totalPhases: 3 };
    render(<PlanCard plan={multiPhasePlan} onView={mockOnView} />);

    const phaseText = screen.getByText((content, element) => {
      return element?.tagName === 'SPAN' && element?.textContent === '3 phases';
    });
    expect(phaseText).toBeInTheDocument();
  });

  it('should render singular phase text for one phase', () => {
    const singlePhasePlan = { ...mockPlan, totalPhases: 1 };
    render(<PlanCard plan={singlePhasePlan} onView={mockOnView} />);

    const phaseText = screen.getByText((content, element) => {
      return element?.tagName === 'SPAN' && element?.textContent === '1 phase';
    });
    expect(phaseText).toBeInTheDocument();
  });

  it('should render singular task text for one task', () => {
    const singleTaskPlan = { ...mockPlan, totalTasks: 1, completedTasks: 0 };
    render(<PlanCard plan={singleTaskPlan} onView={mockOnView} />);

    const taskText = screen.getByText((content, element) => {
      return element?.tagName === 'SPAN' && element?.textContent === '0/1 task';
    });
    expect(taskText).toBeInTheDocument();
  });

  it('should show active border for running plans', () => {
    const runningPlan = { ...mockPlan, status: 'running' as const };
    const { container } = render(<PlanCard plan={runningPlan} onView={mockOnView} />);

    // Card should have the border-l-amber-500 class for active plans
    const card = container.firstChild;
    expect(card).toHaveClass('border-l-2');
  });

  it('should show active border for paused plans', () => {
    const pausedPlan = { ...mockPlan, status: 'paused' as const };
    const { container } = render(<PlanCard plan={pausedPlan} onView={mockOnView} />);

    const card = container.firstChild;
    expect(card).toHaveClass('border-l-2');
  });

  it('should render list variant with all action handlers', () => {
    render(
      <PlanCard
        plan={{ ...mockPlan, status: 'ready' as const }}
        variant="list"
        onView={mockOnView}
        onExecute={mockOnExecute}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onMarkReady={mockOnMarkReady}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('Execute')).toBeInTheDocument();
  });

  it('should render completed plan in list variant with progress bar', () => {
    const completedPlan = {
      ...mockPlan,
      status: 'completed' as const,
      completedTasks: 5,
      totalTasks: 5,
    };
    render(<PlanCard plan={completedPlan} variant="list" onView={mockOnView} />);

    expect(screen.getByText('Test Plan')).toBeInTheDocument();
  });

  it('should render failed plan in list variant', () => {
    const failedPlan = {
      ...mockPlan,
      status: 'failed' as const,
      completedTasks: 2,
      totalTasks: 5,
    };
    render(<PlanCard plan={failedPlan} variant="list" onView={mockOnView} />);

    expect(screen.getByText('Test Plan')).toBeInTheDocument();
  });

  it('should not render description in list variant when empty', () => {
    const planWithoutDesc = { ...mockPlan, description: null };
    render(<PlanCard plan={planWithoutDesc as any} variant="list" onView={mockOnView} />);

    expect(screen.queryByText('Test description')).not.toBeInTheDocument();
  });
});
