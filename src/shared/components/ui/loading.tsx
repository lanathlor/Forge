import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/shared/lib/utils"
import { Loader2 } from "lucide-react"

// =============================================================================
// Loading Spinner Component
// =============================================================================

const spinnerVariants = cva(
  "animate-spin",
  {
    variants: {
      size: {
        xs: "h-3 w-3",
        sm: "h-4 w-4",
        default: "h-6 w-6",
        lg: "h-8 w-8",
        xl: "h-12 w-12",
      },
      variant: {
        default: "text-muted-foreground",
        primary: "text-accent-primary",
        success: "text-success",
        warning: "text-warning",
        error: "text-error",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
)

export interface LoadingSpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
  label?: string
  centered?: boolean
}

export const LoadingSpinner = React.memo(React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ className, size, variant, label, centered, ...props }, ref) => {
    const content = (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center gap-2",
          centered && "justify-center w-full",
          className
        )}
        {...props}
      >
        <Loader2 className={cn(spinnerVariants({ size, variant }))} />
        {label && <span className="text-sm text-muted-foreground">{label}</span>}
      </div>
    )

    if (centered) {
      return (
        <div className="flex items-center justify-center h-full min-h-[200px]">
          {content}
        </div>
      )
    }

    return content
  }
))
LoadingSpinner.displayName = "LoadingSpinner"

// =============================================================================
// Progress Bar Component
// =============================================================================

const progressBarVariants = cva(
  "h-2 rounded-full overflow-hidden bg-muted transition-all duration-300",
  {
    variants: {
      variant: {
        default: "",
        primary: "",
        success: "",
        warning: "",
        error: "",
      },
      size: {
        sm: "h-1",
        default: "h-2",
        lg: "h-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const progressFillVariants = cva(
  "h-full transition-all duration-500 ease-out",
  {
    variants: {
      variant: {
        default: "bg-accent-primary",
        primary: "bg-accent-primary",
        success: "bg-success",
        warning: "bg-warning",
        error: "bg-error",
      },
      animated: {
        true: "bg-gradient-to-r from-accent-primary via-accent-primary-hover to-accent-primary animate-shimmer bg-[length:200%_100%]",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      animated: false,
    },
  }
)

export interface ProgressBarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    Omit<VariantProps<typeof progressBarVariants>, 'variant'> {
  value?: number // 0-100
  variant?: VariantProps<typeof progressFillVariants>['variant']
  animated?: boolean
  label?: string
  showPercentage?: boolean
}

export const ProgressBar = React.memo(React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ className, size, variant, value = 0, animated = false, label, showPercentage = false, ...props }, ref) => {
    const clampedValue = Math.min(100, Math.max(0, value))

    return (
      <div className="w-full space-y-2">
        {(label || showPercentage) && (
          <div className="flex items-center justify-between text-sm">
            {label && <span className="text-muted-foreground">{label}</span>}
            {showPercentage && (
              <span className="text-muted-foreground font-mono font-medium">
                {Math.round(clampedValue)}%
              </span>
            )}
          </div>
        )}
        <div
          ref={ref}
          className={cn(progressBarVariants({ size }), className)}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
          {...props}
        >
          <div
            className={cn(progressFillVariants({ variant, animated }))}
            style={{ width: `${clampedValue}%` }}
          />
        </div>
      </div>
    )
  }
))
ProgressBar.displayName = "ProgressBar"

// =============================================================================
// Indeterminate Progress Bar (for unknown duration operations)
// =============================================================================

export type IndeterminateProgressProps = Omit<ProgressBarProps, 'value' | 'showPercentage'>;

export const IndeterminateProgress = React.memo(React.forwardRef<HTMLDivElement, IndeterminateProgressProps>(
  ({ className, size, variant = "primary", label, ...props }, ref) => {
    return (
      <div className="w-full space-y-2">
        {label && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
          </div>
        )}
        <div
          ref={ref}
          className={cn(progressBarVariants({ size }), "relative overflow-hidden", className)}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          {...props}
        >
          <div
            className={cn(
              "absolute inset-y-0 w-1/3 animate-indeterminate",
              variant === "primary" && "bg-accent-primary",
              variant === "success" && "bg-success",
              variant === "warning" && "bg-warning",
              variant === "error" && "bg-error",
              variant === "default" && "bg-accent-primary"
            )}
          />
        </div>
      </div>
    )
  }
))
IndeterminateProgress.displayName = "IndeterminateProgress"

