'use client';

import React, { Component, type ReactNode } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

interface ErrorBoundaryProps {
  /** Unique identifier for this error boundary (helps with debugging) */
  id?: string;
  /** Child components to render */
  children: ReactNode;
  /** Custom fallback UI to render on error */
  fallback?: ReactNode;
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Whether to show the Report Issue button */
  showReport?: boolean;
  /** Whether to show error details (stack trace) */
  showDetails?: boolean;
  /** Custom error title */
  errorTitle?: string;
  /** Size of the error UI */
  size?: 'sm' | 'md' | 'lg';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  copied: boolean;
}

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 *
 * Features:
 * - Friendly error UI with retry button
 * - Error reporting to GitHub issues
 * - Copy error details to clipboard
 * - Customizable fallback UI
 * - Automatic error logging
 *
 * @example
 * ```tsx
 * <ErrorBoundary id="user-profile">
 *   <UserProfile />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const boundaryId = this.props.id || 'unknown';
    console.error(`[ErrorBoundary: ${boundaryId}] Caught error:`, error);
    console.error('Error Info:', errorInfo);

    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Log to error tracking service if available
    if (
      typeof window !== 'undefined' &&
      (
        window as unknown as {
          errorTracker?: {
            logError: (error: Error, context: Record<string, unknown>) => void;
          };
        }
      ).errorTracker
    ) {
      (
        window as unknown as {
          errorTracker: {
            logError: (error: Error, context: Record<string, unknown>) => void;
          };
        }
      ).errorTracker.logError(error, {
        boundaryId,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      copied: false,
    });
  };

  handleReport = () => {
    const { id } = this.props;
    const { error, errorInfo } = this.state;

    const errorTitle = `Error in ${id || 'component'}: ${error?.message || 'Unknown error'}`;
    const errorBody = `
## Error Report

**Boundary ID:** ${id || 'unknown'}
**Error Message:** ${error?.message || 'Unknown error'}
**Error Name:** ${error?.name || 'Error'}

### Stack Trace
\`\`\`
${error?.stack || 'No stack trace available'}
\`\`\`

### Component Stack
\`\`\`
${errorInfo?.componentStack || 'No component stack available'}
\`\`\`

**Timestamp:** ${new Date().toISOString()}
**User Agent:** ${typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'}
    `.trim();

    const githubUrl = `https://github.com/anthropics/claude-code/issues/new?title=${encodeURIComponent(errorTitle)}&body=${encodeURIComponent(errorBody)}`;
    window.open(githubUrl, '_blank', 'noopener,noreferrer');
  };

  handleCopyError = async () => {
    const { id } = this.props;
    const { error, errorInfo } = this.state;

    const errorText = `
Error Boundary: ${id || 'unknown'}
Error: ${error?.message || 'Unknown error'}
Stack: ${error?.stack || 'No stack trace'}
Component Stack: ${errorInfo?.componentStack || 'No component stack'}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorText);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const {
        showReport = true,
        showDetails = false,
        errorTitle = 'Something went wrong',
        size = 'md',
      } = this.props;
      const { error, errorInfo, copied } = this.state;

      const sizeClasses = {
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      };

      const iconSizes = {
        sm: 'h-6 w-6',
        md: 'h-8 w-8',
        lg: 'h-12 w-12',
      };

      const titleSizes = {
        sm: 'text-base',
        md: 'text-lg',
        lg: 'text-xl',
      };

      return (
        <div
          className={cn(
            'flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20',
            sizeClasses[size]
          )}
          role="alert"
          aria-live="assertive"
        >
          <AlertTriangle className={cn('mb-3 text-red-500', iconSizes[size])} />
          <h3
            className={cn(
              'mb-2 font-semibold text-red-700 dark:text-red-400',
              titleSizes[size]
            )}
          >
            {errorTitle}
          </h3>
          <p className="mb-4 max-w-md text-center text-sm text-red-600 dark:text-red-500">
            {error?.message || 'An unexpected error occurred'}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleRetry}
              className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>

            {showReport && (
              <Button
                variant="ghost"
                size="sm"
                onClick={this.handleReport}
                className="text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Report Issue
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={this.handleCopyError}
              className="text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Error
                </>
              )}
            </Button>
          </div>

          {/* Error Details (Expandable) */}
          {showDetails && error && (
            <details className="mt-4 w-full max-w-2xl">
              <summary className="mb-2 cursor-pointer text-xs text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400">
                Show technical details
              </summary>
              <div className="mt-2 rounded border border-red-200 bg-red-100 p-3 dark:border-red-800 dark:bg-red-950/50">
                <div className="space-y-2 font-mono text-xs text-red-800 dark:text-red-300">
                  <div>
                    <strong>Error:</strong> {error.name}
                  </div>
                  <div>
                    <strong>Message:</strong> {error.message}
                  </div>
                  {error.stack && (
                    <div>
                      <strong>Stack:</strong>
                      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[10px]">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                  {errorInfo?.componentStack && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[10px]">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
