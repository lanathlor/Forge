'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { cn } from '@/shared/lib/utils';
import { usePreflightChecks } from '../hooks/usePreflightChecks';
import {
  useExecutePlanMutation,
  useUpdatePlanMutation,
} from '../store/plansApi';
import type { Plan } from '@/db/schema';
import {
  Rocket,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  RotateCcw,
  Layers,
} from 'lucide-react';

interface PlanLaunchDialogProps {
  plan: Plan;
  repositoryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLaunched: (planId: string) => void;
  onLaunchAndSwitch?: (planId: string) => void;
}

function CheckIcon({ status }: { status: string }) {
  switch (status) {
    case 'pass':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case 'fail':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'warn':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    default:
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }
}

export function PlanLaunchDialog({
  plan,
  repositoryId,
  open,
  onOpenChange,
  onLaunched,
  onLaunchAndSwitch,
}: PlanLaunchDialogProps) {
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const { checks, isReady, isChecking, rerunChecks } = usePreflightChecks({
    repositoryId,
    planId: plan.id,
    enabled: open,
  });

  const [executePlan] = useExecutePlanMutation();
  const [updatePlan] = useUpdatePlanMutation();

  const handleLaunch = useCallback(async (switchAfter: boolean) => {
    setIsLaunching(true);
    setLaunchError(null);

    try {
      // Auto-ready draft plans
      if (plan.status === 'draft') {
        await updatePlan({ id: plan.id, data: { status: 'ready' } }).unwrap();
      }

      await executePlan(plan.id).unwrap();
      onOpenChange(false);

      if (switchAfter && onLaunchAndSwitch) {
        onLaunchAndSwitch(plan.id);
      } else {
        onLaunched(plan.id);
      }
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : 'Failed to launch plan');
    } finally {
      setIsLaunching(false);
    }
  }, [plan, executePlan, updatePlan, onOpenChange, onLaunched, onLaunchAndSwitch]);

  const canLaunch = isReady && !isChecking && !isLaunching;
  const progress = plan.totalTasks > 0
    ? Math.round((plan.completedTasks / plan.totalTasks) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Launch Plan
          </DialogTitle>
          <DialogDescription>
            Pre-flight checks for &ldquo;{plan.title}&rdquo;
          </DialogDescription>
        </DialogHeader>

        {/* Plan summary */}
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium truncate">{plan.title}</span>
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {plan.totalPhases} phase{plan.totalPhases !== 1 ? 's' : ''}
            </span>
            <span>{plan.totalTasks} task{plan.totalTasks !== 1 ? 's' : ''}</span>
            {progress > 0 && <span>{progress}% done</span>}
          </div>
        </div>

        {/* Pre-flight checklist */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pre-flight Checklist
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={rerunChecks}
              disabled={isChecking}
            >
              <RotateCcw className={cn('h-3 w-3 mr-1', isChecking && 'animate-spin')} />
              Recheck
            </Button>
          </div>

          <div className="rounded-lg border divide-y">
            {checks.map((check) => (
              <div
                key={check.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 transition-colors',
                  check.status === 'fail' && 'bg-red-50 dark:bg-red-950/20',
                )}
              >
                <CheckIcon status={check.status} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm">{check.label}</span>
                  {check.detail && (
                    <p className="text-xs text-muted-foreground truncate">{check.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Launch error */}
        {launchError && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 px-3 py-2">
            <p className="text-sm text-red-600 dark:text-red-400">{launchError}</p>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {onLaunchAndSwitch && (
            <Button
              variant="outline"
              onClick={() => handleLaunch(true)}
              disabled={!canLaunch}
              className="gap-2"
            >
              <Rocket className="h-4 w-4" />
              Launch & Switch
              <ArrowRight className="h-3 w-3" />
            </Button>
          )}
          <Button
            onClick={() => handleLaunch(false)}
            disabled={!canLaunch}
            className="gap-2"
          >
            {isLaunching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
            {isLaunching ? 'Launching...' : 'Launch & Monitor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
