import { Suspense, lazy } from 'react';
import { ErrorBoundary } from '@/shared/components/error';
import { Loader2 } from 'lucide-react';

const PlanList = lazy(() =>
  import('@/features/plans/components').then((mod) => ({
    default: mod.PlanList,
  }))
);
const PlanDetailView = lazy(() =>
  import('@/features/plans/components').then((mod) => ({
    default: mod.PlanDetailView,
  }))
);
const PlanExecutionView = lazy(() =>
  import('@/features/plans/components').then((mod) => ({
    default: mod.PlanExecutionView,
  }))
);
const PlanRefinementChat = lazy(() =>
  import('@/features/plans/components').then((mod) => ({
    default: mod.PlanRefinementChat,
  }))
);

interface LoadingFallbackProps {
  message: string;
}

function LoadingFallback({ message }: LoadingFallbackProps) {
  return (
    <div
      className="flex h-full min-h-[300px] items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        <span className="text-sm">{message}</span>
      </div>
    </div>
  );
}

interface PlansTabContentProps {
  planView: 'list' | 'detail' | 'execution';
  selectedPlanId: string | null;
  repositoryId: string;
  handleViewPlan: (planId: string) => void;
  handleOpenLaunch: (planId: string) => void;
  handleBackToList: () => void;
  setReviewPlanId: (planId: string | null) => void;
  justLaunchedPlanId: string | null;
  handleViewExecution: (planId: string) => void;
  reviewPlanId: string | null;
}

export function PlansTabContent({
  planView,
  selectedPlanId,
  repositoryId,
  handleViewPlan,
  handleOpenLaunch,
  handleBackToList,
  setReviewPlanId,
  justLaunchedPlanId,
  handleViewExecution,
  reviewPlanId,
}: PlansTabContentProps) {
  return (
    <ErrorBoundary id="plans-tab">
      <Suspense fallback={<LoadingFallback message="Loading plans..." />}>
        {planView === 'list' ? (
          <div className="h-full overflow-auto">
            <PlanList
              repositoryId={repositoryId}
              onViewPlan={handleViewPlan}
              onLaunchPlan={handleOpenLaunch}
            />
          </div>
        ) : planView === 'execution' && selectedPlanId ? (
          <div className="h-full overflow-hidden">
            <PlanExecutionView
              planId={selectedPlanId}
              onBack={handleBackToList}
              onReview={(planId) => setReviewPlanId(planId)}
              justLaunched={justLaunchedPlanId === selectedPlanId}
            />
          </div>
        ) : planView === 'detail' && selectedPlanId ? (
          <div className="flex h-full overflow-hidden">
            <div className="min-w-0 flex-1 overflow-auto">
              <PlanDetailView
                planId={selectedPlanId}
                onBack={handleBackToList}
                onReview={(planId) => setReviewPlanId(planId)}
                onLaunch={handleOpenLaunch}
                onViewExecution={handleViewExecution}
              />
            </div>
            {reviewPlanId && (
              <PlanRefinementChat
                planId={reviewPlanId}
                open={!!reviewPlanId}
                onClose={() => setReviewPlanId(null)}
                onLaunch={() => {
                  setReviewPlanId(null);
                  handleOpenLaunch(reviewPlanId);
                }}
              />
            )}
          </div>
        ) : null}
      </Suspense>
    </ErrorBoundary>
  );
}
