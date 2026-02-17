'use client';

import { lazy, Suspense } from 'react';
import { useAppSelector } from '@/shared/hooks';
import { AppLayout } from '../components/AppLayout';
import { Loader2 } from 'lucide-react';

const PlanList = lazy(() => import('@/features/plans/components').then(mod => ({ default: mod.PlanList })));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[300px]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">Loading plans...</span>
      </div>
    </div>
  );
}

export default function PlansPage() {
  const currentRepositoryId = useAppSelector(state => state.session.currentRepositoryId);

  if (!currentRepositoryId) {
    return (
      <AppLayout activeNavItem="plans">
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">No repository selected. Please select a repository.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activeNavItem="plans">
      <div className="h-full p-4 lg:p-6 overflow-auto">
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
