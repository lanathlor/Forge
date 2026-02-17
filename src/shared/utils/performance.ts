/**
 * Performance optimization utilities
 *
 * This module provides utilities for monitoring and optimizing React component performance
 */

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Check if the current device prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Performance profiler callback type
 */
export interface ProfilerCallbackParams {
  id: string;
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
}

export type ProfilerCallback = (params: ProfilerCallbackParams) => void;

/**
 * Log slow renders to console (development only)
 */
export const logSlowRender: ProfilerCallback = ({
  id,
  phase,
  actualDuration,
  baseDuration,
}) => {
  if (process.env.NODE_ENV !== 'development') return;

  // Log if render takes more than 16ms (60fps threshold)
  if (actualDuration > 16) {
    console.warn(`[Performance] Slow ${phase} render detected:`, {
      component: id,
      actualDuration: `${actualDuration.toFixed(2)}ms`,
      baseDuration: `${baseDuration.toFixed(2)}ms`,
    });
  }
};

/**
 * Request idle callback polyfill for older browsers
 */
export const requestIdleCallback =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? window.requestIdleCallback
    : (callback: IdleRequestCallback) => {
        const start = Date.now();
        return setTimeout(() => {
          callback({
            didTimeout: false,
            timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
          });
        }, 1);
      };

/**
 * Cancel idle callback polyfill
 */
export const cancelIdleCallback =
  typeof window !== 'undefined' && 'cancelIdleCallback' in window
    ? window.cancelIdleCallback
    : (id: number) => clearTimeout(id);

/**
 * Measure component render time (development only)
 */
export function measureRender(componentName: string, fn: () => void): void {
  if (process.env.NODE_ENV !== 'development') {
    fn();
    return;
  }

  const start = performance.now();
  fn();
  const end = performance.now();
  const duration = end - start;

  if (duration > 16) {
    console.warn(
      `[Performance] ${componentName} render took ${duration.toFixed(2)}ms`
    );
  }
}
