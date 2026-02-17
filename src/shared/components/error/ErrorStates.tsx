'use client';

import React from 'react';
import {
  AlertTriangle,
  WifiOff,
  RefreshCw,
  XCircle,
  ServerCrash,
  Clock,
  FileQuestion,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/utils';

/* ============================================
   ERROR STATE TYPES
   ============================================ */

export type ErrorType =
  | 'network'
  | 'timeout'
  | 'not-found'
  | 'validation'
  | 'server'
  | 'unauthorized'
  | 'forbidden'
  | 'generic';

interface ErrorStateProps {
  /**
   * Type of error to display
   */
  type?: ErrorType;
  /**
   * Error title (auto-generated if not provided)
   */
  title?: string;
  /**
   * Error description/message
   */
  message?: string;
  /**
   * Retry callback
   */
  onRetry?: () => void;
  /**
   * Report issue callback
   */
  onReport?: () => void;
  /**
   * Additional action button
   */
  action?: {
    label: string;
    onClick: () => void;
  };
  /**
   * Whether to show the retry button
   */
  showRetry?: boolean;
  /**
   * Whether to show the report button
   */
  showReport?: boolean;
  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Additional CSS classes
   */
  className?: string;
}

/* ============================================
   ERROR STATE CONFIGURATIONS
   ============================================ */

interface ErrorConfig {
  icon: React.ElementType;
  title: string;
  defaultMessage: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const ERROR_CONFIGS: Record<ErrorType, ErrorConfig> = {
  network: {
    icon: WifiOff,
    title: 'Network Error',
    defaultMessage:
      'Unable to connect to the server. Please check your internet connection.',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/50',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  timeout: {
    icon: Clock,
    title: 'Request Timeout',
    defaultMessage: 'The request took too long to complete. Please try again.',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/50',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  'not-found': {
    icon: FileQuestion,
    title: 'Not Found',
    defaultMessage: 'The requested resource could not be found.',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/50',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  validation: {
    icon: XCircle,
    title: 'Validation Error',
    defaultMessage: 'The provided data is invalid. Please check your input.',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/50',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  server: {
    icon: ServerCrash,
    title: 'Server Error',
    defaultMessage: 'An error occurred on the server. Please try again later.',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/50',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  unauthorized: {
    icon: ShieldAlert,
    title: 'Unauthorized',
    defaultMessage: 'You are not authorized to access this resource.',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/50',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  forbidden: {
    icon: ShieldAlert,
    title: 'Access Denied',
    defaultMessage: 'You do not have permission to perform this action.',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/50',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  generic: {
    icon: AlertTriangle,
    title: 'Error',
    defaultMessage: 'An unexpected error occurred. Please try again.',
    color: 'text-destructive',
    bgColor: 'bg-destructive/5',
    borderColor: 'border-destructive/20',
  },
};

/* ============================================
   MAIN ERROR STATE COMPONENT
   ============================================ */

/**
 * Generic Error State Component
 *
 * Displays a friendly error message with optional retry and report actions.
 * Used for failed data fetches, network errors, and validation errors.
 */
export function ErrorState({
  type = 'generic',
  title,
  message,
  onRetry,
  onReport,
  action,
  showRetry = true,
  showReport = true,
  size = 'md',
  className,
}: ErrorStateProps) {
  const config = ERROR_CONFIGS[type];
  const Icon = config.icon;

  const displayTitle = title || config.title;
  const displayMessage = message || config.defaultMessage;

  const handleReport = () => {
    if (onReport) {
      onReport();
    } else {
      // Default report action
      const issueTitle = encodeURIComponent(`Error: ${displayTitle}`);
      const issueBody = encodeURIComponent(
        `## Error Report\n\n**Type:** ${type}\n\n**Message:** ${displayMessage}\n\n**Timestamp:** ${new Date().toISOString()}`
      );
      const githubUrl = `https://github.com/anthropics/claude-code/issues/new?title=${issueTitle}&body=${issueBody}`;
      window.open(githubUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const sizeClasses = {
    sm: 'min-h-[200px]',
    md: 'min-h-[300px]',
    lg: 'min-h-[400px]',
  };

  const iconSizes = {
    sm: 'h-10 w-10',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  };

  return (
    <div
      className={cn(
        'flex items-center justify-center p-4',
        sizeClasses[size],
        className
      )}
    >
      <div className="w-full max-w-md space-y-4 text-center">
        {/* Icon */}
        <div className="flex justify-center">
          <div
            className={cn(
              'rounded-full p-4',
              config.bgColor,
              config.borderColor,
              'border'
            )}
          >
            <Icon className={cn(iconSizes[size], config.color)} />
          </div>
        </div>

        {/* Title & Message */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{displayTitle}</h3>
          <p className="text-sm text-muted-foreground">{displayMessage}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {onRetry && showRetry && (
            <Button
              onClick={onRetry}
              variant="default"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}
          {action && (
            <Button onClick={action.onClick} variant="outline" size="sm">
              {action.label}
            </Button>
          )}
          {showReport && (
            <Button
              onClick={handleReport}
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Report Issue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================
   INLINE ERROR STATE (COMPACT)
   ============================================ */

interface InlineErrorProps {
  type?: ErrorType;
  message: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Inline Error Component
 *
 * Compact error display for inline use (e.g., in forms or small sections)
 */
export function InlineError({
  type = 'generic',
  message,
  onRetry,
  className,
}: InlineErrorProps) {
  const config = ERROR_CONFIGS[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3',
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      <Icon className={cn('h-4 w-4 flex-shrink-0', config.color)} />
      <p className="flex-1 text-sm">{message}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </Button>
      )}
    </div>
  );
}

/* ============================================
   CARD ERROR STATE
   ============================================ */

interface CardErrorProps {
  type?: ErrorType;
  title?: string;
  message?: string;
  onRetry?: () => void;
  onReport?: () => void;
  className?: string;
}

/**
 * Card Error Component
 *
 * Error state designed for card components
 */
export function CardError({
  type = 'generic',
  title,
  message,
  onRetry,
  onReport,
  className,
}: CardErrorProps) {
  const config = ERROR_CONFIGS[type];
  const Icon = config.icon;

  const displayTitle = title || config.title;
  const displayMessage = message || config.defaultMessage;

  const handleReport = () => {
    if (onReport) {
      onReport();
    } else {
      const issueTitle = encodeURIComponent(`Error: ${displayTitle}`);
      const issueBody = encodeURIComponent(
        `## Error Report\n\n**Type:** ${type}\n\n**Message:** ${displayMessage}\n\n**Timestamp:** ${new Date().toISOString()}`
      );
      const githubUrl = `https://github.com/anthropics/claude-code/issues/new?title=${issueTitle}&body=${issueBody}`;
      window.open(githubUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card className={cn('border-destructive/50', className)}>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className={cn('rounded-full p-2', config.bgColor)}>
            <Icon className={cn('h-5 w-5', config.color)} />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">{displayTitle}</CardTitle>
            <CardDescription className="mt-1">{displayMessage}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex gap-2">
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        )}
        <Button
          onClick={handleReport}
          variant="ghost"
          size="sm"
          className="gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          Report
        </Button>
      </CardContent>
    </Card>
  );
}

/* ============================================
   CONVENIENCE ERROR COMPONENTS
   ============================================ */

export function NetworkError(props: Omit<ErrorStateProps, 'type'>) {
  return <ErrorState type="network" {...props} />;
}

export function TimeoutError(props: Omit<ErrorStateProps, 'type'>) {
  return <ErrorState type="timeout" {...props} />;
}

export function NotFoundError(props: Omit<ErrorStateProps, 'type'>) {
  return <ErrorState type="not-found" {...props} />;
}

export function ValidationError(props: Omit<ErrorStateProps, 'type'>) {
  return <ErrorState type="validation" {...props} />;
}

export function ServerError(props: Omit<ErrorStateProps, 'type'>) {
  return <ErrorState type="server" {...props} />;
}

export function UnauthorizedError(props: Omit<ErrorStateProps, 'type'>) {
  return <ErrorState type="unauthorized" {...props} />;
}

export function ForbiddenError(props: Omit<ErrorStateProps, 'type'>) {
  return <ErrorState type="forbidden" {...props} />;
}
