'use client';

import React from 'react';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import { PlanStatusBadge } from './PlanStatusBadge';
import { cn, truncate, formatRelativeTime } from '@/shared/lib/utils';
import type { Plan } from '@/db/schema';
import {
  MoreVertical,
  Play,
  Pause,
  RotateCcw,
  Eye,
  Copy,
  Trash2,
  CheckCircle2,
  Layers,
  ListChecks,
  Clock,
  Rocket,
} from 'lucide-react';

interface PlanCardProps {
  plan: Plan;
  onView: (planId: string) => void;
  onExecute?: (planId: string) => void;
  onLaunch?: (planId: string) => void;
  onPause?: (planId: string) => void;
  onResume?: (planId: string) => void;
  onDuplicate?: (planId: string) => void;
  onMarkReady?: (planId: string) => void;
  onDelete?: (planId: string) => void;
  variant?: 'grid' | 'list';
}

export const PlanCard = React.memo(function PlanCard({
  plan,
  onView,
  onExecute,
  onLaunch,
  onPause,
  onResume,
  onDuplicate,
  onMarkReady,
  onDelete,
  variant = 'grid',
}: PlanCardProps) {
  const progress = plan.totalTasks > 0
    ? Math.round((plan.completedTasks / plan.totalTasks) * 100)
    : 0;

  const isActive = plan.status === 'running' || plan.status === 'paused';

  const primaryAction = getPrimaryAction(plan, { onExecute, onLaunch, onPause, onResume, onMarkReady });

  if (variant === 'list') {
    return (
      <Card
        className={cn(
          'group flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/40',
          isActive && 'border-l-2 border-l-amber-500',
        )}
        onClick={() => onView(plan.id)}
      >
        {/* Title + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate">
              {plan.title}
            </p>
            <PlanStatusBadge status={plan.status} size="sm" />
          </div>
          {plan.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {plan.description}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-4 flex-shrink-0 text-xs text-muted-foreground">
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

        {/* Progress bar (compact) */}
        {plan.totalTasks > 0 && (
          <div className="hidden md:block w-20 flex-shrink-0">
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  plan.status === 'failed' ? 'bg-red-500' : plan.status === 'completed' ? 'bg-emerald-500' : 'bg-primary',
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {primaryAction && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={primaryAction.onClick}
            >
              {primaryAction.icon}
              <span className="hidden lg:inline ml-1">{primaryAction.label}</span>
            </Button>
          )}
          <QuickActionsMenu
            plan={plan}
            onView={onView}
            onExecute={onExecute}
            onLaunch={onLaunch}
            onPause={onPause}
            onResume={onResume}
            onDuplicate={onDuplicate}
            onMarkReady={onMarkReady}
            onDelete={onDelete}
          />
        </div>
      </Card>
    );
  }

  // Grid variant (default)
  return (
    <Card
      className={cn(
        'group flex flex-col cursor-pointer transition-all hover:shadow-md hover:border-primary/20',
        isActive && 'border-l-2 border-l-amber-500',
      )}
      onClick={() => onView(plan.id)}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {plan.title}
          </h3>
          {plan.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {truncate(plan.description, 120)}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <PlanStatusBadge status={plan.status} size="sm" />
          <QuickActionsMenu
            plan={plan}
            onView={onView}
            onExecute={onExecute}
            onLaunch={onLaunch}
            onPause={onPause}
            onResume={onResume}
            onDuplicate={onDuplicate}
            onMarkReady={onMarkReady}
            onDelete={onDelete}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="px-4 py-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Layers className="h-3 w-3" />
          {plan.totalPhases} phase{plan.totalPhases !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          <ListChecks className="h-3 w-3" />
          {plan.completedTasks}/{plan.totalTasks} task{plan.totalTasks !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Progress bar */}
      {plan.totalTasks > 0 && (
        <div className="px-4 pb-2">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                plan.status === 'failed' ? 'bg-red-500' : plan.status === 'completed' ? 'bg-emerald-500' : 'bg-primary',
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 pb-3 pt-1 flex items-center justify-between border-t border-border/50 mt-auto">
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatRelativeTime(new Date(plan.updatedAt))}
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          {primaryAction && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={primaryAction.onClick}
            >
              {primaryAction.icon}
              <span className="ml-1">{primaryAction.label}</span>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
});

// ---------------------------------------------------------------------------
// Quick actions dropdown
// ---------------------------------------------------------------------------

function QuickActionsMenu({
  plan,
  onView,
  onExecute,
  onLaunch,
  onPause,
  onResume,
  onDuplicate,
  onMarkReady,
  onDelete,
}: Omit<PlanCardProps, 'variant'>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'p-1 rounded-md transition-opacity',
            'opacity-0 group-hover:opacity-100 focus:opacity-100',
            'hover:bg-muted text-muted-foreground hover:text-foreground',
          )}
          aria-label="Plan actions"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onView(plan.id)}>
          <Eye className="h-4 w-4 mr-2" />
          View Details
        </DropdownMenuItem>

        {(plan.status === 'ready' || plan.status === 'draft') && onLaunch && (
          <DropdownMenuItem onClick={() => onLaunch(plan.id)}>
            <Rocket className="h-4 w-4 mr-2" />
            Launch Plan
          </DropdownMenuItem>
        )}

        {plan.status === 'draft' && onMarkReady && (
          <DropdownMenuItem onClick={() => onMarkReady(plan.id)}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Mark as Ready
          </DropdownMenuItem>
        )}

        {plan.status === 'ready' && onExecute && !onLaunch && (
          <DropdownMenuItem onClick={() => onExecute(plan.id)}>
            <Play className="h-4 w-4 mr-2" />
            Execute Plan
          </DropdownMenuItem>
        )}

        {plan.status === 'running' && onPause && (
          <DropdownMenuItem onClick={() => onPause(plan.id)}>
            <Pause className="h-4 w-4 mr-2" />
            Pause
          </DropdownMenuItem>
        )}

        {plan.status === 'paused' && onResume && (
          <DropdownMenuItem onClick={() => onResume(plan.id)}>
            <Play className="h-4 w-4 mr-2" />
            Resume
          </DropdownMenuItem>
        )}

        {onDuplicate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDuplicate(plan.id)}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
          </>
        )}

        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(plan.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Primary action helper
// ---------------------------------------------------------------------------

function getPrimaryAction(
  plan: Plan,
  handlers: {
    onExecute?: (id: string) => void;
    onLaunch?: (id: string) => void;
    onPause?: (id: string) => void;
    onResume?: (id: string) => void;
    onMarkReady?: (id: string) => void;
  },
): { label: string; icon: React.ReactNode; onClick: () => void } | null {
  switch (plan.status) {
    case 'draft':
      if (handlers.onLaunch)
        return {
          label: 'Launch',
          icon: <Rocket className="h-3.5 w-3.5" />,
          onClick: () => handlers.onLaunch!(plan.id),
        };
      if (handlers.onMarkReady)
        return {
          label: 'Ready',
          icon: <CheckCircle2 className="h-3.5 w-3.5" />,
          onClick: () => handlers.onMarkReady!(plan.id),
        };
      break;
    case 'ready':
      if (handlers.onLaunch)
        return {
          label: 'Launch',
          icon: <Rocket className="h-3.5 w-3.5" />,
          onClick: () => handlers.onLaunch!(plan.id),
        };
      if (handlers.onExecute)
        return {
          label: 'Execute',
          icon: <Play className="h-3.5 w-3.5" />,
          onClick: () => handlers.onExecute!(plan.id),
        };
      break;
    case 'running':
      if (handlers.onPause)
        return {
          label: 'Pause',
          icon: <Pause className="h-3.5 w-3.5" />,
          onClick: () => handlers.onPause!(plan.id),
        };
      break;
    case 'paused':
      if (handlers.onResume)
        return {
          label: 'Resume',
          icon: <RotateCcw className="h-3.5 w-3.5" />,
          onClick: () => handlers.onResume!(plan.id),
        };
      break;
  }
  return null;
}
