'use client';

import * as React from 'react';
import { useMemo, useCallback, useState, useEffect, memo } from 'react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { useStuckDetection } from '@/shared/hooks/useStuckDetection';
import {
  type StuckAlert,
  type StuckStatus,
  type AlertSeverity,
  formatStuckDuration,
} from '@/lib/stuck-detection/types';
import {
  AlertTriangle,
  Clock,
  XCircle,
  ShieldAlert,
  Timer,
  Eye,
  Check,
  ChevronDown,
  ChevronUp,
  Bell,
  GitBranch,
} from 'lucide-react';

/* ============================================
   TYPES & INTERFACES
   ============================================ */

export interface NeedsAttentionProps {
  /** Callback when clicking on an alert to navigate to that repo */
  onSelectRepo?: (repositoryId: string, sessionId?: string | null) => void;
  /** Whether to show the collapsed state initially */
  defaultCollapsed?: boolean;
  /** Maximum number of alerts to show before "show more" */
  maxVisible?: number;
  /** Additional class name */
  className?: string;
}

/* ============================================
   SEVERITY CONFIGURATION
   ============================================ */

const SEVERITY_CONFIG: Record<
  AlertSeverity,
  {
    color: string;
    bgColor: string;
    borderColor: string;
    icon: typeof AlertTriangle;
  }
> = {
  critical: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
    icon: XCircle,
  },
  high: {
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
    icon: AlertTriangle,
  },
  medium: {
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
    icon: Clock,
  },
  low: {
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    icon: Bell,
  },
};

const REASON_ICONS: Record<string, typeof AlertTriangle> = {
  no_output: Timer,
  waiting_input: Clock,
  repeated_failures: XCircle,
  qa_gate_blocked: ShieldAlert,
  timeout: Timer,
};

/* ============================================
   ALERT ITEM COMPONENT
   ============================================ */

interface AlertItemProps {
  alert: StuckAlert;
  onView: () => void;
  onAcknowledge: () => void;
}

/**
 * Hook to create a live counting stuck duration
 * Updates every second for real-time feedback - essential for knowing exactly how long stuck
 */
function useAlertDuration(initialDuration: number, alertId: string) {
  const [displayDuration, setDisplayDuration] = useState(initialDuration);
  useEffect(() => {
    setDisplayDuration(initialDuration);
    // Update every second for live counting
    const interval = setInterval(() => setDisplayDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [initialDuration, alertId]);
  return displayDuration;
}

const AlertItemHeader = memo(function AlertItemHeader({
  alert,
  severityConfig,
}: {
  alert: StuckAlert;
  severityConfig: (typeof SEVERITY_CONFIG)[AlertSeverity];
}) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="truncate text-sm font-semibold">
        {alert.repositoryName}
      </span>
      <Badge
        variant="outline"
        className={cn('px-1.5 text-[10px]', severityConfig.color)}
      >
        {alert.severity}
      </Badge>
    </div>
  );
});

const AlertItemMeta = memo(function AlertItemMeta({
  alert,
  displayDuration,
}: {
  alert: StuckAlert;
  displayDuration: number;
}) {
  const ReasonIcon = REASON_ICONS[alert.reason] || AlertTriangle;
  const isCritical = alert.severity === 'critical';
  const isHigh = alert.severity === 'high';

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <ReasonIcon className="h-3 w-3" />
        {formatReasonLabel(alert.reason)}
      </span>
      <span
        className={cn(
          'flex items-center gap-1 font-mono',
          isCritical &&
            'animate-pulse font-bold text-red-600 dark:text-red-400',
          isHigh && 'font-semibold text-orange-600 dark:text-orange-400',
          !isCritical && !isHigh && 'text-red-600 dark:text-red-400'
        )}
      >
        <Timer className={cn('h-3 w-3', isCritical && 'animate-pulse')} />
        {formatStuckDuration(displayDuration)}
        {isCritical && <span className="ml-1 text-[10px]">(!)</span>}
      </span>
    </div>
  );
});

