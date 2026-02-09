import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApprovalPanel } from '../ApprovalPanel';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.prompt
const mockPrompt = vi.fn();
global.prompt = mockPrompt;

// Mock CommitMessageEditor component
vi.mock('../CommitMessageEditor', () => ({
  CommitMessageEditor: ({ taskId, initialMessage, onCommitted, onCancel }: {
    taskId: string;
    initialMessage: string;
    onCommitted: () => void;
    onCancel: () => void;
  }) => (
    <div data-testid="commit-message-editor">
      <span data-testid="task-id">{taskId}</span>
      <span data-testid="initial-message">{initialMessage}</span>
      <button onClick={onCommitted}>Commit</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

describe('ApprovalPanel', () => {
  const defaultProps = {
    taskId: 'task-123',
    filesChanged: [
      { path: 'src/index.ts', status: 'modified' as const, additions: 10, deletions: 5 },
      { path: 'src/utils.ts', status: 'added' as const, additions: 20, deletions: 0 },
    ],
    qaGatesPassed: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockPrompt.mockReset();
  });

  it('should render review panel with file statistics', () => {
    render(<ApprovalPanel {...defaultProps} />);

    expect(screen.getByText('Review Changes')).toBeInTheDocument();
    expect(screen.getByText('2 files changed')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument(); // insertions
    expect(screen.getByText('5')).toBeInTheDocument(); // deletions
  });

  it('should show QA Gates passed badge when qaGatesPassed is true', () => {
    render(<ApprovalPanel {...defaultProps} qaGatesPassed={true} />);

    expect(screen.getByText('All Passed')).toBeInTheDocument();
  });

  it('should show QA Gates failed badge when qaGatesPassed is false', () => {
    render(<ApprovalPanel {...defaultProps} qaGatesPassed={false} />);

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Fix QA gate failures before approving')).toBeInTheDocument();
  });

  it('should disable approve button when qaGatesPassed is false', () => {
    render(<ApprovalPanel {...defaultProps} qaGatesPassed={false} />);

    const approveButton = screen.getByRole('button', { name: 'Approve Changes' });
    expect(approveButton).toBeDisabled();
  });

  it('should enable approve button when qaGatesPassed is true', () => {
    render(<ApprovalPanel {...defaultProps} qaGatesPassed={true} />);

    const approveButton = screen.getByRole('button', { name: 'Approve Changes' });
    expect(approveButton).not.toBeDisabled();
  });

  it('should call approve API and show commit message editor on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ commitMessage: 'feat: add new feature' }),
    });

    render(<ApprovalPanel {...defaultProps} />);

    const approveButton = screen.getByRole('button', { name: 'Approve Changes' });
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(screen.getByTestId('commit-message-editor')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/tasks/task-123/approve', { method: 'POST' });
    expect(screen.getByTestId('initial-message')).toHaveTextContent('feat: add new feature');
  });

  it('should show error message when approve API fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Server error' }),
    });

    render(<ApprovalPanel {...defaultProps} />);

    const approveButton = screen.getByRole('button', { name: 'Approve Changes' });
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('should show loading state while approving', async () => {
    mockFetch.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ commitMessage: 'test' }),
      }), 100))
    );

    render(<ApprovalPanel {...defaultProps} />);

    const approveButton = screen.getByRole('button', { name: 'Approve Changes' });
    fireEvent.click(approveButton);

    expect(screen.getByText('Generating...')).toBeInTheDocument();
  });

  it('should call reject API when reject button is clicked', async () => {
    mockPrompt.mockReturnValueOnce('Code quality issues');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const onRejected = vi.fn();
    render(<ApprovalPanel {...defaultProps} onRejected={onRejected} />);

    const rejectButton = screen.getByRole('button', { name: 'Reject & Revert' });
    fireEvent.click(rejectButton);

    await waitFor(() => {
      expect(onRejected).toHaveBeenCalled();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/tasks/task-123/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Code quality issues' }),
    });
  });

  it('should show error when reject API fails', async () => {
    mockPrompt.mockReturnValueOnce('Reason');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Reject failed' }),
    });

    render(<ApprovalPanel {...defaultProps} />);

    const rejectButton = screen.getByRole('button', { name: 'Reject & Revert' });
    fireEvent.click(rejectButton);

    await waitFor(() => {
      expect(screen.getByText('Reject failed')).toBeInTheDocument();
    });
  });

  it('should handle single file correctly', () => {
    const singleFileProps = {
      ...defaultProps,
      filesChanged: [
        { path: 'src/index.ts', status: 'modified' as const, additions: 5, deletions: 3 },
      ],
    };

    render(<ApprovalPanel {...singleFileProps} />);

    expect(screen.getByText('1 file changed')).toBeInTheDocument();
  });

  it('should call onApproved callback after successful commit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ commitMessage: 'feat: test' }),
    });

    const onApproved = vi.fn();
    render(<ApprovalPanel {...defaultProps} onApproved={onApproved} />);

    // First approve to show commit editor
    const approveButton = screen.getByRole('button', { name: 'Approve Changes' });
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(screen.getByTestId('commit-message-editor')).toBeInTheDocument();
    });

    // Click commit in the mocked editor
    const commitButton = screen.getByRole('button', { name: 'Commit' });
    fireEvent.click(commitButton);

    expect(onApproved).toHaveBeenCalled();
  });

  it('should return to review panel when cancel is clicked in commit editor', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ commitMessage: 'feat: test' }),
    });

    render(<ApprovalPanel {...defaultProps} />);

    // First approve to show commit editor
    const approveButton = screen.getByRole('button', { name: 'Approve Changes' });
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(screen.getByTestId('commit-message-editor')).toBeInTheDocument();
    });

    // Click cancel in the mocked editor
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    // Should be back to review panel
    expect(screen.getByText('Review Changes')).toBeInTheDocument();
  });

  it('should disable buttons while loading', async () => {
    mockFetch.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ commitMessage: 'test' }),
      }), 100))
    );

    render(<ApprovalPanel {...defaultProps} />);

    const approveButton = screen.getByRole('button', { name: 'Approve Changes' });
    fireEvent.click(approveButton);

    const rejectButton = screen.getByRole('button', { name: 'Reject & Revert' });
    expect(rejectButton).toBeDisabled();
  });

  it('should default qaGatesPassed to true', () => {
    const { qaGatesPassed: _, ...propsWithoutQA } = defaultProps;
    render(<ApprovalPanel {...propsWithoutQA} />);

    expect(screen.getByText('All Passed')).toBeInTheDocument();
    const approveButton = screen.getByRole('button', { name: 'Approve Changes' });
    expect(approveButton).not.toBeDisabled();
  });
});
