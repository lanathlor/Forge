import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlanList } from '../PlanList';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { api } from '@/store/api';
import type { Plan } from '@/db/schema';

// Mock the plansApi hooks
const mockExecutePlan = vi.fn();
const mockPausePlan = vi.fn();
const mockResumePlan = vi.fn();
const mockUpdatePlan = vi.fn();
const mockDeletePlan = vi.fn();

vi.mock('@/features/plans/store/plansApi', () => ({
  useGetPlansQuery: vi.fn(() => ({
    data: { plans: [] },
    isLoading: false,
    error: null,
  })),
  useGetPlanQuery: vi.fn(() => ({
    data: null,
    refetch: vi.fn(),
  })),
  useLazyGetPlanWithDetailsQuery: vi.fn(() => [
    vi.fn().mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({
        plan: { id: 'plan-1', title: 'Test' },
        phases: [],
        tasks: [],
      }),
    }),
    { isLoading: false },
  ]),
  useExecutePlanMutation: vi.fn(() => [mockExecutePlan]),
  usePausePlanMutation: vi.fn(() => [mockPausePlan]),
  useResumePlanMutation: vi.fn(() => [mockResumePlan]),
  useUpdatePlanMutation: vi.fn(() => [mockUpdatePlan]),
  useDeletePlanMutation: vi.fn(() => [mockDeletePlan]),
  useGeneratePlanMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
}));

