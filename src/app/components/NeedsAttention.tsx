'use client';

import * as React from 'react';
import { useMemo, useCallback, useState, useEffect } from 'react';
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

const SEVERITY_CONFIG: Record<AlertSeverity, {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof AlertTriangle;
}> = {
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
    const interval = setInterval(() => setDisplayDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [initialDuration, alertId]);
  return displayDuration;
}

function AlertItemHeader({ alert, severityConfig }: { alert: StuckAlert; severityConfig: typeof SEVERITY_CONFIG[AlertSeverity] }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-sm font-semibold truncate">{alert.repositoryName}</span>
      <Badge variant="outline" className={cn('text-[10px] px-1.5', severityConfig.color)}>{alert.severity}</Badge>
    </div>
  );
}

function AlertItemMeta({ alert, displayDuration }: { alert: StuckAlert; displayDuration: number }) {
  const ReasonIcon = REASON_ICONS[alert.reason] || AlertTriangle;
  const isCritical = alert.severity === 'critical';
  const isHigh = alert.severity === 'high';

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1"><ReasonIcon className="h-3 w-3" />{formatReasonLabel(alert.reason)}</span>
      <span className={cn(
        'flex items-center gap-1 font-mono',
        isCritical && 'text-red-600 dark:text-red-400 font-bold animate-pulse',
        isHigh && 'text-orange-600 dark:text-orange-400 font-semibold',
        !isCritical && !isHigh && 'text-red-600 dark:text-red-400'
      )}>
        <Timer className={cn('h-3 w-3', isCritical && 'animate-pulse')} />
        {formatStuckDuration(displayDuration)}
        {isCritical && <span className="ml-1 text-[10px]">(!)</span>}
      </span>
    </div>
  );
}

function AlertItemActions({ alert, onView, onAcknowledge }: { alert: StuckAlert; onView: () => void; onAcknowledge: () => void }) {
  return (
    <div className="flex flex-col gap-1 shrink-0">
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onView}><Eye className="h-3 w-3 mr-1" />View</Button>
      {!alert.acknowledged && (
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onAcknowledge}><Check className="h-3 w-3 mr-1" />Dismiss</Button>
      )}
    </div>
  );
}

function AlertItem({ alert, onView, onAcknowledge }: AlertItemProps) {
  const severityConfig = SEVERITY_CONFIG[alert.severity];
  const SeverityIcon = severityConfig.icon;
  const displayDuration = useAlertDuration(alert.stuckDurationSeconds, alert.id);
  const isCritical = alert.severity === 'critical';
  const isHigh = alert.severity === 'high';

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-lg border transition-all',
      severityConfig.bgColor,
      severityConfig.borderColor,
      alert.acknowledged && 'opacity-60',
      // Enhanced animations for urgent alerts
      isCritical && !alert.acknowledged && 'animate-pulse ring-2 ring-red-500/50 shadow-lg shadow-red-500/20',
      isHigh && !alert.acknowledged && 'ring-1 ring-orange-500/30 shadow-md shadow-orange-500/10'
    )}>
      <div className={cn(
        'shrink-0 mt-0.5',
        severityConfig.color,
        isCritical && !alert.acknowledged && 'animate-bounce'
      )}>
        <SeverityIcon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <AlertItemHeader alert={alert} severityConfig={severityConfig} />
        <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
        <AlertItemMeta alert={alert} displayDuration={displayDuration} />
        <p className="text-xs text-muted-foreground mt-2 italic">{alert.suggestedAction}</p>
      </div>
      <AlertItemActions alert={alert} onView={onView} onAcknowledge={onAcknowledge} />
    </div>
  );
}