const AlertItemActions = memo(function AlertItemActions({
  alert,
  onView,
  onAcknowledge,
}: {
  alert: StuckAlert;
  onView: () => void;
  onAcknowledge: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-1">
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={onView}
        aria-label={`View details for ${alert.repositoryName}`}
      >
        <Eye className="mr-1 h-3 w-3" aria-hidden="true" />
        View
      </Button>
      {!alert.acknowledged && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={onAcknowledge}
          aria-label={`Dismiss alert for ${alert.repositoryName}`}
        >
          <Check className="mr-1 h-3 w-3" aria-hidden="true" />
          Dismiss
        </Button>
      )}
    </div>
  );
});

const AlertItem = memo(function AlertItem({
  alert,
  onView,
  onAcknowledge,
}: AlertItemProps) {
  const severityConfig = SEVERITY_CONFIG[alert.severity];
  const SeverityIcon = severityConfig.icon;
  const displayDuration = useAlertDuration(
    alert.stuckDurationSeconds,
    alert.id
  );
  const isCritical = alert.severity === 'critical';
  const isHigh = alert.severity === 'high';

  const alertLabel = `${alert.severity} severity alert for ${alert.repositoryName}: ${alert.description}. Stuck for ${formatStuckDuration(displayDuration)}`;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 transition-all',
        severityConfig.bgColor,
        severityConfig.borderColor,
        alert.acknowledged && 'opacity-60',
        // Enhanced animations for urgent alerts
        isCritical &&
          !alert.acknowledged &&
          'animate-pulse shadow-lg shadow-red-500/20 ring-2 ring-red-500/50',
        isHigh &&
          !alert.acknowledged &&
          'shadow-md shadow-orange-500/10 ring-1 ring-orange-500/30'
      )}
      role="alert"
      aria-live={isCritical ? 'assertive' : 'polite'}
      aria-label={alertLabel}
    >
      <div
        className={cn(
          'mt-0.5 shrink-0',
          severityConfig.color,
          isCritical && !alert.acknowledged && 'animate-bounce'
        )}
      >
        <SeverityIcon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <AlertItemHeader alert={alert} severityConfig={severityConfig} />
        <p className="mb-2 text-sm text-muted-foreground">
          {alert.description}
        </p>
        <AlertItemMeta alert={alert} displayDuration={displayDuration} />
        <p className="mt-2 text-xs italic text-muted-foreground">
          {alert.suggestedAction}
        </p>
      </div>
      <AlertItemActions
        alert={alert}
        onView={onView}
        onAcknowledge={onAcknowledge}
      />
    </div>
  );
});

function formatReasonLabel(reason: string): string {
  switch (reason) {
    case 'no_output':
      return 'No output';
    case 'waiting_input':
      return 'Waiting';
    case 'repeated_failures':
      return 'Failures';
    case 'qa_gate_blocked':
      return 'QA blocked';
    case 'timeout':
      return 'Timeout';
    default:
      return 'Issue';
  }
}

/* ============================================
   SUMMARY HEADER
   ============================================ */

interface SummaryHeaderProps {
  status: StuckStatus;
  isCollapsed: boolean;
  onToggle: () => void;
}

const SummaryHeaderIcon = memo(function SummaryHeaderIcon({
  hasAlerts,
  severityConfig,
  isCritical,
}: {
  hasAlerts: boolean;
  severityConfig: (typeof SEVERITY_CONFIG)[AlertSeverity] | null;
  isCritical: boolean;
}) {
  if (hasAlerts) {
    return (
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full transition-all',
          severityConfig?.bgColor || 'bg-muted',
          isCritical &&
            'animate-pulse ring-2 ring-red-500 ring-offset-2 ring-offset-background'
        )}
      >
        <AlertTriangle
          className={cn(
            'h-5 w-5',
            severityConfig?.color || 'text-muted-foreground',
            isCritical && 'animate-bounce'
          )}
        />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
      <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
    </div>
  );
});

