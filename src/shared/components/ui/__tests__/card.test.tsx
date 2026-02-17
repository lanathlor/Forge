import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../card';

describe('Card Components', () => {
  describe('Card', () => {
    it('should render with children', () => {
      render(<Card>Card Content</Card>);
      expect(screen.getByText('Card Content')).toBeInTheDocument();
    });

    it('should render as div element', () => {
      const { container } = render(<Card>Test</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card.tagName).toBe('DIV');
    });

    it('should apply custom className', () => {
      const { container } = render(<Card className="custom-card">Custom</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('custom-card');
      expect(card.className).toContain('rounded-lg');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Card ref={ref}>Ref</Card>);
      expect(ref.current).not.toBeNull();
    });

    it('should accept HTML attributes', () => {
      render(
        <Card data-testid="test-card" id="card-id">
          Attributes
        </Card>
      );
      const card = screen.getByTestId('test-card');
      expect(card).toBeInTheDocument();
      expect(card.id).toBe('card-id');
    });
  });

  describe('CardHeader', () => {
    it('should render with children', () => {
      render(<CardHeader>Header Content</CardHeader>);
      expect(screen.getByText('Header Content')).toBeInTheDocument();
    });

    it('should render as div element', () => {
      const { container } = render(<CardHeader>Header</CardHeader>);
      const header = container.firstChild as HTMLElement;
      expect(header.tagName).toBe('DIV');
    });

    it('should apply custom className', () => {
      const { container } = render(
        <CardHeader className="custom-header">Header</CardHeader>
      );
      const header = container.firstChild as HTMLElement;
      expect(header.className).toContain('custom-header');
      expect(header.className).toContain('flex');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<CardHeader ref={ref}>Ref</CardHeader>);
      expect(ref.current).not.toBeNull();
    });
  });

  describe('CardTitle', () => {
    it('should render with children', () => {
      render(<CardTitle>Title Text</CardTitle>);
      expect(screen.getByText('Title Text')).toBeInTheDocument();
    });

    it('should render as div element', () => {
      const { container } = render(<CardTitle>Title</CardTitle>);
      const title = container.firstChild as HTMLElement;
      expect(title.tagName).toBe('DIV');
    });

    it('should apply custom className', () => {
      const { container } = render(
        <CardTitle className="custom-title">Title</CardTitle>
      );
      const title = container.firstChild as HTMLElement;
      expect(title.className).toContain('custom-title');
      expect(title.className).toContain('font-semibold');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLHeadingElement>();
      render(<CardTitle ref={ref}>Ref</CardTitle>);
      expect(ref.current).not.toBeNull();
    });
  });

  describe('CardDescription', () => {
    it('should render with children', () => {
      render(<CardDescription>Description Text</CardDescription>);
      expect(screen.getByText('Description Text')).toBeInTheDocument();
    });

    it('should render as div element', () => {
      const { container } = render(
        <CardDescription>Description</CardDescription>
      );
      const description = container.firstChild as HTMLElement;
      expect(description.tagName).toBe('DIV');
    });

    it('should apply custom className', () => {
      const { container } = render(
        <CardDescription className="custom-description">
          Description
        </CardDescription>
      );
      const description = container.firstChild as HTMLElement;
      expect(description.className).toContain('custom-description');
      expect(description.className).toContain('text-sm');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLParagraphElement>();
      render(<CardDescription ref={ref}>Ref</CardDescription>);
      expect(ref.current).not.toBeNull();
    });
  });

  describe('CardContent', () => {
    it('should render with children', () => {
      render(<CardContent>Content Text</CardContent>);
      expect(screen.getByText('Content Text')).toBeInTheDocument();
    });

    it('should render as div element', () => {
      const { container } = render(<CardContent>Content</CardContent>);
      const content = container.firstChild as HTMLElement;
      expect(content.tagName).toBe('DIV');
    });

    it('should apply custom className', () => {
      const { container } = render(
        <CardContent className="custom-content">Content</CardContent>
      );
      const content = container.firstChild as HTMLElement;
      expect(content.className).toContain('custom-content');
      expect(content.className).toContain('p-6');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<CardContent ref={ref}>Ref</CardContent>);
      expect(ref.current).not.toBeNull();
    });
  });

  describe('CardFooter', () => {
    it('should render with children', () => {
      render(<CardFooter>Footer Content</CardFooter>);
      expect(screen.getByText('Footer Content')).toBeInTheDocument();
    });

    it('should render as div element', () => {
      const { container } = render(<CardFooter>Footer</CardFooter>);
      const footer = container.firstChild as HTMLElement;
      expect(footer.tagName).toBe('DIV');
    });

    it('should apply custom className', () => {
      const { container } = render(
        <CardFooter className="custom-footer">Footer</CardFooter>
      );
      const footer = container.firstChild as HTMLElement;
      expect(footer.className).toContain('custom-footer');
      expect(footer.className).toContain('flex');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<CardFooter ref={ref}>Ref</CardFooter>);
      expect(ref.current).not.toBeNull();
    });
  });

  describe('composition', () => {
    it('should render complete card with all components', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent>Card Content</CardContent>
          <CardFooter>Card Footer</CardFooter>
        </Card>
      );

      expect(screen.getByText('Card Title')).toBeInTheDocument();
      expect(screen.getByText('Card Description')).toBeInTheDocument();
      expect(screen.getByText('Card Content')).toBeInTheDocument();
      expect(screen.getByText('Card Footer')).toBeInTheDocument();
    });
  });
});
