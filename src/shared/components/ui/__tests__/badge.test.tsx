import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Badge, badgeVariants } from '../badge';

describe('Badge Component', () => {
  describe('rendering', () => {
    it('should render with text content', () => {
      render(<Badge>Test Badge</Badge>);
      expect(screen.getByText('Test Badge')).toBeInTheDocument();
    });

    it('should render with default variant', () => {
      const { container } = render(<Badge>Default</Badge>);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toBeInTheDocument();
    });

    it('should render with secondary variant', () => {
      const { container } = render(<Badge variant="secondary">Secondary</Badge>);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toBeInTheDocument();
      expect(screen.getByText('Secondary')).toBeInTheDocument();
    });

    it('should render with destructive variant', () => {
      const { container } = render(
        <Badge variant="destructive">Destructive</Badge>
      );
      const badge = container.firstChild as HTMLElement;
      expect(badge).toBeInTheDocument();
      expect(screen.getByText('Destructive')).toBeInTheDocument();
    });

    it('should render with outline variant', () => {
      const { container } = render(<Badge variant="outline">Outline</Badge>);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toBeInTheDocument();
      expect(screen.getByText('Outline')).toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <Badge className="custom-class">Custom</Badge>
      );
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('custom-class');
    });

    it('should merge custom className with default classes', () => {
      const { container } = render(
        <Badge className="custom-class">Merged</Badge>
      );
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('custom-class');
      expect(badge.className).toContain('inline-flex');
    });
  });

  describe('HTML attributes', () => {
    it('should accept standard div attributes', () => {
      render(
        <Badge data-testid="test-badge" id="badge-id">
          Attributes
        </Badge>
      );
      const badge = screen.getByTestId('test-badge');
      expect(badge).toBeInTheDocument();
      expect(badge.id).toBe('badge-id');
    });

    it('should render as div element', () => {
      const { container } = render(<Badge>Div</Badge>);
      const badge = container.firstChild as HTMLElement;
      expect(badge.tagName).toBe('DIV');
    });
  });

  describe('badgeVariants', () => {
    it('should be a function', () => {
      expect(typeof badgeVariants).toBe('function');
    });

    it('should generate class string for default variant', () => {
      const classes = badgeVariants();
      expect(typeof classes).toBe('string');
      expect(classes).toContain('inline-flex');
    });

    it('should generate class string for secondary variant', () => {
      const classes = badgeVariants({ variant: 'secondary' });
      expect(typeof classes).toBe('string');
    });

    it('should generate class string for destructive variant', () => {
      const classes = badgeVariants({ variant: 'destructive' });
      expect(typeof classes).toBe('string');
    });

    it('should generate class string for outline variant', () => {
      const classes = badgeVariants({ variant: 'outline' });
      expect(typeof classes).toBe('string');
    });
  });
});
