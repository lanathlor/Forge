import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddGateForm } from '../AddGateForm';

vi.mock('lucide-react', () => ({
  Plus: (props: Record<string, unknown>) => (
    <svg data-testid="plus-icon" {...props} />
  ),
  X: (props: Record<string, unknown>) => (
    <svg data-testid="x-icon" {...props} />
  ),
  ChevronDown: (props: Record<string, unknown>) => (
    <svg data-testid="chevron-icon" {...props} />
  ),
  Check: (props: Record<string, unknown>) => (
    <svg data-testid="check-icon" {...props} />
  ),
}));

vi.mock('@/shared/components/ui/select', () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (v: string) => void;
  }) => <div data-testid="select">{children}</div>,
  SelectTrigger: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    id?: string;
  }) => (
    <button data-testid="select-trigger" {...props}>
      {children}
    </button>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <option value={value}>{children}</option>,
  SelectValue: () => <span>1 min</span>,
}));

describe('AddGateForm', () => {
  const defaultProps = {
    onAdd: vi.fn(),
    onCancel: vi.fn(),
    nextOrder: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form fields', () => {
    render(<AddGateForm {...defaultProps} />);
    expect(screen.getByText('Add New Quality Gate')).toBeInTheDocument();
    expect(screen.getByLabelText('Gate Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Command')).toBeInTheDocument();
  });

  it('disables submit button when fields are empty', () => {
    render(<AddGateForm {...defaultProps} />);
    const submitBtn = screen.getByRole('button', { name: /add gate/i });
    expect(submitBtn).toBeDisabled();
  });

  it('enables submit button when name and command are filled', async () => {
    const user = userEvent.setup();
    render(<AddGateForm {...defaultProps} />);

    await user.type(screen.getByLabelText('Gate Name'), 'ESLint');
    await user.type(screen.getByLabelText('Command'), 'pnpm lint');

    const submitBtn = screen.getByRole('button', { name: /add gate/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it('calls onAdd with gate data on submit', async () => {
    const user = userEvent.setup();
    render(<AddGateForm {...defaultProps} />);

    await user.type(screen.getByLabelText('Gate Name'), 'ESLint');
    await user.type(screen.getByLabelText('Command'), 'pnpm lint');
    await user.click(screen.getByRole('button', { name: /add gate/i }));

    expect(defaultProps.onAdd).toHaveBeenCalledWith({
      name: 'ESLint',
      command: 'pnpm lint',
      timeout: 60000,
      failOnError: true,
      enabled: true,
      order: 1,
    });
  });

  it('trims whitespace from name and command', async () => {
    const user = userEvent.setup();
    render(<AddGateForm {...defaultProps} />);

    await user.type(screen.getByLabelText('Gate Name'), '  ESLint  ');
    await user.type(screen.getByLabelText('Command'), '  pnpm lint  ');
    await user.click(screen.getByRole('button', { name: /add gate/i }));

    expect(defaultProps.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ESLint', command: 'pnpm lint' })
    );
  });

  it('calls onCancel when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<AddGateForm {...defaultProps} />);

    const buttons = screen.getAllByRole('button');
    const closeButton = buttons.find((b) =>
      b.querySelector('[data-testid="x-icon"]')
    );
    expect(closeButton).toBeDefined();
    await user.click(closeButton!);

    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('toggles failOnError switch', async () => {
    const user = userEvent.setup();
    render(<AddGateForm {...defaultProps} />);

    expect(screen.getByText('Required Gate')).toBeInTheDocument();

    const switchBtn = screen.getByRole('switch');
    await user.click(switchBtn);

    expect(screen.getByText('Optional Gate')).toBeInTheDocument();
  });

  it('does not submit when name is only whitespace', async () => {
    const user = userEvent.setup();
    render(<AddGateForm {...defaultProps} />);

    await user.type(screen.getByLabelText('Gate Name'), '   ');
    await user.type(screen.getByLabelText('Command'), 'pnpm lint');

    const submitBtn = screen.getByRole('button', { name: /add gate/i });
    expect(submitBtn).toBeDisabled();
  });

  it('uses nextOrder prop for gate order', async () => {
    const user = userEvent.setup();
    render(<AddGateForm {...defaultProps} nextOrder={5} />);

    await user.type(screen.getByLabelText('Gate Name'), 'Test');
    await user.type(screen.getByLabelText('Command'), 'npm test');
    await user.click(screen.getByRole('button', { name: /add gate/i }));

    expect(defaultProps.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ order: 5 })
    );
  });
});
