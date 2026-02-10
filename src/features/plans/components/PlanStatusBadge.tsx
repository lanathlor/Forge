'use client';

import { Badge } from '@/shared/components/ui/badge';

interface PlanStatusBadgeProps {
  status: 'draft' | 'ready' | 'running' | 'paused' | 'completed' | 'failed';
}

export function PlanStatusBadge({ status }: PlanStatusBadgeProps) {
  const variants = {
    draft: { variant: 'secondary' as const, label: 'Draft' },
    ready: { variant: 'default' as const, label: 'Ready' },
    running: { variant: 'default' as const, label: 'Running' },
    paused: { variant: 'secondary' as const, label: 'Paused' },
    completed: { variant: 'default' as const, label: 'Completed' },
    failed: { variant: 'destructive' as const, label: 'Failed' },
  };

  const { variant, label } = variants[status];

  return <Badge variant={variant}>{label}</Badge>;
}
