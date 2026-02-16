import * as React from "react"
import { cn } from "@/shared/lib/utils"
import { Skeleton } from "./loading"
import { statCardVariants, actionCardVariants, listCardVariants } from "./dashboard-cards"
import type { VariantProps } from "class-variance-authority"

// =============================================================================
// Card Skeleton Loaders
// =============================================================================

/**
 * Skeleton for StatCard component
 */
export interface StatCardSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: VariantProps<typeof statCardVariants>['variant']
  size?: VariantProps<typeof statCardVariants>['size']
  showTrend?: boolean
}

export const StatCardSkeleton = React.memo(React.forwardRef<HTMLDivElement, StatCardSkeletonProps>(
  ({ className, variant, size, showTrend = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(statCardVariants({ variant, size }), className)}
      {...props}
    >
      <div className="flex items-start justify-between">
        <Skeleton variant="circular" className="h-10 w-10" />
        {showTrend && <Skeleton className="h-5 w-16 rounded-full" />}
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  )
))
StatCardSkeleton.displayName = "StatCardSkeleton"

/**
 * Skeleton for ActionCard component
 */
export interface ActionCardSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: VariantProps<typeof actionCardVariants>['variant']
  size?: VariantProps<typeof actionCardVariants>['size']
  showAction?: boolean
}

export const ActionCardSkeleton = React.memo(React.forwardRef<HTMLDivElement, ActionCardSkeletonProps>(
  ({ className, variant, size, showAction = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(actionCardVariants({ variant, size }), className)}
      {...props}
    >
      <div className="flex items-start gap-4">
        <Skeleton variant="circular" className="h-12 w-12 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      {showAction && (
        <div className="mt-4 pt-4 border-t border-border">
          <Skeleton className="h-9 w-24" />
        </div>
      )}
    </div>
  )
))
ActionCardSkeleton.displayName = "ActionCardSkeleton"

/**
 * Skeleton for ListCard component
 */
export interface ListCardSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: VariantProps<typeof listCardVariants>['variant']
  itemCount?: number
  showHeader?: boolean
  showDescription?: boolean
  showHeaderAction?: boolean
  maxHeight?: string | number
}