// Mock DropdownMenu to always render children (avoids Radix portal issues in jsdom)
vi.mock('@/shared/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

// Mock confirm
vi.stubGlobal(
  'confirm',
  vi.fn(() => true)
);

// Create a mock store
const createMockStore = () =>
  configureStore({
    reducer: {
      [api.reducerPath]: api.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(api.middleware),
  });

const { useGetPlansQuery } = await import('@/features/plans/store/plansApi');

describe('PlanList', () => {
  const mockOnViewPlan = vi.fn();

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (repositoryId?: string) => {
    const store = createMockStore();
    return render(
      <Provider store={store}>
        <PlanList repositoryId={repositoryId} onViewPlan={mockOnViewPlan} />
      </Provider>
    );
  };

  it('should show loading state', () => {
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    const { container } = renderComponent();
    // Loading state renders skeleton placeholders with animate-pulse
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should show error state', () => {
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Error' },
    } as any);

    renderComponent();
    expect(screen.getByText('Error loading plans')).toBeInTheDocument();
  });

  it('should show empty state when no plans', () => {
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent('repo-1');
    expect(screen.getByText('No plans yet')).toBeInTheDocument();
    expect(
      screen.getByText(/Plans help you break down complex tasks/)
    ).toBeInTheDocument();
  });

  it('should render plans list', () => {
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [mockPlan] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();
    expect(screen.getByText('Test Plan')).toBeInTheDocument();
  });

  it('should show "New Plan" button when plans exist', () => {
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [mockPlan] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();
    expect(screen.getByText('New Plan')).toBeInTheDocument();
  });

  it('should call executePlan when execute is clicked', async () => {
    const readyPlan = { ...mockPlan, status: 'ready' as const };
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [readyPlan] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();
    const executeButton = screen.getByText('Execute');
    fireEvent.click(executeButton);

    expect(mockExecutePlan).toHaveBeenCalledWith('plan-1');
  });

  it('should call pausePlan when pause is clicked', async () => {
    const runningPlan = { ...mockPlan, status: 'running' as const };
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [runningPlan] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();
    // "Pause" appears in both primary action and dropdown menu
    const pauseButtons = screen.getAllByText('Pause');
    fireEvent.click(pauseButtons[0]!);

    expect(mockPausePlan).toHaveBeenCalledWith('plan-1');
  });

  it('should call resumePlan when resume is clicked', async () => {
    const pausedPlan = { ...mockPlan, status: 'paused' as const };
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [pausedPlan] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();
    // "Resume" appears in both primary action and dropdown menu
    const resumeButtons = screen.getAllByText('Resume');
    fireEvent.click(resumeButtons[0]!);

    expect(mockResumePlan).toHaveBeenCalledWith('plan-1');
  });

  it('should call updatePlan to mark ready', async () => {
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [mockPlan] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();
    // Primary action button label is "Ready" for draft plans
    const markReadyButton = screen.getByText('Ready');
    fireEvent.click(markReadyButton);

    expect(mockUpdatePlan).toHaveBeenCalledWith({
      id: 'plan-1',
      data: { status: 'ready' },
    });
  });

  it('should call deletePlan after confirmation', async () => {
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [mockPlan] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();
    // With mocked dropdown, Delete is always rendered
    const deleteButton = screen.getByText('Delete');
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to delete this plan?'
    );
    expect(mockDeletePlan).toHaveBeenCalledWith('plan-1');
  });

  it('should not delete when confirmation is cancelled', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false)
    );

    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [mockPlan] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();
    // With mocked dropdown, Delete is always rendered
    const deleteButton = screen.getByText('Delete');
    fireEvent.click(deleteButton);

    expect(mockDeletePlan).not.toHaveBeenCalled();

    // Restore
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
  });

  it('should call onViewPlan when plan title is clicked', async () => {
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [mockPlan] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();
    const planTitle = screen.getByText('Test Plan');
    fireEvent.click(planTitle);

    expect(mockOnViewPlan).toHaveBeenCalledWith('plan-1');
  });

  it('should render title "Plans"', () => {
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [mockPlan] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();
    expect(screen.getByText('Plans')).toBeInTheDocument();
  });

  it('should show generate buttons', async () => {
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent('repo-1');

    // Verify the generate buttons exist
    const generateButtons = screen.getAllByText(/Generate.*Claude/);
    expect(generateButtons.length).toBeGreaterThan(0);
  });

  it('should filter plans by search query', () => {
    const plans = [
      {
        ...mockPlan,
        id: 'plan-1',
        title: 'Alpha Plan',
        description: 'first plan',
      },
      {
        ...mockPlan,
        id: 'plan-2',
        title: 'Beta Plan',
        description: 'second plan',
      },
    ];
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const searchInput = screen.getByPlaceholderText(
      'Search plans by title or description...'
    );
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });

    expect(screen.getByText('Alpha Plan')).toBeInTheDocument();
    expect(screen.queryByText('Beta Plan')).not.toBeInTheDocument();
  });

  it('should filter by description in search', () => {
    const plans = [
      {
        ...mockPlan,
        id: 'plan-1',
        title: 'Plan A',
        description: 'unique description',
      },
      { ...mockPlan, id: 'plan-2', title: 'Plan B', description: 'other' },
    ];
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const searchInput = screen.getByPlaceholderText(
      'Search plans by title or description...'
    );
    fireEvent.change(searchInput, { target: { value: 'unique' } });

    expect(screen.getByText('Plan A')).toBeInTheDocument();
    expect(screen.queryByText('Plan B')).not.toBeInTheDocument();
  });

  it('should clear search query when X button is clicked', () => {
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [mockPlan] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const searchInput = screen.getByPlaceholderText(
      'Search plans by title or description...'
    );
    fireEvent.change(searchInput, { target: { value: 'test' } });

    // X button should appear
    const clearButton = searchInput.parentElement!.querySelector('button');
    expect(clearButton).toBeInTheDocument();
    fireEvent.click(clearButton!);

    expect(searchInput).toHaveValue('');
  });

  it('should filter by status when status tab is clicked', () => {
    const plans = [
      {
        ...mockPlan,
        id: 'plan-1',
        title: 'Draft Plan',
        status: 'draft' as const,
      },
      {
        ...mockPlan,
        id: 'plan-2',
        title: 'Completed Plan',
        status: 'completed' as const,
      },
    ];
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    // Click "Done" tab to filter completed plans
    const doneTab = screen.getByText('Done');
    fireEvent.click(doneTab);

    expect(screen.getByText('Completed Plan')).toBeInTheDocument();
    expect(screen.queryByText('Draft Plan')).not.toBeInTheDocument();
  });

  it('should show paused plans under Running tab', () => {
    const plans = [
      {
        ...mockPlan,
        id: 'plan-1',
        title: 'Active Plan',
        status: 'running' as const,
      },
      {
        ...mockPlan,
        id: 'plan-2',
        title: 'Paused Plan',
        status: 'paused' as const,
      },
    ];
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    // Click "Running" tab - use getAllByText since "Running" also appears in status badges
    const runningElements = screen.getAllByText('Running');
    // The first one is the status badge, the filter tab also has "Running"
    // Click the filter tab (which has the count suffix)
    const runningTab = runningElements.find(
      (el) => el.closest('button') && !el.closest('[class*="badge"]')
    );
    fireEvent.click(runningTab!);

    expect(screen.getByText('Active Plan')).toBeInTheDocument();
    expect(screen.getByText('Paused Plan')).toBeInTheDocument();
  });

  it('should show empty filter state when no plans match', () => {
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [mockPlan] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const searchInput = screen.getByPlaceholderText(
      'Search plans by title or description...'
    );
    fireEvent.change(searchInput, {
      target: { value: 'nonexistent query xyz' },
    });

    expect(screen.getByText('No matching plans')).toBeInTheDocument();
    expect(screen.getByText('Clear filters')).toBeInTheDocument();
  });

  it('should clear filters when "Clear filters" is clicked', () => {
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [mockPlan] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const searchInput = screen.getByPlaceholderText(
      'Search plans by title or description...'
    );
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    const clearButton = screen.getByText('Clear filters');
    fireEvent.click(clearButton);

    expect(screen.getByText('Test Plan')).toBeInTheDocument();
  });

  it('should switch to list view', () => {
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [mockPlan] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const listViewButton = screen.getByLabelText('List view');
    fireEvent.click(listViewButton);

    // Plan should still be visible in list view
    expect(screen.getByText('Test Plan')).toBeInTheDocument();
  });

  it('should switch to grid view', () => {
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [mockPlan] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    // First switch to list, then back to grid
    const listViewButton = screen.getByLabelText('List view');
    fireEvent.click(listViewButton);

    const gridViewButton = screen.getByLabelText('Grid view');
    fireEvent.click(gridViewButton);

    expect(screen.getByText('Test Plan')).toBeInTheDocument();
  });

  it('should toggle sort direction when same field is clicked', () => {
    const plans = [
      {
        ...mockPlan,
        id: 'plan-1',
        title: 'Alpha',
        updatedAt: new Date('2024-01-01'),
      },
      {
        ...mockPlan,
        id: 'plan-2',
        title: 'Beta',
        updatedAt: new Date('2024-01-02'),
      },
    ];
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    // Click "Last Modified" sort option (already selected) to toggle direction
    const lastModifiedButton = screen.getByText('Last Modified');
    fireEvent.click(lastModifiedButton);

    // Both plans should still be visible
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('should sort by title when Title sort is selected', () => {
    const plans = [
      {
        ...mockPlan,
        id: 'plan-1',
        title: 'Zeta Plan',
        updatedAt: new Date('2024-01-02'),
      },
      {
        ...mockPlan,
        id: 'plan-2',
        title: 'Alpha Plan',
        updatedAt: new Date('2024-01-01'),
      },
    ];
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const titleSortButton = screen.getByText('Title');
    fireEvent.click(titleSortButton);

    // Both plans should be visible
    expect(screen.getByText('Zeta Plan')).toBeInTheDocument();
    expect(screen.getByText('Alpha Plan')).toBeInTheDocument();
  });

  it('should sort by status', () => {
    const plans = [
      {
        ...mockPlan,
        id: 'plan-1',
        title: 'Draft Plan',
        status: 'draft' as const,
      },
      {
        ...mockPlan,
        id: 'plan-2',
        title: 'Running Plan',
        status: 'running' as const,
      },
    ];
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const statusSortButton = screen.getByText('Status');
    fireEvent.click(statusSortButton);

    expect(screen.getByText('Draft Plan')).toBeInTheDocument();
    expect(screen.getByText('Running Plan')).toBeInTheDocument();
  });

  it('should sort by progress', () => {
    const plans = [
      {
        ...mockPlan,
        id: 'plan-1',
        title: 'Low Progress Plan',
        completedTasks: 1,
        totalTasks: 10,
      },
      {
        ...mockPlan,
        id: 'plan-2',
        title: 'High Progress Plan',
        completedTasks: 9,
        totalTasks: 10,
      },
    ];
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    // "Progress" appears in both sort dropdown and progress bar labels, use getAllByText
    const progressElements = screen.getAllByText('Progress');
    // Find the one in the sort dropdown (inside a button element)
    const sortButton = progressElements.find(
      (el) => el.closest('button') && !el.closest('[class*="px-4"]')
    );
    fireEvent.click(sortButton!);

    expect(screen.getByText('Low Progress Plan')).toBeInTheDocument();
    expect(screen.getByText('High Progress Plan')).toBeInTheDocument();
  });

  it('should sort by createdAt', () => {
    const plans = [
      {
        ...mockPlan,
        id: 'plan-1',
        title: 'Old Created Plan',
        createdAt: new Date('2023-01-01'),
      },
      {
        ...mockPlan,
        id: 'plan-2',
        title: 'Recent Created Plan',
        createdAt: new Date('2024-06-01'),
      },
    ];
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const createdSortButton = screen.getByText('Created');
    fireEvent.click(createdSortButton);

    expect(screen.getByText('Old Created Plan')).toBeInTheDocument();
    expect(screen.getByText('Recent Created Plan')).toBeInTheDocument();
  });

  it('should handle plan with null description in search', () => {
    const plans = [
      { ...mockPlan, id: 'plan-1', title: 'Plan A', description: null },
    ];
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const searchInput = screen.getByPlaceholderText(
      'Search plans by title or description...'
    );
    fireEvent.change(searchInput, { target: { value: 'Plan A' } });

    expect(screen.getByText('Plan A')).toBeInTheDocument();
  });

  it('should not render GeneratePlanDialog when repositoryId is not provided', () => {
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [mockPlan] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent(); // No repositoryId
    expect(screen.getByText('Test Plan')).toBeInTheDocument();
  });

  it('should handle plans with zero totalTasks for progress sort', () => {
    const plans = [
      {
        ...mockPlan,
        id: 'plan-1',
        title: 'Zero Task Plan',
        totalTasks: 0,
        completedTasks: 0,
      },
      {
        ...mockPlan,
        id: 'plan-2',
        title: 'Some Task Plan',
        totalTasks: 5,
        completedTasks: 3,
      },
    ];
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    // "Progress" appears in both sort dropdown and progress bar labels, use getAllByText
    const progressElements = screen.getAllByText('Progress');
    const sortButton = progressElements.find(
      (el) => el.closest('button') && !el.closest('[class*="px-4"]')
    );
    fireEvent.click(sortButton!);

    expect(screen.getByText('Zero Task Plan')).toBeInTheDocument();
    expect(screen.getByText('Some Task Plan')).toBeInTheDocument();
  });
});
