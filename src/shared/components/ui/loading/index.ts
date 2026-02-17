/**
 * Loading Components Index
 *
 * Centralized exports for all loading-related components
 *
 * @example
 * ```tsx
 * import { LoadingSpinner, TaskListSkeleton } from '@/shared/components/ui/loading';
 * ```
 */

// ============================================================================
// Core Loading Components
// ============================================================================

export {
  LoadingSpinner,
  ProgressBar,
  IndeterminateProgress,
  Skeleton,
  SkeletonGroup,
  LoadingOverlay,
  PulsingDot,
  spinnerVariants,
  progressBarVariants,
  progressFillVariants,
  type LoadingSpinnerProps,
  type ProgressBarProps,
  type IndeterminateProgressProps,
  type SkeletonProps,
  type SkeletonGroupProps,
  type LoadingOverlayProps,
  type PulsingDotProps,
} from '../loading'

// ============================================================================
// Specialized Skeleton Loaders
// ============================================================================

export {
  StatCardSkeleton,
  ActionCardSkeleton,
  ListCardSkeleton,
  TaskListItemSkeleton,
  TaskListSkeleton,
  PlanItemSkeleton,
  PlanListSkeleton,
  RepositorySelectorSkeleton,
  SessionSummarySkeleton,
  QAGatesConfigSkeleton,
  DashboardGridSkeleton,
  DetailPanelSkeleton,
  TableSkeleton,
  type StatCardSkeletonProps,
  type ActionCardSkeletonProps,
  type ListCardSkeletonProps,
  type TableSkeletonProps,
} from '../skeleton-loaders'

// ============================================================================
// Helper Components
// ============================================================================

export {
  LoadingButton,
  type LoadingButtonProps,
} from '../loading-button'

export {
  SuspenseWrapper,
  SuspenseSpinner,
  SuspenseTaskList,
  SuspensePlanList,
  SuspenseDashboard,
  type SuspenseWrapperProps,
  type SuspenseFallbackType,
} from '../suspense-wrapper'
