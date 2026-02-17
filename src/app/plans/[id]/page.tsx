'use client';

import { lazy, Suspense, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '../../components/AppLayout';
import { Button } from '@/shared/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';

const PlanDetailView = lazy(() => import('@/features/plans/components').then(mod => ({ default: mod.PlanDetailView })));
const PlanRefinementChat = lazy(() => import('@/features/plans/components').then(mod => ({ default: mod.PlanRefinementChat })));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[300px]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">Loading plan details...</span>
      </div>
    </div>
  );
}

export default function PlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.id as string;
  const [reviewPlanId, setReviewPlanId] = useState<string | null>(null);

  return (
    <AppLayout activeNavItem="plans">
      <div className="h-full p-4 lg:p-6 flex flex-col">
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/plans')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Plans
          </Button>
        </div>
        <div className="flex-1 overflow-hidden flex">
          <Suspense fallback={<LoadingFallback />}>
            <div className="flex-1 overflow-auto min-w-0">
              <PlanDetailView
                planId={planId}
                onBack={() => router.push('/plans')}
                onReview={(id) => setReviewPlanId(id)}
                onLaunch={() => {}}
                onViewExecution={() => {}}
              />
            </div>
            {reviewPlanId && (
              <PlanRefinementChat
                planId={reviewPlanId}
                open={!!reviewPlanId}
                onClose={() => setReviewPlanId(null)}
                onLaunch={() => {
                  setReviewPlanId(null);
                }}
              />
            )}
          </Suspense>
        </div>
      </div>
    </AppLayout>
  );
}