const SummaryHeaderTitle = memo(function SummaryHeaderTitle({
  hasAlerts,
  count,
  isCritical,
  isHigh,
}: {
  hasAlerts: boolean;
  count: number;
  isCritical: boolean;
  isHigh: boolean;
}) {
  const message = hasAlerts
    ? `${count} repo${count > 1 ? 's' : ''} need${count === 1 ? 's' : ''} your help`
    : 'All repos running smoothly';
  return (
    <div>
      <h3 className="flex items-center gap-2 text-base font-semibold">
        Needs Attention
        {hasAlerts && (
          <Badge
            variant="destructive"
            className={cn(
              'h-6 px-2 text-xs font-bold',
              isCritical && 'animate-bounce bg-red-600',
              isHigh && !isCritical && 'bg-orange-500'
            )}
          >
            {count}
          </Badge>
        )}
      </h3>
      <p
        className={cn(
          'text-sm',
          hasAlerts ? 'font-medium text-foreground' : 'text-muted-foreground'
        )}
      >
        {message}
      </p>
    </div>
  );
});

const SummaryHeader = memo(function SummaryHeader({
  status,
  isCollapsed,
  onToggle,
}: SummaryHeaderProps) {
  const hasAlerts = status.totalStuckCount > 0;
  const severityConfig = status.highestSeverity
    ? SEVERITY_CONFIG[status.highestSeverity]
    : null;
  const isCritical = status.highestSeverity === 'critical';
  const isHigh = status.highestSeverity === 'high';

  const ariaLabel = hasAlerts
    ? `${status.totalStuckCount} repositories need attention. ${isCollapsed ? 'Expand' : 'Collapse'} to ${isCollapsed ? 'show' : 'hide'} details`
    : 'All repositories running smoothly';

  return (
    <button
      className={cn(
        '-mx-2 flex w-full cursor-pointer select-none items-center justify-between rounded-lg px-3 py-2 transition-all',
        'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        hasAlerts &&
          isCritical &&
          'bg-red-50/50 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/30',
        hasAlerts &&
          isHigh &&
          !isCritical &&
          'bg-orange-50/50 hover:bg-orange-50 dark:bg-orange-950/20 dark:hover:bg-orange-950/30'
      )}
      onClick={onToggle}
      aria-label={ariaLabel}
      aria-expanded={!isCollapsed}
      type="button"
    >
      <div className="flex items-center gap-3">
        <SummaryHeaderIcon
          hasAlerts={hasAlerts}
          severityConfig={severityConfig}
          isCritical={isCritical}
        />
        <SummaryHeaderTitle
          hasAlerts={hasAlerts}
          count={status.totalStuckCount}
          isCritical={isCritical}
          isHigh={isHigh}
        />
      </div>
      {hasAlerts && (
        <span aria-hidden="true">
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </span>
      )}
    </button>
  );
});

/* ============================================
   STATS BAR
   ============================================ */

function getSeverityTimeStyles(severity: AlertSeverity | null) {
  if (severity === 'critical')
    return 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 animate-pulse';
  if (severity === 'high')
    return 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300';
  if (severity === 'medium')
    return 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300';
  return 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-300';
}

function TotalStuckTimeBadge({
  totalSeconds,
  severity,
}: {
  totalSeconds: number;
  severity: AlertSeverity | null;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full px-3 py-1.5 font-semibold',
        getSeverityTimeStyles(severity)
      )}
    >
      <Timer
        className={cn('h-4 w-4', severity === 'critical' && 'animate-pulse')}
      />
      <span className="font-mono text-sm">
        {formatStuckDuration(totalSeconds)}
      </span>
      <span className="text-xs opacity-80">total wait</span>
    </div>
  );
}

function StatBadge({
  count,
  label,
  icon: Icon,
  colorClass,
}: {
  count: number;
  label: string;
  icon: typeof Clock;
  colorClass: string;
}) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2 py-1 font-medium',
        colorClass
      )}
    >
      <Icon className="h-3 w-3" />
      <span className="font-bold">{count}</span> {label}
    </span>
  );
}

