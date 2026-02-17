/**
 * Error Toast Utilities
 *
 * Convenient functions for showing error notifications via toast
 * with consistent styling and actions.
 */

import type { Toast } from '@/shared/components/ui/toast';

export type ErrorToastType =
  | 'network'
  | 'timeout'
  | 'validation'
  | 'server'
  | 'generic';

interface ErrorToastOptions {
  /**
   * Error type (determines icon and styling)
   */
  type?: ErrorToastType;
  /**
   * Error title
   */
  title?: string;
  /**
   * Error message/description
   */
  message: string;
  /**
   * Retry callback
   */
  onRetry?: () => void;
  /**
   * Duration in ms (0 = no auto-dismiss)
   */
  duration?: number;
  /**
   * Whether the toast can be dismissed
   */
  dismissible?: boolean;
}

interface ShowErrorToastFn {
  (options: ErrorToastOptions): string;
}

/**
 * Show an error toast notification
 */
export function createErrorToast(
  addToast: (toast: Omit<Toast, 'id'>) => string
): ShowErrorToastFn {
  return ({
    type = 'generic',
    title,
    message,
    onRetry,
    duration = 7000,
    dismissible = true,
  }) => {
    const errorTitle = title || getErrorTitle(type);

    return addToast({
      title: errorTitle,
      description: message,
      variant: 'error',
      duration,
      dismissible,
      action: onRetry
        ? {
            label: 'Retry',
            onClick: onRetry,
          }
        : undefined,
    });
  };
}

/**
 * Get default title for error type
 */
function getErrorTitle(type: ErrorToastType): string {
  switch (type) {
    case 'network':
      return 'Network Error';
    case 'timeout':
      return 'Request Timeout';
    case 'validation':
      return 'Validation Error';
    case 'server':
      return 'Server Error';
    default:
      return 'Error';
  }
}

/**
 * Check if error is network-related
 */
function isNetworkError(err: Record<string, unknown>): boolean {
  return err.name === 'NetworkError' || err.message === 'Failed to fetch';
}

/**
 * Check if error is timeout-related
 */
function isTimeoutError(err: Record<string, unknown>): boolean {
  return err.name === 'TimeoutError' || String(err.message).includes('timeout');
}

/**
 * Check if error is validation-related
 */
function isValidationError(err: Record<string, unknown>): boolean {
  return err.name === 'ValidationError' || err.type === 'validation';
}

/**
 * Check if error is server error (5xx)
 */
function isServerError(err: Record<string, unknown>): boolean {
  return (
    err.status !== undefined &&
    typeof err.status === 'number' &&
    err.status >= 500
  );
}

/**
 * Format object errors
 */
function formatObjectError(err: Record<string, unknown>): {
  title: string;
  message: string;
  type: ErrorToastType;
} {
  if (isNetworkError(err)) {
    return {
      title: 'Network Error',
      message:
        'Unable to connect to the server. Please check your internet connection.',
      type: 'network',
    };
  }

  if (isTimeoutError(err)) {
    return {
      title: 'Request Timeout',
      message: 'The request took too long to complete. Please try again.',
      type: 'timeout',
    };
  }

  if (isValidationError(err)) {
    return {
      title: 'Validation Error',
      message: String(err.message || 'The provided data is invalid.'),
      type: 'validation',
    };
  }

  if (isServerError(err)) {
    return {
      title: 'Server Error',
      message: String(err.message || 'An error occurred on the server. Please try again later.'),
      type: 'server',
    };
  }

  if (err.message) {
    return { title: 'Error', message: String(err.message), type: 'generic' };
  }

  return {
    title: 'Error',
    message: 'An unexpected error occurred. Please try again.',
    type: 'generic',
  };
}

/**
 * Parse and format error from various sources
 */
export function formatError(error: unknown): {
  title: string;
  message: string;
  type: ErrorToastType;
} {
  if (error instanceof Error) {
    return { title: 'Error', message: error.message, type: 'generic' };
  }

  if (error && typeof error === 'object') {
    return formatObjectError(error as Record<string, unknown>);
  }

  if (typeof error === 'string') {
    return { title: 'Error', message: error, type: 'generic' };
  }

  return {
    title: 'Error',
    message: 'An unexpected error occurred. Please try again.',
    type: 'generic',
  };
}

/**
 * Convenience functions for common error scenarios
 */
export const errorToastHelpers = {
  /**
   * Show a network error toast
   */
  network: (
    addToast: (toast: Omit<Toast, 'id'>) => string,
    message?: string,
    onRetry?: () => void
  ) => {
    return createErrorToast(addToast)({
      type: 'network',
      message:
        message ||
        'Unable to connect to the server. Please check your internet connection.',
      onRetry,
    });
  },

  /**
   * Show a timeout error toast
   */
  timeout: (
    addToast: (toast: Omit<Toast, 'id'>) => string,
    message?: string,
    onRetry?: () => void
  ) => {
    return createErrorToast(addToast)({
      type: 'timeout',
      message:
        message || 'The request took too long to complete. Please try again.',
      onRetry,
    });
  },

  /**
   * Show a validation error toast
   */
  validation: (
    addToast: (toast: Omit<Toast, 'id'>) => string,
    message: string
  ) => {
    return createErrorToast(addToast)({
      type: 'validation',
      message,
      duration: 5000,
    });
  },

  /**
   * Show a server error toast
   */
  server: (
    addToast: (toast: Omit<Toast, 'id'>) => string,
    message?: string,
    onRetry?: () => void
  ) => {
    return createErrorToast(addToast)({
      type: 'server',
      message:
        message || 'An error occurred on the server. Please try again later.',
      onRetry,
    });
  },

  /**
   * Show a generic error toast from an unknown error
   */
  fromError: (
    addToast: (toast: Omit<Toast, 'id'>) => string,
    error: unknown,
    onRetry?: () => void
  ) => {
    const formatted = formatError(error);
    return createErrorToast(addToast)({
      type: formatted.type,
      title: formatted.title,
      message: formatted.message,
      onRetry,
    });
  },
};

/**
 * Hook for error toast notifications
 * Usage in components:
 *
 * import { useToast } from '@/shared/components/ui/toast';
 * import { useErrorToast } from '@/shared/components/error/errorToast';
 *
 * function MyComponent() {
 *   const { addToast } = useToast();
 *   const showError = useErrorToast(addToast);
 *
 *   const handleFetch = async () => {
 *     try {
 *       await fetchData();
 *     } catch (error) {
 *       showError.fromError(error, handleFetch);
 *     }
 *   };
 * }
 */
export function useErrorToast(addToast: (toast: Omit<Toast, 'id'>) => string) {
  return {
    show: createErrorToast(addToast),
    network: (message?: string, onRetry?: () => void) =>
      errorToastHelpers.network(addToast, message, onRetry),
    timeout: (message?: string, onRetry?: () => void) =>
      errorToastHelpers.timeout(addToast, message, onRetry),
    validation: (message: string) =>
      errorToastHelpers.validation(addToast, message),
    server: (message?: string, onRetry?: () => void) =>
      errorToastHelpers.server(addToast, message, onRetry),
    fromError: (error: unknown, onRetry?: () => void) =>
      errorToastHelpers.fromError(addToast, error, onRetry),
  };
}
