'use client';

import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import { Check, X, AlertTriangle, Info } from 'lucide-react';

/**
 * Feedback Animations Component
 *
 * Provides visual feedback for user actions:
 * - Success checkmark animation
 * - Error shake animation
 * - Warning pulse animation
 * - Info fade animation
 */

/* ============================================
   SUCCESS CHECKMARK
   ============================================ */

export interface SuccessCheckmarkProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the animation */
  show?: boolean;
}

const sizeMap = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
};

const iconSizeMap = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export function SuccessCheckmark({
  className,
  size = 'md',
  show = true,
  ...props
}: SuccessCheckmarkProps) {
  if (!show) return null;

  return (
    <div
      className={cn(
        'animate-bounce-in flex items-center justify-center rounded-full bg-success/10 text-success',
        sizeMap[size],
        className
      )}
      {...props}
    >
      <Check
        className={cn(iconSizeMap[size], 'animate-checkmark')}
        strokeWidth={3}
      />
    </div>
  );
}

/* ============================================
   ERROR INDICATOR
   ============================================ */

export interface ErrorIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the animation */
  show?: boolean;
}

export function ErrorIndicator({
  className,
  size = 'md',
  show = true,
  ...props
}: ErrorIndicatorProps) {
  if (!show) return null;

  return (
    <div
      className={cn(
        'animate-shake flex items-center justify-center rounded-full bg-error/10 text-error',
        sizeMap[size],
        className
      )}
      {...props}
    >
      <X className={cn(iconSizeMap[size])} strokeWidth={3} />
    </div>
  );
}

/* ============================================
   WARNING INDICATOR
   ============================================ */

export interface WarningIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the animation */
  show?: boolean;
}

export function WarningIndicator({
  className,
  size = 'md',
  show = true,
  ...props
}: WarningIndicatorProps) {
  if (!show) return null;

  return (
    <div
      className={cn(
        'animate-pulse-alert flex items-center justify-center rounded-full bg-warning/10 text-warning',
        sizeMap[size],
        className
      )}
      {...props}
    >
      <AlertTriangle className={cn(iconSizeMap[size])} strokeWidth={2.5} />
    </div>
  );
}

/* ============================================
   INFO INDICATOR
   ============================================ */

export interface InfoIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the animation */
  show?: boolean;
}

export function InfoIndicator({
  className,
  size = 'md',
  show = true,
  ...props
}: InfoIndicatorProps) {
  if (!show) return null;

  return (
    <div
      className={cn(
        'animate-fade-in flex items-center justify-center rounded-full bg-info/10 text-info',
        sizeMap[size],
        className
      )}
      {...props}
    >
      <Info className={cn(iconSizeMap[size])} strokeWidth={2.5} />
    </div>
  );
}

/* ============================================
   SUCCESS FLASH (for row/element feedback)
   ============================================ */

export interface SuccessFlashProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Content to wrap */
  children: React.ReactNode;
  /** Whether to trigger the flash */
  trigger?: boolean;
}

export function SuccessFlash({
  children,
  trigger,
  className,
  ...props
}: SuccessFlashProps) {
  return (
    <div className={cn(trigger && 'success-flash', className)} {...props}>
      {children}
    </div>
  );
}

/* ============================================
   ERROR FLASH (for row/element feedback)
   ============================================ */

export interface ErrorFlashProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Content to wrap */
  children: React.ReactNode;
  /** Whether to trigger the flash */
  trigger?: boolean;
}

export function ErrorFlash({
  children,
  trigger,
  className,
  ...props
}: ErrorFlashProps) {
  return (
    <div className={cn(trigger && 'error-flash', className)} {...props}>
      {children}
    </div>
  );
}

/* ============================================
   LOADING SPINNER
   ============================================ */

export interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the spinner */
  show?: boolean;
}

export function LoadingSpinner({
  className,
  size = 'md',
  show = true,
  ...props
}: LoadingSpinnerProps) {
  if (!show) return null;

  const spinnerSize = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-3',
  };

  return (
    <div
      className={cn(
        'inline-block animate-spin rounded-full border-current border-t-transparent',
        spinnerSize[size],
        className
      )}
      {...props}
    />
  );
}

/* ============================================
   RIPPLE EFFECT (for button clicks)
   ============================================ */

export function useRipple() {
  const [ripples, setRipples] = React.useState<
    Array<{ x: number; y: number; id: number }>
  >([]);

  const addRipple = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const id = Date.now();

      setRipples((prev) => [...prev, { x, y, id }]);

      setTimeout(() => {
        setRipples((prev) => prev.filter((ripple) => ripple.id !== id));
      }, 600);
    },
    []
  );

  const RippleContainer = React.useCallback(
    () => (
      <>
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="animate-ripple pointer-events-none absolute rounded-full bg-white/30"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: 20,
              height: 20,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
      </>
    ),
    [ripples]
  );

  return { addRipple, RippleContainer };
}

/* ============================================
   SKELETON LOADER (with pulse animation)
   ============================================ */

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width of the skeleton */
  width?: string | number;
  /** Height of the skeleton */
  height?: string | number;
}

export function Skeleton({
  className,
  width,
  height,
  style,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn('skeleton-pulse rounded bg-muted', className)}
      style={{
        width,
        height,
        ...style,
      }}
      {...props}
    />
  );
}