export const ListCardSkeleton = React.memo(React.forwardRef<HTMLDivElement, ListCardSkeletonProps>(
  ({
    className,
    variant,
    itemCount = 3,
    showHeader = true,
    showDescription = true,
    showHeaderAction = true,
    maxHeight = 320,
    ...props
  }, ref) => {
    const maxHeightStyle = typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight

    return (
      <div ref={ref} className={cn(listCardVariants({ variant }), className)} {...props}>
        {showHeader && (
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="space-y-1">
              <Skeleton className="h-5 w-32" />
              {showDescription && <Skeleton className="h-4 w-48" />}
            </div>
            {showHeaderAction && <Skeleton className="h-8 w-20" />}
          </div>
        )}
        <div className="overflow-y-auto" style={{ maxHeight: maxHeightStyle }}>
          {Array.from({ length: itemCount }).map((_, i) => (
            <div key={i} className="p-4 border-b border-border last:border-b-0">
              <div className="flex items-center gap-3">
                <Skeleton variant="circular" className="h-8 w-8 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
))
ListCardSkeleton.displayName = "ListCardSkeleton"

// =============================================================================
// Specialized Dashboard Skeletons
// =============================================================================

/**
 * Skeleton for Task List items
 */
export const TaskListItemSkeleton = React.memo(({ className }: { className?: string }) => (
  <div className={cn("flex items-start gap-3 p-3 border-b border-border", className)}>
    <Skeleton variant="circular" className="h-5 w-5 shrink-0 mt-1" />
    <div className="flex-1 min-w-0 space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
    <Skeleton className="h-6 w-6 rounded shrink-0" />
  </div>
))
TaskListItemSkeleton.displayName = "TaskListItemSkeleton"

/**
 * Skeleton for Task List
 */
export const TaskListSkeleton = React.memo(({ count = 5, className }: { count?: number; className?: string }) => (
  <div className={cn("space-y-0", className)}>
    {Array.from({ length: count }).map((_, i) => (
      <TaskListItemSkeleton key={i} />
    ))}
  </div>
))
TaskListSkeleton.displayName = "TaskListSkeleton"

/**
 * Skeleton for Plan items
 */
export const PlanItemSkeleton = React.memo(({ className }: { className?: string }) => (
  <div className={cn("p-4 border-b border-border", className)}>
    <div className="flex items-start gap-3">
      <Skeleton variant="circular" className="h-10 w-10 shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <div className="flex items-center gap-3 pt-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  </div>
))
PlanItemSkeleton.displayName = "PlanItemSkeleton"

/**
 * Skeleton for Plan List
 */
export const PlanListSkeleton = React.memo(({ count = 3, className }: { count?: number; className?: string }) => (
  <div className={cn("space-y-0", className)}>
    {Array.from({ length: count }).map((_, i) => (
      <PlanItemSkeleton key={i} />
    ))}
  </div>
))
PlanListSkeleton.displayName = "PlanListSkeleton"

/**
 * Skeleton for Repository Selector
 */
export const RepositorySelectorSkeleton = React.memo(({ className }: { className?: string }) => (
  <div className={cn("space-y-3", className)}>
    <div className="flex items-center gap-2">
      <Skeleton className="h-10 flex-1" />
      <Skeleton className="h-10 w-10" />
    </div>
    <div className="border rounded-lg divide-y">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-3 flex items-center gap-3">
          <Skeleton variant="circular" className="h-8 w-8 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  </div>
))
RepositorySelectorSkeleton.displayName = "RepositorySelectorSkeleton"

/**
 * Skeleton for Session Summary
 */
export const SessionSummarySkeleton = React.memo(({ className }: { className?: string }) => (
  <div className={cn("space-y-6 p-6", className)}>
    {/* Header */}
    <div className="space-y-3">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
    </div>

    {/* Stats Grid */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>

    {/* Timeline */}
    <div className="space-y-3">
      <Skeleton className="h-6 w-32" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton variant="circular" className="h-3 w-3 shrink-0 mt-1" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
))
SessionSummarySkeleton.displayName = "SessionSummarySkeleton"

/**
 * Skeleton for QA Gates Config
 */
export const QAGatesConfigSkeleton = React.memo(({ className }: { className?: string }) => (
  <div className={cn("space-y-6 p-6", className)}>
    {/* Header */}
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-10 w-32" />
    </div>

    {/* Gate Cards */}
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton variant="circular" className="h-10 w-10" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
          <div className="pl-13 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  </div>
))
QAGatesConfigSkeleton.displayName = "QAGatesConfigSkeleton"

/**
 * Skeleton for Dashboard Grid (common pattern)
 */
export const DashboardGridSkeleton = React.memo(({
  columns = 3,
  rows = 2,
  className
}: {
  columns?: number
  rows?: number
  className?: string
}) => {
  const gridClass = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  }[columns] || "grid-cols-3"

  return (
    <div className={cn(`grid gap-4 ${gridClass}`, className)}>
      {Array.from({ length: columns * rows }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  )
})
DashboardGridSkeleton.displayName = "DashboardGridSkeleton"

/**
 * Skeleton for Detail Panel (sidebar)
 */
export const DetailPanelSkeleton = React.memo(({ className }: { className?: string }) => (
  <div className={cn("space-y-4 p-4", className)}>
    {/* Header */}
    <div className="flex items-start justify-between">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-8 w-8" />
    </div>

    {/* Status badges */}
    <div className="flex gap-2">
      <Skeleton className="h-6 w-20 rounded-full" />
      <Skeleton className="h-6 w-24 rounded-full" />
    </div>

    {/* Content sections */}
    <div className="space-y-4 pt-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-32 w-full" />
        </div>
      ))}
    </div>

    {/* Actions */}
    <div className="flex gap-2 pt-4 border-t">
      <Skeleton className="h-10 flex-1" />
      <Skeleton className="h-10 flex-1" />
    </div>
  </div>
))
DetailPanelSkeleton.displayName = "DetailPanelSkeleton"

/**
 * Skeleton for Table
 */
export interface TableSkeletonProps {
  columns?: number
  rows?: number
  showHeader?: boolean
  className?: string
}

export const TableSkeleton = React.memo(({
  columns = 4,
  rows = 5,
  showHeader = true,
  className
}: TableSkeletonProps) => (
  <div className={cn("border rounded-lg overflow-hidden", className)}>
    {showHeader && (
      <div className="bg-muted/50 p-3 border-b">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
    )}
    <div className="divide-y">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="p-3">
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={colIndex} className="h-4 flex-1" />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
))
TableSkeleton.displayName = "TableSkeleton"
