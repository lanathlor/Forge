'use client';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Play, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { QARunStatus } from '../types/qa-gates';

interface QARunControlsProps {
  status: QARunStatus | null;
  hasRun: boolean;
  isRunning: boolean;
  enabledGatesCount: number;
  onRun: () => void;
}

function getRunStatusBadge(status: QARunStatus) {
  const variants = {
    running: {
      label: 'Running',
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      className:
        'h-8 px-4 text-sm font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-400 border-2 border-blue-500/30',
    },
    passed: {
      label: 'All Gates Passed',
      icon: <CheckCircle2 className="h-4 w-4" />,
      className:
        'h-8 px-4 text-sm font-semibold bg-green-500/15 text-green-700 dark:text-green-400 border-2 border-green-500/30',
    },
    failed: {
      label: 'Some Gates Failed',
      icon: <XCircle className="h-4 w-4" />,
      className:
        'h-8 px-4 text-sm font-semibold bg-red-500/15 text-red-700 dark:text-red-400 border-2 border-red-500/30',
    },
    cancelled: {
      label: 'Cancelled',
      icon: <XCircle className="h-4 w-4" />,
      className:
        'h-8 px-4 text-sm font-semibold bg-gray-500/15 text-gray-700 dark:text-gray-400 border-2 border-gray-500/30',
    },
  };

  const statusInfo = variants[status];
  return (
    <Badge className={statusInfo.className}>
      <span className="flex items-center gap-2">
        {statusInfo.icon}
        {statusInfo.label}
      </span>
    </Badge>
  );
}

export function QARunControls({
  status,
  hasRun,
  isRunning,
  enabledGatesCount,
  onRun,
}: QARunControlsProps) {
  return (
    <div className="flex items-center gap-4">
      {hasRun && status && getRunStatusBadge(status)}
      <Button
        onClick={onRun}
        disabled={isRunning || enabledGatesCount === 0}
        variant={hasRun && status === 'passed' ? 'outline' : 'default'}
        size="lg"
        className="gap-2 px-8 font-semibold shadow-sm"
      >
        {isRunning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Running Gates...
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            {hasRun ? 'Run Again' : 'Run QA Gates'}
          </>
        )}
      </Button>
    </div>
  );
}
