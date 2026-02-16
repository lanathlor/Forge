import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Alert, AlertTitle, AlertDescription } from '../alert';
import * as React from 'react';

describe('Alert Components', () => {
  describe('Alert', () => {
    it('should render with default variant', () => {
      render(
        <Alert>
          <div>Alert content</div>
        </Alert>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Alert content');
    });

    it('should render with destructive variant', () => {
      render(
        <Alert variant="destructive">
          <div>Destructive alert</div>
        </Alert>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Destructive alert');
    });

    it('should apply custom className', () => {
      render(
        <Alert className="custom-class">
          <div>Custom class alert</div>
        </Alert>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('custom-class');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <Alert ref={ref}>
          <div>Ref alert</div>
        </Alert>
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('should pass through additional props', () => {
      render(
        <Alert data-testid="custom-alert" aria-live="polite">
          <div>Props alert</div>
        </Alert>
      );

      const alert = screen.getByTestId('custom-alert');
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('AlertTitle', () => {
    it('should render alert title', () => {
      render(<AlertTitle>Alert Title</AlertTitle>);

      const title = screen.getByText('Alert Title');
      expect(title).toBeInTheDocument();
      expect(title.tagName).toBe('H5');
    });

    it('should apply custom className', () => {
      render(<AlertTitle className="custom-title">Title</AlertTitle>);

      const title = screen.getByText('Title');
      expect(title).toHaveClass('custom-title');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLParagraphElement>();
      render(<AlertTitle ref={ref}>Title</AlertTitle>);

      expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
    });
  });

  describe('AlertDescription', () => {
    it('should render alert description', () => {
      render(<AlertDescription>Alert Description</AlertDescription>);

      const description = screen.getByText('Alert Description');
      expect(description).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(
        <AlertDescription className="custom-desc">
          Description
        </AlertDescription>
      );

      const description = screen.getByText('Description');
      expect(description).toHaveClass('custom-desc');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLParagraphElement>();
      render(<AlertDescription ref={ref}>Description</AlertDescription>);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('should render with paragraph children', () => {
      render(
        <AlertDescription>
          <p>Paragraph 1</p>
          <p>Paragraph 2</p>
        </AlertDescription>
      );

      expect(screen.getByText('Paragraph 1')).toBeInTheDocument();
      expect(screen.getByText('Paragraph 2')).toBeInTheDocument();
    });
  });

  describe('Complete Alert', () => {
    it('should render complete alert with title and description', () => {
      render(
        <Alert>
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Something went wrong</AlertDescription>
        </Alert>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should render destructive alert with content', () => {
      render(
        <Alert variant="destructive">
          <AlertTitle>Critical Error</AlertTitle>
          <AlertDescription>This is a critical error message</AlertDescription>
        </Alert>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(screen.getByText('Critical Error')).toBeInTheDocument();
      expect(screen.getByText('This is a critical error message')).toBeInTheDocument();
    });
  });
});
