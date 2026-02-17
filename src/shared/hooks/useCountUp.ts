'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export interface UseCountUpOptions {
  /** Starting value (default: 0) */
  from?: number;
  /** Target value to count up to */
  to: number;
  /** Animation duration in milliseconds (default: 1000) */
  duration?: number;
  /** Easing function (default: easeOutCubic) */
  easing?: (t: number) => number;
  /** Number of decimal places (default: 0) */
  decimals?: number;
  /** Delay before starting animation in milliseconds (default: 0) */
  delay?: number;
  /** Whether to start animation automatically (default: true) */
  autoStart?: boolean;
  /** Callback when animation completes */
  onComplete?: () => void;
}

export interface UseCountUpReturn {
  /** Current animated value */
  value: number;
  /** Formatted value as string */
  formattedValue: string;
  /** Whether animation is currently running */
  isAnimating: boolean;
  /** Start the animation */
  start: () => void;
  /** Reset to initial value */
  reset: () => void;
}

export const easings = {
  linear: (t: number): number => t,
  easeOutCubic: (t: number): number => 1 - Math.pow(1 - t, 3),
  easeOutQuart: (t: number): number => 1 - Math.pow(1 - t, 4),
  easeOutExpo: (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutCubic: (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};

interface AnimationState {
  animationRef: React.MutableRefObject<number | null>;
  startTimeRef: React.MutableRefObject<number | null>;
  hasStartedRef: React.MutableRefObject<boolean>;
}

interface AnimationCallbacks {
  animate: (timestamp: number) => void;
  start: () => void;
  reset: () => void;
}

interface ValueSyncConfig {
  to: number;
  from: number;
  isAnimating: boolean;
  autoStart: boolean;
  prefersReducedMotion: boolean;
}

function cancelAnimation(
  animationRef: React.MutableRefObject<number | null>
): void {
  if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
}

function useAnimationState(): AnimationState {
  return {
    animationRef: useRef<number | null>(null),
    startTimeRef: useRef<number | null>(null),
    hasStartedRef: useRef(false),
  };
}

function useCleanup(animationRef: React.MutableRefObject<number | null>): void {
  useEffect(() => () => cancelAnimation(animationRef), [animationRef]);
}

function useAutoStart(
  autoStart: boolean,
  hasStartedRef: React.MutableRefObject<boolean>,
  start: () => void
): void {
  useEffect(() => {
    if (autoStart && !hasStartedRef.current) {
      hasStartedRef.current = true;
      start();
    }
  }, [autoStart, start, hasStartedRef]);
}

function useValueSync(
  config: ValueSyncConfig,
  setValue: (value: number) => void
): void {
  const { to, from, isAnimating, autoStart, prefersReducedMotion } = config;
  useEffect(() => {
    if (!isAnimating && !autoStart) setValue(prefersReducedMotion ? to : from);
  }, [to, from, isAnimating, autoStart, prefersReducedMotion, setValue]);
}

interface AnimationParams {
  from: number;
  to: number;
  duration: number;
  easing: (t: number) => number;
  delay: number;
  prefersReducedMotion: boolean;
  onComplete?: () => void;
}

function useAnimationCallbacks(
  params: AnimationParams,
  state: AnimationState,
  setValue: (v: number) => void,
  setIsAnimating: (v: boolean) => void
): AnimationCallbacks {
  const { from, to, duration, easing, delay, prefersReducedMotion, onComplete } = params;

  const animate = useCallback(
    (timestamp: number) => {
      if (state.startTimeRef.current === null) state.startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - state.startTimeRef.current) / duration, 1);
      setValue(from + (to - from) * easing(progress));
      if (progress < 1) state.animationRef.current = requestAnimationFrame(animate);
      else { setValue(to); setIsAnimating(false); onComplete?.(); }
    },
    [from, to, duration, easing, onComplete, state, setValue, setIsAnimating]
  );

  const start = useCallback(() => {
    if (prefersReducedMotion) { setValue(to); onComplete?.(); return; }
    cancelAnimation(state.animationRef);
    state.startTimeRef.current = null;
    setValue(from);
    setIsAnimating(true);
    setTimeout(() => { state.animationRef.current = requestAnimationFrame(animate); }, delay);
  }, [prefersReducedMotion, to, from, delay, animate, onComplete, state, setValue, setIsAnimating]);

  const reset = useCallback(() => {
    cancelAnimation(state.animationRef);
    state.startTimeRef.current = null;
    setIsAnimating(false);
    setValue(prefersReducedMotion ? to : from);
    state.hasStartedRef.current = false;
  }, [prefersReducedMotion, from, to, state, setValue, setIsAnimating]);

  return { animate, start, reset };
}

/**
 * Hook for animating numbers with a count-up effect.
 * Respects user's reduced motion preferences.
 *
 * @example
 * const { formattedValue } = useCountUp({ to: 100, duration: 1500 });
 */
export function useCountUp(options: UseCountUpOptions): UseCountUpReturn {
  const { from = 0, to, duration = 1000, easing = easings.easeOutCubic, decimals = 0, delay = 0, autoStart = true, onComplete } = options;
  const prefersReducedMotion = usePrefersReducedMotion();
  const [value, setValue] = useState(prefersReducedMotion ? to : from);
  const [isAnimating, setIsAnimating] = useState(false);
  const state = useAnimationState();

  const formatValue = useCallback((val: number): string => val.toFixed(decimals), [decimals]);
  const { start, reset } = useAnimationCallbacks(
    { from, to, duration, easing, delay, prefersReducedMotion, onComplete },
    state, setValue, setIsAnimating
  );

  useAutoStart(autoStart, state.hasStartedRef, start);
  useValueSync({ to, from, isAnimating, autoStart, prefersReducedMotion }, setValue);
  useCleanup(state.animationRef);

  return { value, formattedValue: formatValue(value), isAnimating, start, reset };
}
