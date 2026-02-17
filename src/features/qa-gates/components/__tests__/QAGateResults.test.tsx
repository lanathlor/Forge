import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QAGateResults } from '../QAGateResults';
import { ToastProvider } from '@/shared/components/ui/toast';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to render with ToastProvider
function renderWithToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('QAGateResults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading state initially', () => {
      mockFetch.mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          })
      );

      renderWithToast(<QAGateResults taskId="task-1" />);

      expect(
        screen.getByText('Loading QA gate results...')
      ).toBeInTheDocument();
    });
  });

  describe('All Tests Passed', () => {
    const mockPassedResults = {
      results: [
        {
          gateName: 'TypeScript Check',
          status: 'passed',
          output: 'No errors found',
          errors: [],
          duration: 2500,
        },
        {
          gateName: 'ESLint',
          status: 'passed',
          output: 'All rules passed',
          errors: [],
          duration: 1500,
        },
      ],
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockPassedResults,
      });
    });

    it('displays all passed badge', async () => {
      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(screen.getByText('✅ ALL PASSED')).toBeInTheDocument();
      });
    });

    it('renders all gate results', async () => {
      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(screen.getByText(/TypeScript Check/)).toBeInTheDocument();
        expect(screen.getByText(/ESLint/)).toBeInTheDocument();
      });
    });

    it('displays correct status badges', async () => {
      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        const badges = screen.getAllByText('passed');
        expect(badges).toHaveLength(2);
      });
    });

    it('shows duration for each gate', async () => {
      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(screen.getByText('2.5s')).toBeInTheDocument();
        expect(screen.getByText('1.5s')).toBeInTheDocument();
      });
    });

    it('shows success message for passed gates', async () => {
      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        const messages = screen.getAllByText('No errors or warnings found');
        expect(messages).toHaveLength(2);
      });
    });

    it('does not show attempt information when all passed', async () => {
      renderWithToast(
        <QAGateResults taskId="task-1" attempt={2} maxAttempts={3} />
      );

      await waitFor(() => {
        expect(screen.queryByText(/Attempt/)).not.toBeInTheDocument();
      });
    });

    it('does not show footer when all passed', async () => {
      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(
          screen.queryByText(/Maximum retry attempts/)
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Failed Tests', () => {
    const mockFailedResults = {
      results: [
        {
          gateName: 'TypeScript Check',
          status: 'failed',
          output: 'Type checking output',
          errors: ['Type error in file.ts', 'Missing property'],
          duration: 3000,
        },
        {
          gateName: 'ESLint',
          status: 'passed',
          output: 'All rules passed',
          errors: [],
          duration: 1500,
        },
      ],
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockFailedResults,
      });
    });

    it('displays failed badge with count', async () => {
      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(screen.getByText('❌ FAILED (1/2 passed)')).toBeInTheDocument();
      });
    });

    it('shows attempt information when failed', async () => {
      renderWithToast(
        <QAGateResults taskId="task-1" attempt={2} maxAttempts={3} />
      );

      await waitFor(() => {
        expect(screen.getByText('Attempt 2 of 3')).toBeInTheDocument();
      });
    });

    it('shows error count when details expanded', async () => {
      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(screen.getAllByText('Show Details').length).toBeGreaterThan(0);
      });

      const showDetailsButtons = screen.getAllByText('Show Details');
      await userEvent.click(showDetailsButtons[0]!);

      await waitFor(() => {
        expect(screen.getByText('2 errors found:')).toBeInTheDocument();
      });
    });

    it('displays individual errors', async () => {
      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(screen.getAllByText('Show Details').length).toBeGreaterThan(0);
      });

      const showDetailsButtons = screen.getAllByText('Show Details');
      await userEvent.click(showDetailsButtons[0]!);

      await waitFor(() => {
        expect(screen.getByText('Type error in file.ts')).toBeInTheDocument();
        expect(screen.getByText('Missing property')).toBeInTheDocument();
      });
    });

    it('shows footer when max attempts reached', async () => {
      renderWithToast(
        <QAGateResults taskId="task-1" attempt={3} maxAttempts={3} />
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Maximum retry attempts \(3\) reached/)
        ).toBeInTheDocument();
      });
    });

    it('does not show footer when max attempts not reached', async () => {
      renderWithToast(
        <QAGateResults taskId="task-1" attempt={2} maxAttempts={3} />
      );

      await waitFor(() => {
        expect(
          screen.queryByText(/Maximum retry attempts/)
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Skipped Tests', () => {
    const mockSkippedResults = {
      results: [
        {
          gateName: 'TypeScript Check',
          status: 'failed',
          output: 'Type errors',
          errors: ['Error 1'],
          duration: 2000,
        },
        {
          gateName: 'ESLint',
          status: 'skipped',
          output: '',
          errors: [],
          duration: 0,
        },
      ],
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockSkippedResults,
      });
    });

    it('displays skipped badge', async () => {
      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(screen.getByText('skipped')).toBeInTheDocument();
      });
    });

    it('shows skipped message', async () => {
      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(
          screen.getByText('Skipped (previous gate failed)')
        ).toBeInTheDocument();
      });
    });

    it('treats skipped as passed for overall status', async () => {
      const allPassedResults = {
        results: [
          {
            gateName: 'TypeScript Check',
            status: 'passed',
            output: '',
            errors: [],
            duration: 2000,
          },
          {
            gateName: 'ESLint',
            status: 'skipped',
            output: '',
            errors: [],
            duration: 0,
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => allPassedResults,
      });

      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(screen.getByText('✅ ALL PASSED')).toBeInTheDocument();
      });
    });
  });

  describe('Details Toggle', () => {
    const mockResultsWithDetails = {
      results: [
        {
          gateName: 'TypeScript Check',
          status: 'failed',
          output: 'Compilation output',
          errors: ['Error 1', 'Error 2'],
          duration: 3000,
        },
      ],
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResultsWithDetails,
      });
    });

    it('shows "Show Details" button when gate has output or errors', async () => {
      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(screen.getByText('Show Details')).toBeInTheDocument();
      });
    });

    it('toggles details visibility when button clicked', async () => {
      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(screen.getByText('Show Details')).toBeInTheDocument();
      });

      const toggleButton = screen.getByText('Show Details');
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText('Hide Details')).toBeInTheDocument();
        expect(screen.getByText('Compilation output')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Hide Details'));

      await waitFor(() => {
        expect(screen.getByText('Show Details')).toBeInTheDocument();
        expect(
          screen.queryByText('Compilation output')
        ).not.toBeInTheDocument();
      });
    });

    it('shows both output and errors when expanded', async () => {
      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(screen.getByText('Show Details')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Show Details'));

      await waitFor(() => {
        expect(screen.getByText('Output:')).toBeInTheDocument();
        expect(screen.getByText('Compilation output')).toBeInTheDocument();
        expect(screen.getByText('2 errors found:')).toBeInTheDocument();
        expect(screen.getByText('Error 1')).toBeInTheDocument();
        expect(screen.getByText('Error 2')).toBeInTheDocument();
      });
    });
  });

  describe('Re-run Functionality', () => {
    const mockResults = {
      results: [
        {
          gateName: 'TypeScript Check',
          status: 'failed',
          output: '',
          errors: ['Error'],
          duration: 2000,
        },
      ],
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResults,
      });
    });

    it('renders re-run button in header', async () => {
      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(screen.getByText('Re-run Gates')).toBeInTheDocument();
      });
    });

    it('calls API to re-run gates when button clicked', async () => {
      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(screen.getByText('Re-run Gates')).toBeInTheDocument();
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResults,
      });

      await userEvent.click(screen.getByText('Re-run Gates'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/tasks/task-1/qa-gates/run',
          { method: 'POST' }
        );
      });
    });

    it('renders Fix & Re-run button in footer when max attempts reached', async () => {
      renderWithToast(
        <QAGateResults taskId="task-1" attempt={3} maxAttempts={3} />
      );

      await waitFor(() => {
        expect(screen.getByText('Fix & Re-run')).toBeInTheDocument();
      });
    });

    it('renders Override & Approve Anyway button in footer', async () => {
      renderWithToast(
        <QAGateResults taskId="task-1" attempt={3} maxAttempts={3} />
      );

      await waitFor(() => {
        expect(
          screen.getByText('Override & Approve Anyway')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Icons', () => {
    it('displays correct icon for passed status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              gateName: 'Test',
              status: 'passed',
              output: '',
              errors: [],
              duration: 1000,
            },
          ],
        }),
      });

      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(screen.getByText(/✅ Test/)).toBeInTheDocument();
      });
    });

    it('displays correct icon for failed status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              gateName: 'Test',
              status: 'failed',
              output: '',
              errors: ['Error'],
              duration: 1000,
            },
          ],
        }),
      });

      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(screen.getByText(/❌ Test/)).toBeInTheDocument();
      });
    });

    it('displays correct icon for skipped status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              gateName: 'Test',
              status: 'skipped',
              output: '',
              errors: [],
              duration: 0,
            },
          ],
        }),
      });

      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(screen.getByText(/⏭️ Test/)).toBeInTheDocument();
      });
    });

    it('displays correct icon for running status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              gateName: 'Test',
              status: 'running',
              output: '',
              errors: [],
              duration: 1000,
            },
          ],
        }),
      });

      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(screen.getByText(/⏳ Test/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles fetch errors gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));

      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to load QA gate results:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it('handles empty results', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });

      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(screen.getByText('QA Gate Results')).toBeInTheDocument();
      });
    });
  });

  describe('Default Props', () => {
    it('uses default attempt value of 1', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              gateName: 'Test',
              status: 'failed',
              output: '',
              errors: ['Error'],
              duration: 1000,
            },
          ],
        }),
      });

      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(screen.getByText('Attempt 1 of 3')).toBeInTheDocument();
      });
    });

    it('uses default maxAttempts value of 3', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              gateName: 'Test',
              status: 'failed',
              output: '',
              errors: ['Error'],
              duration: 1000,
            },
          ],
        }),
      });

      renderWithToast(<QAGateResults taskId="task-1" attempt={1} />);

      await waitFor(() => {
        expect(screen.getByText('Attempt 1 of 3')).toBeInTheDocument();
      });
    });
  });

  describe('Single Error Display', () => {
    it('displays singular "error" for single error', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              gateName: 'Test',
              status: 'failed',
              output: '',
              errors: ['Single error'],
              duration: 1000,
            },
          ],
        }),
      });

      renderWithToast(<QAGateResults taskId="task-1" />);

      await waitFor(() => {
        expect(screen.getByText('Show Details')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Show Details'));

      await waitFor(() => {
        expect(screen.getByText('1 error found:')).toBeInTheDocument();
      });
    });
  });
});
