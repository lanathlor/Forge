import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GeneratePlanDialog } from '../GeneratePlanDialog';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { api } from '@/store/api';

// Mock window.alert
vi.stubGlobal('alert', vi.fn());

// Mock the plansApi module
const mockGeneratePlan = vi.fn();
const mockUnwrap = vi.fn();

vi.mock('@/features/plans/store/plansApi', () => ({
  useGeneratePlanMutation: vi.fn(() => [
    mockGeneratePlan,
    { isLoading: false },
  ]),
}));

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
    mockUnwrap.mockResolvedValue({});
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
    expect(screen.getByText('Generate Plan with Claude')).toBeInTheDocument();
  });

  it('should render form fields', () => {
    renderDialog();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  it('should have disabled Generate button when fields are empty', () => {
    renderDialog();
    const button = screen.getByText('Generate Plan');
    expect(button).toBeDisabled();
  });

  it('should enable Generate button when fields have values', () => {
    renderDialog();

    const titleInput = screen.getByLabelText('Title');
    const descInput = screen.getByLabelText('Description');

    fireEvent.change(titleInput, { target: { value: 'Test Title' } });
    fireEvent.change(descInput, { target: { value: 'Test Description' } });

    const button = screen.getByText('Generate Plan');
    expect(button).not.toBeDisabled();
  });

  it('should call generatePlan with correct data', async () => {
    renderDialog();

    const titleInput = screen.getByLabelText('Title');
    const descInput = screen.getByLabelText('Description');

    fireEvent.change(titleInput, { target: { value: 'My Plan' } });
    fireEvent.change(descInput, { target: { value: 'My Description' } });

    const button = screen.getByText('Generate Plan');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockGeneratePlan).toHaveBeenCalledWith({
        repositoryId: 'repo-1',
        title: 'My Plan',
        description: 'My Description',
      });
    });
  });

  it('should close dialog on successful generation', async () => {
    renderDialog();

    const titleInput = screen.getByLabelText('Title');
    const descInput = screen.getByLabelText('Description');

    fireEvent.change(titleInput, { target: { value: 'My Plan' } });
    fireEvent.change(descInput, { target: { value: 'My Description' } });

    const button = screen.getByText('Generate Plan');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('should call onOpenChange when Cancel is clicked', () => {
    renderDialog();

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('should show error alert on generation failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUnwrap.mockRejectedValueOnce(new Error('Generation failed'));

    renderDialog();

    const titleInput = screen.getByLabelText('Title');
    const descInput = screen.getByLabelText('Description');

    fireEvent.change(titleInput, { target: { value: 'My Plan' } });
    fireEvent.change(descInput, { target: { value: 'My Description' } });

    const button = screen.getByText('Generate Plan');
    fireEvent.click(button);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Failed to generate plan. Please try again.');
    });

    consoleSpy.mockRestore();
  });

  it('should not call generatePlan when title is empty', () => {
    renderDialog();

    const descInput = screen.getByLabelText('Description');
    fireEvent.change(descInput, { target: { value: 'My Description' } });

    const button = screen.getByText('Generate Plan');
    expect(button).toBeDisabled();

    // Force click even if disabled
    fireEvent.click(button);
    expect(mockGeneratePlan).not.toHaveBeenCalled();
  });

  it('should not call generatePlan when description is empty', () => {
    renderDialog();

    const titleInput = screen.getByLabelText('Title');
    fireEvent.change(titleInput, { target: { value: 'My Plan' } });

    const button = screen.getByText('Generate Plan');
    expect(button).toBeDisabled();
  });

  it('should not render dialog when open is false', () => {
    renderDialog(false);
    expect(screen.queryByText('Generate Plan with Claude')).not.toBeInTheDocument();
  });
});
