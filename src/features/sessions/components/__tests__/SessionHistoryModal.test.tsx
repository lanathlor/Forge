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
  useListSessionsQuery: (...args: unknown[]) =>
    mockUseListSessionsQuery(...args),
  useDeleteSessionMutation: () => mockUseDeleteSessionMutation(),
  useResumeSessionMutation: () => mockUseResumeSessionMutation(),
  useGetSessionSummaryQuery: () => ({ data: null, isLoading: false }),
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

// Mock DropdownMenu to always render children
vi.mock('@/shared/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    className,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} className={className} disabled={disabled}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

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
    mockUseDeleteSessionMutation.mockReturnValue([
      mockDeleteSession,
      { isLoading: false },
    ]);
    mockUseResumeSessionMutation.mockReturnValue([mockResumeSession]);
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
      // Description now shows "repoName · N sessions" format
      const description = screen.getByTestId('dialog-description');
      expect(description).toHaveTextContent('test-repo');
      expect(description).toHaveTextContent('session');
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

      // Status labels appear both in filter dropdown and session cards
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Paused').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Abandoned').length).toBeGreaterThanOrEqual(1);
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
      expect(
        screen.getByText(
          'Sessions will appear here as you work with this repository.'
        )
      ).toBeInTheDocument();
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

      // Find and click the active session card (not the filter dropdown item)
      const activeElements = screen.getAllByText('Active');
      const activeSessionRow = activeElements
        .map((el) => el.closest('div[class*="group relative border"]'))
        .find((el) => el !== null);
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

      // Find and click the paused session card (not the filter dropdown item)
      const pausedElements = screen.getAllByText('Paused');
      const pausedSessionRow = pausedElements
        .map((el) => el.closest('div[class*="group relative border"]'))
        .find((el) => el !== null);
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

      // Find and click the completed session card (not the filter dropdown item)
      const completedElements = screen.getAllByText('Completed');
      const completedSessionRow = completedElements
        .map((el) => el.closest('div[class*="group relative border"]'))
        .find((el) => el !== null);
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

      // Find and click a Delete menu item (rendered as button via dropdown mock)
      const deleteButtons = screen
        .getAllByText('Delete')
        .filter((el) => el.tagName === 'BUTTON');

      const firstDeleteButton = deleteButtons[0];
      if (firstDeleteButton) {
        await user.click(firstDeleteButton);
      }

      // New flow: confirm delete in the overlay
      await waitFor(() => {
        expect(screen.getByText('Delete Session')).toBeInTheDocument();
      });

      // Click the confirm Delete button in the overlay
      const confirmButton = screen
        .getAllByText('Delete')
        .filter((el) => el.tagName === 'BUTTON')
        .pop();
      if (confirmButton) {
        await user.click(confirmButton);
      }

      await waitFor(() => {
        expect(mockDeleteSession).toHaveBeenCalled();
        expect(mockRefetch).toHaveBeenCalled();
      });
    });

    it('does not delete session when cancelled', async () => {
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

      // Find and click a Delete menu item
      const deleteButtons = screen
        .getAllByText('Delete')
        .filter((el) => el.tagName === 'BUTTON');

      const firstDeleteButton = deleteButtons[0];
      if (firstDeleteButton) {
        await user.click(firstDeleteButton);
      }

      // Confirmation overlay should appear
      await waitFor(() => {
        expect(screen.getByText('Delete Session')).toBeInTheDocument();
      });

      // Click Cancel in the overlay
      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

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
      expect(screen.getByText('2h 0m')).toBeInTheDocument();
    });
  });
});
