'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import {
  usePreflightChecks,
  type PreflightCheck,
} from '../hooks/usePreflightChecks';
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
  Layers,
} from 'lucide-react';

interface PlanLaunchButtonProps {
  plan: Plan;
  repositoryId: string;
  onLaunched: (planId: string) => void;
  onLaunchAndSwitch?: (planId: string) => void;
  /** Show the inline pre-flight checklist briefly */
  showPreflight?: boolean;
  size?: 'default' | 'lg';
  className?: string;
}

function MiniCheckIcon({ status }: { status: string }) {
  switch (status) {
    case 'pass':
      return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
    case 'fail':
      return <XCircle className="h-3 w-3 text-red-500" />;
    case 'warn':
      return <AlertTriangle className="h-3 w-3 text-amber-500" />;
    default:
      return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
  }
}

function PreflightRow({ checks }: { checks: PreflightCheck[] }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground duration-200 animate-in fade-in slide-in-from-top-1">
      {checks.map((check) => (
        <span
          key={check.id}
          className="flex items-center gap-1"
          title={check.detail}
        >
          <MiniCheckIcon status={check.status} />
          <span className="hidden sm:inline">{check.label}</span>
        </span>
      ))}
    </div>
  );
}

function LaunchButtons({
  isLg,
  canLaunch,
  isLaunching,
  onLaunch,
  onLaunchSwitch,
}: {
  isLg: boolean;
  canLaunch: boolean;
  isLaunching: boolean;
  onLaunch: () => void;
  onLaunchSwitch?: () => void;
}) {
  const iconSize = isLg ? 'h-5 w-5' : 'h-4 w-4';

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={onLaunch}
        disabled={!canLaunch}
        size={isLg ? 'lg' : 'default'}
        className={cn(
          'gap-2 font-semibold shadow-md transition-all',
          isLg && 'px-8 text-base',
          canLaunch && 'hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]'
        )}
      >
        {isLaunching ? (
          <Loader2 className={cn('animate-spin', iconSize)} />
        ) : (
          <Rocket className={iconSize} />
        )}
        {isLaunching ? 'Launching...' : 'Launch Plan'}
      </Button>

      {onLaunchSwitch && (
        <Button
          variant="outline"
          onClick={onLaunchSwitch}
          disabled={!canLaunch}
          size={isLg ? 'lg' : 'default'}
          className="gap-1.5"
          title="Launch the plan and return to command center"
        >
          <Rocket className={isLg ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
          <span className="hidden sm:inline">Launch & Switch</span>
          <ArrowRight className={isLg ? 'h-4 w-4' : 'h-3 w-3'} />
        </Button>
      )}
    </div>
  );
}

export function PlanLaunchButton({
  plan,
  repositoryId,
  onLaunched,
  onLaunchAndSwitch,
  showPreflight = true,
  size = 'default',
  className,
}: PlanLaunchButtonProps) {
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [showChecks, setShowChecks] = useState(false);

  const canAttemptLaunch = plan.status === 'ready' || plan.status === 'draft';

  const { checks, isReady, isChecking } = usePreflightChecks({
    repositoryId,
    planId: plan.id,
    enabled: canAttemptLaunch && showPreflight,
  });

  const [executePlan] = useExecutePlanMutation();
  const [updatePlan] = useUpdatePlanMutation();

  // Auto-show checks briefly, then hide after they pass
  useEffect(() => {
    if (!showPreflight || !canAttemptLaunch || checks.length === 0) return;
    setShowChecks(true);
    if (isReady && !isChecking) {
      const timer = setTimeout(() => setShowChecks(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showPreflight, canAttemptLaunch, checks.length, isReady, isChecking]);

  const handleLaunch = useCallback(
    async (switchAfter: boolean) => {
      setIsLaunching(true);
      setLaunchError(null);

      try {
        if (plan.status === 'draft') {
          await updatePlan({ id: plan.id, data: { status: 'ready' } }).unwrap();
        }
        await executePlan(plan.id).unwrap();

        if (switchAfter && onLaunchAndSwitch) {
          onLaunchAndSwitch(plan.id);
        } else {
          onLaunched(plan.id);
        }
      } catch (err) {
        setLaunchError(
          err instanceof Error ? err.message : 'Failed to launch plan'
        );
      } finally {
        setIsLaunching(false);
      }
    },
    [plan, executePlan, updatePlan, onLaunched, onLaunchAndSwitch]
  );

  if (!canAttemptLaunch) return null;

  const canLaunch = (isReady || !showPreflight) && !isChecking && !isLaunching;
  const isLg = size === 'lg';

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {showPreflight && showChecks && checks.length > 0 && (
        <PreflightRow checks={checks} />
      )}

      <LaunchButtons
        isLg={isLg}
        canLaunch={canLaunch}
        isLaunching={isLaunching}
        onLaunch={() => handleLaunch(false)}
        onLaunchSwitch={
          onLaunchAndSwitch ? () => handleLaunch(true) : undefined
        }
      />

      {isLg && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {plan.totalPhases} phase{plan.totalPhases !== 1 ? 's' : ''}
          </span>
          <span>
            {plan.totalTasks} task{plan.totalTasks !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {launchError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 dark:border-red-900 dark:bg-red-950/20">
          <p className="text-xs text-red-600 dark:text-red-400">
            {launchError}
          </p>
        </div>
      )}
    </div>
  );
}
