import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GeneratePlanDialog } from '../GeneratePlanDialog';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { api } from '@/store/api';

// Mock the plansApi module
const mockGeneratePlan = vi.fn();
const mockExecutePlan = vi.fn();
const mockUpdatePlan = vi.fn();
const mockFetchPlanWithDetails = vi.fn();
const mockUnwrap = vi.fn();

vi.mock('@/features/plans/store/plansApi', () => ({
  useGeneratePlanMutation: vi.fn(() => [
    mockGeneratePlan,
    { isLoading: false },
  ]),
  useExecutePlanMutation: vi.fn(() => [mockExecutePlan, { isLoading: false }]),
  useUpdatePlanMutation: vi.fn(() => [mockUpdatePlan, { isLoading: false }]),
  useLazyGetPlanWithDetailsQuery: vi.fn(() => [
    mockFetchPlanWithDetails,
    { isLoading: false },
  ]),
  useGetPlanQuery: vi.fn(() => ({
    data: null,
    refetch: vi.fn(),
  })),
}));

// Helper to build a readable stream from SSE data strings
function buildSSEStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event));
      }
      controller.close();
    },
  });
}

// Create a mock store
const createMockStore = () =>
  configureStore({
    reducer: {
      [api.reducerPath]: api.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(api.middleware),
  });

describe('GeneratePlanDialog', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGeneratePlan.mockReturnValue({ unwrap: mockUnwrap });
    mockExecutePlan.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
    mockUpdatePlan.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
    mockFetchPlanWithDetails.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({
        plan: { id: 'plan-1', title: 'Test' },
        phases: [],
        tasks: [],
      }),
    });
    mockUnwrap.mockResolvedValue({
      plan: { id: 'plan-1', title: 'Test' },
      phases: [],
      tasks: [],
    });

    // Default fetch mock: returns a successful SSE stream with a done event
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: buildSSEStream([
          'data: {"type":"status","message":"Starting..."}\n\n',
          'data: {"type":"progress","percent":50}\n\n',
          'data: {"type":"done","planId":"plan-1"}\n\n',
        ]),
      })
    );
  });

  const renderDialog = (open = true) => {
    const store = createMockStore();
    return render(
      <Provider store={store}>
        <GeneratePlanDialog
          open={open}
          onOpenChange={mockOnOpenChange}
          repositoryId="repo-1"
        />
      </Provider>
    );
  };

  it('should render dialog with title', () => {
    renderDialog();
    expect(screen.getAllByText('Generate Plan').length).toBeGreaterThanOrEqual(
      1
    );
  });

  it('should render form fields', () => {
    renderDialog();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  it('should render template chips', () => {
    renderDialog();
    expect(screen.getByText('New Feature')).toBeInTheDocument();
    expect(screen.getByText('Bug Fix')).toBeInTheDocument();
    expect(screen.getByText('Refactor')).toBeInTheDocument();
    expect(screen.getByText('Quick Task')).toBeInTheDocument();
  });

  it('should have disabled Generate Plan button when fields are empty', () => {
    renderDialog();
    const buttons = screen.getAllByRole('button', { name: /Generate Plan/i });
    const generateButton = buttons.find(
      (btn) =>
        btn.textContent?.includes('Generate Plan') &&
        !btn.textContent?.includes('Launch')
    );
    expect(generateButton).toBeDisabled();
  });

  it('should enable Generate Plan button when fields have values', () => {
    renderDialog();

    const titleInput = screen.getByLabelText('Title');
    const descInput = screen.getByLabelText('Description');

    fireEvent.change(titleInput, { target: { value: 'Test Title' } });
    fireEvent.change(descInput, { target: { value: 'Test Description' } });

    const buttons = screen.getAllByRole('button', { name: /Generate Plan/i });
    const generateButton = buttons.find(
      (btn) =>
        btn.textContent?.includes('Generate Plan') &&
        !btn.textContent?.includes('Launch')
    );
    expect(generateButton).not.toBeDisabled();
  });

  it('should call generatePlan with correct data', async () => {
    renderDialog();

    const titleInput = screen.getByLabelText('Title');
    const descInput = screen.getByLabelText('Description');

    fireEvent.change(titleInput, { target: { value: 'My Plan' } });
    fireEvent.change(descInput, { target: { value: 'My Description' } });

    const buttons = screen.getAllByRole('button', { name: /Generate Plan/i });
    const generateButton = buttons.find(
      (btn) =>
        btn.textContent?.includes('Generate Plan') &&
        !btn.textContent?.includes('Launch')
    );
    fireEvent.click(generateButton!);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/plans/generate/stream',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            repositoryId: 'repo-1',
            title: 'My Plan',
            description: 'My Description',
          }),
        })
      );
    });
  });

  it('should populate description when template is selected', () => {
    renderDialog();

    const bugFixButton = screen.getByText('Bug Fix');
    fireEvent.click(bugFixButton);

    const descInput = screen.getByLabelText(
      'Description'
    ) as HTMLTextAreaElement;
    expect(descInput.value).toContain('Fix a bug:');
    expect(descInput.value).toContain('Current behavior:');
  });

  it('should clear description when same template is clicked again', () => {
    renderDialog();

    const bugFixButton = screen.getByText('Bug Fix');
    fireEvent.click(bugFixButton);

    const descInput = screen.getByLabelText(
      'Description'
    ) as HTMLTextAreaElement;
    expect(descInput.value).toContain('Fix a bug:');

    fireEvent.click(bugFixButton);
    expect(descInput.value).toBe('');
  });

  it('should call onOpenChange when Cancel is clicked', () => {
    renderDialog();

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('should show error on generation failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: buildSSEStream([
          'data: {"type":"error","message":"Generation failed"}\n\n',
        ]),
      })
    );

    renderDialog();

    const titleInput = screen.getByLabelText('Title');
    const descInput = screen.getByLabelText('Description');

    fireEvent.change(titleInput, { target: { value: 'My Plan' } });
    fireEvent.change(descInput, { target: { value: 'My Description' } });

    const buttons = screen.getAllByRole('button', { name: /Generate Plan/i });
    const generateButton = buttons.find(
      (btn) =>
        btn.textContent?.includes('Generate Plan') &&
        !btn.textContent?.includes('Launch')
    );
    fireEvent.click(generateButton!);

    await waitFor(() => {
      expect(screen.getByText('Generation failed')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('should not render dialog when open is false', () => {
    renderDialog(false);
    expect(screen.queryAllByText('Generate Plan')).toHaveLength(0);
  });

  it('should render Generate & Launch button', () => {
    renderDialog();
    expect(screen.getByText('Generate & Launch')).toBeInTheDocument();
  });
});