// =============================================================================
// Skeleton Loader (shimmer effect)
// =============================================================================

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "text" | "circular" | "rectangular"
  width?: string | number
  height?: string | number
  animated?: boolean
}

export const Skeleton = React.memo(React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = "default", width, height, animated = true, ...props }, ref) => {
    const style: React.CSSProperties = {
      ...(width && { width: typeof width === "number" ? `${width}px` : width }),
      ...(height && { height: typeof height === "number" ? `${height}px` : height }),
    }

    return (
      <div
        ref={ref}
        className={cn(
          "bg-muted",
          animated && "animate-pulse",
          variant === "default" && "rounded-md",
          variant === "text" && "rounded h-4",
          variant === "circular" && "rounded-full",
          variant === "rectangular" && "rounded-none",
          className
        )}
        style={style}
        {...props}
      />
    )
  }
))
Skeleton.displayName = "Skeleton"

// =============================================================================
// Skeleton Group (for multiple skeletons)
// =============================================================================

export interface SkeletonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  count?: number
  spacing?: "sm" | "default" | "lg"
}

export const SkeletonGroup = React.memo(React.forwardRef<HTMLDivElement, SkeletonGroupProps>(
  ({ className, count = 3, spacing = "default", children, ...props }, ref) => {
    const spacingClass = {
      sm: "space-y-2",
      default: "space-y-3",
      lg: "space-y-4",
    }[spacing]

    if (children) {
      return (
        <div ref={ref} className={cn(spacingClass, className)} {...props}>
          {children}
        </div>
      )
    }

    return (
      <div ref={ref} className={cn(spacingClass, className)} {...props}>
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }
))
SkeletonGroup.displayName = "SkeletonGroup"

// =============================================================================
// Loading Overlay (for full-screen or container-level loading)
// =============================================================================

export interface LoadingOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  visible?: boolean
  label?: string
  spinnerSize?: VariantProps<typeof spinnerVariants>['size']
  blur?: boolean
  transparent?: boolean
}

export const LoadingOverlay = React.memo(React.forwardRef<HTMLDivElement, LoadingOverlayProps>(
  ({ className, visible = true, label, spinnerSize = "lg", blur = true, transparent = false, ...props }, ref) => {
    if (!visible) return null

    return (
      <div
        ref={ref}
        className={cn(
          "absolute inset-0 z-50 flex items-center justify-center",
          blur && "backdrop-blur-sm",
          transparent ? "bg-background/30" : "bg-background/80",
          className
        )}
        {...props}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className={cn(spinnerVariants({ size: spinnerSize, variant: "primary" }))} />
          {label && (
            <span className="text-sm font-medium text-foreground">
              {label}
            </span>
          )}
        </div>
      </div>
    )
  }
))
LoadingOverlay.displayName = "LoadingOverlay"

// =============================================================================
// Pulsing Dot (for inline status indicators)
// =============================================================================

export interface PulsingDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "primary" | "success" | "warning" | "error"
  size?: "sm" | "default" | "lg"
  pulse?: boolean
}

export const PulsingDot = React.memo(React.forwardRef<HTMLSpanElement, PulsingDotProps>(
  ({ className, variant = "default", size = "default", pulse = true, ...props }, ref) => {
    const sizeClass = {
      sm: "h-1.5 w-1.5",
      default: "h-2 w-2",
      lg: "h-3 w-3",
    }[size]

    const colorClass = {
      default: "bg-muted-foreground",
      primary: "bg-blue-500",
      success: "bg-green-500",
      warning: "bg-yellow-500",
      error: "bg-red-500",
    }[variant]

    return (
      <span className="relative flex" ref={ref} {...props}>
        {pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
              colorClass
            )}
          />
        )}
        <span className={cn("relative inline-flex rounded-full", sizeClass, colorClass, className)} />
      </span>
    )
  }
))
PulsingDot.displayName = "PulsingDot"

// =============================================================================
// Exports
// =============================================================================

export {
  spinnerVariants,
  progressBarVariants,
  progressFillVariants,
}
