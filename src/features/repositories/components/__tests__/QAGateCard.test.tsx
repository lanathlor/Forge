import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QAGateCard } from '../QAGateCard';
import type { QAGate, QAGateExecutionResult } from '../../types/qa-gates';

describe('QAGateCard', () => {
  const mockGate: QAGate = {
    name: 'TypeScript Check',
    command: 'tsc --noEmit',
    timeout: 60000,
    enabled: true,
    failOnError: true,
    order: 1,
  };

  // Helper to create a complete QAGateExecutionResult with defaults
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
      render(<QAGateCard gate={mockGate} index={0} />);
      expect(screen.getByText('TypeScript Check')).toBeInTheDocument();
    });

    it('renders gate command', () => {
      render(<QAGateCard gate={mockGate} index={0} />);
      expect(screen.getByText('tsc --noEmit')).toBeInTheDocument();
    });

    it('renders timeout information', () => {
      render(<QAGateCard gate={mockGate} index={0} />);
      expect(screen.getByText('60s timeout')).toBeInTheDocument();
    });

    it('displays order number from gate.order if provided', () => {
      render(<QAGateCard gate={mockGate} index={5} />);
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('displays index + 1 if gate.order is not provided', () => {
      const gateWithoutOrder = { ...mockGate, order: undefined };
      render(<QAGateCard gate={gateWithoutOrder} index={2} />);
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('Active Gate Variant', () => {
    it('shows Active badge when gate is active and no execution', () => {
      render(<QAGateCard gate={mockGate} index={0} variant="active" />);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('shows Blocks badge when failOnError is true', () => {
      render(
        <QAGateCard gate={{ ...mockGate, failOnError: true }} index={0} />
      );
      expect(screen.getByText('Blocks')).toBeInTheDocument();
    });

    it('does not show Blocks badge when failOnError is false', () => {
      render(
        <QAGateCard gate={{ ...mockGate, failOnError: false }} index={0} />
      );
      expect(screen.queryByText('Blocks')).not.toBeInTheDocument();
    });

    it('applies primary border styling for active variant', () => {
      const { container } = render(
        <QAGateCard gate={mockGate} index={0} variant="active" />
      );
      const card = container.querySelector('.border-l-4');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Disabled Gate Variant', () => {
    it('shows Disabled badge when gate is disabled', () => {
      render(<QAGateCard gate={mockGate} index={0} variant="disabled" />);
      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });

    it('applies dashed border styling for disabled variant', () => {
      const { container } = render(
        <QAGateCard gate={mockGate} index={0} variant="disabled" />
      );
      const card = container.querySelector('.border-dashed');
      expect(card).toBeInTheDocument();
    });

    it('applies reduced opacity for disabled variant', () => {
      const { container } = render(
        <QAGateCard gate={mockGate} index={0} variant="disabled" />
      );
      const card = container.querySelector('.opacity-60');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Execution Status', () => {
    it('shows Running badge when execution status is running', () => {
      const execution = createMockExecution({
        status: 'running',
        duration: 1000,
      });
      render(<QAGateCard gate={mockGate} index={0} execution={execution} />);
      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    it('shows Passed badge when execution status is passed', () => {
      const execution = createMockExecution({
        status: 'passed',
        duration: 2500,
      });
      render(<QAGateCard gate={mockGate} index={0} execution={execution} />);
      expect(screen.getByText('Passed')).toBeInTheDocument();
    });

    it('shows Failed badge when execution status is failed', () => {
      const execution = createMockExecution({
        status: 'failed',
        duration: 1500,
        error: 'Type error found',
      });
      render(<QAGateCard gate={mockGate} index={0} execution={execution} />);
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('shows Skipped badge when execution status is skipped', () => {
      const execution = createMockExecution({
        status: 'skipped',
      });
      render(<QAGateCard gate={mockGate} index={0} execution={execution} />);
      expect(screen.getByText('Skipped')).toBeInTheDocument();
    });

    it('displays execution duration', () => {
      const execution = createMockExecution({
        status: 'passed',
        duration: 2345,
      });
      render(<QAGateCard gate={mockGate} index={0} execution={execution} />);
      expect(screen.getByText('2.35s')).toBeInTheDocument();
    });
  });

  describe('Execution Output', () => {
    it('does not show output toggle when no output or error', () => {
      const execution = createMockExecution({
        status: 'passed',
        duration: 1000,
      });
      render(<QAGateCard gate={mockGate} index={0} execution={execution} />);
      expect(screen.queryByText('Show Output')).not.toBeInTheDocument();
    });

    it('shows output toggle button when output is present', () => {
      const execution = createMockExecution({
        status: 'passed',
        duration: 1000,
        output: 'All checks passed',
      });
      render(<QAGateCard gate={mockGate} index={0} execution={execution} />);
      expect(screen.getByText('Show Output')).toBeInTheDocument();
    });

    it('shows output toggle button when error is present', () => {
      const execution = createMockExecution({
        status: 'failed',
        duration: 1000,
        error: 'Type error in file.ts',
      });
      render(<QAGateCard gate={mockGate} index={0} execution={execution} />);
      expect(screen.getByText('Show Output')).toBeInTheDocument();
    });

    it('toggles output visibility when button is clicked', async () => {
      const user = userEvent.setup();
      const execution = createMockExecution({
        status: 'passed',
        duration: 1000,
        output: 'All checks passed',
      });
      render(<QAGateCard gate={mockGate} index={0} execution={execution} />);

      const toggleButton = screen.getByText('Show Output');
      await user.click(toggleButton);

      expect(screen.getByText('Hide Output')).toBeInTheDocument();
      expect(screen.getByText('All checks passed')).toBeInTheDocument();
    });

    it('displays output with correct label', async () => {
      const user = userEvent.setup();
      const execution = createMockExecution({
        status: 'passed',
        duration: 1000,
        output: 'Build successful',
      });
      render(<QAGateCard gate={mockGate} index={0} execution={execution} />);

      await user.click(screen.getByText('Show Output'));

      expect(screen.getByText('Output:')).toBeInTheDocument();
      expect(screen.getByText('Build successful')).toBeInTheDocument();
    });

    it('displays error with correct label and styling', async () => {
      const user = userEvent.setup();
      const execution = createMockExecution({
        status: 'failed',
        duration: 1000,
        error: 'Type error found',
      });
      render(<QAGateCard gate={mockGate} index={0} execution={execution} />);

      await user.click(screen.getByText('Show Output'));

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
      render(<QAGateCard gate={mockGate} index={0} execution={execution} />);

      await user.click(screen.getByText('Show Output'));

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
      render(<QAGateCard gate={mockGate} index={0} execution={execution} />);

      const toggleButton = screen.getByText('Show Output');
      await user.click(toggleButton);
      await user.click(screen.getByText('Hide Output'));

      expect(screen.queryByText('All checks passed')).not.toBeInTheDocument();
      expect(screen.getByText('Show Output')).toBeInTheDocument();
    });
  });

  describe('Command Display', () => {
    it('renders command in code element', () => {
      render(<QAGateCard gate={mockGate} index={0} />);
      const commandElement = screen.getByText('tsc --noEmit');
      expect(commandElement.tagName).toBe('CODE');
    });

    it('applies monospace font to command', () => {
      const { container } = render(<QAGateCard gate={mockGate} index={0} />);
      const commandContainer = container.querySelector('.font-mono');
      expect(commandContainer).toBeInTheDocument();
    });
  });
});
