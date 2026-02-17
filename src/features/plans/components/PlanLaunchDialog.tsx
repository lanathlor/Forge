'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
  ListChecks,
  Zap,
} from 'lucide-react';

interface PlanLaunchDialogProps {
  plan: Plan;
  repositoryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLaunched: (planId: string) => void;
  onLaunchAndSwitch?: (planId: string) => void;
}

type LaunchPhase = 'preflight' | 'ready' | 'launching' | 'launched';

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

function LaunchingAnimation() {
  return (
    <div className="flex flex-col items-center justify-center py-6 duration-300 animate-in fade-in zoom-in-95">
      <div className="relative">
        <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-primary/10">
          <Rocket className="h-8 w-8 animate-bounce text-primary" />
        </div>
        <span className="absolute -right-1 -top-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
        </span>
      </div>
      <p className="mt-4 text-sm font-medium">Launching plan...</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Connecting to execution engine
      </p>
    </div>
  );
}

/* eslint-disable complexity */
export function PlanLaunchDialog({
  plan,
  repositoryId,
  open,
  onOpenChange,
  onLaunched,
  onLaunchAndSwitch,
}: PlanLaunchDialogProps) {
  const [launchPhase, setLaunchPhase] = useState<LaunchPhase>('preflight');
  const [launchError, setLaunchError] = useState<string | null>(null);
  const hasAutoTransitioned = useRef(false);

  const { checks, isReady, isChecking, rerunChecks } = usePreflightChecks({
    repositoryId,
    planId: plan.id,
    enabled: open,
  });

  const [executePlan] = useExecutePlanMutation();
  const [updatePlan] = useUpdatePlanMutation();

  // Auto-transition from preflight to ready when checks pass
  useEffect(() => {
    if (
      isReady &&
      !isChecking &&
      launchPhase === 'preflight' &&
      !hasAutoTransitioned.current
    ) {
      hasAutoTransitioned.current = true;
      // Brief delay so user can see checks passing
      const timer = setTimeout(() => setLaunchPhase('ready'), 600);
      return () => clearTimeout(timer);
    }
  }, [isReady, isChecking, launchPhase]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setLaunchPhase('preflight');
      setLaunchError(null);
      hasAutoTransitioned.current = false;
    }
  }, [open]);

  const handleLaunch = useCallback(
    async (switchAfter: boolean) => {
      setLaunchPhase('launching');
      setLaunchError(null);

      try {
        // Auto-ready draft plans
        if (plan.status === 'draft') {
          await updatePlan({ id: plan.id, data: { status: 'ready' } }).unwrap();
        }

        await executePlan(plan.id).unwrap();
        setLaunchPhase('launched');

        // Brief pause to show success, then navigate
        setTimeout(() => {
          onOpenChange(false);
          if (switchAfter && onLaunchAndSwitch) {
            onLaunchAndSwitch(plan.id);
          } else {
            onLaunched(plan.id);
          }
        }, 400);
      } catch (err) {
        setLaunchPhase('ready');
        setLaunchError(
          err instanceof Error ? err.message : 'Failed to launch plan'
        );
      }
    },
    [plan, executePlan, updatePlan, onOpenChange, onLaunched, onLaunchAndSwitch]
  );

  const canLaunch = isReady && !isChecking && launchPhase === 'ready';
  const isLaunching = launchPhase === 'launching' || launchPhase === 'launched';
  const progress =
    plan.totalTasks > 0
      ? Math.round((plan.completedTasks / plan.totalTasks) * 100)
      : 0;

  const hasFailures = checks.some((c) => c.status === 'fail');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket
              className={cn(
                'h-5 w-5',
                isLaunching ? 'text-emerald-500' : 'text-primary'
              )}
            />
            {isLaunching ? 'Launching...' : 'Launch Plan'}
          </DialogTitle>
          <DialogDescription>
            {isLaunching
              ? 'Starting execution engine'
              : `Pre-flight checks for \u201c${plan.title}\u201d`}
          </DialogDescription>
        </DialogHeader>

        {isLaunching ? (
          <LaunchingAnimation />
        ) : (
          <>
            {/* Plan summary */}
            <div className="rounded-lg border bg-muted/30 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="truncate text-sm font-medium">
                  {plan.title}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {plan.totalPhases} phase{plan.totalPhases !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <ListChecks className="h-3 w-3" />
                  {plan.totalTasks} task{plan.totalTasks !== 1 ? 's' : ''}
                </span>
                {progress > 0 && <span>{progress}% done</span>}
              </div>
            </div>

            {/* Pre-flight checklist */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Pre-flight Checklist
                </span>
                <div className="flex items-center gap-2">
                  {launchPhase === 'ready' && !hasFailures && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 duration-200 animate-in fade-in">
                      <Zap className="h-3 w-3" />
                      All systems go
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={rerunChecks}
                    disabled={isChecking}
                  >
                    <RotateCcw
                      className={cn(
                        'mr-1 h-3 w-3',
                        isChecking && 'animate-spin'
                      )}
                    />
                    Recheck
                  </Button>
                </div>
              </div>

              <div
                className={cn(
                  'divide-y rounded-lg border transition-all duration-300',
                  launchPhase === 'ready' &&
                    !hasFailures &&
                    'border-emerald-200 dark:border-emerald-900'
                )}
              >
                {checks.map((check) => (
                  <div
                    key={check.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 transition-colors',
                      check.status === 'fail' && 'bg-red-50 dark:bg-red-950/20',
                      check.status === 'pass' &&
                        launchPhase === 'ready' &&
                        'bg-emerald-50/30 dark:bg-emerald-950/10'
                    )}
                  >
                    <CheckIcon status={check.status} />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm">{check.label}</span>
                      {check.detail && (
                        <p className="truncate text-xs text-muted-foreground">
                          {check.detail}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Launch error */}
            {launchError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/20">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {launchError}
                </p>
              </div>
            )}
          </>
        )}

        {!isLaunching && (
          <DialogFooter className="flex-col gap-2 sm:flex-row">
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
              className={cn(
                'gap-2 transition-all',
                canLaunch &&
                  'shadow-md hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]'
              )}
            >
              <Rocket className="h-4 w-4" />
              Launch & Monitor
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
