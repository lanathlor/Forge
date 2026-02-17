'use client';

import React, { type ComponentType } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface ErrorBoundaryConfig {
  /** Unique identifier for the error boundary */
  id?: string;
  /** Custom error title */
  errorTitle?: string;
  /** Custom fallback component */
  fallback?: React.ReactNode;
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Whether to show the Report Issue button */
  showReport?: boolean;
  /** Whether to show error details */
  showDetails?: boolean;
  /** Size of the error UI */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Higher-Order Component that wraps a component with an ErrorBoundary
 *
 * @example
 * ```tsx
 * const SafeUserProfile = withErrorBoundary(UserProfile, {
 *   id: 'user-profile',
 *   errorTitle: 'Failed to load user profile',
 *   onError: (error) => logError(error),
 * });
 * ```
 */
export function withErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  config: ErrorBoundaryConfig = {}
): ComponentType<P> {
  const WithErrorBoundary = (props: P) => {
    const displayName = Component.displayName || Component.name || 'Component';
    const boundaryId =
      config.id || `error-boundary-${displayName.toLowerCase()}`;

    return (
      <ErrorBoundary
        id={boundaryId}
        errorTitle={config.errorTitle}
        fallback={config.fallback}
        onError={config.onError}
        showReport={config.showReport}
        showDetails={config.showDetails}
        size={config.size}
      >
        <Component {...props} />
      </ErrorBoundary>
    );
  };

  WithErrorBoundary.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WithErrorBoundary;
}

/**
 * Create an error boundary wrapper with predefined configuration
 *
 * @example
 * ```tsx
 * const createSafeComponent = createErrorBoundaryWrapper({
 *   showReport: true,
 *   showDetails: true,
 *   onError: (error) => trackError(error),
 * });
 *
 * const SafeComponent = createSafeComponent(MyComponent, { id: 'my-component' });
 * ```
 */
export function createErrorBoundaryWrapper(
  defaultConfig: ErrorBoundaryConfig = {}
) {
  return function <P extends object>(
    Component: ComponentType<P>,
    config: ErrorBoundaryConfig = {}
  ): ComponentType<P> {
    return withErrorBoundary(Component, { ...defaultConfig, ...config });
  };
}
