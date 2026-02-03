import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QAGatesConfig } from '../QAGatesConfig';
import type { QAGatesConfigData, QARunStatusData } from '../../types/qa-gates';

// Mock the useQAGatesData hook
vi.mock('../useQAGatesData', () => ({
  useQAGatesData: vi.fn(),
}));

// Mock child components
vi.mock('../QAGateCard', () => ({
  QAGateCard: ({ gate }: { gate: { name: string } }) => (
    <div data-testid={`qa-gate-${gate.name}`}>{gate.name}</div>
  ),
}));

vi.mock('../QARunControls', () => ({
  QARunControls: ({ onRun }: { onRun: () => void }) => (
    <button onClick={onRun} data-testid="run-controls">
      Run Controls
    </button>
  ),
}));

import { useQAGatesData } from '../useQAGatesData';

describe('QAGatesConfig', () => {
  const mockRunQAGates = vi.fn();

  const mockConfigData: QAGatesConfigData = {
    repository: {
      id: 'repo-1',
      name: 'test-repo',
      path: '/path/to/repo',
    },
    config: {
      version: '1.0.0',
      maxRetries: 2,
      hasCustomConfig: false,
      qaGates: [
        {
          name: 'TypeScript Check',
          command: 'tsc --noEmit',
          timeout: 60000,
          enabled: true,
          failOnError: true,
          order: 1,
        },
        {
          name: 'ESLint',
          command: 'eslint .',
          timeout: 30000,
          enabled: true,
          failOnError: false,
          order: 2,
        },
        {
          name: 'Disabled Gate',
          command: 'echo test',
          timeout: 10000,
          enabled: false,
          failOnError: false,
          order: 3,
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading state when data is loading', () => {
      vi.mocked(useQAGatesData).mockReturnValue({
        config: null,
        isLoading: true,
        error: null,
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(
        screen.getByText('Loading QA gates configuration...')
      ).toBeInTheDocument();
    });

    it('shows loading spinner when loading', () => {
      vi.mocked(useQAGatesData).mockReturnValue({
        config: null,
        isLoading: true,
        error: null,
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      const { container } = render(<QAGatesConfig repositoryId="repo-1" />);

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error state when there is an error', () => {
      vi.mocked(useQAGatesData).mockReturnValue({
        config: null,
        isLoading: false,
        error: 'Failed to load configuration',
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText('Error Loading Configuration')).toBeInTheDocument();
      expect(
        screen.getByText('Failed to load configuration')
      ).toBeInTheDocument();
    });

    it('applies destructive styling to error state', () => {
      vi.mocked(useQAGatesData).mockReturnValue({
        config: null,
        isLoading: false,
        error: 'Failed to load configuration',
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      render(<QAGatesConfig repositoryId="repo-1" />);

      const errorTitle = screen.getByText('Error Loading Configuration');
      expect(errorTitle).toHaveClass('text-destructive');
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no gates are configured', () => {
      const emptyConfig = {
        ...mockConfigData,
        config: { ...mockConfigData.config, qaGates: [] },
      };

      vi.mocked(useQAGatesData).mockReturnValue({
        config: emptyConfig,
        isLoading: false,
        error: null,
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText('No QA Gates Configured')).toBeInTheDocument();
      expect(
        screen.getByText(
          'This repository does not have any quality assurance gates set up yet.'
        )
      ).toBeInTheDocument();
    });

    it('shows .autobot.json hint in empty state', () => {
      const emptyConfig = {
        ...mockConfigData,
        config: { ...mockConfigData.config, qaGates: [] },
      };

      vi.mocked(useQAGatesData).mockReturnValue({
        config: emptyConfig,
        isLoading: false,
        error: null,
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText('.autobot.json')).toBeInTheDocument();
    });
  });

  describe('Pipeline Header', () => {
    it('displays repository name', () => {
      vi.mocked(useQAGatesData).mockReturnValue({
        config: mockConfigData,
        isLoading: false,
        error: null,
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText('test-repo')).toBeInTheDocument();
    });

    it('displays config version', () => {
      vi.mocked(useQAGatesData).mockReturnValue({
        config: mockConfigData,
        isLoading: false,
        error: null,
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    });

    it('displays max retries', () => {
      vi.mocked(useQAGatesData).mockReturnValue({
        config: mockConfigData,
        isLoading: false,
        error: null,
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText('Max retries: 2')).toBeInTheDocument();
    });
  });

  describe('Pipeline Statistics', () => {
    it('displays total gates count', () => {
      vi.mocked(useQAGatesData).mockReturnValue({
        config: mockConfigData,
        isLoading: false,
        error: null,
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText('Total:')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('displays enabled gates count', () => {
      vi.mocked(useQAGatesData).mockReturnValue({
        config: mockConfigData,
        isLoading: false,
        error: null,
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      render(<QAGatesConfig repositoryId="repo-1" />);

      const enabledLabel = screen.getByText('Enabled:');
      expect(enabledLabel).toBeInTheDocument();
      // Check that the enabled count is displayed near the label
      const enabledSection = enabledLabel.parentElement;
      expect(enabledSection?.textContent).toContain('2');
    });

    it('displays disabled gates count', () => {
      vi.mocked(useQAGatesData).mockReturnValue({
        config: mockConfigData,
        isLoading: false,
        error: null,
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText('Disabled:')).toBeInTheDocument();
      // The count "1" appears twice: once for total and once for disabled
      const disabledSection = screen.getByText('Disabled:').parentElement;
      expect(disabledSection?.textContent).toContain('1');
    });
  });

  describe('Gates Lists', () => {
    it('displays Active Pipeline section for enabled gates', () => {
      vi.mocked(useQAGatesData).mockReturnValue({
        config: mockConfigData,
        isLoading: false,
        error: null,
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText('Active Pipeline')).toBeInTheDocument();
    });

    it('displays Disabled Gates section for disabled gates', () => {
      vi.mocked(useQAGatesData).mockReturnValue({
        config: mockConfigData,
        isLoading: false,
        error: null,
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText('Disabled Gates')).toBeInTheDocument();
    });

    it('renders enabled gates', () => {
      vi.mocked(useQAGatesData).mockReturnValue({
        config: mockConfigData,
        isLoading: false,
        error: null,
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByTestId('qa-gate-TypeScript Check')).toBeInTheDocument();
      expect(screen.getByTestId('qa-gate-ESLint')).toBeInTheDocument();
    });

    it('renders disabled gates', () => {
      vi.mocked(useQAGatesData).mockReturnValue({
        config: mockConfigData,
        isLoading: false,
        error: null,
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByTestId('qa-gate-Disabled Gate')).toBeInTheDocument();
    });

    it('does not show Active Pipeline section when no enabled gates', () => {
      const allDisabledConfig = {
        ...mockConfigData,
        config: {
          ...mockConfigData.config,
          qaGates: mockConfigData.config.qaGates.map((gate) => ({
            ...gate,
            enabled: false,
          })),
        },
      };

      vi.mocked(useQAGatesData).mockReturnValue({
        config: allDisabledConfig,
        isLoading: false,
        error: null,
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.queryByText('Active Pipeline')).not.toBeInTheDocument();
    });

    it('does not show Disabled Gates section when no disabled gates', () => {
      const allEnabledConfig = {
        ...mockConfigData,
        config: {
          ...mockConfigData.config,
          qaGates: mockConfigData.config.qaGates.filter((gate) => gate.enabled),
        },
      };

      vi.mocked(useQAGatesData).mockReturnValue({
        config: allEnabledConfig,
        isLoading: false,
        error: null,
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.queryByText('Disabled Gates')).not.toBeInTheDocument();
    });
  });

  describe('Run Controls', () => {
    it('renders QARunControls component', () => {
      vi.mocked(useQAGatesData).mockReturnValue({
        config: mockConfigData,
        isLoading: false,
        error: null,
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByTestId('run-controls')).toBeInTheDocument();
    });

    it('calls runQAGates when run button is clicked', async () => {
      const user = userEvent.setup();

      vi.mocked(useQAGatesData).mockReturnValue({
        config: mockConfigData,
        isLoading: false,
        error: null,
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      render(<QAGatesConfig repositoryId="repo-1" />);

      const runButton = screen.getByTestId('run-controls');
      await user.click(runButton);

      expect(mockRunQAGates).toHaveBeenCalledTimes(1);
    });
  });

  describe('Run Status', () => {
    it('passes run status to components', () => {
      const mockRunStatus: QARunStatusData = {
        run: {
          id: 'run-1',
          repositoryId: 'repo-1',
          status: 'running',
          startedAt: new Date(),
          completedAt: null,
          duration: null,
        },
        gates: [],
        hasRun: true,
      };

      vi.mocked(useQAGatesData).mockReturnValue({
        config: mockConfigData,
        isLoading: false,
        error: null,
        runStatus: mockRunStatus,
        isRunning: true,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      render(<QAGatesConfig repositoryId="repo-1" />);

      // Component should render without errors
      expect(screen.getByText('QA Gates Pipeline')).toBeInTheDocument();
    });
  });

  describe('Null Config Handling', () => {
    it('returns null when config is null but not loading and no error', () => {
      vi.mocked(useQAGatesData).mockReturnValue({
        config: null,
        isLoading: false,
        error: null,
        runStatus: null,
        isRunning: false,
        fetchStatus: vi.fn(),
        runQAGates: mockRunQAGates,
      });

      const { container } = render(<QAGatesConfig repositoryId="repo-1" />);

      expect(container.firstChild).toBeNull();
    });
  });
});
