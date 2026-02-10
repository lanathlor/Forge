'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { PlanStatusBadge } from './PlanStatusBadge';
import type { Plan } from '@/db/schema';
import { formatDistanceToNow } from 'date-fns';

interface PlanCardProps {
  plan: Plan;
  onView: (planId: string) => void;
  onExecute?: (planId: string) => void;
  onPause?: (planId: string) => void;
  onResume?: (planId: string) => void;
  onMarkReady?: (planId: string) => void;
  onDelete?: (planId: string) => void;
}

export function PlanCard({
  plan,
  onView,
  onExecute,
  onPause,
  onResume,
  onMarkReady,
  onDelete,
}: PlanCardProps) {
  const progressPercentage = plan.totalTasks > 0
    ? Math.round((plan.completedTasks / plan.totalTasks) * 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="cursor-pointer hover:underline" onClick={() => onView(plan.id)}>
              {plan.title}
            </CardTitle>
            <CardDescription>{plan.description || 'No description'}</CardDescription>
          </div>
          <PlanStatusBadge status={plan.status} />
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span>{plan.totalPhases} phases</span>
          <span>{plan.totalTasks} tasks</span>
          <span>
            {plan.completedTasks}/{plan.totalTasks} complete
          </span>
        </div>

        {plan.status === 'running' && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{progressPercentage}%</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <div className="text-xs text-muted-foreground">
          Created {formatDistanceToNow(new Date(plan.createdAt))} ago
        </div>

        <div className="flex gap-2">
          {plan.status === 'draft' && onMarkReady && (
            <Button size="sm" onClick={() => onMarkReady(plan.id)}>
              Mark as Ready
            </Button>
          )}

          {plan.status === 'ready' && onExecute && (
            <Button size="sm" onClick={() => onExecute(plan.id)}>
              Execute Plan
            </Button>
          )}

          {plan.status === 'running' && onPause && (
            <Button size="sm" variant="outline" onClick={() => onPause(plan.id)}>
              Pause
            </Button>
          )}

          {plan.status === 'paused' && onResume && (
            <Button size="sm" onClick={() => onResume(plan.id)}>
              Resume
            </Button>
          )}

          {(plan.status === 'completed' || plan.status === 'failed') && (
            <Button size="sm" variant="outline" onClick={() => onView(plan.id)}>
              View Details
            </Button>
          )}

          {onDelete && (
            <Button size="sm" variant="ghost" onClick={() => onDelete(plan.id)}>
              Delete
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
