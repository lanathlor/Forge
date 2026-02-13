import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QAGateCard } from '../QAGateCard';
import type { QAGate, QAGateExecutionResult } from '../../types/qa-gates';

// Mock TestGateButton to avoid dialog complexity in unit tests
vi.mock('../TestGateButton', () => ({
  TestGateButton: () => <button data-testid="test-gate-btn">Test</button>,
}));

describe('QAGateCard', () => {
  const mockGate: QAGate = {
    name: 'TypeScript Check',
    command: 'tsc --noEmit',
    timeout: 60000,
    enabled: true,
    failOnError: true,
    order: 1,
  };

  const defaultProps = {
    gate: mockGate,
    index: 0,
    repositoryId: 'repo-1',
    onToggle: vi.fn(),
    onDelete: vi.fn(),
  };

  const createMockExecution = (
    overrides: Partial<QAGateExecutionResult> = {}
  ): QAGateExecutionResult => ({
    id: 'exec-1',
    runId: 'run-1',
    gateName: 'TypeScript Check',
    command: 'tsc --noEmit',
    status: 'pending',
    output: null,
    error: null,
    exitCode: null,
    duration: null,
    startedAt: new Date(),
    completedAt: null,
    order: 1,
    ...overrides,
  });

  describe('Gate Header', () => {
    it('renders gate name', () => {
      render(<QAGateCard {...defaultProps} />);
      expect(screen.getByText('TypeScript Check')).toBeInTheDocument();
    });

    it('renders gate command', () => {
      render(<QAGateCard {...defaultProps} />);
      expect(screen.getByText('tsc --noEmit')).toBeInTheDocument();
    });

    it('renders timeout information', () => {
      render(<QAGateCard {...defaultProps} />);
      expect(screen.getByText('60s')).toBeInTheDocument();
    });

    it('displays order number from gate.order if provided', () => {
      render(<QAGateCard {...defaultProps} index={5} />);
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('displays index + 1 if gate.order is not provided', () => {
      const gateWithoutOrder = { ...mockGate, order: undefined };
      render(<QAGateCard {...defaultProps} gate={gateWithoutOrder} index={2} />);
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('Required/Optional badges', () => {
    it('shows Required badge when failOnError is true', () => {
      render(<QAGateCard {...defaultProps} gate={{ ...mockGate, failOnError: true }} />);
      expect(screen.getByText('Required')).toBeInTheDocument();
    });

    it('shows Optional badge when failOnError is false', () => {
      render(<QAGateCard {...defaultProps} gate={{ ...mockGate, failOnError: false }} />);
      expect(screen.getByText('Optional')).toBeInTheDocument();
    });
  });

  describe('Enabled/Disabled styling', () => {
    it('applies primary border styling for enabled gate', () => {
      const { container } = render(<QAGateCard {...defaultProps} />);
      const card = container.querySelector('.border-l-4');
      expect(card).toBeInTheDocument();
    });

    it('applies dashed border styling for disabled gate', () => {
      const disabledGate = { ...mockGate, enabled: false };
      const { container } = render(<QAGateCard {...defaultProps} gate={disabledGate} />);
      const card = container.querySelector('.border-dashed');
      expect(card).toBeInTheDocument();
    });

    it('applies reduced opacity for disabled gate', () => {
      const disabledGate = { ...mockGate, enabled: false };
      const { container } = render(<QAGateCard {...defaultProps} gate={disabledGate} />);
      const card = container.querySelector('.opacity-60');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Execution Status', () => {
    it('shows Running badge when execution status is running', () => {
      const execution = createMockExecution({ status: 'running', duration: 1000 });
      render(<QAGateCard {...defaultProps} execution={execution} />);
      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    it('shows Passed badge when execution status is passed', () => {
      const execution = createMockExecution({ status: 'passed', duration: 2500 });
      render(<QAGateCard {...defaultProps} execution={execution} />);
      expect(screen.getByText('Passed')).toBeInTheDocument();
    });

    it('shows Failed badge when execution status is failed', () => {
      const execution = createMockExecution({
        status: 'failed',
        duration: 1500,
        error: 'Type error found',
      });
      render(<QAGateCard {...defaultProps} execution={execution} />);
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('shows Skipped badge when execution status is skipped', () => {
      const execution = createMockExecution({ status: 'skipped' });
      render(<QAGateCard {...defaultProps} execution={execution} />);
      expect(screen.getByText('Skipped')).toBeInTheDocument();
    });

    it('displays execution duration', () => {
      const execution = createMockExecution({ status: 'passed', duration: 2345 });
      render(<QAGateCard {...defaultProps} execution={execution} />);
      expect(screen.getByText('2.3s')).toBeInTheDocument();
    });
  });

  describe('Execution Output', () => {
    it('does not show output toggle when no output or error', () => {
      const execution = createMockExecution({ status: 'passed', duration: 1000 });
      render(<QAGateCard {...defaultProps} execution={execution} />);
      expect(screen.queryByText('Show output')).not.toBeInTheDocument();
    });

    it('shows output toggle button when output is present', () => {
      const execution = createMockExecution({
        status: 'passed',
        duration: 1000,
        output: 'All checks passed',
      });
      render(<QAGateCard {...defaultProps} execution={execution} />);
      expect(screen.getByText('Show output')).toBeInTheDocument();
    });

    it('shows output toggle button when error is present', () => {
      const execution = createMockExecution({
        status: 'failed',
        duration: 1000,
        error: 'Type error in file.ts',
      });
      render(<QAGateCard {...defaultProps} execution={execution} />);
      expect(screen.getByText('Show output')).toBeInTheDocument();
    });

    it('toggles output visibility when button is clicked', async () => {
      const user = userEvent.setup();
      const execution = createMockExecution({
        status: 'passed',
        duration: 1000,
        output: 'All checks passed',
      });
      render(<QAGateCard {...defaultProps} execution={execution} />);

      const toggleButton = screen.getByText('Show output');
      await user.click(toggleButton);

      expect(screen.getByText('Hide output')).toBeInTheDocument();
      expect(screen.getByText('All checks passed')).toBeInTheDocument();
    });

    it('displays output with correct label', async () => {
      const user = userEvent.setup();
      const execution = createMockExecution({
        status: 'passed',
        duration: 1000,
        output: 'Build successful',
      });
      render(<QAGateCard {...defaultProps} execution={execution} />);

      await user.click(screen.getByText('Show output'));

      expect(screen.getByText('Output:')).toBeInTheDocument();
      expect(screen.getByText('Build successful')).toBeInTheDocument();
    });

    it('displays error with correct label', async () => {
      const user = userEvent.setup();
      const execution = createMockExecution({
        status: 'failed',
        duration: 1000,
        error: 'Type error found',
      });
      render(<QAGateCard {...defaultProps} execution={execution} />);

      await user.click(screen.getByText('Show output'));

      expect(screen.getByText('Error:')).toBeInTheDocument();
      expect(screen.getByText('Type error found')).toBeInTheDocument();
    });

    it('displays both output and error when both are present', async () => {
      const user = userEvent.setup();
      const execution = createMockExecution({
        status: 'failed',
        duration: 1000,
        output: 'Checking files...',
        error: 'Type error found',
      });
      render(<QAGateCard {...defaultProps} execution={execution} />);

      await user.click(screen.getByText('Show output'));

      expect(screen.getByText('Output:')).toBeInTheDocument();
      expect(screen.getByText('Checking files...')).toBeInTheDocument();
      expect(screen.getByText('Error:')).toBeInTheDocument();
      expect(screen.getByText('Type error found')).toBeInTheDocument();
    });

    it('hides output when toggle is clicked again', async () => {
      const user = userEvent.setup();
      const execution = createMockExecution({
        status: 'passed',
        duration: 1000,
        output: 'All checks passed',
      });
      render(<QAGateCard {...defaultProps} execution={execution} />);

      const toggleButton = screen.getByText('Show output');
      await user.click(toggleButton);
      await user.click(screen.getByText('Hide output'));

      expect(screen.queryByText('All checks passed')).not.toBeInTheDocument();
      expect(screen.getByText('Show output')).toBeInTheDocument();
    });
  });

  describe('Command Display', () => {
    it('renders command in code element', () => {
      render(<QAGateCard {...defaultProps} />);
      const commandElement = screen.getByText('tsc --noEmit');
      expect(commandElement.tagName).toBe('CODE');
    });

    it('applies monospace font to command', () => {
      const { container } = render(<QAGateCard {...defaultProps} />);
      const commandContainer = container.querySelector('code');
      expect(commandContainer).toBeInTheDocument();
    });
  });

  describe('Toggle and Delete', () => {
    it('calls onToggle when switch is clicked', async () => {
      const onToggle = vi.fn();
      const user = userEvent.setup();
      render(<QAGateCard {...defaultProps} onToggle={onToggle} />);

      const switchEl = screen.getByRole('switch');
      await user.click(switchEl);

      expect(onToggle).toHaveBeenCalledWith('TypeScript Check', false);
    });

    it('calls onDelete when delete button is clicked', async () => {
      const onDelete = vi.fn();
      const user = userEvent.setup();
      render(<QAGateCard {...defaultProps} onDelete={onDelete} />);

      // The delete button is the last button in the actions area with a Trash2 icon
      const buttons = screen.getAllByRole('button');
      // Find a button that is not the switch, not the test button, and not the toggle
      const trashButton = buttons.find(b => {
        const svg = b.querySelector('svg');
        return svg && b.getAttribute('role') !== 'switch' && !b.hasAttribute('data-testid');
      });
      if (trashButton) await user.click(trashButton);

      expect(onDelete).toHaveBeenCalledWith('TypeScript Check');
    });
  });
});
