import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, buttonVariants } from '../button';

describe('Button Component', () => {
  describe('rendering', () => {
    it('should render with text content', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('should render as button element by default', () => {
      const { container } = render(<Button>Button</Button>);
      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
    });

    it('should render with default variant', () => {
      const { container } = render(<Button>Default</Button>);
      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
    });

    it('should render with destructive variant', () => {
      render(<Button variant="destructive">Destructive</Button>);
      expect(screen.getByText('Destructive')).toBeInTheDocument();
    });

    it('should render with outline variant', () => {
      render(<Button variant="outline">Outline</Button>);
      expect(screen.getByText('Outline')).toBeInTheDocument();
    });

    it('should render with secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>);
      expect(screen.getByText('Secondary')).toBeInTheDocument();
    });

    it('should render with ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>);
      expect(screen.getByText('Ghost')).toBeInTheDocument();
    });

    it('should render with link variant', () => {
      render(<Button variant="link">Link</Button>);
      expect(screen.getByText('Link')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('should render with default size', () => {
      render(<Button size="default">Default Size</Button>);
      expect(screen.getByText('Default Size')).toBeInTheDocument();
    });

    it('should render with small size', () => {
      render(<Button size="sm">Small</Button>);
      expect(screen.getByText('Small')).toBeInTheDocument();
    });

    it('should render with large size', () => {
      render(<Button size="lg">Large</Button>);
      expect(screen.getByText('Large')).toBeInTheDocument();
    });

    it('should render with icon size', () => {
      render(<Button size="icon">🔍</Button>);
      expect(screen.getByText('🔍')).toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    it('should handle click events', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click</Button>);

      fireEvent.click(screen.getByText('Click'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should be disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByText('Disabled');
      expect(button).toBeDisabled();
    });

    it('should not trigger onClick when disabled', () => {
      const handleClick = vi.fn();
      render(
        <Button onClick={handleClick} disabled>
          Disabled
        </Button>
      );

      fireEvent.click(screen.getByText('Disabled'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <Button className="custom-class">Custom</Button>
      );
      const button = container.querySelector('button');
      expect(button?.className).toContain('custom-class');
    });

    it('should merge custom className with default classes', () => {
      const { container } = render(
        <Button className="custom-class">Merged</Button>
      );
      const button = container.querySelector('button');
      expect(button?.className).toContain('custom-class');
      expect(button?.className).toContain('inline-flex');
    });
  });

  describe('asChild prop', () => {
    it('should render children when asChild is true', () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      );
      const link = screen.getByText('Link Button');
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '/test');
    });
  });

  describe('HTML attributes', () => {
    it('should accept standard button attributes', () => {
      render(
        <Button type="submit" data-testid="test-button">
          Submit
        </Button>
      );
      const button = screen.getByTestId('test-button');
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<Button ref={ref}>Ref</Button>);
      expect(ref.current).not.toBeNull();
    });
  });

  describe('buttonVariants', () => {
    it('should be a function', () => {
      expect(typeof buttonVariants).toBe('function');
    });

    it('should generate class string for default variant', () => {
      const classes = buttonVariants();
      expect(typeof classes).toBe('string');
      expect(classes).toContain('inline-flex');
    });

    it('should generate class string with variant and size', () => {
      const classes = buttonVariants({ variant: 'destructive', size: 'lg' });
      expect(typeof classes).toBe('string');
    });
  });
});
