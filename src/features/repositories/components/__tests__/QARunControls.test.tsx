import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QARunControls } from '../QARunControls';

describe('QARunControls', () => {
  const mockOnRun = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Button States', () => {
    it('renders Run QA Gates button when not running', () => {
      render(
        <QARunControls
          status={null}
          hasRun={false}
          isRunning={false}
          enabledGatesCount={1}
          onRun={mockOnRun}
        />
      );
      expect(
        screen.getByRole('button', { name: 'Run QA Gates' })
      ).toBeInTheDocument();
    });

    it('renders Running... button with spinner when running', () => {
      render(
        <QARunControls
          status={null}
          hasRun={false}
          isRunning={true}
          enabledGatesCount={1}
          onRun={mockOnRun}
        />
      );
      expect(
        screen.getByRole('button', { name: /Running.../i })
      ).toBeInTheDocument();
    });

    it('disables button when running', () => {
      render(
        <QARunControls
          status={null}
          hasRun={false}
          isRunning={true}
          enabledGatesCount={1}
          onRun={mockOnRun}
        />
      );
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('disables button when no enabled gates', () => {
      render(
        <QARunControls
          status={null}
          hasRun={false}
          isRunning={false}
          enabledGatesCount={0}
          onRun={mockOnRun}
        />
      );
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('enables button when not running and has enabled gates', () => {
      render(
        <QARunControls
          status={null}
          hasRun={false}
          isRunning={false}
          enabledGatesCount={1}
          onRun={mockOnRun}
        />
      );
      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });
  });

  describe('Status Badges', () => {
    it('does not show status badge when hasRun is false', () => {
      render(
        <QARunControls
          status="passed"
          hasRun={false}
          isRunning={false}
          enabledGatesCount={1}
          onRun={mockOnRun}
        />
      );
      expect(screen.queryByText('Passed')).not.toBeInTheDocument();
    });

    it('shows Running badge when status is running and hasRun is true', () => {
      render(
        <QARunControls
          status="running"
          hasRun={true}
          isRunning={true}
          enabledGatesCount={1}
          onRun={mockOnRun}
        />
      );
      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    it('shows Passed badge when status is passed and hasRun is true', () => {
      render(
        <QARunControls
          status="passed"
          hasRun={true}
          isRunning={false}
          enabledGatesCount={1}
          onRun={mockOnRun}
        />
      );
      expect(screen.getByText('All Gates Passed')).toBeInTheDocument();
    });

    it('shows Failed badge when status is failed and hasRun is true', () => {
      render(
        <QARunControls
          status="failed"
          hasRun={true}
          isRunning={false}
          enabledGatesCount={1}
          onRun={mockOnRun}
        />
      );
      expect(screen.getByText('Some Gates Failed')).toBeInTheDocument();
    });

    it('shows Cancelled badge when status is cancelled and hasRun is true', () => {
      render(
        <QARunControls
          status="cancelled"
          hasRun={true}
          isRunning={false}
          enabledGatesCount={1}
          onRun={mockOnRun}
        />
      );
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onRun when button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <QARunControls
          status={null}
          hasRun={false}
          isRunning={false}
          enabledGatesCount={1}
          onRun={mockOnRun}
        />
      );

      const button = screen.getByRole('button', { name: 'Run QA Gates' });
      await user.click(button);

      expect(mockOnRun).toHaveBeenCalledTimes(1);
    });

    it('does not call onRun when button is disabled', async () => {
      const user = userEvent.setup();
      render(
        <QARunControls
          status={null}
          hasRun={false}
          isRunning={true}
          enabledGatesCount={1}
          onRun={mockOnRun}
        />
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnRun).not.toHaveBeenCalled();
    });
  });

  describe('Badge Styling', () => {
    it('applies correct classes for running status badge', () => {
      const { container } = render(
        <QARunControls
          status="running"
          hasRun={true}
          isRunning={true}
          enabledGatesCount={1}
          onRun={mockOnRun}
        />
      );
      const badge = screen.getByText('Running').closest('[class*="bg-blue-500"]');
      expect(badge).toHaveClass('bg-blue-500/15');
    });

    it('applies correct classes for passed status badge', () => {
      const { container } = render(
        <QARunControls
          status="passed"
          hasRun={true}
          isRunning={false}
          enabledGatesCount={1}
          onRun={mockOnRun}
        />
      );
      const badge = screen.getByText('All Gates Passed').closest('[class*="bg-green-500"]');
      expect(badge).toHaveClass('bg-green-500/15');
    });

    it('applies correct classes for failed status badge', () => {
      const { container } = render(
        <QARunControls
          status="failed"
          hasRun={true}
          isRunning={false}
          enabledGatesCount={1}
          onRun={mockOnRun}
        />
      );
      const badge = screen.getByText('Some Gates Failed').closest('[class*="bg-red-500"]');
      expect(badge).toHaveClass('bg-red-500/15');
    });
  });
});
