'use client';

import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import { StatCard, type StatCardProps } from '@/shared/components/ui/dashboard-cards';
import { useCountUp, easings } from '@/shared/hooks/useCountUp';
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion';
import {
  CheckCircle,
  Clock,
  TrendingUp,
  AlertCircle,
  Shield,
} from 'lucide-react';

/* ============================================
   TYPES & INTERFACES
   ============================================ */

export interface MetricsData {
  /** Tasks completed today */
  tasksCompletedToday: number;
  /** Tasks completed this week */
  tasksCompletedThisWeek: number;
  /** Average task duration in minutes */
  avgTaskDurationMinutes: number;
  /** Success rate as a percentage (0-100) */
  successRatePercent: number;
  /** Number of pending approvals */
  pendingApprovals: number;
  /** QA pass rate as a percentage (0-100) */
  qaPassRatePercent: number;
  /** Trend data for enhanced context */
  trends?: {
    tasksCompleted?: {
      value: number;
      direction: 'up' | 'down' | 'neutral';
    };
    successRate?: {
      value: number;
      direction: 'up' | 'down' | 'neutral';
    };
    qaPassRate?: {
      value: number;
      direction: 'up' | 'down' | 'neutral';
    };
  };
}

export interface MetricsGridProps {
  /** Metrics data to display */
  metrics?: MetricsData;
  /** Whether data is loading */
  loading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Animation duration for number count-up in ms (default: 1000) */
  animationDuration?: number;
  /** Stagger delay between cards in ms (default: 100) */
  staggerDelay?: number;
}

/* ============================================
   ANIMATED STAT CARD
   ============================================ */

interface AnimatedStatCardProps extends Omit<StatCardProps, 'value'> {
  /** Numeric value to animate */
  numericValue: number;
  /** Format for display (e.g., adding % suffix) */
  formatValue?: (value: number) => string;
  /** Number of decimal places */
  decimals?: number;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Animation delay in ms */
  animationDelay?: number;
}

function AnimatedStatCard({
  numericValue,
  formatValue,
  decimals = 0,
  animationDuration = 1000,
  animationDelay = 0,
  loading,
  ...props
}: AnimatedStatCardProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const { formattedValue } = useCountUp({
    to: numericValue,
    duration: animationDuration,
    delay: animationDelay,
    decimals,
    easing: easings.easeOutCubic,
  });

  // Format the value (e.g., add % suffix)
  const displayValue = React.useMemo(() => {
    if (formatValue) {
      return formatValue(parseFloat(formattedValue));
    }
    return formattedValue;
  }, [formattedValue, formatValue]);

  return (
    <StatCard
      {...props}
      value={displayValue}
      loading={loading}
      className={cn(
        props.className,
        // Subtle fade-in effect on mount
        !prefersReducedMotion && !loading && 'animate-in fade-in-0 duration-300'
      )}
    />
  );
}

/* ============================================
   METRIC CARD CONFIGURATIONS
   ============================================ */

