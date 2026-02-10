'use client';

import { useState, useEffect, useMemo } from 'react';
import { useMediaQuery } from './useMediaQuery';

/**
 * Tailwind CSS default breakpoints (in pixels)
 * These match Tailwind's default configuration
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;

/**
 * Semantic breakpoint names used throughout the app
 */
export type SemanticBreakpoint = 'mobile' | 'tablet' | 'desktop';

/**
 * Hook to get the current breakpoint name based on viewport width.
 * Uses semantic names: mobile (< 768px), tablet (768px - 1279px), desktop (>= 1280px)
 *
 * @returns Current semantic breakpoint name
 *
 * @example
 * const breakpoint = useBreakpoint();
 * if (breakpoint === 'mobile') {
 *   // Render mobile layout
 * }
 */
export function useBreakpoint(): SemanticBreakpoint {
  const [breakpoint, setBreakpoint] = useState<SemanticBreakpoint>('desktop');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const checkBreakpoint = () => {
      const width = window.innerWidth;
      if (width < BREAKPOINTS.md) {
        setBreakpoint('mobile');
      } else if (width < BREAKPOINTS.xl) {
        setBreakpoint('tablet');
      } else {
        setBreakpoint('desktop');
      }
    };

    checkBreakpoint();
    window.addEventListener('resize', checkBreakpoint);
    return () => window.removeEventListener('resize', checkBreakpoint);
  }, []);

  return breakpoint;
}

/**
 * Hook to check if the viewport is at or above a specific breakpoint.
 *
 * @param breakpoint - The breakpoint key to check against (sm, md, lg, xl, 2xl)
 * @returns boolean indicating if viewport is at or above the breakpoint
 *
 * @example
 * const isTabletOrLarger = useIsBreakpoint('md');
 * const isDesktop = useIsBreakpoint('lg');
 */
export function useIsBreakpoint(breakpoint: BreakpointKey): boolean {
  const query = `(min-width: ${BREAKPOINTS[breakpoint]}px)`;
  return useMediaQuery(query);
}

/**
 * Hook to check if the viewport is below a specific breakpoint.
 *
 * @param breakpoint - The breakpoint key to check against (sm, md, lg, xl, 2xl)
 * @returns boolean indicating if viewport is below the breakpoint
 *
 * @example
 * const isMobile = useIsBelowBreakpoint('md');
 */
export function useIsBelowBreakpoint(breakpoint: BreakpointKey): boolean {
  const query = `(max-width: ${BREAKPOINTS[breakpoint] - 1}px)`;
  return useMediaQuery(query);
}

/**
 * Hook to check if the viewport is between two breakpoints (inclusive of min, exclusive of max).
 *
 * @param minBreakpoint - The minimum breakpoint (inclusive)
 * @param maxBreakpoint - The maximum breakpoint (exclusive)
 * @returns boolean indicating if viewport is between the breakpoints
 *
 * @example
 * const isTabletOnly = useIsBetweenBreakpoints('md', 'lg');
 */
export function useIsBetweenBreakpoints(
  minBreakpoint: BreakpointKey,
  maxBreakpoint: BreakpointKey
): boolean {
  const query = `(min-width: ${BREAKPOINTS[minBreakpoint]}px) and (max-width: ${BREAKPOINTS[maxBreakpoint] - 1}px)`;
  return useMediaQuery(query);
}

/**
 * Hook to get the current Tailwind breakpoint key.
 * Returns the largest breakpoint that the viewport currently satisfies.
 *
 * @returns The current breakpoint key or null if below 'sm'
 *
 * @example
 * const currentBreakpoint = useCurrentBreakpoint();
 * // Returns: null | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
 */
export function useCurrentBreakpoint(): BreakpointKey | null {
  const isSm = useMediaQuery(`(min-width: ${BREAKPOINTS.sm}px)`);
  const isMd = useMediaQuery(`(min-width: ${BREAKPOINTS.md}px)`);
  const isLg = useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);
  const isXl = useMediaQuery(`(min-width: ${BREAKPOINTS.xl}px)`);
  const is2xl = useMediaQuery(`(min-width: ${BREAKPOINTS['2xl']}px)`);

  return useMemo(() => {
    if (is2xl) return '2xl';
    if (isXl) return 'xl';
    if (isLg) return 'lg';
    if (isMd) return 'md';
    if (isSm) return 'sm';
    return null;
  }, [isSm, isMd, isLg, isXl, is2xl]);
}
