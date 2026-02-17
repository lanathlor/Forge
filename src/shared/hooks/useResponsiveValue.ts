'use client';

import { useMemo } from 'react';
import { useMediaQuery } from './useMediaQuery';
import { BREAKPOINTS, type BreakpointKey } from './useBreakpoint';

/**
 * Responsive value configuration object.
 * Keys are breakpoint names, values are the values to use at that breakpoint and above.
 * Uses a mobile-first approach: values cascade up from smaller to larger breakpoints.
 */
export type ResponsiveValue<T> = {
  /** Base value for all screen sizes (mobile-first default) */
  base?: T;
  /** Value for sm (640px) and above */
  sm?: T;
  /** Value for md (768px) and above */
  md?: T;
  /** Value for lg (1024px) and above */
  lg?: T;
  /** Value for xl (1280px) and above */
  xl?: T;
  /** Value for 2xl (1536px) and above */
  '2xl'?: T;
};

/**
 * Array of breakpoint keys in ascending order
 */
const BREAKPOINT_ORDER: (BreakpointKey | 'base')[] = [
  'base',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
];

/**
 * Hook to get a value that changes based on the current breakpoint.
 * Uses a mobile-first approach where values cascade up from smaller to larger breakpoints.
 *
 * @param values - Object with breakpoint keys and their corresponding values
 * @param fallback - Default value if no breakpoint matches
 * @returns The value for the current breakpoint
 *
 * @example
 * // Simple responsive padding
 * const padding = useResponsiveValue({ base: 16, md: 24, lg: 32 });
 *
 * // Responsive layout mode
 * const layout = useResponsiveValue({
 *   base: 'compact',
 *   md: 'comfortable',
 *   lg: 'expanded'
 * }, 'compact');
 *
 * // Responsive columns
 * const columns = useResponsiveValue({ base: 1, sm: 2, lg: 3, xl: 4 }, 1);
 */
export function useResponsiveValue<T>(
  values: ResponsiveValue<T>,
  fallback?: T
): T | undefined {
  const isSm = useMediaQuery(`(min-width: ${BREAKPOINTS.sm}px)`);
  const isMd = useMediaQuery(`(min-width: ${BREAKPOINTS.md}px)`);
  const isLg = useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);
  const isXl = useMediaQuery(`(min-width: ${BREAKPOINTS.xl}px)`);
  const is2xl = useMediaQuery(`(min-width: ${BREAKPOINTS['2xl']}px)`);

  return useMemo(() => {
    // Determine the highest matching breakpoint
    let currentBreakpointIndex: number;
    if (is2xl)
      currentBreakpointIndex = 5; // '2xl'
    else if (isXl)
      currentBreakpointIndex = 4; // 'xl'
    else if (isLg)
      currentBreakpointIndex = 3; // 'lg'
    else if (isMd)
      currentBreakpointIndex = 2; // 'md'
    else if (isSm)
      currentBreakpointIndex = 1; // 'sm'
    else currentBreakpointIndex = 0; // 'base'

    // Find the value for the current breakpoint or cascade down to smaller breakpoints
    for (let i = currentBreakpointIndex; i >= 0; i--) {
      const key = BREAKPOINT_ORDER[i];
      if (
        key &&
        key in values &&
        values[key as keyof ResponsiveValue<T>] !== undefined
      ) {
        return values[key as keyof ResponsiveValue<T>];
      }
    }

    return fallback;
  }, [values, fallback, isSm, isMd, isLg, isXl, is2xl]);
}

/**
 * Hook variant that requires a fallback value, guaranteeing a non-undefined return.
 *
 * @param values - Object with breakpoint keys and their corresponding values
 * @param fallback - Required default value
 * @returns The value for the current breakpoint (never undefined)
 *
 * @example
 * const size = useResponsiveValueWithFallback({ base: 'sm', lg: 'lg' }, 'md');
 * // size is guaranteed to be a string, never undefined
 */
export function useResponsiveValueWithFallback<T>(
  values: ResponsiveValue<T>,
  fallback: T
): T {
  const result = useResponsiveValue(values, fallback);
  return result ?? fallback;
}

/**
 * Utility type to extract the value type from a ResponsiveValue
 */
export type ExtractResponsiveValue<T> =
  T extends ResponsiveValue<infer U> ? U : never;