interface MetricCardConfig {
  key: string;
  icon: React.ReactNode;
  label: string;
  getValue: (metrics: MetricsData) => number;
  formatValue?: (value: number) => string;
  decimals?: number;
  variant: StatCardProps['variant'];
  getTrend?: (metrics: MetricsData) => StatCardProps['trend'] | undefined;
  getWarningState?: (metrics: MetricsData) => boolean;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function formatMinutes(value: number): string {
  if (value < 60) {
    return `${Math.round(value)}m`;
  }
  const hours = Math.floor(value / 60);
  const mins = Math.round(value % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatTrendData(
  trend?: { value: number; direction: 'up' | 'down' | 'neutral' },
  label?: string
): StatCardProps['trend'] | undefined {
  if (!trend) return undefined;
  return {
    value: `${trend.value}%`,
    direction: trend.direction,
    label,
  };
}

const METRIC_CARDS: MetricCardConfig[] = [
  {
    key: 'tasks-completed',
    icon: <CheckCircle className="h-5 w-5" />,
    label: 'Tasks Completed',
    getValue: (m) => m.tasksCompletedToday,
    variant: 'success',
    getTrend: (m) => formatTrendData(m.trends?.tasksCompleted, 'vs yesterday'),
  },
  {
    key: 'avg-duration',
    icon: <Clock className="h-5 w-5" />,
    label: 'Avg. Task Duration',
    getValue: (m) => m.avgTaskDurationMinutes,
    formatValue: formatMinutes,
    decimals: 0,
    variant: 'default',
  },
  {
    key: 'success-rate',
    icon: <TrendingUp className="h-5 w-5" />,
    label: 'Success Rate',
    getValue: (m) => m.successRatePercent,
    formatValue: formatPercent,
    decimals: 0,
    variant: 'primary',
    getTrend: (m) => formatTrendData(m.trends?.successRate, 'vs last week'),
  },
  {
    key: 'pending-approvals',
    icon: <AlertCircle className="h-5 w-5" />,
    label: 'Pending Approvals',
    getValue: (m) => m.pendingApprovals,
    variant: 'default',
    getWarningState: (m) => m.pendingApprovals > 0,
  },
  {
    key: 'qa-pass-rate',
    icon: <Shield className="h-5 w-5" />,
    label: 'QA Pass Rate',
    getValue: (m) => m.qaPassRatePercent,
    formatValue: formatPercent,
    decimals: 0,
    variant: 'success',
    getTrend: (m) => formatTrendData(m.trends?.qaPassRate),
  },
];

/* ============================================
   METRICS GRID COMPONENT
   ============================================ */

// Default metrics when none provided
const DEFAULT_METRICS: MetricsData = {
  tasksCompletedToday: 0,
  tasksCompletedThisWeek: 0,
  avgTaskDurationMinutes: 0,
  successRatePercent: 0,
  pendingApprovals: 0,
  qaPassRatePercent: 0,
};

/**
 * MetricsGrid Component
 *
 * Displays key dashboard statistics in a responsive grid:
 * - Tasks completed today/this week
 * - Average task duration
 * - Success rate percentage
 * - Pending approvals count (with warning styling if > 0)
 * - QA pass rate
 *
 * Features:
 * - Number animations on mount (respects reduced motion preference)
 * - Staggered animation delays for visual appeal
 * - Warning state for pending approvals
 * - Responsive grid: 1 col mobile, 2 cols tablet, 3 cols desktop, 5 cols large desktop
 */
export function MetricsGrid({
  metrics,
  loading = false,
  className,
  animationDuration = 1000,
  staggerDelay = 100,
}: MetricsGridProps) {
  const data = metrics ?? DEFAULT_METRICS;

  return (
    <section aria-labelledby="metrics-grid-heading" className={className}>
      <h3 id="metrics-grid-heading" className="sr-only">
        Key Performance Metrics
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {METRIC_CARDS.map((card, index) => {
          const hasWarning = card.getWarningState?.(data) ?? false;
          const variant = hasWarning ? 'warning' : card.variant;
          const trend = card.getTrend?.(data);

          return (
            <AnimatedStatCard
              key={card.key}
              icon={card.icon}
              numericValue={card.getValue(data)}
              formatValue={card.formatValue}
              decimals={card.decimals ?? 0}
              label={card.label}
              variant={variant}
              trend={trend}
              loading={loading}
              size="sm"
              animationDuration={animationDuration}
              animationDelay={index * staggerDelay}
              className={cn(
                // Add subtle warning pulse animation when there are pending approvals
                hasWarning && !loading && 'ring-2 ring-warning/50 ring-offset-2 ring-offset-background'
              )}
              aria-label={`${card.label}: ${loading ? 'Loading' : card.formatValue ? card.formatValue(card.getValue(data)) : card.getValue(data)}`}
            />
          );
        })}
      </div>
    </section>
  );
}

/* ============================================
   COMPACT METRICS VARIANT
   ============================================ */

export interface CompactMetricsGridProps {
  metrics?: MetricsData;
  loading?: boolean;
  className?: string;
}

/**
 * Compact version showing only the most critical metrics:
 * - Tasks completed today
 * - Success rate
 * - Pending approvals (with warning)
 */
export function CompactMetricsGrid({
  metrics,
  loading = false,
  className,
}: CompactMetricsGridProps) {
  const data = metrics ?? DEFAULT_METRICS;
  const criticalCards = METRIC_CARDS.filter((card) =>
    ['tasks-completed', 'success-rate', 'pending-approvals'].includes(card.key)
  );

  return (
    <section aria-labelledby="compact-metrics-heading" className={className}>
      <h3 id="compact-metrics-heading" className="sr-only">
        Key Metrics Summary
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {criticalCards.map((card, index) => {
          const hasWarning = card.getWarningState?.(data) ?? false;
          const variant = hasWarning ? 'warning' : card.variant;

          return (
            <AnimatedStatCard
              key={card.key}
              icon={card.icon}
              numericValue={card.getValue(data)}
              formatValue={card.formatValue}
              decimals={card.decimals ?? 0}
              label={card.label}
              variant={variant}
              loading={loading}
              size="sm"
              animationDuration={800}
              animationDelay={index * 75}
              className={cn(
                hasWarning && !loading && 'ring-2 ring-warning/50'
              )}
            />
          );
        })}
      </div>
    </section>
  );
}

export default MetricsGrid;
