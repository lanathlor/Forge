import * as React from "react"
import { Suspense } from "react"
import { cn } from "@/shared/lib/utils"
import { LoadingSpinner } from "./loading"
import {
  TaskListSkeleton,
  PlanListSkeleton,
  SessionSummarySkeleton,
  QAGatesConfigSkeleton,
  DashboardGridSkeleton,
} from "./skeleton-loaders"

/**
 * Common loading fallback types for React.Suspense
 */
export type SuspenseFallbackType =
  | "spinner"
  | "task-list"
  | "plan-list"
  | "session-summary"
  | "qa-gates"
  | "dashboard-grid"
  | "custom"

export interface SuspenseWrapperProps {
  /** The content to lazy load */
  children: React.ReactNode
  /** Type of loading fallback to show */
  fallbackType?: SuspenseFallbackType
  /** Custom fallback component (used when fallbackType is "custom") */
  customFallback?: React.ReactNode
  /** Optional className for wrapper */
  className?: string
  /** Loading message for spinner fallback */
  loadingMessage?: string
  /** Number of skeleton items to show */
  skeletonCount?: number
}

/**
 * Suspense wrapper with pre-configured loading states
 *
 * Usage:
 * ```tsx
 * <SuspenseWrapper fallbackType="task-list">
 *   <LazyTaskList />
 * </SuspenseWrapper>
 * ```
 */
export function SuspenseWrapper({
  children,
  fallbackType = "spinner",
  customFallback,
  className,
  loadingMessage = "Loading...",
  skeletonCount = 3,
}: SuspenseWrapperProps) {
  const getFallback = () => {
    switch (fallbackType) {
      case "spinner":
        return (
          <div className="flex items-center justify-center h-full min-h-[300px]">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <LoadingSpinner size="lg" variant="primary" />
              <span className="text-sm">{loadingMessage}</span>
            </div>
          </div>
        )

      case "task-list":
        return <TaskListSkeleton count={skeletonCount} />

      case "plan-list":
        return <PlanListSkeleton count={skeletonCount} />

      case "session-summary":
        return <SessionSummarySkeleton />

      case "qa-gates":
        return <QAGatesConfigSkeleton />

      case "dashboard-grid":
        return <DashboardGridSkeleton columns={3} rows={2} />

      case "custom":
        return customFallback || null

      default:
        return (
          <div className="flex items-center justify-center p-8">
            <LoadingSpinner size="lg" />
          </div>
        )
    }
  }

  return (
    <div className={cn(className)}>
      <Suspense fallback={getFallback()}>
        {children}
      </Suspense>
    </div>
  )
}

/**
 * Spinner-based Suspense (lightweight fallback)
 */
export function SuspenseSpinner({
  children,
  message,
  className,
}: {
  children: React.ReactNode
  message?: string
  className?: string
}) {
  return (
    <SuspenseWrapper
      fallbackType="spinner"
      loadingMessage={message}
      className={className}
    >
      {children}
    </SuspenseWrapper>
  )
}

/**
 * Task list Suspense (for task-related lazy components)
 */
export function SuspenseTaskList({
  children,
  count = 5,
  className,
}: {
  children: React.ReactNode
  count?: number
  className?: string
}) {
  return (
    <SuspenseWrapper
      fallbackType="task-list"
      skeletonCount={count}
      className={className}
    >
      {children}
    </SuspenseWrapper>
  )
}

/**
 * Plan list Suspense (for plan-related lazy components)
 */
export function SuspensePlanList({
  children,
  count = 3,
  className,
}: {
  children: React.ReactNode
  count?: number
  className?: string
}) {
  return (
    <SuspenseWrapper
      fallbackType="plan-list"
      skeletonCount={count}
      className={className}
    >
      {children}
    </SuspenseWrapper>
  )
}

/**
 * Dashboard Suspense (for dashboard sections)
 */
export function SuspenseDashboard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <SuspenseWrapper
      fallbackType="dashboard-grid"
      className={className}
    >
      {children}
    </SuspenseWrapper>
  )
}

/**
 * Usage Examples:
 *
 * // Basic spinner
 * <SuspenseWrapper>
 *   <LazyComponent />
 * </SuspenseWrapper>
 *
 * // With message
 * <SuspenseWrapper loadingMessage="Loading tasks...">
 *   <LazyTaskList />
 * </SuspenseWrapper>
 *
 * // Task list skeleton
 * <SuspenseWrapper fallbackType="task-list" skeletonCount={10}>
 *   <LazyTaskList />
 * </SuspenseWrapper>
 *
 * // Shorthand variants
 * <SuspenseSpinner message="Loading...">
 *   <LazyComponent />
 * </SuspenseSpinner>
 *
 * <SuspenseTaskList count={10}>
 *   <LazyTaskList />
 * </SuspenseTaskList>
 *
 * <SuspensePlanList count={5}>
 *   <LazyPlanList />
 * </SuspensePlanList>
 *
 * <SuspenseDashboard>
 *   <LazyDashboard />
 * </SuspenseDashboard>
 *
 * // Custom fallback
 * <SuspenseWrapper
 *   fallbackType="custom"
 *   customFallback={<MyCustomLoader />}
 * >
 *   <LazyComponent />
 * </SuspenseWrapper>
 */
