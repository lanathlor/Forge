'use client';

import { useCallback, useRef } from 'react';
import { useToast } from '@/shared/components/ui/toast';
import { useErrorToast } from './errorToast';

/**
 * Error Handler Hook
 *
 * Provides utilities for handling errors consistently across the application.
 * Includes automatic toast notifications, error logging, and retry logic.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { handleError, wrapAsync } = useErrorHandler();
 *
 *   const fetchData = wrapAsync(async () => {
 *     const res = await fetch('/api/data');
 *     if (!res.ok) throw new Error('Failed to fetch');
 *     return res.json();
 *   }, {
 *     showToast: true,
 *     onError: (error) => console.error('Custom handler:', error)
 *   });
 * }
 * ```
 */
export function useErrorHandler() {
  const { addToast } = useToast();
  const errorToast = useErrorToast(addToast);
  const lastErrorRef = useRef<{ error: unknown; timestamp: number } | null>(null);

  /**
   * Handle an error with optional toast notification
   */
  const handleError = useCallback(
    (
      error: unknown,
      options?: {
        /** Show a toast notification */
        showToast?: boolean;
        /** Custom error message */
        message?: string;
        /** Retry callback to show in toast */
        onRetry?: () => void;
        /** Custom error handler */
        onError?: (error: unknown) => void;
        /** Whether to log the error to console */
        logError?: boolean;
      }
    ) => {
      const {
        showToast = true,
        message,
        onRetry,
        onError,
        logError = true,
      } = options || {};

      // Log error to console
      if (logError) {
        console.error('[ErrorHandler]', error);
      }

      // Store last error for debugging
      lastErrorRef.current = {
        error,
        timestamp: Date.now(),
      };

      // Call custom error handler
      if (onError) {
        onError(error);
      }

      // Show toast notification
      if (showToast) {
        if (message) {
          errorToast.show({
            type: 'generic',
            message,
            onRetry,
          });
        } else {
          errorToast.fromError(error, onRetry);
        }
      }
    },
    [errorToast]
  );

  /**
   * Wrap an async function with error handling
   */
  const wrapAsync = useCallback(
    <T,>(
      fn: () => Promise<T>,
      options?: {
        /** Show a toast notification on error */
        showToast?: boolean;
        /** Custom error message */
        message?: string;
        /** Callback on error */
        onError?: (error: unknown) => void;
        /** Callback on success */
        onSuccess?: (result: T) => void;
        /** Whether to rethrow the error after handling */
        rethrow?: boolean;
      }
    ) => {
      const {
        showToast = true,
        message,
        onError,
        onSuccess,
        rethrow = false,
      } = options || {};

      return async (): Promise<T | undefined> => {
        try {
          const result = await fn();
          onSuccess?.(result);
          return result;
        } catch (error) {
          handleError(error, {
            showToast,
            message,
            onError,
          });

          if (rethrow) {
            throw error;
          }
          return undefined;
        }
      };
    },
    [handleError]
  );

  /**
   * Wrap a sync function with error handling
   */
  const wrapSync = useCallback(
    <T,>(
      fn: () => T,
      options?: {
        /** Show a toast notification on error */
        showToast?: boolean;
        /** Custom error message */
        message?: string;
        /** Callback on error */
        onError?: (error: unknown) => void;
        /** Callback on success */
        onSuccess?: (result: T) => void;
        /** Whether to rethrow the error after handling */
        rethrow?: boolean;
      }
    ) => {
      const {
        showToast = true,
        message,
        onError,
        onSuccess,
        rethrow = false,
      } = options || {};

      return (): T | undefined => {
        try {
          const result = fn();
          onSuccess?.(result);
          return result;
        } catch (error) {
          handleError(error, {
            showToast,
            message,
            onError,
          });

          if (rethrow) {
            throw error;
          }
          return undefined;
        }
      };
    },
    [handleError]
  );

  /**
   * Get the last error that was handled
   */
  const getLastError = useCallback(() => {
    return lastErrorRef.current;
  }, []);

  /**
   * Clear the last error
   */
  const clearLastError = useCallback(() => {
    lastErrorRef.current = null;
  }, []);

  return {
    handleError,
    wrapAsync,
    wrapSync,
    getLastError,
    clearLastError,
  };
}

/**
 * Create a safe async function with automatic error handling
 *
 * @example
 * ```tsx
 * const fetchUser = createSafeAsync(
 *   async (id: string) => {
 *     const res = await fetch(`/api/users/${id}`);
 *     return res.json();
 *   },
 *   {
 *     onError: (error) => console.error('Failed to fetch user:', error),
 *     showToast: true,
 *   }
 * );
 * ```
 */
export function createSafeAsync<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options?: {
    /** Show a toast notification on error */
    showToast?: boolean;
    /** Custom error message */
    message?: string;
    /** Callback on error */
    onError?: (error: unknown) => void;
    /** Callback on success */
    onSuccess?: (result: TResult) => void;
    /** Whether to rethrow the error after handling */
    rethrow?: boolean;
  }
) {
  const {
    message,
    onError,
    onSuccess,
    rethrow = false,
  } = options || {};

  return async (...args: TArgs): Promise<TResult | undefined> => {
    try {
      const result = await fn(...args);
      onSuccess?.(result);
      return result;
    } catch (error) {
      console.error('[SafeAsync] Error:', error);

      if (message) {
        console.error('[SafeAsync]', message);
      }

      onError?.(error);

      // Note: Toast notification would require access to the toast context
      // which isn't available in a standalone function. Use the hook instead.

      if (rethrow) {
        throw error;
      }
      return undefined;
    }
  };
}
