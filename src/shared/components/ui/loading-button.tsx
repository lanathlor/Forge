import * as React from "react"
import { Button, type ButtonProps } from "./button"
import { LoadingSpinner } from "./loading"
import { cn } from "@/shared/lib/utils"

/**
 * Button with built-in loading state
 *
 * Features:
 * - Automatic spinner display
 * - Disabled while loading
 * - Customizable loading text
 * - Preserves button styling
 */

export interface LoadingButtonProps extends ButtonProps {
  /** Whether the button is in a loading state */
  loading?: boolean
  /** Optional text to show while loading (defaults to children) */
  loadingText?: React.ReactNode
  /** Size of the loading spinner */
  spinnerSize?: "xs" | "sm" | "default"
}

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ className, children, loading = false, loadingText, spinnerSize = "sm", disabled, ...props }, ref) => {
    // Determine spinner size based on button size
    const getSpinnerSize = () => {
      if (spinnerSize !== "default") return spinnerSize

      // Auto-detect from button variant
      if (props.size === "sm" || props.size === "icon") return "xs"
      if (props.size === "lg") return "default"
      return "sm"
    }

    return (
      <Button
        ref={ref}
        className={cn(className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <LoadingSpinner
              size={getSpinnerSize()}
              className="mr-2"
              variant={props.variant === "destructive" ? "error" : "default"}
            />
            {loadingText || children}
          </>
        ) : (
          children
        )}
      </Button>
    )
  }
)
LoadingButton.displayName = "LoadingButton"

/**
 * Usage Examples:
 *
 * // Basic usage
 * <LoadingButton loading={isSaving} onClick={handleSave}>
 *   Save
 * </LoadingButton>
 *
 * // With loading text
 * <LoadingButton
 *   loading={isSaving}
 *   loadingText="Saving..."
 *   onClick={handleSave}
 * >
 *   Save Changes
 * </LoadingButton>
 *
 * // Different variants
 * <LoadingButton loading={isDeleting} variant="destructive">
 *   Delete
 * </LoadingButton>
 *
 * // Custom spinner size
 * <LoadingButton loading={isProcessing} spinnerSize="default">
 *   Process
 * </LoadingButton>
 *
 * // With icon
 * <LoadingButton loading={isSaving}>
 *   <SaveIcon className="mr-2 h-4 w-4" />
 *   Save
 * </LoadingButton>
 */
