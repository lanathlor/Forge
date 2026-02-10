import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../input';

describe('Input', () => {
  it('should render an input element', () => {
    render(<Input placeholder="Test input" />);
    expect(screen.getByPlaceholderText('Test input')).toBeInTheDocument();
  });

  it('should forward ref to the input element', () => {
    const ref = { current: null };
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('should apply custom className', () => {
    render(<Input className="custom-class" data-testid="input" />);
    expect(screen.getByTestId('input')).toHaveClass('custom-class');
  });

  it('should pass through native input props', () => {
    render(<Input type="email" disabled data-testid="input" />);
    const input = screen.getByTestId('input');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toBeDisabled();
  });

  it('should handle value changes', async () => {
    const user = userEvent.setup();
    render(<Input data-testid="input" />);

    const input = screen.getByTestId('input');
    await user.type(input, 'Hello');

    expect(input).toHaveValue('Hello');
  });

  it('should have displayName', () => {
    expect(Input.displayName).toBe('Input');
  });
});
