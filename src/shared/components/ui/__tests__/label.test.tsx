import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from '../label';

describe('Label', () => {
  it('should render a label element', () => {
    render(<Label>Test Label</Label>);
    expect(screen.getByText('Test Label')).toBeInTheDocument();
  });

  it('should forward ref to the label element', () => {
    const ref = { current: null };
    render(<Label ref={ref}>Test</Label>);
    expect(ref.current).toBeInstanceOf(HTMLLabelElement);
  });

  it('should apply custom className', () => {
    render(
      <Label className="custom-class" data-testid="label">
        Test
      </Label>
    );
    expect(screen.getByTestId('label')).toHaveClass('custom-class');
  });

  it('should pass through native label props', () => {
    render(
      <Label htmlFor="input-id" data-testid="label">
        Test
      </Label>
    );
    expect(screen.getByTestId('label')).toHaveAttribute('for', 'input-id');
  });

  it('should have displayName', () => {
    expect(Label.displayName).toBe('Label');
  });

  it('should render without className', () => {
    render(<Label data-testid="label">Test</Label>);
    expect(screen.getByTestId('label')).toHaveClass('text-sm');
  });
});
