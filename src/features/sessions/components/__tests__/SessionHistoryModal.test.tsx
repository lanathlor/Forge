import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionHistoryModal } from '../SessionHistoryModal';

// Mock the sessionsApi hooks
const mockUseListSessionsQuery = vi.fn();
const mockUseDeleteSessionMutation = vi.fn();
const mockUseResumeSessionMutation = vi.fn();
const mockDeleteSession = vi.fn();
const mockResumeSession = vi.fn();
const mockRefetch = vi.fn();

vi.mock('@/features/sessions/store/sessionsApi', () => ({
  useListSessionsQuery: (...args: unknown[]) => mockUseListSessionsQuery(...args),
  useDeleteSessionMutation: () => mockUseDeleteSessionMutation(),
  useResumeSessionMutation: () => mockUseResumeSessionMutation(),
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
}));

// Mock window.confirm
const mockConfirm = vi.fn();
global.confirm = mockConfirm;

describe('SessionHistoryModal', () => {
  const mockSessions = [
    {
      id: 'session-1',
      repositoryId: 'repo-1',
      status: 'active',
      startBranch: 'main',
      taskCount: 5,
      startedAt: new Date('2024-01-01T10:00:00Z'),
      endedAt: null,
    },
    {
      id: 'session-2',
      repositoryId: 'repo-1',
      status: 'paused',
      startBranch: 'feature',
      taskCount: 3,
      startedAt: new Date('2024-01-01T09:00:00Z'),
      endedAt: null,
    },
    {
      id: 'session-3',
      repositoryId: 'repo-1',
      status: 'completed',
      startBranch: 'main',
      taskCount: 10,
      startedAt: new Date('2024-01-01T08:00:00Z'),
      endedAt: new Date('2024-01-01T10:00:00Z'),
    },
    {
      id: 'session-4',
      repositoryId: 'repo-1',
      status: 'abandoned',
      startBranch: 'develop',
      taskCount: 2,
      startedAt: new Date('2024-01-01T07:00:00Z'),
      endedAt: new Date('2024-01-01T08:00:00Z'),
    },
  ];

  const mockOnClose = vi.fn();
  const mockOnSelectSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseListSessionsQuery.mockReturnValue({
      data: { sessions: mockSessions },
      isLoading: false,
      refetch: mockRefetch,
    });
    mockUseDeleteSessionMutation.mockReturnValue([mockDeleteSession, { isLoading: false }]);
    mockUseResumeSessionMutation.mockReturnValue([mockResumeSession]);
    mockConfirm.mockReturnValue(true);
  });

  describe('Basic Rendering', () => {
    it('renders when isOpen is true', () => {
      render(
        <SessionHistoryModal
          repositoryId="repo-1"
          repositoryName="test-repo"
          isOpen={true}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
        />
      );

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(
        <SessionHistoryModal
          repositoryId="repo-1"
          repositoryName="test-repo"
          isOpen={false}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
        />
      );

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('displays title and description', () => {
      render(
        <SessionHistoryModal
          repositoryId="repo-1"
          repositoryName="test-repo"
          isOpen={true}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
        />
      );

      expect(screen.getByText('Session History')).toBeInTheDocument();
      expect(screen.getByText('Sessions for test-repo')).toBeInTheDocument();
    });
  });

  describe('Session List', () => {
    it('displays all sessions', () => {
      render(
        <SessionHistoryModal
          repositoryId="repo-1"
          repositoryName="test-repo"
          isOpen={true}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
        />
      );

      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Paused')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Abandoned')).toBeInTheDocument();
    });

    it('displays task count for each session', () => {
      render(
        <SessionHistoryModal
          repositoryId="repo-1"
          repositoryName="test-repo"
          isOpen={true}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
        />
      );

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('displays start branch for each session', () => {
      render(
        <SessionHistoryModal
          repositoryId="repo-1"
          repositoryName="test-repo"
          isOpen={true}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
        />
      );

      expect(screen.getAllByText('main').length).toBeGreaterThan(0);
      expect(screen.getByText('feature')).toBeInTheDocument();
      expect(screen.getByText('develop')).toBeInTheDocument();
    });

    it('indicates current session', () => {
      render(
        <SessionHistoryModal
          repositoryId="repo-1"
          repositoryName="test-repo"
          currentSessionId="session-1"
          isOpen={true}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
        />
      );

      expect(screen.getByText('Current')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('displays loading spinner when loading', () => {
      mockUseListSessionsQuery.mockReturnValue({
        data: null,
        isLoading: true,
        refetch: mockRefetch,
      });

      render(
        <SessionHistoryModal
          repositoryId="repo-1"
          repositoryName="test-repo"
          isOpen={true}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
        />
      );

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('displays message when no sessions', () => {
      mockUseListSessionsQuery.mockReturnValue({
        data: { sessions: [] },
        isLoading: false,
        refetch: mockRefetch,
      });

      render(
        <SessionHistoryModal
          repositoryId="repo-1"
          repositoryName="test-repo"
          isOpen={true}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
        />
      );

      expect(screen.getByText('No sessions yet')).toBeInTheDocument();
      expect(screen.getByText('Sessions will appear here as you work')).toBeInTheDocument();
    });
  });

  describe('Session Selection', () => {
    it('calls onSelectSession for active session', async () => {
      const user = userEvent.setup();
      render(
        <SessionHistoryModal
          repositoryId="repo-1"
          repositoryName="test-repo"
          isOpen={true}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
        />
      );

      // Find and click the active session
      const activeSessionRow = screen.getByText('Active').closest('div[class*="border"]');
      if (activeSessionRow) {
        await user.click(activeSessionRow);
      }

      expect(mockOnSelectSession).toHaveBeenCalledWith('session-1');
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('resumes paused session before selecting', async () => {
      const user = userEvent.setup();
      render(
        <SessionHistoryModal
          repositoryId="repo-1"
          repositoryName="test-repo"
          isOpen={true}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
        />
      );

      // Find and click the paused session
      const pausedSessionRow = screen.getByText('Paused').closest('div[class*="border"]');
      if (pausedSessionRow) {
        await user.click(pausedSessionRow);
      }

      expect(mockResumeSession).toHaveBeenCalledWith('session-2');
      expect(mockOnSelectSession).toHaveBeenCalledWith('session-2');
    });

    it('does not call onSelectSession for completed session', async () => {
      const user = userEvent.setup();
      render(
        <SessionHistoryModal
          repositoryId="repo-1"
          repositoryName="test-repo"
          isOpen={true}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
        />
      );

      // Find and click the completed session - should not be clickable
      const completedSessionRow = screen.getByText('Completed').closest('div[class*="border"]');
      if (completedSessionRow) {
        await user.click(completedSessionRow);
      }

      // onSelectSession should not be called for completed sessions
      expect(mockOnSelectSession).not.toHaveBeenCalledWith('session-3');
    });
  });

  describe('Session Deletion', () => {
    it('deletes session when confirmed', async () => {
      const user = userEvent.setup();
      render(
        <SessionHistoryModal
          repositoryId="repo-1"
          repositoryName="test-repo"
          isOpen={true}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
        />
      );

      // Find a delete button (should be on non-active, non-current sessions)
      const deleteButtons = screen.getAllByRole('button').filter(
        (btn) => btn.querySelector('.text-destructive')
      );

      const firstDeleteButton = deleteButtons[0];
      if (firstDeleteButton) {
        await user.click(firstDeleteButton);
      }

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalled();
        expect(mockDeleteSession).toHaveBeenCalled();
        expect(mockRefetch).toHaveBeenCalled();
      });
    });

    it('does not delete session when cancelled', async () => {
      mockConfirm.mockReturnValue(false);
      const user = userEvent.setup();
      render(
        <SessionHistoryModal
          repositoryId="repo-1"
          repositoryName="test-repo"
          isOpen={true}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
        />
      );

      const deleteButtons = screen.getAllByRole('button').filter(
        (btn) => btn.querySelector('.text-destructive')
      );

      const firstDeleteButton = deleteButtons[0];
      if (firstDeleteButton) {
        await user.click(firstDeleteButton);
      }

      expect(mockDeleteSession).not.toHaveBeenCalled();
    });
  });

  describe('Close Button', () => {
    it('calls onClose when close button clicked', async () => {
      const user = userEvent.setup();
      render(
        <SessionHistoryModal
          repositoryId="repo-1"
          repositoryName="test-repo"
          isOpen={true}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
        />
      );

      const closeButton = screen.getByText('Close');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Duration Formatting', () => {
    it('formats duration correctly for completed sessions', () => {
      render(
        <SessionHistoryModal
          repositoryId="repo-1"
          repositoryName="test-repo"
          isOpen={true}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
        />
      );

      // Session 3 has 2 hour duration
      expect(screen.getByText('Duration: 2h 0m')).toBeInTheDocument();
    });
  });
});
