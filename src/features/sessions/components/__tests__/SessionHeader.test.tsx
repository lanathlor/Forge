import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionHeader } from '../SessionHeader';
import type { Session } from '@/db/schema/sessions';

// Mock the sessionsApi hooks
const mockUseGetSessionSummaryQuery = vi.fn();
const mockUseEndSessionMutation = vi.fn();
const mockUsePauseSessionMutation = vi.fn();
const mockUseResumeSessionMutation = vi.fn();

vi.mock('@/features/sessions/store/sessionsApi', () => ({
  useGetSessionSummaryQuery: (...args: unknown[]) => mockUseGetSessionSummaryQuery(...args),
  useEndSessionMutation: () => mockUseEndSessionMutation(),
  usePauseSessionMutation: () => mockUsePauseSessionMutation(),
  useResumeSessionMutation: () => mockUseResumeSessionMutation(),
}));

// Mock window.confirm
const mockConfirm = vi.fn();
global.confirm = mockConfirm;

describe('SessionHeader', () => {
  const mockSession: Session = {
    id: 'session-123',
    repositoryId: 'repo-1',
    status: 'active',
    startBranch: 'main',
    endBranch: null,
    startedAt: new Date('2024-01-01T10:00:00Z'),
    endedAt: null,
    lastActivity: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSummaryData = {
    stats: {
      totalTasks: 5,
      completedTasks: 3,
      rejectedTasks: 1,
      failedTasks: 1,
      filesChanged: 10,
      commits: 2,
      duration: 3600000, // 1 hour
    },
  };

  const mockEndSession = vi.fn();
  const mockPauseSession = vi.fn();
  const mockResumeSession = vi.fn();
  const mockOnOpenHistory = vi.fn();
  const mockOnOpenSummary = vi.fn();
  const mockOnSessionEnded = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetSessionSummaryQuery.mockReturnValue({ data: mockSummaryData });
    mockUseEndSessionMutation.mockReturnValue([mockEndSession, { isLoading: false }]);
    mockUsePauseSessionMutation.mockReturnValue([mockPauseSession, { isLoading: false }]);
    mockUseResumeSessionMutation.mockReturnValue([mockResumeSession, { isLoading: false }]);
    mockConfirm.mockReturnValue(true);
  });

  describe('Basic Rendering', () => {
    it('renders repository name', () => {
      render(
        <SessionHeader
          session={mockSession}
          repositoryName="test-repo"
        />
      );

      expect(screen.getByText('test-repo')).toBeInTheDocument();
    });

    it('displays active status badge', () => {
      render(
        <SessionHeader
          session={mockSession}
          repositoryName="test-repo"
        />
      );

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('displays paused status badge for paused session', () => {
      const pausedSession = { ...mockSession, status: 'paused' as const };
      render(
        <SessionHeader
          session={pausedSession}
          repositoryName="test-repo"
        />
      );

      expect(screen.getByText('Paused')).toBeInTheDocument();
    });

    it('displays completed status badge for completed session', () => {
      const completedSession = { ...mockSession, status: 'completed' as const };
      render(
        <SessionHeader
          session={completedSession}
          repositoryName="test-repo"
        />
      );

      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('displays abandoned status badge for abandoned session', () => {
      const abandonedSession = { ...mockSession, status: 'abandoned' as const };
      render(
        <SessionHeader
          session={abandonedSession}
          repositoryName="test-repo"
        />
      );

      expect(screen.getByText('Abandoned')).toBeInTheDocument();
    });

    it('shows session start time', () => {
      render(
        <SessionHeader
          session={mockSession}
          repositoryName="test-repo"
        />
      );

      expect(screen.getByText(/Started/)).toBeInTheDocument();
    });

    it('shows start branch when provided', () => {
      render(
        <SessionHeader
          session={mockSession}
          repositoryName="test-repo"
        />
      );

      expect(screen.getByText('main')).toBeInTheDocument();
    });
  });

  describe('Stats Display', () => {
    it('displays total tasks count', () => {
      render(
        <SessionHeader
          session={mockSession}
          repositoryName="test-repo"
        />
      );

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('tasks')).toBeInTheDocument();
    });

    it('displays completed tasks count', () => {
      render(
        <SessionHeader
          session={mockSession}
          repositoryName="test-repo"
        />
      );

      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('displays formatted duration', () => {
      render(
        <SessionHeader
          session={mockSession}
          repositoryName="test-repo"
        />
      );

      expect(screen.getByText('1h 0m')).toBeInTheDocument();
    });
  });

  describe('History Button', () => {
    it('renders history button when onOpenHistory is provided', () => {
      render(
        <SessionHeader
          session={mockSession}
          repositoryName="test-repo"
          onOpenHistory={mockOnOpenHistory}
        />
      );

      const historyButton = screen.getByRole('button', { name: /history/i });
      expect(historyButton).toBeInTheDocument();
    });

    it('does not render history button when onOpenHistory is not provided', () => {
      render(
        <SessionHeader
          session={mockSession}
          repositoryName="test-repo"
        />
      );

      const historyButton = screen.queryByRole('button', { name: /history/i });
      expect(historyButton).not.toBeInTheDocument();
    });

    it('calls onOpenHistory when clicked', async () => {
      const user = userEvent.setup();
      render(
        <SessionHeader
          session={mockSession}
          repositoryName="test-repo"
          onOpenHistory={mockOnOpenHistory}
        />
      );

      const historyButton = screen.getByRole('button', { name: /history/i });
      await user.click(historyButton);

      expect(mockOnOpenHistory).toHaveBeenCalledTimes(1);
    });
  });

  describe('Session Controls - Active Session', () => {
    it('renders pause button for active session', () => {
      render(
        <SessionHeader
          session={mockSession}
          repositoryName="test-repo"
        />
      );

      const pauseButton = screen.getByRole('button', { name: /pause/i });
      expect(pauseButton).toBeInTheDocument();
    });

    it('renders end session button for active session', () => {
      render(
        <SessionHeader
          session={mockSession}
          repositoryName="test-repo"
        />
      );

      const endButton = screen.getByRole('button', { name: /end/i });
      expect(endButton).toBeInTheDocument();
    });

    it('calls pauseSession when pause button clicked', async () => {
      const user = userEvent.setup();
      render(
        <SessionHeader
          session={mockSession}
          repositoryName="test-repo"
        />
      );

      const pauseButton = screen.getByRole('button', { name: /pause/i });
      await user.click(pauseButton);

      expect(mockPauseSession).toHaveBeenCalledWith('session-123');
    });

    it('calls endSession and callbacks when end button clicked and confirmed', async () => {
      const user = userEvent.setup();
      render(
        <SessionHeader
          session={mockSession}
          repositoryName="test-repo"
          onSessionEnded={mockOnSessionEnded}
          onOpenSummary={mockOnOpenSummary}
        />
      );

      const endButton = screen.getByRole('button', { name: /end/i });
      await user.click(endButton);

      expect(mockConfirm).toHaveBeenCalled();
      expect(mockEndSession).toHaveBeenCalledWith('session-123');
      await waitFor(() => {
        expect(mockOnSessionEnded).toHaveBeenCalled();
        expect(mockOnOpenSummary).toHaveBeenCalled();
      });
    });

    it('does not call endSession when confirmation cancelled', async () => {
      mockConfirm.mockReturnValue(false);
      const user = userEvent.setup();
      render(
        <SessionHeader
          session={mockSession}
          repositoryName="test-repo"
        />
      );

      const endButton = screen.getByRole('button', { name: /end/i });
      await user.click(endButton);

      expect(mockConfirm).toHaveBeenCalled();
      expect(mockEndSession).not.toHaveBeenCalled();
    });
  });

  describe('Session Controls - Paused Session', () => {
    const pausedSession = { ...mockSession, status: 'paused' as const };

    it('renders resume button for paused session', () => {
      render(
        <SessionHeader
          session={pausedSession}
          repositoryName="test-repo"
        />
      );

      const resumeButton = screen.getByRole('button', { name: /resume/i });
      expect(resumeButton).toBeInTheDocument();
    });

    it('calls resumeSession when resume button clicked', async () => {
      const user = userEvent.setup();
      render(
        <SessionHeader
          session={pausedSession}
          repositoryName="test-repo"
        />
      );

      const resumeButton = screen.getByRole('button', { name: /resume/i });
      await user.click(resumeButton);

      expect(mockResumeSession).toHaveBeenCalledWith('session-123');
    });
  });

  describe('Session Controls - Completed/Abandoned Session', () => {
    it('does not render control buttons for completed session', () => {
      const completedSession = { ...mockSession, status: 'completed' as const };
      render(
        <SessionHeader
          session={completedSession}
          repositoryName="test-repo"
        />
      );

      expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /resume/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /end/i })).not.toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('disables pause button when pausing', () => {
      mockUsePauseSessionMutation.mockReturnValue([mockPauseSession, { isLoading: true }]);
      render(
        <SessionHeader
          session={mockSession}
          repositoryName="test-repo"
        />
      );

      const pauseButton = screen.getByRole('button', { name: /pause/i });
      expect(pauseButton).toBeDisabled();
    });

    it('disables end button when ending', () => {
      mockUseEndSessionMutation.mockReturnValue([mockEndSession, { isLoading: true }]);
      render(
        <SessionHeader
          session={mockSession}
          repositoryName="test-repo"
        />
      );

      const endButton = screen.getByRole('button', { name: /end/i });
      expect(endButton).toBeDisabled();
    });

    it('disables resume button when resuming', () => {
      const pausedSession = { ...mockSession, status: 'paused' as const };
      mockUseResumeSessionMutation.mockReturnValue([mockResumeSession, { isLoading: true }]);
      render(
        <SessionHeader
          session={pausedSession}
          repositoryName="test-repo"
        />
      );

      const resumeButton = screen.getByRole('button', { name: /resume/i });
      expect(resumeButton).toBeDisabled();
    });
  });

  describe('formatDuration helper', () => {
    it('formats hours and minutes correctly', () => {
      mockUseGetSessionSummaryQuery.mockReturnValue({
        data: { stats: { ...mockSummaryData.stats, duration: 5400000 } }, // 1.5 hours
      });
      render(
        <SessionHeader
          session={mockSession}
          repositoryName="test-repo"
        />
      );

      expect(screen.getByText('1h 30m')).toBeInTheDocument();
    });

    it('formats minutes only', () => {
      mockUseGetSessionSummaryQuery.mockReturnValue({
        data: { stats: { ...mockSummaryData.stats, duration: 300000 } }, // 5 minutes
      });
      render(
        <SessionHeader
          session={mockSession}
          repositoryName="test-repo"
        />
      );

      expect(screen.getByText('5m')).toBeInTheDocument();
    });

    it('formats seconds only', () => {
      mockUseGetSessionSummaryQuery.mockReturnValue({
        data: { stats: { ...mockSummaryData.stats, duration: 45000 } }, // 45 seconds
      });
      render(
        <SessionHeader
          session={mockSession}
          repositoryName="test-repo"
        />
      );

      expect(screen.getByText('45s')).toBeInTheDocument();
    });
  });
});
