'use client';

import { useMediaQuery } from './useMediaQuery';

/**
 * Hook to detect if the user prefers reduced motion.
 * This is an accessibility feature that respects user system preferences.
 *
 * Users may enable reduced motion for various reasons:
 * - Motion sensitivity or vestibular disorders
 * - Cognitive disabilities that make animations distracting
 * - Battery conservation on mobile devices
 * - Personal preference
 *
 * @returns boolean indicating if user prefers reduced motion
 *
 * @example
 * const prefersReducedMotion = usePrefersReducedMotion();
 *
 * // Conditionally apply animations
 * const animationDuration = prefersReducedMotion ? 0 : 300;
 *
 * // Or disable animations entirely
 * <motion.div
 *   animate={{ opacity: 1 }}
 *   transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
 * />
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Hook to detect if the user prefers no animations at all.
 * More restrictive than reduced motion - should disable all non-essential animations.
 *
 * @returns boolean indicating if user prefers no motion
 */
export function usePrefersNoMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Hook to get appropriate animation duration based on user preference.
 * Returns 0 for reduced motion users, otherwise returns the provided duration.
 *
 * @param duration - Default animation duration in milliseconds
 * @returns 0 if user prefers reduced motion, otherwise the provided duration
 *
 * @example
 * const duration = useAnimationDuration(300);
 * // Returns 0 for reduced motion users, 300 otherwise
 */
export function useAnimationDuration(duration: number): number {
  const prefersReducedMotion = usePrefersReducedMotion();
  return prefersReducedMotion ? 0 : duration;
}