function StatsBar({ status }: { status: StuckStatus }) {
  if (status.totalStuckCount === 0) return null;
  const totalStuckSeconds = status.alerts.reduce(
    (sum, alert) => sum + alert.stuckDurationSeconds,
    0
  );

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-lg border-y bg-muted/30 px-3 py-3"
      role="region"
      aria-label="Alert statistics"
    >
      <TotalStuckTimeBadge
        totalSeconds={totalStuckSeconds}
        severity={status.highestSeverity}
      />
      <div className="h-4 w-px bg-border" aria-hidden="true" />
      <div className="flex items-center gap-3 text-xs">
        <StatBadge
          count={status.waitingInputCount}
          label="waiting"
          icon={Clock}
          colorClass="bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
        />
        <StatBadge
          count={status.failedCount}
          label="failed"
          icon={XCircle}
          colorClass="bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400"
        />
        <StatBadge
          count={status.qaBlockedCount}
          label="blocked"
          icon={ShieldAlert}
          colorClass="bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400"
        />
      </div>
    </div>
  );
}

/* ============================================
   MAIN COMPONENT HELPERS
   ============================================ */

function useSortedAlerts(status: StuckStatus | null) {
  return useMemo(() => {
    if (!status) return [];
    const severityOrder: AlertSeverity[] = [
      'critical',
      'high',
      'medium',
      'low',
    ];
    return [...status.alerts].sort((a, b) => {
      if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
      const severityDiff =
        severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
      if (severityDiff !== 0) return severityDiff;
      return b.stuckDurationSeconds - a.stuckDurationSeconds;
    });
  }, [status]);
}

function AlertList({
  alerts,
  onView,
  onAcknowledge,
}: {
  alerts: StuckAlert[];
  onView: (a: StuckAlert) => void;
  onAcknowledge: (repoId: string) => void;
}) {
  return (
    <div className="space-y-2" role="list" aria-label="Stuck repository alerts">
      {alerts.map((alert) => (
        <div key={alert.id} role="listitem">
          <AlertItem
            alert={alert}
            onView={() => onView(alert)}
            onAcknowledge={() => onAcknowledge(alert.repositoryId)}
          />
        </div>
      ))}
    </div>
  );
}

function ShowMoreButton({
  showAll,
  onToggle,
  remainingCount,
}: {
  showAll: boolean;
  onToggle: () => void;
  remainingCount: number;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full text-xs"
      onClick={onToggle}
      aria-label={
        showAll ? 'Show fewer alerts' : `Show ${remainingCount} more alerts`
      }
      aria-expanded={showAll}
    >
      {showAll ? (
        <>
          <ChevronUp className="mr-1 h-3 w-3" aria-hidden="true" />
          Show less
        </>
      ) : (
        <>
          <ChevronDown className="mr-1 h-3 w-3" aria-hidden="true" />
          Show {remainingCount} more
        </>
      )}
    </Button>
  );
}

/* ============================================
   MAIN COMPONENT
   ============================================ */

export function NeedsAttention({
  onSelectRepo,
  defaultCollapsed = false,
  maxVisible = 5,
  className,
}: NeedsAttentionProps) {
  const { status, acknowledgeAlert } = useStuckDetection();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [showAll, setShowAll] = useState(false);
  const sortedAlerts = useSortedAlerts(status);

  const visibleAlerts = showAll
    ? sortedAlerts
    : sortedAlerts.slice(0, maxVisible);
  const hasMore = sortedAlerts.length > maxVisible;

  const handleView = useCallback(
    (alert: StuckAlert) => onSelectRepo?.(alert.repositoryId, alert.sessionId),
    [onSelectRepo]
  );
  const handleAcknowledge = useCallback(
    async (repositoryId: string) => {
      await acknowledgeAlert(repositoryId);
    },
    [acknowledgeAlert]
  );

  if (!status) return null;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <SummaryHeader
          status={status}
          isCollapsed={isCollapsed}
          onToggle={() => setIsCollapsed(!isCollapsed)}
        />
      </CardHeader>
      {!isCollapsed && status.totalStuckCount > 0 && (
        <CardContent className="space-y-3 pt-0">
          <StatsBar status={status} />
          <AlertList
            alerts={visibleAlerts}
            onView={handleView}
            onAcknowledge={handleAcknowledge}
          />
          {hasMore && (
            <ShowMoreButton
              showAll={showAll}
              onToggle={() => setShowAll(!showAll)}
              remainingCount={sortedAlerts.length - maxVisible}
            />
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default NeedsAttention;
