import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Re-export other hooks
export { useTaskStream } from './useTaskStream';
export type { TaskUpdate } from './useTaskStream';

// Responsive hooks
export { useMediaQuery } from './useMediaQuery';

export {
  useBreakpoint,
  useIsBreakpoint,
  useIsBelowBreakpoint,
  useIsBetweenBreakpoints,
  useCurrentBreakpoint,
  BREAKPOINTS,
} from './useBreakpoint';
export type { BreakpointKey, SemanticBreakpoint } from './useBreakpoint';

export {
  usePrefersReducedMotion,
  usePrefersNoMotion,
  useAnimationDuration,
} from './usePrefersReducedMotion';

export {
  useResponsiveValue,
  useResponsiveValueWithFallback,
} from './useResponsiveValue';
export type { ResponsiveValue, ExtractResponsiveValue } from './useResponsiveValue';
