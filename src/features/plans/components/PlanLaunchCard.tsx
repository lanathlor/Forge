'use client';

import React from 'react';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { PlanStatusBadge } from './PlanStatusBadge';
import { cn, formatRelativeTime } from '@/shared/lib/utils';
import type { Plan } from '@/db/schema';
import {
  Rocket,
  Layers,
  ListChecks,
  Clock,
  Eye,
  Play,
  Pause,
} from 'lucide-react';

interface PlanLaunchCardProps {
  plan: Plan;
  onLaunch: (planId: string) => void;
  onView: (planId: string) => void;
  onResume?: (planId: string) => void;
  onPause?: (planId: string) => void;
}

export const PlanLaunchCard = React.memo(function PlanLaunchCard({
  plan,
  onLaunch,
  onView,
  onResume,
  onPause,
}: PlanLaunchCardProps) {
  const progress = plan.totalTasks > 0
    ? Math.round((plan.completedTasks / plan.totalTasks) * 100)
    : 0;

  const canLaunch = plan.status === 'ready' || plan.status === 'draft';
  const isActive = plan.status === 'running' || plan.status === 'paused';

  return (
    <Card
      className={cn(
        'group flex flex-col transition-all hover:shadow-md',
        canLaunch && 'hover:border-primary/40 hover:shadow-primary/5',
        isActive && 'border-l-2 border-l-blue-500',
      )}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-semibold truncate">{plan.title}</h3>
            <PlanStatusBadge status={plan.status} size="sm" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onView(plan.id)}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
        {plan.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{plan.description}</p>
        )}
      </div>

      {/* Stats */}
      <div className="px-4 py-1.5 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Layers className="h-3 w-3" />
          {plan.totalPhases}
        </span>
        <span className="flex items-center gap-1">
          <ListChecks className="h-3 w-3" />
          {plan.completedTasks}/{plan.totalTasks}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatRelativeTime(new Date(plan.updatedAt))}
        </span>
      </div>

      {/* Progress */}
      {plan.totalTasks > 0 && (
        <div className="px-4 py-1.5">
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                plan.status === 'failed' ? 'bg-red-500'
                  : plan.status === 'completed' ? 'bg-emerald-500'
                  : plan.status === 'running' ? 'bg-blue-500'
                  : 'bg-primary',
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Launch action */}
      <div className="px-4 pb-3 pt-1 mt-auto">
        {canLaunch ? (
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={(e) => {
              e.stopPropagation();
              onLaunch(plan.id);
            }}
          >
            <Rocket className="h-3.5 w-3.5" />
            Launch Plan
          </Button>
        ) : plan.status === 'running' && onPause ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-2"
            onClick={(e) => {
              e.stopPropagation();
              onPause(plan.id);
            }}
          >
            <Pause className="h-3.5 w-3.5" />
            Pause
          </Button>
        ) : plan.status === 'paused' && onResume ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-2"
            onClick={(e) => {
              e.stopPropagation();
              onResume(plan.id);
            }}
          >
            <Play className="h-3.5 w-3.5" />
            Resume
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="w-full gap-2"
            onClick={(e) => {
              e.stopPropagation();
              onView(plan.id);
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            View Details
          </Button>
        )}
      </div>
    </Card>
  );
});
