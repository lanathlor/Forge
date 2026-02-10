/* eslint-disable max-lines-per-function */
'use client';

import { Button } from '@/shared/components/ui/button';
import { PlanCard } from './PlanCard';
import {
  useGetPlansQuery,
  useExecutePlanMutation,
  usePausePlanMutation,
  useResumePlanMutation,
  useUpdatePlanMutation,
  useDeletePlanMutation,
} from '../store/plansApi';
import { useState } from 'react';
import { GeneratePlanDialog } from './GeneratePlanDialog';

interface PlanListProps {
  repositoryId?: string;
  onViewPlan: (planId: string) => void;
}

export function PlanList({
  repositoryId,
  onViewPlan,
}: PlanListProps) {
  // Poll every 5 seconds to update plan statuses
  const { data, isLoading, error } = useGetPlansQuery(repositoryId, {
    pollingInterval: 5000,
    skipPollingIfUnfocused: true,
  });
  const [executePlan] = useExecutePlanMutation();
  const [pausePlan] = usePausePlanMutation();
  const [resumePlan] = useResumePlanMutation();
  const [updatePlan] = useUpdatePlanMutation();
  const [deletePlan] = useDeletePlanMutation();
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading plans...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-destructive">Error loading plans</p>
      </div>
    );
  }

  const plans = data?.plans || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Plans</h2>
        <div className="flex gap-2">
          <Button onClick={() => setShowGenerateDialog(true)}>
            Generate with Claude
          </Button>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="text-center p-8 border-2 border-dashed rounded-lg">
          <h3 className="text-lg font-semibold mb-2">No plans yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first plan to get started
          </p>
          <Button onClick={() => setShowGenerateDialog(true)}>
            Generate Plan with Claude
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onView={onViewPlan}
              onExecute={(id) => executePlan(id)}
              onPause={(id) => pausePlan(id)}
              onResume={(id) => resumePlan(id)}
              onMarkReady={(id) => updatePlan({ id, data: { status: 'ready' } })}
              onDelete={(id) => {
                if (confirm('Are you sure you want to delete this plan?')) {
                  deletePlan(id);
                }
              }}
            />
          ))}
        </div>
      )}

      {repositoryId && (
        <GeneratePlanDialog
          open={showGenerateDialog}
          onOpenChange={setShowGenerateDialog}
          repositoryId={repositoryId}
        />
      )}
    </div>
  );
}
