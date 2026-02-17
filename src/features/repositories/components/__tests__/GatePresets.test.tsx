import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GatePresets } from '../GatePresets';

vi.mock('lucide-react', () => ({
  PackagePlus: (props: Record<string, unknown>) => (
    <svg data-testid="package-icon" {...props} />
  ),
  X: (props: Record<string, unknown>) => (
    <svg data-testid="x-icon" {...props} />
  ),
}));

describe('GatePresets', () => {
  const defaultProps = {
    onApplyPreset: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the presets button', () => {
    render(<GatePresets {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: /presets/i })
    ).toBeInTheDocument();
  });

  it('opens dialog when presets button is clicked', async () => {
    const user = userEvent.setup();
    render(<GatePresets {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /presets/i }));

    expect(screen.getByText('Load Preset Configuration')).toBeInTheDocument();
  });

  it('shows all preset options in the dialog', async () => {
    const user = userEvent.setup();
    render(<GatePresets {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /presets/i }));

    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('Go')).toBeInTheDocument();
    expect(screen.getByText('Rust')).toBeInTheDocument();
  });

  it('shows gate count badges', async () => {
    const user = userEvent.setup();
    render(<GatePresets {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /presets/i }));

    expect(screen.getByText('4 gates')).toBeInTheDocument(); // TypeScript
    expect(screen.getByText('2 gates')).toBeInTheDocument(); // JavaScript
    expect(screen.getAllByText('3 gates')).toHaveLength(3); // Python, Go, Rust
  });

  it('calls onApplyPreset with gates when preset is selected', async () => {
    const user = userEvent.setup();
    render(<GatePresets {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /presets/i }));
    await user.click(screen.getByText('JavaScript'));

    expect(defaultProps.onApplyPreset).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'ESLint', command: 'npm run lint' }),
      expect.objectContaining({ name: 'Tests', command: 'npm test' }),
    ]);
  });

  it('shows preset descriptions', async () => {
    const user = userEvent.setup();
    render(<GatePresets {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /presets/i }));

    expect(
      screen.getByText('ESLint + TypeScript + Tests + Build')
    ).toBeInTheDocument();
    expect(screen.getByText('ESLint + Tests')).toBeInTheDocument();
    expect(screen.getByText('Ruff + MyPy + Pytest')).toBeInTheDocument();
  });
});
