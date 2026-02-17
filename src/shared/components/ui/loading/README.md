# Loading States & Skeleton Loaders

Comprehensive loading state system with skeleton loaders, spinners, progress bars, and overlays.

## Table of Contents

- [Components](#components)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Animation System](#animation-system)

## Components

### LoadingSpinner

A customizable spinning loader with multiple sizes and variants.

```tsx
import { LoadingSpinner } from '@/shared/components/ui/loading';

// Basic usage
<LoadingSpinner />

// With label
<LoadingSpinner label="Loading data..." />

// Centered
<LoadingSpinner centered label="Processing..." />

// Different sizes
<LoadingSpinner size="xs" />
<LoadingSpinner size="sm" />
<LoadingSpinner size="default" />
<LoadingSpinner size="lg" />
<LoadingSpinner size="xl" />

// Different variants
<LoadingSpinner variant="primary" />
<LoadingSpinner variant="success" />
<LoadingSpinner variant="warning" />
<LoadingSpinner variant="error" />
```

### ProgressBar

Determinate progress bar for operations with known completion percentage.

```tsx
import { ProgressBar } from '@/shared/components/ui/loading';

// Basic usage
<ProgressBar value={45} />

// With label and percentage
<ProgressBar
  value={75}
  label="Uploading files"
  showPercentage
/>

// Animated shimmer effect
<ProgressBar
  value={60}
  animated
  label="Processing"
/>

// Different variants
<ProgressBar value={100} variant="success" />
<ProgressBar value={30} variant="warning" />
<ProgressBar value={85} variant="error" />

// Different sizes
<ProgressBar value={50} size="sm" />
<ProgressBar value={50} size="lg" />
```

### IndeterminateProgress

For operations with unknown duration.

```tsx
import { IndeterminateProgress } from '@/shared/components/ui/loading';

// Basic usage
<IndeterminateProgress />

// With label
<IndeterminateProgress label="Analyzing codebase..." />

// Different variants
<IndeterminateProgress variant="primary" />
<IndeterminateProgress variant="success" />
```

### Skeleton

Basic skeleton loader for individual elements.

```tsx
import { Skeleton } from '@/shared/components/ui/loading';

// Basic usage
<Skeleton className="h-4 w-full" />

// Different variants
<Skeleton variant="text" className="w-3/4" />
<Skeleton variant="circular" className="h-12 w-12" />
<Skeleton variant="rectangular" className="h-32 w-full" />

// With specific dimensions
<Skeleton width={200} height={100} />

// Without animation (static placeholder)
<Skeleton animated={false} className="h-8 w-32" />
```

### SkeletonGroup

Multiple skeletons with spacing.

```tsx
import { SkeletonGroup, Skeleton } from '@/shared/components/ui/loading';

// Auto-generate count
<SkeletonGroup count={5} />

// Custom skeletons
<SkeletonGroup spacing="lg">
  <Skeleton className="h-12 w-full" />
  <Skeleton className="h-8 w-3/4" />
  <Skeleton className="h-8 w-1/2" />
</SkeletonGroup>

// Different spacing
<SkeletonGroup count={3} spacing="sm" />
<SkeletonGroup count={3} spacing="default" />
<SkeletonGroup count={3} spacing="lg" />
```

### LoadingOverlay

Full-screen or container overlay for blocking interactions during loading.

```tsx
import { LoadingOverlay } from '@/shared/components/ui/loading';

// Basic usage (visible by default)
<div className="relative h-96">
  <YourContent />
  <LoadingOverlay visible={isLoading} />
</div>

// With label
<LoadingOverlay visible={isLoading} label="Saving changes..." />

// Different spinner sizes
<LoadingOverlay visible={isLoading} spinnerSize="xl" />

// Without blur
<LoadingOverlay visible={isLoading} blur={false} />

// Transparent background
<LoadingOverlay visible={isLoading} transparent />
```

### PulsingDot

Small animated indicator for status/activity.

```tsx
import { PulsingDot } from '@/shared/components/ui/loading';

// Basic usage
<PulsingDot />

// Without pulse animation
<PulsingDot pulse={false} />

// Different variants
<PulsingDot variant="primary" />
<PulsingDot variant="success" />
<PulsingDot variant="warning" />
<PulsingDot variant="error" />

// Different sizes
<PulsingDot size="sm" />
<PulsingDot size="lg" />

// In text
<span className="flex items-center gap-2">
  <PulsingDot variant="success" />
  <span>Live</span>
</span>
```

### Specialized Skeletons

Pre-built skeleton loaders for common dashboard patterns.

```tsx
import {
  StatCardSkeleton,
  ActionCardSkeleton,
  ListCardSkeleton,
  TaskListSkeleton,
  PlanListSkeleton,
  RepositorySelectorSkeleton,
  SessionSummarySkeleton,
  QAGatesConfigSkeleton,
  DashboardGridSkeleton,
  DetailPanelSkeleton,
  TableSkeleton,
} from '@/shared/components/ui/loading';

// Stat card skeleton
<StatCardSkeleton variant="primary" showTrend />

// Action card skeleton
<ActionCardSkeleton showAction />

// List card skeleton
<ListCardSkeleton
  itemCount={5}
  showHeader
  showDescription
  showHeaderAction
/>

// Task list skeleton
<TaskListSkeleton count={5} />

// Plan list skeleton
<PlanListSkeleton count={3} />

// Repository selector skeleton
<RepositorySelectorSkeleton />

// Session summary skeleton
<SessionSummarySkeleton />

// QA gates config skeleton
<QAGatesConfigSkeleton />

// Dashboard grid skeleton
<DashboardGridSkeleton columns={3} rows={2} />

// Detail panel skeleton
<DetailPanelSkeleton />

// Table skeleton
<TableSkeleton
  columns={4}
  rows={5}
  showHeader
/>
```

## Usage Examples

### Component with Loading State

```tsx
import { LoadingSpinner } from '@/shared/components/ui/loading';
import { TaskListSkeleton } from '@/shared/components/ui/loading';

function TaskList() {
  const { data, isLoading, error } = useGetTasksQuery();

  if (isLoading) {
    return <TaskListSkeleton count={5} />;
  }

  if (error) {
    return <ErrorMessage error={error} />;
  }

  return (
    <div>
      {data.tasks.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </div>
  );
}
```

### Card with Loading Prop

```tsx
import { StatCard } from '@/shared/components/ui/dashboard-cards';

function DashboardStats() {
  const { data, isLoading } = useGetStatsQuery();

  return (
    <div className="grid grid-cols-3 gap-4">
      <StatCard
        loading={isLoading}
        icon={<CheckIcon />}
        value={data?.completed ?? 0}
        label="Completed Tasks"
        trend={{
          value: '+12%',
          direction: 'up',
        }}
      />
      {/* More cards... */}
    </div>
  );
}
```

### Form with Submit Loading

```tsx
import { Button } from '@/shared/components/ui/button';
import { LoadingSpinner } from '@/shared/components/ui/loading';

function SettingsForm() {
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (data) => {
    setIsSaving(true);
    try {
      await saveSettings(data);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields... */}
      <Button type="submit" disabled={isSaving}>
        {isSaving ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            Saving...
          </>
        ) : (
          'Save Changes'
        )}
      </Button>
    </form>
  );
}
```

### Long Operation with Progress

```tsx
import { ProgressBar, LoadingSpinner } from '@/shared/components/ui/loading';

function FileUpload() {
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  return (
    <div className="space-y-4">
      {progress > 0 && progress < 100 && (
        <ProgressBar
          value={progress}
          label="Uploading files"
          showPercentage
          animated
        />
      )}

      {isProcessing && (
        <div className="flex items-center gap-2">
          <LoadingSpinner size="sm" />
          <span className="text-sm text-muted-foreground">
            Processing uploaded files...
          </span>
        </div>
      )}
    </div>
  );
}
```

### With React Suspense

```tsx
import { Suspense, lazy } from 'react';
import { TaskListSkeleton } from '@/shared/components/ui/loading';

const TaskList = lazy(() => import('./TaskList'));

function TasksTab() {
  return (
    <Suspense fallback={<TaskListSkeleton count={10} />}>
      <TaskList />
    </Suspense>
  );
}
```

### Modal with Loading Overlay

```tsx
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { LoadingOverlay } from '@/shared/components/ui/loading';

function ConfirmDialog({ open, onConfirm }) {
  const [isProcessing, setIsProcessing] = useState(false);

  return (
    <Dialog open={open}>
      <DialogContent className="relative">
        <LoadingOverlay visible={isProcessing} label="Processing..." />

        {/* Dialog content */}
        <DialogActions>
          <Button onClick={onConfirm} disabled={isProcessing}>
            Confirm
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
```

## Best Practices

### 1. Match Loading State to Content

Use skeleton loaders that match your actual content structure:

```tsx
// Good: Skeleton matches actual content
{
  isLoading ? <TaskListSkeleton count={5} /> : <TaskList tasks={tasks} />;
}

// Avoid: Generic spinner for complex content
{
  isLoading ? <LoadingSpinner centered /> : <ComplexDashboard data={data} />;
}
```

### 2. Provide Context

Always provide context about what's loading:

```tsx
// Good: User knows what's happening
<LoadingSpinner label="Loading repository data..." />
<ProgressBar value={75} label="Analyzing codebase" showPercentage />

// Avoid: No context
<LoadingSpinner />
```

### 3. Use Suspense Boundaries

Wrap lazy-loaded components with appropriate loading states:

```tsx
<Suspense fallback={<DashboardGridSkeleton columns={3} rows={2} />}>
  <DashboardStats />
</Suspense>
```

### 4. Disable Interactions During Loading

Prevent user actions while loading:

```tsx
<Button disabled={isLoading}>
  {isLoading ? (
    <>
      <LoadingSpinner size="sm" className="mr-2" />
      Saving...
    </>
  ) : (
    'Save'
  )}
</Button>
```

### 5. Show Progress for Long Operations

Use determinate progress when possible:

```tsx
// Good: Shows actual progress
<ProgressBar value={progress} label="Uploading" showPercentage />

// Only use indeterminate when you can't track progress
<IndeterminateProgress label="Processing..." />
```

### 6. Respect Loading Prop Pattern

Components should accept a `loading` prop:

```tsx
export function DataCard({ data, loading }: DataCardProps) {
  if (loading) {
    return <StatCardSkeleton />;
  }

  return <StatCard {...data} />;
}
```

### 7. Avoid Over-Animation

Don't show loading states for very fast operations (<200ms):

```tsx
const [showLoading, setShowLoading] = useState(false);

useEffect(() => {
  const timer = setTimeout(() => {
    if (isLoading) {
      setShowLoading(true);
    }
  }, 200);

  return () => clearTimeout(timer);
}, [isLoading]);

// Only show skeleton after 200ms
{
  showLoading && <TaskListSkeleton />;
}
```

## Animation System

All loading components use the animation system defined in:

- `/src/shared/styles/animations.css` - Core animation keyframes
- `/tailwind.config.ts` - Tailwind animation utilities

### Available Animations

- `animate-pulse` - Standard pulse animation
- `animate-spin` - Rotation animation (spinners)
- `animate-shimmer` - Shimmer effect (progress bars)
- `animate-indeterminate` - Moving bar animation
- `skeleton-shimmer` - Subtle shimmer for skeletons

### Accessibility

All animations respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

This ensures users who prefer reduced motion get a better experience.
