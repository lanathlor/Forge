import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApprovalPanel } from '../ApprovalPanel';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

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
  });

  it('should render review panel with header and QA status', () => {
    render(<ApprovalPanel {...defaultProps} />);

    expect(screen.getByText('Review Changes')).toBeInTheDocument();
    expect(screen.getByText('QA Passed')).toBeInTheDocument();
  });

  it('should render file change summary with stats', () => {
    render(<ApprovalPanel {...defaultProps} />);

    expect(screen.getByText('Files Changed')).toBeInTheDocument();
    expect(screen.getByText('2 files')).toBeInTheDocument();
  });

  it('should render single file text correctly', () => {
    const singleFileProps = {
      ...defaultProps,
      filesChanged: [
        { path: 'src/index.ts', status: 'modified' as const, additions: 5, deletions: 3 },
      ],
    };

    render(<ApprovalPanel {...singleFileProps} />);

    expect(screen.getByText('1 file')).toBeInTheDocument();
  });

  it('should render pre-flight checklist', () => {
    render(<ApprovalPanel {...defaultProps} />);

    expect(screen.getByText('Pre-flight Checklist')).toBeInTheDocument();
    expect(screen.getByText('QA gates passed')).toBeInTheDocument();
    expect(screen.getByText('Diff reviewed')).toBeInTheDocument();
    expect(screen.getByText('Commit message ready')).toBeInTheDocument();
  });

  it('should show QA Failed badge when qaGatesPassed is false', () => {
    render(<ApprovalPanel {...defaultProps} qaGatesPassed={false} />);

    expect(screen.getByText('QA Failed')).toBeInTheDocument();
    expect(screen.getByText('QA gates have failed. Fix issues before approving.')).toBeInTheDocument();
  });

  it('should disable approve button when QA gates failed', () => {
    render(<ApprovalPanel {...defaultProps} qaGatesPassed={false} />);

    const approveButton = screen.getByRole('button', { name: /Approve Changes/i });
    expect(approveButton).toBeDisabled();
  });

  it('should disable approve button when checklist is incomplete', () => {
    render(<ApprovalPanel {...defaultProps} qaGatesPassed={true} />);

    // Approve should be disabled because "Diff reviewed" is unchecked
    const approveButton = screen.getByRole('button', { name: /Approve Changes/i });
    expect(approveButton).toBeDisabled();
  });

  it('should enable approve button after completing the checklist', () => {
    render(<ApprovalPanel {...defaultProps} qaGatesPassed={true} />);

    // Check the "Diff reviewed" item
    const diffItem = screen.getByText('Diff reviewed');
    fireEvent.click(diffItem);

    const approveButton = screen.getByRole('button', { name: /Approve Changes/i });
    expect(approveButton).not.toBeDisabled();
  });

  it('should show approve confirmation dialog when approve is clicked', () => {
    render(<ApprovalPanel {...defaultProps} qaGatesPassed={true} />);

    // Complete checklist
    fireEvent.click(screen.getByText('Diff reviewed'));

    // Click approve
    fireEvent.click(screen.getByRole('button', { name: /Approve Changes/i }));

    // Confirmation dialog should appear
    expect(screen.getByText(/This will generate a commit message/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm Approval' })).toBeInTheDocument();
  });

  it('should call approve API after confirming in dialog', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ commitMessage: 'feat: add new feature' }),
    });

    render(<ApprovalPanel {...defaultProps} />);

    // Complete checklist
    fireEvent.click(screen.getByText('Diff reviewed'));

    // Click approve button
    fireEvent.click(screen.getByRole('button', { name: /Approve Changes/i }));

    // Confirm in dialog
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Approval' }));

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

    // Complete checklist & click approve
    fireEvent.click(screen.getByText('Diff reviewed'));
    fireEvent.click(screen.getByRole('button', { name: /Approve Changes/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Approval' }));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('should show reject confirmation dialog when reject is clicked', () => {
    render(<ApprovalPanel {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Reject & Revert/i }));

    expect(screen.getByText(/This will revert all changes/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Describe why these changes are being rejected...')).toBeInTheDocument();
  });

  it('should call reject API with reason after confirming', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const onRejected = vi.fn();
    render(<ApprovalPanel {...defaultProps} onRejected={onRejected} />);

    // Click reject
    fireEvent.click(screen.getByRole('button', { name: /Reject & Revert/i }));

    // Type reason
    const textarea = screen.getByPlaceholderText('Describe why these changes are being rejected...');
    fireEvent.change(textarea, { target: { value: 'Code quality issues' } });

    // Confirm rejection
    const confirmButtons = screen.getAllByRole('button', { name: /Reject & Revert/i });
    // The dialog's confirm button is the destructive one
    const dialogConfirmButton = confirmButtons.find(
      (btn) => btn.closest('[role="dialog"]')
    );
    fireEvent.click(dialogConfirmButton!);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/tasks/task-123/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Code quality issues' }),
      });
    });
  });

  it('should show error when reject API fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Reject failed' }),
    });

    render(<ApprovalPanel {...defaultProps} />);

    // Click reject and confirm
    fireEvent.click(screen.getByRole('button', { name: /Reject & Revert/i }));
    const confirmButtons = screen.getAllByRole('button', { name: /Reject & Revert/i });
    const dialogConfirmButton = confirmButtons.find(
      (btn) => btn.closest('[role="dialog"]')
    );
    fireEvent.click(dialogConfirmButton!);

    await waitFor(() => {
      expect(screen.getByText('Reject failed')).toBeInTheDocument();
    });
  });

  it('should call onApproved callback after successful commit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ commitMessage: 'feat: test' }),
    });

    const onApproved = vi.fn();
    render(<ApprovalPanel {...defaultProps} onApproved={onApproved} />);

    // Complete checklist & approve
    fireEvent.click(screen.getByText('Diff reviewed'));
    fireEvent.click(screen.getByRole('button', { name: /Approve Changes/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Approval' }));

    await waitFor(() => {
      expect(screen.getByTestId('commit-message-editor')).toBeInTheDocument();
    });

    // Click commit in the mocked editor
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }));
    expect(onApproved).toHaveBeenCalled();
  });

  it('should return to review panel when cancel is clicked in commit editor', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ commitMessage: 'feat: test' }),
    });

    render(<ApprovalPanel {...defaultProps} />);

    // Complete checklist & approve
    fireEvent.click(screen.getByText('Diff reviewed'));
    fireEvent.click(screen.getByRole('button', { name: /Approve Changes/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Approval' }));

    await waitFor(() => {
      expect(screen.getByTestId('commit-message-editor')).toBeInTheDocument();
    });

    // Click cancel in the mocked editor
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Should be back to review panel
    expect(screen.getByText('Review Changes')).toBeInTheDocument();
  });

  it('should show keyboard shortcut hints', () => {
    render(<ApprovalPanel {...defaultProps} />);

    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('should expand file list when clicking the file summary', () => {
    render(<ApprovalPanel {...defaultProps} />);

    // Click the files changed header to expand
    fireEvent.click(screen.getByText('Files Changed'));

    // Should show individual file paths
    expect(screen.getByText('src/index.ts')).toBeInTheDocument();
    expect(screen.getByText('src/utils.ts')).toBeInTheDocument();
  });

  it('should toggle checklist items on click', () => {
    render(<ApprovalPanel {...defaultProps} />);

    const diffItem = screen.getByText('Diff reviewed');

    // Initially unchecked - approve should be disabled
    expect(screen.getByRole('button', { name: /Approve Changes/i })).toBeDisabled();

    // Check it
    fireEvent.click(diffItem);
    expect(screen.getByRole('button', { name: /Approve Changes/i })).not.toBeDisabled();

    // Uncheck it
    fireEvent.click(diffItem);
    expect(screen.getByRole('button', { name: /Approve Changes/i })).toBeDisabled();
  });

  it('should handle keyboard shortcut A to open approve dialog', () => {
    render(<ApprovalPanel {...defaultProps} qaGatesPassed={true} />);

    // Complete checklist first
    fireEvent.click(screen.getByText('Diff reviewed'));

    // Press A key
    fireEvent.keyDown(document, { key: 'a' });

    // Approval dialog should appear
    expect(screen.getByRole('button', { name: 'Confirm Approval' })).toBeInTheDocument();
  });

  it('should handle keyboard shortcut R to open reject dialog', () => {
    render(<ApprovalPanel {...defaultProps} />);

    // Press R key
    fireEvent.keyDown(document, { key: 'r' });

    // Reject dialog should appear
    expect(screen.getByText(/This will revert all changes/)).toBeInTheDocument();
  });

  it('should not trigger keyboard shortcuts when typing in a textarea', () => {
    render(<ApprovalPanel {...defaultProps} />);

    // Open reject dialog to get a textarea
    fireEvent.click(screen.getByRole('button', { name: /Reject & Revert/i }));

    const textarea = screen.getByPlaceholderText('Describe why these changes are being rejected...');

    // Type 'r' in the textarea - should not trigger shortcut
    fireEvent.keyDown(textarea, { key: 'r' });

    // The dialog should still be open (not a duplicate)
    expect(screen.getByText(/This will revert all changes/)).toBeInTheDocument();
  });

  it('should default qaGatesPassed to true', () => {
    const { qaGatesPassed: _, ...propsWithoutQA } = defaultProps;
    render(<ApprovalPanel {...propsWithoutQA} />);

    expect(screen.getByText('QA Passed')).toBeInTheDocument();
  });

  it('should show status breakdown badges', () => {
    render(<ApprovalPanel {...defaultProps} />);

    expect(screen.getByText('1 modified')).toBeInTheDocument();
    expect(screen.getByText('1 added')).toBeInTheDocument();
  });
});