function formatReasonLabel(reason: string): string {
  switch (reason) {
    case 'no_output': return 'No output';
    case 'waiting_input': return 'Waiting';
    case 'repeated_failures': return 'Failures';
    case 'qa_gate_blocked': return 'QA blocked';
    case 'timeout': return 'Timeout';
    default: return 'Issue';
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

function SummaryHeaderIcon({ hasAlerts, severityConfig }: { hasAlerts: boolean; severityConfig: typeof SEVERITY_CONFIG[AlertSeverity] | null }) {
  if (hasAlerts) {
    return (
      <div className={cn('flex items-center justify-center h-8 w-8 rounded-full', severityConfig?.bgColor || 'bg-muted')}>
        <AlertTriangle className={cn('h-4 w-4', severityConfig?.color || 'text-muted-foreground')} />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
    </div>
  );
}

function SummaryHeaderTitle({ hasAlerts, count }: { hasAlerts: boolean; count: number }) {
  const message = hasAlerts
    ? `${count} repo${count > 1 ? 's' : ''} need${count === 1 ? 's' : ''} your help`
    : 'All repos running smoothly';
  return (
    <div>
      <h3 className="text-sm font-semibold flex items-center gap-2">
        Needs Attention
        {hasAlerts && <Badge variant="destructive" className="text-[10px] h-5 px-1.5">{count}</Badge>}
      </h3>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

function SummaryHeader({ status, isCollapsed, onToggle }: SummaryHeaderProps) {
  const hasAlerts = status.totalStuckCount > 0;
  const severityConfig = status.highestSeverity ? SEVERITY_CONFIG[status.highestSeverity] : null;

  return (
    <div className={cn('flex items-center justify-between cursor-pointer select-none', 'hover:bg-muted/50 rounded-lg -mx-2 px-2 py-1 transition-colors')} onClick={onToggle}>
      <div className="flex items-center gap-3">
        <SummaryHeaderIcon hasAlerts={hasAlerts} severityConfig={severityConfig} />
        <SummaryHeaderTitle hasAlerts={hasAlerts} count={status.totalStuckCount} />
      </div>
      {hasAlerts && (
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}

/* ============================================
   STATS BAR
   ============================================ */

function StatsBar({ status }: { status: StuckStatus }) {
  if (status.totalStuckCount === 0) return null;

  return (
    <div className="flex items-center gap-4 py-2 border-y text-xs">
      {status.waitingInputCount > 0 && (
        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
          <Clock className="h-3 w-3" />
          {status.waitingInputCount} waiting
        </span>
      )}
      {status.failedCount > 0 && (
        <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
          <XCircle className="h-3 w-3" />
          {status.failedCount} failed
        </span>
      )}
      {status.qaBlockedCount > 0 && (
        <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
          <ShieldAlert className="h-3 w-3" />
          {status.qaBlockedCount} blocked
        </span>
      )}
    </div>
  );
}

/* ============================================
   MAIN COMPONENT HELPERS
   ============================================ */

function useSortedAlerts(status: StuckStatus | null) {
  return useMemo(() => {
    if (!status) return [];
    const severityOrder: AlertSeverity[] = ['critical', 'high', 'medium', 'low'];
    return [...status.alerts].sort((a, b) => {
      if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
      const severityDiff = severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
      if (severityDiff !== 0) return severityDiff;
      return b.stuckDurationSeconds - a.stuckDurationSeconds;
    });
  }, [status]);
}

function AlertList({ alerts, onView, onAcknowledge }: { alerts: StuckAlert[]; onView: (a: StuckAlert) => void; onAcknowledge: (repoId: string) => void }) {
  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <AlertItem key={alert.id} alert={alert} onView={() => onView(alert)} onAcknowledge={() => onAcknowledge(alert.repositoryId)} />
      ))}
    </div>
  );
}

function ShowMoreButton({ showAll, onToggle, remainingCount }: { showAll: boolean; onToggle: () => void; remainingCount: number }) {
  return (
    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={onToggle}>
      {showAll ? <><ChevronUp className="h-3 w-3 mr-1" />Show less</> : <><ChevronDown className="h-3 w-3 mr-1" />Show {remainingCount} more</>}
    </Button>
  );
}

/* ============================================
   MAIN COMPONENT
   ============================================ */

export function NeedsAttention({ onSelectRepo, defaultCollapsed = false, maxVisible = 5, className }: NeedsAttentionProps) {
  const { status, acknowledgeAlert } = useStuckDetection();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [showAll, setShowAll] = useState(false);
  const sortedAlerts = useSortedAlerts(status);

  const visibleAlerts = showAll ? sortedAlerts : sortedAlerts.slice(0, maxVisible);
  const hasMore = sortedAlerts.length > maxVisible;

  const handleView = useCallback((alert: StuckAlert) => onSelectRepo?.(alert.repositoryId, alert.sessionId), [onSelectRepo]);
  const handleAcknowledge = useCallback(async (repositoryId: string) => { await acknowledgeAlert(repositoryId); }, [acknowledgeAlert]);

  if (!status) return null;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <SummaryHeader status={status} isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
      </CardHeader>
      {!isCollapsed && status.totalStuckCount > 0 && (
        <CardContent className="pt-0 space-y-3">
          <StatsBar status={status} />
          <AlertList alerts={visibleAlerts} onView={handleView} onAcknowledge={handleAcknowledge} />
          {hasMore && <ShowMoreButton showAll={showAll} onToggle={() => setShowAll(!showAll)} remainingCount={sortedAlerts.length - maxVisible} />}
        </CardContent>
      )}
    </Card>
  );
}

export default NeedsAttention;
