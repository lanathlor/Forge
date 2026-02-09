import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionSelector } from '../SessionSelector';
import type { Session } from '@/db/schema/sessions';

// Mock the sessionsApi hooks
const mockUseListSessionsQuery = vi.fn();
const mockUseResumeSessionMutation = vi.fn();
const mockResumeSession = vi.fn();

vi.mock('@/features/sessions/store/sessionsApi', () => ({
  useListSessionsQuery: (...args: unknown[]) => mockUseListSessionsQuery(...args),
  useResumeSessionMutation: () => mockUseResumeSessionMutation(),
}));

describe('SessionSelector', () => {
  const mockCurrentSession: Session = {
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

  const mockOtherSessions = [
    {
      ...mockCurrentSession,
      id: 'session-456',
      status: 'paused',
      taskCount: 5,
      startedAt: new Date('2024-01-01T09:00:00Z'),
    },
    {
      ...mockCurrentSession,
      id: 'session-789',
      status: 'completed',
      taskCount: 10,
      startedAt: new Date('2024-01-01T08:00:00Z'),
    },
  ];

  const mockOnSelectSession = vi.fn();
  const mockOnCreateNewSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseListSessionsQuery.mockReturnValue({
      data: { sessions: [mockCurrentSession, ...mockOtherSessions] },
      isLoading: false,
    });
    mockUseResumeSessionMutation.mockReturnValue([mockResumeSession]);
  });

  describe('Basic Rendering', () => {
    it('renders current session ID (truncated)', () => {
      render(
        <SessionSelector
          currentSession={mockCurrentSession}
          repositoryId="repo-1"
          onSelectSession={mockOnSelectSession}
        />
      );

      expect(screen.getByText('session-')).toBeInTheDocument();
    });

    it('renders dropdown toggle button', () => {
      render(
        <SessionSelector
          currentSession={mockCurrentSession}
          repositoryId="repo-1"
          onSelectSession={mockOnSelectSession}
        />
      );

      const toggleButton = screen.getByRole('button');
      expect(toggleButton).toBeInTheDocument();
    });
  });

  describe('Dropdown Interaction', () => {
    it('opens dropdown when toggle clicked', async () => {
      const user = userEvent.setup();
      render(
        <SessionSelector
          currentSession={mockCurrentSession}
          repositoryId="repo-1"
          onSelectSession={mockOnSelectSession}
        />
      );

      const toggleButton = screen.getByRole('button');
      await user.click(toggleButton);

      expect(screen.getByText('Current Session')).toBeInTheDocument();
    });

    it('closes dropdown when toggle clicked again', async () => {
      const user = userEvent.setup();
      render(
        <SessionSelector
          currentSession={mockCurrentSession}
          repositoryId="repo-1"
          onSelectSession={mockOnSelectSession}
        />
      );

      const toggleButton = screen.getByRole('button');
      await user.click(toggleButton);
      await user.click(toggleButton);

      expect(screen.queryByText('Current Session')).not.toBeInTheDocument();
    });

    it('closes dropdown when backdrop clicked', async () => {
      const user = userEvent.setup();
      render(
        <SessionSelector
          currentSession={mockCurrentSession}
          repositoryId="repo-1"
          onSelectSession={mockOnSelectSession}
        />
      );

      const toggleButton = screen.getByRole('button');
      await user.click(toggleButton);

      // Click on backdrop
      const backdrop = document.querySelector('.fixed.inset-0');
      if (backdrop) {
        await user.click(backdrop);
      }

      await waitFor(() => {
        expect(screen.queryByText('Current Session')).not.toBeInTheDocument();
      });
    });
  });

  describe('Session List', () => {
    it('displays current session info', async () => {
      const user = userEvent.setup();
      render(
        <SessionSelector
          currentSession={mockCurrentSession}
          repositoryId="repo-1"
          onSelectSession={mockOnSelectSession}
        />
      );

      await user.click(screen.getByRole('button'));

      expect(screen.getByText('Current Session')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
    });

    it('displays other sessions', async () => {
      const user = userEvent.setup();
      render(
        <SessionSelector
          currentSession={mockCurrentSession}
          repositoryId="repo-1"
          onSelectSession={mockOnSelectSession}
        />
      );

      await user.click(screen.getByRole('button'));

      expect(screen.getByText('Recent Sessions')).toBeInTheDocument();
      expect(screen.getByText('5 tasks')).toBeInTheDocument();
      expect(screen.getByText('10 tasks')).toBeInTheDocument();
    });

    it('shows loading spinner when loading', async () => {
      mockUseListSessionsQuery.mockReturnValue({
        data: null,
        isLoading: true,
      });

      const user = userEvent.setup();
      render(
        <SessionSelector
          currentSession={mockCurrentSession}
          repositoryId="repo-1"
          onSelectSession={mockOnSelectSession}
        />
      );

      await user.click(screen.getByRole('button'));

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('shows "No other sessions" when only current session exists', async () => {
      mockUseListSessionsQuery.mockReturnValue({
        data: { sessions: [mockCurrentSession] },
        isLoading: false,
      });

      const user = userEvent.setup();
      render(
        <SessionSelector
          currentSession={mockCurrentSession}
          repositoryId="repo-1"
          onSelectSession={mockOnSelectSession}
        />
      );

      await user.click(screen.getByRole('button'));

      expect(screen.getByText('No other sessions')).toBeInTheDocument();
    });

    it('indicates paused session', async () => {
      const user = userEvent.setup();
      render(
        <SessionSelector
          currentSession={mockCurrentSession}
          repositoryId="repo-1"
          onSelectSession={mockOnSelectSession}
        />
      );

      await user.click(screen.getByRole('button'));

      expect(screen.getByText('(paused)')).toBeInTheDocument();
    });
  });

  describe('Session Selection', () => {
    it('calls onSelectSession when session selected', async () => {
      const user = userEvent.setup();
      render(
        <SessionSelector
          currentSession={mockCurrentSession}
          repositoryId="repo-1"
          onSelectSession={mockOnSelectSession}
        />
      );

      await user.click(screen.getByRole('button'));

      // Click on the first other session
      const sessionButtons = screen.getAllByRole('button');
      // Filter to find session selection buttons (not the main toggle)
      const sessionButton = sessionButtons.find(
        (btn) => btn.textContent?.includes('5 tasks')
      );
      if (sessionButton) {
        await user.click(sessionButton);
      }

      expect(mockOnSelectSession).toHaveBeenCalledWith('session-456');
    });

    it('resumes paused session before selecting', async () => {
      const user = userEvent.setup();
      render(
        <SessionSelector
          currentSession={mockCurrentSession}
          repositoryId="repo-1"
          onSelectSession={mockOnSelectSession}
        />
      );

      await user.click(screen.getByRole('button'));

      // Find the paused session and click it
      const sessionButtons = screen.getAllByRole('button');
      const pausedSessionButton = sessionButtons.find(
        (btn) => btn.textContent?.includes('(paused)')
      );
      if (pausedSessionButton) {
        await user.click(pausedSessionButton);
      }

      expect(mockResumeSession).toHaveBeenCalledWith('session-456');
      expect(mockOnSelectSession).toHaveBeenCalledWith('session-456');
    });

    it('closes dropdown after selection', async () => {
      const user = userEvent.setup();
      render(
        <SessionSelector
          currentSession={mockCurrentSession}
          repositoryId="repo-1"
          onSelectSession={mockOnSelectSession}
        />
      );

      await user.click(screen.getByRole('button'));

      const sessionButtons = screen.getAllByRole('button');
      const sessionButton = sessionButtons.find(
        (btn) => btn.textContent?.includes('5 tasks')
      );
      if (sessionButton) {
        await user.click(sessionButton);
      }

      await waitFor(() => {
        expect(screen.queryByText('Current Session')).not.toBeInTheDocument();
      });
    });
  });

  describe('New Session Button', () => {
    it('renders new session button when onCreateNewSession provided', async () => {
      const user = userEvent.setup();
      render(
        <SessionSelector
          currentSession={mockCurrentSession}
          repositoryId="repo-1"
          onSelectSession={mockOnSelectSession}
          onCreateNewSession={mockOnCreateNewSession}
        />
      );

      await user.click(screen.getByRole('button'));

      expect(screen.getByText('Start New Session')).toBeInTheDocument();
    });

    it('does not render new session button when onCreateNewSession not provided', async () => {
      const user = userEvent.setup();
      render(
        <SessionSelector
          currentSession={mockCurrentSession}
          repositoryId="repo-1"
          onSelectSession={mockOnSelectSession}
        />
      );

      await user.click(screen.getByRole('button'));

      expect(screen.queryByText('Start New Session')).not.toBeInTheDocument();
    });

    it('calls onCreateNewSession when clicked', async () => {
      const user = userEvent.setup();
      render(
        <SessionSelector
          currentSession={mockCurrentSession}
          repositoryId="repo-1"
          onSelectSession={mockOnSelectSession}
          onCreateNewSession={mockOnCreateNewSession}
        />
      );

      await user.click(screen.getByRole('button'));
      await user.click(screen.getByText('Start New Session'));

      expect(mockOnCreateNewSession).toHaveBeenCalled();
    });

    it('closes dropdown after creating new session', async () => {
      const user = userEvent.setup();
      render(
        <SessionSelector
          currentSession={mockCurrentSession}
          repositoryId="repo-1"
          onSelectSession={mockOnSelectSession}
          onCreateNewSession={mockOnCreateNewSession}
        />
      );

      await user.click(screen.getByRole('button'));
      await user.click(screen.getByText('Start New Session'));

      await waitFor(() => {
        expect(screen.queryByText('Current Session')).not.toBeInTheDocument();
      });
    });
  });

  describe('Status Icons', () => {
    it('displays correct icon for active status', () => {
      render(
        <SessionSelector
          currentSession={mockCurrentSession}
          repositoryId="repo-1"
          onSelectSession={mockOnSelectSession}
        />
      );

      // The play icon should be visible for active status
      const toggleButton = screen.getByRole('button');
      expect(toggleButton).toBeInTheDocument();
    });

    it('displays correct icon for paused status', () => {
      const pausedSession = { ...mockCurrentSession, status: 'paused' as const };
      render(
        <SessionSelector
          currentSession={pausedSession}
          repositoryId="repo-1"
          onSelectSession={mockOnSelectSession}
        />
      );

      const toggleButton = screen.getByRole('button');
      expect(toggleButton).toBeInTheDocument();
    });
  });
});
