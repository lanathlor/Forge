'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import { PlanCard } from './PlanCard';
import {
  useGetPlansQuery,
  useExecutePlanMutation,
  usePausePlanMutation,
  useResumePlanMutation,
  useUpdatePlanMutation,
  useDeletePlanMutation,
} from '../store/plansApi';
import { GeneratePlanDialog } from './GeneratePlanDialog';
import type { PlanStatus } from '@/db/schema';
import { PlanLaunchCard } from './PlanLaunchCard';
import {
  Search,
  X,
  ArrowUpDown,
  LayoutGrid,
  LayoutList,
  Sparkles,
  FileText,
  Plus,
  Rocket,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanListProps {
  repositoryId?: string;
  onViewPlan: (planId: string) => void;
  onLaunchPlan?: (planId: string) => void;
}

type StatusFilter = 'all' | PlanStatus;
type SortField = 'updatedAt' | 'createdAt' | 'title' | 'status' | 'progress';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_PRIORITY: Record<PlanStatus, number> = {
  running: 0,
  paused: 1,
  ready: 2,
  draft: 3,
  failed: 4,
  completed: 5,
};

const FILTER_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'draft', label: 'Drafts' },
  { value: 'ready', label: 'Ready' },
  { value: 'completed', label: 'Done' },
  { value: 'failed', label: 'Failed' },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'updatedAt', label: 'Last Modified' },
  { value: 'createdAt', label: 'Created' },
  { value: 'title', label: 'Title' },
  { value: 'status', label: 'Status' },
  { value: 'progress', label: 'Progress' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlanList({
  repositoryId,
  onViewPlan,
  onLaunchPlan,
}: PlanListProps) {
  // Data
  const { data, isLoading, error } = useGetPlansQuery(repositoryId, {
    pollingInterval: 5000,
    skipPollingIfUnfocused: true,
  });
  const [executePlan] = useExecutePlanMutation();
  const [pausePlan] = usePausePlanMutation();
  const [resumePlan] = useResumePlanMutation();
  const [updatePlan] = useUpdatePlanMutation();
  const [deletePlan] = useDeletePlanMutation();

  // UI state
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const plans = data?.plans || [];

  // Plans ready to launch (shown prominently at top)
  const launchablePlans = useMemo(() => {
    return plans.filter((p) => p.status === 'ready' || p.status === 'draft');
  }, [plans]);

  // ---------------------------------------------------------------------------
  // Filtering & sorting
  // ---------------------------------------------------------------------------

  const tabCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: plans.length,
      draft: 0,
      ready: 0,
      running: 0,
      paused: 0,
      completed: 0,
      failed: 0,
    };
    for (const p of plans) {
      counts[p.status]++;
    }
    // Fold paused into running count for the filter tab
    counts.running += counts.paused;
    return counts;
  }, [plans]);

  const processedPlans = useMemo(() => {
    let filtered = [...plans];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'running') {
        // "Running" tab includes paused plans
        filtered = filtered.filter(
          (p) => p.status === 'running' || p.status === 'paused'
        );
      } else {
        filtered = filtered.filter((p) => p.status === statusFilter);
      }
    }

    // Sort
    filtered.sort((a, b) => {
      const dir = sortDirection === 'desc' ? -1 : 1;

      switch (sortField) {
        case 'updatedAt':
          return (
            (new Date(a.updatedAt).getTime() -
              new Date(b.updatedAt).getTime()) *
            dir
          );
        case 'createdAt':
          return (
            (new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime()) *
            dir
          );
        case 'title':
          return a.title.localeCompare(b.title) * dir;
        case 'status':
          return (STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]) * dir;
        case 'progress': {
          const pA = a.totalTasks > 0 ? a.completedTasks / a.totalTasks : 0;
          const pB = b.totalTasks > 0 ? b.completedTasks / b.totalTasks : 0;
          return (pA - pB) * dir;
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [plans, searchQuery, statusFilter, sortField, sortDirection]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('desc');
      }
    },
    [sortField]
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (confirm('Are you sure you want to delete this plan?')) {
        deletePlan(id);
      }
    },
    [deletePlan]
  );

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
  }, []);

  // ---------------------------------------------------------------------------
  // Loading / error
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
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

  // ---------------------------------------------------------------------------
  // Empty state (no plans at all)
  // ---------------------------------------------------------------------------

  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <FileText className="h-8 w-8 text-primary" />
        </div>
        <h3 className="mb-1 text-lg font-semibold text-foreground">
          No plans yet
        </h3>
        <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
          Plans help you break down complex tasks into phases and track
          progress. Generate one with Claude or create your own.
        </p>
        <div className="flex gap-3">
          <Button onClick={() => setShowGenerateDialog(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Generate with Claude
          </Button>
        </div>

        {repositoryId && (
          <GeneratePlanDialog
            open={showGenerateDialog}
            onOpenChange={setShowGenerateDialog}
            repositoryId={repositoryId}
            onPlanCreated={onViewPlan}
          />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 space-y-3 pb-4">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Plans</h2>
            <Badge
              variant="secondary"
              className="h-5 px-1.5 text-[10px] font-medium"
            >
              {processedPlans.length}
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            {/* View toggle */}
            <div className="flex items-center rounded-md border bg-muted/40 p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'rounded-sm p-1 transition-colors',
                  viewMode === 'grid'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'rounded-sm p-1 transition-colors',
                  viewMode === 'list'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label="List view"
              >
                <LayoutList className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuLabel className="text-xs">
                  Sort by
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SORT_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => toggleSort(opt.value)}
                  >
                    {opt.label}
                    {sortField === opt.value && (
                      <span className="ml-auto text-muted-foreground">
                        {sortDirection === 'desc' ? '\u2193' : '\u2191'}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Create */}
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowGenerateDialog(true)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Plan</span>
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search plans by title or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 border-0 bg-muted/40 pl-8 text-sm focus-visible:ring-1"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {FILTER_TABS.map((tab) => {
            const count = tabCounts[tab.value];
            const isActive = statusFilter === tab.value;
            // Hide tabs with zero count (except "all")
            if (tab.value !== 'all' && count === 0) return null;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  'whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'ml-1 text-[10px]',
                      isActive ? 'opacity-80' : 'opacity-60'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ready to Launch section */}
      {statusFilter === 'all' &&
        !searchQuery &&
        launchablePlans.length > 0 &&
        onLaunchPlan && (
          <div className="flex-shrink-0 pb-4">
            <div className="mb-2 flex items-center gap-2">
              <Rocket className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Ready to Launch
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {launchablePlans.slice(0, 3).map((plan) => (
                <PlanLaunchCard
                  key={plan.id}
                  plan={plan}
                  onLaunch={onLaunchPlan}
                  onView={onViewPlan}
                  onPause={(id) => pausePlan(id)}
                  onResume={(id) => resumePlan(id)}
                />
              ))}
            </div>
          </div>
        )}

      {/* Plan list/grid */}
      <div className="flex-1 overflow-auto">
        {processedPlans.length === 0 ? (
          // Filtered empty state
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <Search className="mb-2 h-6 w-6 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No matching plans</p>
            <button
              onClick={clearFilters}
              className="mt-1.5 text-xs text-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {processedPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                variant="grid"
                onView={onViewPlan}
                onLaunch={onLaunchPlan}
                onExecute={(id) => executePlan(id)}
                onPause={(id) => pausePlan(id)}
                onResume={(id) => resumePlan(id)}
                onMarkReady={(id) =>
                  updatePlan({ id, data: { status: 'ready' } })
                }
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {processedPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                variant="list"
                onView={onViewPlan}
                onLaunch={onLaunchPlan}
                onExecute={(id) => executePlan(id)}
                onPause={(id) => pausePlan(id)}
                onResume={(id) => resumePlan(id)}
                onMarkReady={(id) =>
                  updatePlan({ id, data: { status: 'ready' } })
                }
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Generate Dialog */}
      {repositoryId && (
        <GeneratePlanDialog
          open={showGenerateDialog}
          onOpenChange={setShowGenerateDialog}
          repositoryId={repositoryId}
          onPlanCreated={onViewPlan}
        />
      )}
    </div>
  );
}
