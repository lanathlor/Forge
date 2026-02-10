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
  useExecutePlanMutation: vi.fn(() => [mockExecutePlan]),
  usePausePlanMutation: vi.fn(() => [mockPausePlan]),
  useResumePlanMutation: vi.fn(() => [mockResumePlan]),
  useUpdatePlanMutation: vi.fn(() => [mockUpdatePlan]),
  useDeletePlanMutation: vi.fn(() => [mockDeletePlan]),
  useGeneratePlanMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
}));

// Mock confirm
vi.stubGlobal('confirm', vi.fn(() => true));

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

    renderComponent();
    expect(screen.getByText('Loading plans...')).toBeInTheDocument();
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
    expect(screen.getByText('Create your first plan to get started')).toBeInTheDocument();
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

  it('should show "Generate with Claude" button', () => {
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [mockPlan] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();
    expect(screen.getByText('Generate with Claude')).toBeInTheDocument();
  });

  it('should call executePlan when execute is clicked', async () => {
    const readyPlan = { ...mockPlan, status: 'ready' as const };
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [readyPlan] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();
    const executeButton = screen.getByText('Execute Plan');
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
    const pauseButton = screen.getByText('Pause');
    fireEvent.click(pauseButton);

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
    const resumeButton = screen.getByText('Resume');
    fireEvent.click(resumeButton);

    expect(mockResumePlan).toHaveBeenCalledWith('plan-1');
  });

  it('should call updatePlan to mark ready', async () => {
    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [mockPlan] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();
    const markReadyButton = screen.getByText('Mark as Ready');
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
    const deleteButton = screen.getByText('Delete');
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this plan?');
    expect(mockDeletePlan).toHaveBeenCalledWith('plan-1');
  });

  it('should not delete when confirmation is cancelled', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));

    vi.mocked(useGetPlansQuery).mockReturnValue({
      data: { plans: [mockPlan] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();
    const deleteButton = screen.getByText('Delete');
    fireEvent.click(deleteButton);

    expect(mockDeletePlan).not.toHaveBeenCalled();

    // Restore
    vi.stubGlobal('confirm', vi.fn(() => true));
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
      data: { plans: [] },
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
});
