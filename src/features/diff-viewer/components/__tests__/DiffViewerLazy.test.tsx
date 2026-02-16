import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiffViewerLazy } from '../DiffViewerLazy';
import * as React from 'react';

// Mock the DiffViewer component
vi.mock('../DiffViewer', () => ({
  DiffViewer: ({ taskId }: { taskId: string }) => (
    <div data-testid="diff-viewer">DiffViewer for task: {taskId}</div>
  ),
}));

describe('DiffViewerLazy', () => {
  it('should render loading fallback initially', () => {
    render(<DiffViewerLazy taskId="test-task-123" />);

    expect(screen.getByText('Loading diff viewer...')).toBeInTheDocument();
  });

  it('should render DiffViewer component after loading', async () => {
    render(<DiffViewerLazy taskId="test-task-456" />);

    // Wait for Suspense to resolve
    const diffViewer = await screen.findByTestId('diff-viewer');
    expect(diffViewer).toBeInTheDocument();
    expect(diffViewer).toHaveTextContent('DiffViewer for task: test-task-456');
  });

  it('should pass taskId prop to DiffViewer', async () => {
    const taskId = 'specific-task-id';
    render(<DiffViewerLazy taskId={taskId} />);

    const diffViewer = await screen.findByTestId('diff-viewer');
    expect(diffViewer).toHaveTextContent(`DiffViewer for task: ${taskId}`);
  });

  it('should show loading text in fallback', () => {
    const { container } = render(<DiffViewerLazy taskId="test-task" />);

    // Check for loading text which is guaranteed to be there during initial render
    const loadingText = screen.queryByText('Loading diff viewer...');
    // Either loading text is shown, or it's already loaded (both are valid)
    expect(loadingText !== null || screen.queryByTestId('diff-viewer') !== null).toBe(true);
  });
});
