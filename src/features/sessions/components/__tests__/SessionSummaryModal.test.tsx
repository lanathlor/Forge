import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionSummaryModal } from '../SessionSummaryModal';

// Mock the sessionsApi hooks
const mockUseGetSessionSummaryQuery = vi.fn();

vi.mock('@/features/sessions/store/sessionsApi', () => ({
  useGetSessionSummaryQuery: (...args: unknown[]) => mockUseGetSessionSummaryQuery(...args),
}));

// Mock Dialog from shadcn
vi.mock('@/shared/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}));

describe('SessionSummaryModal', () => {
  const mockSummary = {
    session: {
      id: 'session-123',
      repositoryId: 'repo-1',
      status: 'completed',
      startBranch: 'main',
      endBranch: 'feature-branch',
      startedAt: new Date('2024-01-01T10:00:00Z'),
      endedAt: new Date('2024-01-01T12:00:00Z'),
      repository: {
        id: 'repo-1',
        name: 'test-repo',
        path: '/path/to/repo',
        currentBranch: 'main',
      },
    },
    stats: {
      totalTasks: 10,
      completedTasks: 7,
      rejectedTasks: 2,
      failedTasks: 1,
      filesChanged: 25,
      commits: 5,
      duration: 7200000, // 2 hours
    },
  };

  const mockOnClose = vi.fn();
  const mockOnNewSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetSessionSummaryQuery.mockReturnValue({
      data: mockSummary,
      isLoading: false,
    });
  });

  describe('Basic Rendering', () => {
    it('renders when isOpen is true', () => {
      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={false}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('displays title', () => {
      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Session Summary')).toBeInTheDocument();
    });

    it('displays session completion description', () => {
      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Session completed for test-repo')).toBeInTheDocument();
    });
  });

  describe('Session Info Display', () => {
    it('displays repository name', () => {
      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Repository')).toBeInTheDocument();
      expect(screen.getByText('test-repo')).toBeInTheDocument();
    });

    it('displays duration', () => {
      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByText('2 hours 0 minutes')).toBeInTheDocument();
    });

    it('displays start time', () => {
      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Started')).toBeInTheDocument();
    });

    it('displays end time when session ended', () => {
      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Ended')).toBeInTheDocument();
    });
  });

  describe('Branch Info Display', () => {
    it('displays start branch', () => {
      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Start:')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();
    });

    it('displays end branch when different from start', () => {
      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('End:')).toBeInTheDocument();
      expect(screen.getByText('feature-branch')).toBeInTheDocument();
    });

    it('does not display end branch when same as start', () => {
      const sameBranchSummary = {
        ...mockSummary,
        session: {
          ...mockSummary.session,
          endBranch: 'main',
        },
      };
      mockUseGetSessionSummaryQuery.mockReturnValue({
        data: sameBranchSummary,
        isLoading: false,
      });

      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText('End:')).not.toBeInTheDocument();
    });
  });

  describe('Stats Display', () => {
    it('displays total tasks count', () => {
      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('Total Tasks')).toBeInTheDocument();
    });

    it('displays files changed count', () => {
      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('Files Changed')).toBeInTheDocument();
    });

    it('displays completed tasks count', () => {
      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('displays commits count', () => {
      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('Commits')).toBeInTheDocument();
    });
  });

  describe('Warning Display', () => {
    it('displays rejected tasks warning', () => {
      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Check that rejected warning exists by looking for the text
      expect(screen.getByText('tasks rejected')).toBeInTheDocument();
    });

    it('displays failed tasks warning', () => {
      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Check that failed warning exists by looking for the text
      expect(screen.getByText('task failed')).toBeInTheDocument();
    });

    it('does not display warnings when no rejected/failed tasks', () => {
      const noWarningsSummary = {
        ...mockSummary,
        stats: {
          ...mockSummary.stats,
          rejectedTasks: 0,
          failedTasks: 0,
        },
      };
      mockUseGetSessionSummaryQuery.mockReturnValue({
        data: noWarningsSummary,
        isLoading: false,
      });

      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText(/rejected/)).not.toBeInTheDocument();
      expect(screen.queryByText(/failed/)).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('displays loading spinner when loading', () => {
      mockUseGetSessionSummaryQuery.mockReturnValue({
        data: null,
        isLoading: true,
      });

      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Not Found State', () => {
    it('displays message when session not found', () => {
      mockUseGetSessionSummaryQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Session not found')).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('calls onClose when close button clicked', async () => {
      const user = userEvent.setup();
      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByText('Close');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('renders new session button when onNewSession provided', () => {
      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
          onNewSession={mockOnNewSession}
        />
      );

      expect(screen.getByText('Start New Session')).toBeInTheDocument();
    });

    it('does not render new session button when onNewSession not provided', () => {
      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText('Start New Session')).not.toBeInTheDocument();
    });

    it('calls onNewSession and onClose when new session button clicked', async () => {
      const user = userEvent.setup();
      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
          onNewSession={mockOnNewSession}
        />
      );

      const newSessionButton = screen.getByText('Start New Session');
      await user.click(newSessionButton);

      expect(mockOnNewSession).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Duration Formatting', () => {
    it('formats hours and minutes', () => {
      mockUseGetSessionSummaryQuery.mockReturnValue({
        data: {
          ...mockSummary,
          stats: { ...mockSummary.stats, duration: 5400000 }, // 1.5 hours
        },
        isLoading: false,
      });

      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('1 hour 30 minutes')).toBeInTheDocument();
    });

    it('formats minutes and seconds', () => {
      mockUseGetSessionSummaryQuery.mockReturnValue({
        data: {
          ...mockSummary,
          stats: { ...mockSummary.stats, duration: 150000 }, // 2.5 minutes
        },
        isLoading: false,
      });

      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('2 minutes 30 seconds')).toBeInTheDocument();
    });

    it('formats seconds only', () => {
      mockUseGetSessionSummaryQuery.mockReturnValue({
        data: {
          ...mockSummary,
          stats: { ...mockSummary.stats, duration: 45000 }, // 45 seconds
        },
        isLoading: false,
      });

      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('45 seconds')).toBeInTheDocument();
    });

    it('handles singular hour correctly', () => {
      mockUseGetSessionSummaryQuery.mockReturnValue({
        data: {
          ...mockSummary,
          stats: { ...mockSummary.stats, duration: 3600000 }, // exactly 1 hour
        },
        isLoading: false,
      });

      render(
        <SessionSummaryModal
          sessionId="session-123"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('1 hour 0 minutes')).toBeInTheDocument();
    });
  });
});
