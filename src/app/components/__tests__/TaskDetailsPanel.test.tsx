import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TaskDetailsPanel } from '../TaskDetailsPanel';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock DiffViewer component
vi.mock('@/features/diff-viewer/components/DiffViewer', () => ({
  DiffViewer: ({ taskId }: { taskId: string }) => (
    <div data-testid="diff-viewer">DiffViewer for {taskId}</div>
  ),
}));

// Mock QAGateResults component
vi.mock('@/features/qa-gates/components/QAGateResults', () => ({
  QAGateResults: ({ taskId }: { taskId: string }) => (
    <div data-testid="qa-gate-results">QAGateResults for {taskId}</div>
  ),
}));

// Mock ApprovalPanel component
vi.mock('../ApprovalPanel', () => ({
  ApprovalPanel: ({ taskId }: { taskId: string }) => (
    <div data-testid="approval-panel">ApprovalPanel for {taskId}</div>
  ),
}));

describe('TaskDetailsPanel', () => {
  const mockTask = {
    id: 'task-123',
    prompt: 'Fix authentication bug',
    status: 'running',
    claudeOutput: 'Initial output from database',
    createdAt: '2024-01-01T00:00:00Z',
    startedAt: '2024-01-01T00:01:00Z',
    completedAt: null,
    diffContent: null,
    filesChanged: null,
    commitMessage: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('should show loading state initially', () => {
    mockFetch.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

    render(<TaskDetailsPanel taskId="task-123" updates={[]} />);

    // Should show loading spinner
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should show not found state when task is not found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
    });

    render(<TaskDetailsPanel taskId="task-123" updates={[]} />);

    await waitFor(() => {
      expect(screen.getByText('Task not found')).toBeInTheDocument();
    });
  });

  it('should render task details after loading', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ task: mockTask }),
    });

    render(<TaskDetailsPanel taskId="task-123" updates={[]} />);

    await waitFor(() => {
      expect(screen.getByText('Fix authentication bug')).toBeInTheDocument();
    });

    expect(screen.getByText('running')).toBeInTheDocument();
  });

  it('should display initial output from database', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ task: mockTask }),
    });

    render(<TaskDetailsPanel taskId="task-123" updates={[]} />);

    await waitFor(() => {
      expect(screen.getByText('Initial output from database')).toBeInTheDocument();
    });
  });

  it('should show waiting message when no output and running', async () => {
    const taskWithoutOutput = { ...mockTask, claudeOutput: null };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ task: taskWithoutOutput }),
    });

    render(<TaskDetailsPanel taskId="task-123" updates={[]} />);

    await waitFor(() => {
      expect(screen.getByText('Waiting for output...')).toBeInTheDocument();
    });
  });

  it('should show no output message when completed without output', async () => {
    const completedTask = { ...mockTask, status: 'completed', claudeOutput: null };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ task: completedTask }),
    });

    render(<TaskDetailsPanel taskId="task-123" updates={[]} />);

    await waitFor(() => {
      expect(screen.getByText('No output available')).toBeInTheDocument();
    });
  });

  it('should render with output updates prop', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ task: mockTask }),
    });

    const updates = [
      { type: 'task_output' as const, taskId: 'task-123', output: ' New output chunk', timestamp: '2024-01-01T00:02:00Z' },
    ];

    render(<TaskDetailsPanel taskId="task-123" updates={updates} />);

    await waitFor(() => {
      expect(screen.getByText(/Initial output from database/)).toBeInTheDocument();
    });

    // Verify component renders properly with updates
    expect(screen.getByText('Fix authentication bug')).toBeInTheDocument();
  });

  it('should update task status from real-time updates', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ task: mockTask }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ task: { ...mockTask, status: 'completed' } }),
      });

    const { rerender } = render(<TaskDetailsPanel taskId="task-123" updates={[]} />);

    await waitFor(() => {
      expect(screen.getByText('running')).toBeInTheDocument();
    });

    // Simulate status update
    const updates = [
      { type: 'task_update' as const, taskId: 'task-123', status: 'completed', timestamp: '2024-01-01T00:02:00Z' },
    ];

    rerender(<TaskDetailsPanel taskId="task-123" updates={updates} />);

    await waitFor(() => {
      expect(screen.getByText('completed')).toBeInTheDocument();
    });
  });

  it('should render tabs for Output, Diff, QA Gates', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ task: mockTask }),
    });

    render(<TaskDetailsPanel taskId="task-123" updates={[]} />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Output' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Diff' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'QA Gates' })).toBeInTheDocument();
    });
  });

  it('should show Approval tab when status is waiting_approval', async () => {
    const waitingTask = {
      ...mockTask,
      status: 'waiting_approval',
      filesChanged: [{ path: 'test.ts', status: 'modified', additions: 5, deletions: 3 }],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ task: waitingTask }),
    });

    render(<TaskDetailsPanel taskId="task-123" updates={[]} />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Approval' })).toBeInTheDocument();
    });
  });

  it('should not show Approval tab when status is not waiting_approval', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ task: mockTask }),
    });

    render(<TaskDetailsPanel taskId="task-123" updates={[]} />);

    await waitFor(() => {
      expect(screen.getByText('Fix authentication bug')).toBeInTheDocument();
    });

    expect(screen.queryByRole('tab', { name: 'Approval' })).not.toBeInTheDocument();
  });

  it('should render diff tab trigger', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ task: mockTask }),
    });

    render(<TaskDetailsPanel taskId="task-123" updates={[]} />);

    await waitFor(() => {
      expect(screen.getByText('Fix authentication bug')).toBeInTheDocument();
    });

    // Verify the diff tab exists and is clickable
    const diffTab = screen.getByRole('tab', { name: 'Diff' });
    expect(diffTab).toBeInTheDocument();
  });

  it('should render with diff content available', async () => {
    const taskWithDiff = { ...mockTask, diffContent: 'diff content here' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ task: taskWithDiff }),
    });

    render(<TaskDetailsPanel taskId="task-123" updates={[]} />);

    await waitFor(() => {
      expect(screen.getByText('Fix authentication bug')).toBeInTheDocument();
    });

    // Verify the component renders without error when diff content exists
    const diffTab = screen.getByRole('tab', { name: 'Diff' });
    expect(diffTab).toBeInTheDocument();
  });

  it('should show correct status icon for completed tasks', async () => {
    const completedTask = { ...mockTask, status: 'completed' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ task: completedTask }),
    });

    render(<TaskDetailsPanel taskId="task-123" updates={[]} />);

    await waitFor(() => {
      // Check for green checkmark icon (text-green-600 class)
      const icon = document.querySelector('.text-green-600');
      expect(icon).toBeInTheDocument();
    });
  });

  it('should show correct status icon for failed tasks', async () => {
    const failedTask = { ...mockTask, status: 'failed' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ task: failedTask }),
    });

    render(<TaskDetailsPanel taskId="task-123" updates={[]} />);

    await waitFor(() => {
      // Check for red X icon (text-red-600 class)
      const icon = document.querySelector('.text-red-600');
      expect(icon).toBeInTheDocument();
    });
  });

  it('should show spinning icon for running tasks', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ task: mockTask }),
    });

    render(<TaskDetailsPanel taskId="task-123" updates={[]} />);

    await waitFor(() => {
      // Check for spinning icon (animate-spin class)
      const icon = document.querySelector('.animate-spin.text-blue-600');
      expect(icon).toBeInTheDocument();
    });
  });

  it('should reload task when taskId changes', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ task: mockTask }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ task: { ...mockTask, id: 'task-456', prompt: 'Different task' } }),
      });

    const { rerender } = render(<TaskDetailsPanel taskId="task-123" updates={[]} />);

    await waitFor(() => {
      expect(screen.getByText('Fix authentication bug')).toBeInTheDocument();
    });

    rerender(<TaskDetailsPanel taskId="task-456" updates={[]} />);

    await waitFor(() => {
      expect(screen.getByText('Different task')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should handle fetch error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<TaskDetailsPanel taskId="task-123" updates={[]} />);

    await waitFor(() => {
      expect(screen.getByText('Task not found')).toBeInTheDocument();
    });
  });

  it('should ignore output updates for different task', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ task: mockTask }),
    });

    const updates = [
      { type: 'task_output' as const, taskId: 'different-task', output: 'Should not appear', timestamp: '2024-01-01T00:02:00Z' },
    ];

    render(<TaskDetailsPanel taskId="task-123" updates={updates} />);

    await waitFor(() => {
      expect(screen.getByText('Initial output from database')).toBeInTheDocument();
    });

    expect(screen.queryByText('Should not appear')).not.toBeInTheDocument();
  });
});
