'use client';

import { lazy, Suspense } from 'react';
import { useAppSelector } from '@/shared/hooks';
import { AppLayout } from '../components/AppLayout';
import { Loader2 } from 'lucide-react';

const PlanList = lazy(() =>
  import('@/features/plans/components').then((mod) => ({
    default: mod.PlanList,
  }))
);

function LoadingFallback() {
  return (
    <div className="flex h-full min-h-[300px] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">Loading plans...</span>
      </div>
    </div>
  );
}

export default function PlansPage() {
  const currentRepositoryId = useAppSelector(
    (state) => state.session.currentRepositoryId
  );

  if (!currentRepositoryId) {
    return (
      <AppLayout activeNavItem="plans">
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">
            No repository selected. Please select a repository.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activeNavItem="plans">
      <div className="h-full overflow-auto p-4 lg:p-6">
        <Suspense fallback={<LoadingFallback />}>
          <PlanList
            repositoryId={currentRepositoryId}
            onViewPlan={(planId) => {
              window.location.href = `/plans/${planId}`;
            }}
            onLaunchPlan={() => {}}
          />
        </Suspense>
      </div>
    </AppLayout>
  );
}
