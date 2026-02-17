'use client';

import { usePreflightChecks } from '../hooks/usePreflightChecks';
import { cn } from '@/shared/lib/utils';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

interface PlanPreflightBannerProps {
  repositoryId: string;
  planId: string;
  enabled?: boolean;
  className?: string;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'pass':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    case 'fail':
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case 'warn':
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
    default:
      return (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      );
  }
}

export function PlanPreflightBanner({
  repositoryId,
  planId,
  enabled = true,
  className,
}: PlanPreflightBannerProps) {
  const { checks, isChecking } = usePreflightChecks({
    repositoryId,
    planId,
    enabled,
  });

  if (!enabled || checks.length === 0) return null;

  const hasFailures = checks.some((c) => c.status === 'fail');
  const allPassed = checks.every((c) => c.status === 'pass');

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2 transition-all duration-300 animate-in fade-in slide-in-from-top-2',
        allPassed &&
          'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20',
        hasFailures &&
          'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20',
        !allPassed &&
          !hasFailures &&
          'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20',
        isChecking && 'border-border bg-muted/30',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <ShieldCheck
          className={cn(
            'h-4 w-4 flex-shrink-0',
            allPassed && 'text-emerald-600',
            hasFailures && 'text-red-600',
            !allPassed && !hasFailures && 'text-amber-600',
            isChecking && 'text-muted-foreground'
          )}
        />
        <span className="text-xs font-medium">
          {isChecking
            ? 'Running pre-flight checks...'
            : allPassed
              ? 'All systems go'
              : hasFailures
                ? 'Pre-flight check failed'
                : 'Ready with warnings'}
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
        {checks.map((check) => (
          <span
            key={check.id}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            title={check.detail}
          >
            <StatusIcon status={check.status} />
            <span>{check.label}</span>
            {check.detail && check.status !== 'pass' && (
              <span className="text-[10px] opacity-70">({check.detail})</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
