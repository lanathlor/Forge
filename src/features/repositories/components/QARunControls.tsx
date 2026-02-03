'use client';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
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
      className:
        'h-7 px-4 text-sm font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30',
    },
    passed: {
      label: 'Passed',
      className:
        'h-7 px-4 text-sm font-semibold bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30',
    },
    failed: {
      label: 'Failed',
      className:
        'h-7 px-4 text-sm font-semibold bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30',
    },
    cancelled: {
      label: 'Cancelled',
      className:
        'h-7 px-4 text-sm font-semibold bg-gray-500/15 text-gray-700 dark:text-gray-400 border border-gray-500/30',
    },
  };

  const statusInfo = variants[status];
  return <Badge className={statusInfo.className}>{statusInfo.label}</Badge>;
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
        variant="outline"
        size="lg"
        className="border-2 px-8 font-semibold hover:bg-accent"
      >
        {isRunning ? (
          <>
            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Running...
          </>
        ) : (
          'Run QA Gates'
        )}
      </Button>
    </div>
  );
}
