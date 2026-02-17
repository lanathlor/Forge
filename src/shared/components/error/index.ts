/**
 * Error Components & Utilities
 *
 * Comprehensive error handling system including:
 * - ErrorBoundary for catching React component errors
 * - ErrorState components for various error scenarios
 * - Toast utilities for transient error notifications
 * - Error handling hooks and HOCs
 */

// Error Boundary
export { ErrorBoundary } from './ErrorBoundary';
export { withErrorBoundary, createErrorBoundaryWrapper } from './withErrorBoundary';

// Error State Components
export {
  ErrorState,
  InlineError,
  CardError,
  NetworkError,
  TimeoutError,
  NotFoundError,
  ValidationError,
  ServerError,
  UnauthorizedError,
  ForbiddenError,
} from './ErrorStates';
export type { ErrorType } from './ErrorStates';

// Error Toast Utilities
export { useErrorToast, createErrorToast, formatError, errorToastHelpers } from './errorToast';
export type { ErrorToastType } from './errorToast';

// Error Handler Hook
export { useErrorHandler, createSafeAsync } from './useErrorHandler';
