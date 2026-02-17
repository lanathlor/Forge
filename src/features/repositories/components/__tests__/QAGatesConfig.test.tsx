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
vi.mock('../DraggableGatesList', () => ({
  DraggableGatesList: ({ gates }: { gates: Array<{ name: string }> }) => (
    <div data-testid="gates-list">
      {gates.map((g) => (
        <div key={g.name} data-testid={`qa-gate-${g.name}`}>
          {g.name}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../QARunControls', () => ({
  QARunControls: ({ onRun }: { onRun: () => void }) => (
    <button onClick={onRun} data-testid="run-controls">
      Run Controls
    </button>
  ),
}));

vi.mock('../AddGateForm', () => ({
  AddGateForm: () => <div data-testid="add-gate-form">Add Gate Form</div>,
}));

vi.mock('../GatePresets', () => ({
  GatePresets: () => <button data-testid="gate-presets">Presets</button>,
}));

vi.mock('../ImportExportConfig', () => ({
  ImportExportConfig: () => (
    <div data-testid="import-export">Import/Export</div>
  ),
}));

import { useQAGatesData } from '../useQAGatesData';

describe('QAGatesConfig', () => {
  const mockFns = {
    runQAGates: vi.fn(),
    updateGates: vi.fn(),
    saveConfig: vi.fn(),
    toggleGate: vi.fn(),
    deleteGate: vi.fn(),
    addGate: vi.fn(),
    reorderGates: vi.fn(),
    fetchStatus: vi.fn(),
  };

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

  function mockHookReturn(overrides = {}) {
    return {
      config: mockConfigData,
      gates: mockConfigData.config.qaGates,
      isLoading: false,
      isSaving: false,
      error: null,
      runStatus: null,
      isRunning: false,
      ...mockFns,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading state when data is loading', () => {
      vi.mocked(useQAGatesData).mockReturnValue(
        mockHookReturn({
          config: null,
          gates: [],
          isLoading: true,
        })
      );

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(
        screen.getByText('Loading QA gates configuration...')
      ).toBeInTheDocument();
    });

    it('shows loading spinner when loading', () => {
      vi.mocked(useQAGatesData).mockReturnValue(
        mockHookReturn({
          config: null,
          gates: [],
          isLoading: true,
        })
      );

      const { container } = render(<QAGatesConfig repositoryId="repo-1" />);

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error state when there is an error', () => {
      vi.mocked(useQAGatesData).mockReturnValue(
        mockHookReturn({
          config: null,
          gates: [],
          error: 'Failed to load configuration',
        })
      );

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(
        screen.getByText('Error Loading Configuration')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Failed to load configuration')
      ).toBeInTheDocument();
    });

    it('applies destructive styling to error state', () => {
      vi.mocked(useQAGatesData).mockReturnValue(
        mockHookReturn({
          config: null,
          gates: [],
          error: 'Failed to load configuration',
        })
      );

      render(<QAGatesConfig repositoryId="repo-1" />);

      const errorTitle = screen.getByText('Error Loading Configuration');
      expect(errorTitle).toHaveClass('text-destructive');
    });
  });

  describe('Pipeline Header', () => {
    it('displays repository name', () => {
      vi.mocked(useQAGatesData).mockReturnValue(mockHookReturn());

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText(/test-repo/)).toBeInTheDocument();
    });

    it('displays config version', () => {
      vi.mocked(useQAGatesData).mockReturnValue(mockHookReturn());

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText(/v1\.0\.0/)).toBeInTheDocument();
    });
  });

  describe('Pipeline Statistics', () => {
    it('displays enabled gates count', () => {
      vi.mocked(useQAGatesData).mockReturnValue(mockHookReturn());

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
    });

    it('displays disabled gates count', () => {
      vi.mocked(useQAGatesData).mockReturnValue(mockHookReturn());

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('disabled')).toBeInTheDocument();
    });
  });

  describe('Gates List', () => {
    it('renders all gates', () => {
      vi.mocked(useQAGatesData).mockReturnValue(mockHookReturn());

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(
        screen.getByTestId('qa-gate-TypeScript Check')
      ).toBeInTheDocument();
      expect(screen.getByTestId('qa-gate-ESLint')).toBeInTheDocument();
      expect(screen.getByTestId('qa-gate-Disabled Gate')).toBeInTheDocument();
    });

    it('renders empty list when no gates', () => {
      vi.mocked(useQAGatesData).mockReturnValue(
        mockHookReturn({
          config: {
            ...mockConfigData,
            config: { ...mockConfigData.config, qaGates: [] },
          },
          gates: [],
        })
      );

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByTestId('gates-list')).toBeInTheDocument();
    });
  });

  describe('Run Controls', () => {
    it('renders QARunControls component', () => {
      vi.mocked(useQAGatesData).mockReturnValue(mockHookReturn());

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByTestId('run-controls')).toBeInTheDocument();
    });

    it('calls runQAGates when run button is clicked', async () => {
      const user = userEvent.setup();

      vi.mocked(useQAGatesData).mockReturnValue(mockHookReturn());

      render(<QAGatesConfig repositoryId="repo-1" />);

      const runButton = screen.getByTestId('run-controls');
      await user.click(runButton);

      expect(mockFns.runQAGates).toHaveBeenCalledTimes(1);
    });
  });

  describe('Toolbar', () => {
    it('renders Add Gate button', () => {
      vi.mocked(useQAGatesData).mockReturnValue(mockHookReturn());

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText('Add Gate')).toBeInTheDocument();
    });

    it('renders Presets button', () => {
      vi.mocked(useQAGatesData).mockReturnValue(mockHookReturn());

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByTestId('gate-presets')).toBeInTheDocument();
    });

    it('renders Import/Export controls', () => {
      vi.mocked(useQAGatesData).mockReturnValue(mockHookReturn());

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByTestId('import-export')).toBeInTheDocument();
    });
  });

  describe('Null Config Handling', () => {
    it('returns null when config is null but not loading and no error', () => {
      vi.mocked(useQAGatesData).mockReturnValue(
        mockHookReturn({
          config: null,
          gates: [],
        })
      );

      const { container } = render(<QAGatesConfig repositoryId="repo-1" />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('StatusAlert', () => {
    it('shows info alert when QA gates have not been run', () => {
      vi.mocked(useQAGatesData).mockReturnValue(
        mockHookReturn({
          runStatus: { hasRun: false, run: null, gates: [] },
        })
      );

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(
        screen.getByText(/Configure your QA gates below/)
      ).toBeInTheDocument();
    });

    it('shows warning alert when there are unsaved changes', () => {
      vi.mocked(useQAGatesData).mockReturnValue(
        mockHookReturn({
          runStatus: { hasRun: true, run: { status: 'passed' }, gates: [] },
          gates: [
            { ...mockConfigData.config.qaGates[0], timeout: 99999 }, // Modified timeout
          ],
        })
      );

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText(/You have unsaved changes/)).toBeInTheDocument();
    });

    it('shows success alert when all gates passed', () => {
      vi.mocked(useQAGatesData).mockReturnValue(
        mockHookReturn({
          runStatus: {
            hasRun: true,
            run: { status: 'passed' },
            gates: [],
          },
        })
      );

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText(/All QA gates passed/)).toBeInTheDocument();
    });

    it('shows error alert when gates failed with singular message', () => {
      vi.mocked(useQAGatesData).mockReturnValue(
        mockHookReturn({
          runStatus: {
            hasRun: true,
            run: { status: 'failed' },
            gates: [{ name: 'test', status: 'failed', output: '' }],
          },
        })
      );

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText(/1 gate failed/)).toBeInTheDocument();
    });

    it('shows error alert when gates failed with plural message', () => {
      vi.mocked(useQAGatesData).mockReturnValue(
        mockHookReturn({
          runStatus: {
            hasRun: true,
            run: { status: 'failed' },
            gates: [
              { name: 'test1', status: 'failed', output: '' },
              { name: 'test2', status: 'failed', output: '' },
            ],
          },
        })
      );

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText(/2 gates failed/)).toBeInTheDocument();
    });
  });

  describe('Add Gate Form', () => {
    it('shows Add Gate form when Add Gate button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(useQAGatesData).mockReturnValue(mockHookReturn());

      render(<QAGatesConfig repositoryId="repo-1" />);

      const addButton = screen.getByText('Add Gate');
      await user.click(addButton);

      expect(screen.getByTestId('add-gate-form')).toBeInTheDocument();
    });

    it('changes button text to Cancel when form is shown', async () => {
      const user = userEvent.setup();
      vi.mocked(useQAGatesData).mockReturnValue(mockHookReturn());

      render(<QAGatesConfig repositoryId="repo-1" />);

      const addButton = screen.getByText('Add Gate');
      await user.click(addButton);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('hides form when Cancel is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(useQAGatesData).mockReturnValue(mockHookReturn());

      render(<QAGatesConfig repositoryId="repo-1" />);

      const addButton = screen.getByText('Add Gate');
      await user.click(addButton);
      expect(screen.getByTestId('add-gate-form')).toBeInTheDocument();

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(screen.queryByTestId('add-gate-form')).not.toBeInTheDocument();
    });
  });

  describe('Save Button', () => {
    it('shows save button when there are changes', () => {
      vi.mocked(useQAGatesData).mockReturnValue(
        mockHookReturn({
          gates: [
            { ...mockConfigData.config.qaGates[0], timeout: 99999 }, // Modified
          ],
        })
      );

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText('Save Configuration')).toBeInTheDocument();
    });

    it('does not show save button when there are no changes', () => {
      vi.mocked(useQAGatesData).mockReturnValue(mockHookReturn());

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.queryByText('Save Configuration')).not.toBeInTheDocument();
    });

    it('shows saving state when save is in progress', () => {
      vi.mocked(useQAGatesData).mockReturnValue(
        mockHookReturn({
          isSaving: true,
          gates: [
            { ...mockConfigData.config.qaGates[0], timeout: 99999 }, // Modified
          ],
        })
      );

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('calls saveConfig when save button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(useQAGatesData).mockReturnValue(
        mockHookReturn({
          gates: [
            { ...mockConfigData.config.qaGates[0], timeout: 99999 }, // Modified
          ],
        })
      );

      render(<QAGatesConfig repositoryId="repo-1" />);

      const saveButton = screen.getByText('Save Configuration');
      await user.click(saveButton);

      expect(mockFns.saveConfig).toHaveBeenCalledTimes(1);
    });

    it('handles save errors gracefully', async () => {
      const user = userEvent.setup();
      const saveConfigMock = vi
        .fn()
        .mockRejectedValue(new Error('Save failed'));

      vi.mocked(useQAGatesData).mockReturnValue(
        mockHookReturn({
          saveConfig: saveConfigMock,
          gates: [
            { ...mockConfigData.config.qaGates[0], timeout: 99999 }, // Modified
          ],
        })
      );

      render(<QAGatesConfig repositoryId="repo-1" />);

      const saveButton = screen.getByText('Save Configuration');
      await user.click(saveButton);

      expect(saveConfigMock).toHaveBeenCalledTimes(1);
      // Error is caught and logged in the component
    });
  });

  describe('Stats Badge', () => {
    it('hides disabled count badge when all gates are enabled', () => {
      vi.mocked(useQAGatesData).mockReturnValue(
        mockHookReturn({
          gates: [
            { ...mockConfigData.config.qaGates[0], enabled: true },
            { ...mockConfigData.config.qaGates[1], enabled: true },
          ],
        })
      );

      render(<QAGatesConfig repositoryId="repo-1" />);

      // Should show 2 active, 0 disabled (hidden), 2 total
      const badges = screen.getAllByText('2');
      expect(badges.length).toBeGreaterThan(0);
      expect(screen.queryByText('disabled')).not.toBeInTheDocument();
    });

    it('shows disabled count badge when some gates are disabled', () => {
      vi.mocked(useQAGatesData).mockReturnValue(mockHookReturn());

      render(<QAGatesConfig repositoryId="repo-1" />);

      expect(screen.getByText('disabled')).toBeInTheDocument();
    });
  });
});
