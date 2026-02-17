import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Re-export other hooks
export { useTaskStream } from './useTaskStream';
export type { TaskUpdate } from './useTaskStream';

export { useMultiRepoStream } from './useMultiRepoStream';
export type {
  ClaudeStatus,
  RepoSessionState,
  MultiRepoUpdate,
} from './useMultiRepoStream';

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
export type {
  ResponsiveValue,
  ExtractResponsiveValue,
} from './useResponsiveValue';

export { useCountUp, easings } from './useCountUp';
export type { UseCountUpOptions, UseCountUpReturn } from './useCountUp';

// Keyboard navigation hooks
export {
  useKeyboardShortcuts,
  useKeyboardShortcut,
  formatShortcut,
} from './useKeyboardShortcuts';
export type { KeyboardShortcut } from './useKeyboardShortcuts';

export { useFocusTrap, useFocusRestore } from './useFocusTrap';

export {
  useArrowKeyNavigation,
  useGridNavigation,
} from './useArrowKeyNavigation';
export type {
  UseArrowKeyNavigationOptions,
  UseGridNavigationOptions,
} from './useArrowKeyNavigation';

// SSE hooks (re-export from contexts)
export {
  useSSE,
  useSSEStatus,
  useSSEConnected,
  useSSEHealth,
  useSSESubscription,
  useSSESubscriptionAll,
  useSSEData,
  useConnectionStatus,
} from '@/shared/contexts/SSEContext';
export type { SSEContextValue } from '@/shared/contexts/SSEContext';
