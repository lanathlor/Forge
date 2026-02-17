'use client';

import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import {
  FileEdit,
  CheckCircle2,
  Loader2,
  Pause,
  XCircle,
  Rocket,
} from 'lucide-react';

interface PlanStatusBadgeProps {
  status: 'draft' | 'ready' | 'running' | 'paused' | 'completed' | 'failed';
  size?: 'sm' | 'default';
}

const STATUS_CONFIG = {
  draft: {
    label: 'Draft',
    icon: FileEdit,
    className:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
  ready: {
    label: 'Ready',
    icon: Rocket,
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  running: {
    label: 'Running',
    icon: Loader2,
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  paused: {
    label: 'Paused',
    icon: Pause,
    className:
      'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    className:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    className:
      'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800',
  },
} as const;

export function PlanStatusBadge({
  status,
  size = 'default',
}: PlanStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const isRunning = status === 'running';

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 border font-medium',
        config.className,
        size === 'sm' ? 'h-5 px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-xs'
      )}
    >
      <Icon
        className={cn(
          size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5',
          isRunning && 'animate-spin'
        )}
      />
      {config.label}
    </Badge>
  );
}
