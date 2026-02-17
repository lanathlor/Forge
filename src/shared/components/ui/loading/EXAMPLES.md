# Loading States - Real-World Examples

This document provides practical, copy-paste examples for common loading state patterns.

## Table of Contents

1. [Data Fetching](#data-fetching)
2. [Form Submissions](#form-submissions)
3. [File Operations](#file-operations)
4. [Dashboard Cards](#dashboard-cards)
5. [Lists and Tables](#lists-and-tables)
6. [Modals and Dialogs](#modals-and-dialogs)
7. [Lazy Loading](#lazy-loading)

---

## Data Fetching

### Basic List with Loading

```tsx
import { TaskListSkeleton } from '@/shared/components/ui/loading';
import { useGetTasksQuery } from '@/features/tasks/store/tasksApi';

export function TaskList() {
  const { data, isLoading, error } = useGetTasksQuery();

  if (isLoading) {
    return <TaskListSkeleton count={5} />;
  }

  if (error) {
    return (
      <div className="py-8 text-center text-error">
        Failed to load tasks. Please try again.
      </div>
    );
  }

  if (!data?.tasks.length) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No tasks found.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.tasks.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </div>
  );
}
```

### Dashboard Stats with Skeleton

```tsx
import { StatCard } from '@/shared/components/ui/dashboard-cards';
import { useGetDashboardStatsQuery } from '@/features/dashboard/store/dashboardApi';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export function DashboardStats() {
  const { data, isLoading } = useGetDashboardStatsQuery();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <StatCard
        loading={isLoading}
        icon={<CheckCircle className="h-5 w-5" />}
        value={data?.completed ?? 0}
        label="Completed Tasks"
        variant="success"
        trend={{
          value: '+12%',
          direction: 'up',
          label: 'vs last week',
        }}
      />

      <StatCard
        loading={isLoading}
        icon={<Clock className="h-5 w-5" />}
        value={data?.pending ?? 0}
        label="Pending Tasks"
        variant="primary"
      />

      <StatCard
        loading={isLoading}
        icon={<AlertTriangle className="h-5 w-5" />}
        value={data?.failed ?? 0}
        label="Failed Tasks"
        variant="error"
        trend={{
          value: '-5%',
          direction: 'down',
          label: 'vs last week',
        }}
      />
    </div>
  );
}
```

### Delayed Loading Skeleton (Avoid Flashing)

```tsx
import { useState, useEffect } from 'react';
import { PlanListSkeleton } from '@/shared/components/ui/loading';

export function PlanList() {
  const { data, isLoading } = useGetPlansQuery();
  const [showSkeleton, setShowSkeleton] = useState(false);

  // Only show skeleton if loading takes longer than 300ms
  useEffect(() => {
    if (!isLoading) {
      setShowSkeleton(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowSkeleton(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [isLoading]);

  if (isLoading && showSkeleton) {
    return <PlanListSkeleton count={3} />;
  }

  if (isLoading && !showSkeleton) {
    return null; // Don't show anything for fast loads
  }

  return (
    <div className="space-y-4">
      {data?.plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}
```

---

## Form Submissions

### Save Button with Loading

```tsx
import { useState } from 'react';
import { LoadingButton } from '@/shared/components/ui/loading-button';
import { useToast } from '@/shared/hooks/use-toast';

export function SettingsForm() {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (data: FormData) => {
    setIsSaving(true);
    try {
      await saveSettings(data);
      toast({
        title: 'Settings saved',
        description: 'Your changes have been saved successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}

      <div className="flex gap-2">
        <LoadingButton type="submit" loading={isSaving} loadingText="Saving...">
          Save Changes
        </LoadingButton>

        <Button type="button" variant="outline">
          Cancel
        </Button>
      </div>
    </form>
  );
}
```

### Delete Confirmation with Loading

```tsx
import { useState } from 'react';
import { LoadingButton } from '@/shared/components/ui/loading-button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';

export function DeleteTaskDialog({ taskId, open, onOpenChange }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteTask(taskId);
      onOpenChange(false);
    } catch (error) {
      // Handle error
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the task.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <LoadingButton
            variant="destructive"
            loading={isDeleting}
            loadingText="Deleting..."
            onClick={handleDelete}
          >
            Delete
          </LoadingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

## File Operations

### File Upload with Progress

```tsx
import { useState } from 'react';
import { ProgressBar, LoadingSpinner } from '@/shared/components/ui/loading';
import { Upload } from 'lucide-react';

export function FileUploader() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (files: FileList) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        setUploadProgress(i);
      }

      setIsUploading(false);
      setIsProcessing(true);

      // Process files
      await processFiles(files);
    } catch (error) {
      // Handle error
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border-2 border-dashed p-8 text-center">
        <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <input
          type="file"
          multiple
          onChange={(e) => e.target.files && handleUpload(e.target.files)}
          disabled={isUploading || isProcessing}
        />
      </div>

      {isUploading && (
        <ProgressBar
          value={uploadProgress}
          label="Uploading files"
          showPercentage
          variant="primary"
          animated
        />
      )}

      {isProcessing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoadingSpinner size="sm" />
          <span>Processing uploaded files...</span>
        </div>
      )}
    </div>
  );
}
```

### Export with Indeterminate Progress

```tsx
import { useState } from 'react';
import {
  IndeterminateProgress,
  LoadingButton,
} from '@/shared/components/ui/loading';
import { Download } from 'lucide-react';

export function ExportData() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await generateExport();
      downloadFile(data);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <LoadingButton
        loading={isExporting}
        loadingText="Exporting..."
        onClick={handleExport}
      >
        <Download className="mr-2 h-4 w-4" />
        Export Data
      </LoadingButton>

      {isExporting && (
        <IndeterminateProgress
          label="Preparing your export..."
          variant="primary"
        />
      )}
    </div>
  );
}
```

---

## Dashboard Cards

### Action Card with Loading

```tsx
import { ActionCard } from '@/shared/components/ui/dashboard-cards';
import { Zap } from 'lucide-react';

export function QuickActions() {
  const { data, isLoading } = useGetQuickActionsQuery();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <ActionCard
        loading={isLoading}
        icon={<Zap className="h-6 w-6" />}
        title="Create New Task"
        description="Start a new task for this repository"
        variant="primary"
        action={{
          label: 'Create Task',
          onClick: () => handleCreateTask(),
        }}
      />

      <ActionCard
        loading={isLoading}
        icon={<Settings className="h-6 w-6" />}
        title="Configure QA Gates"
        description="Set up quality checks for your workflow"
        action={{
          label: 'Configure',
          href: '/settings/qa-gates',
        }}
      />
    </div>
  );
}
```

---

## Lists and Tables

### Table with Loading

```tsx
import { TableSkeleton } from '@/shared/components/ui/loading';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

export function TaskTable() {
  const { data, isLoading } = useGetTasksQuery();

  if (isLoading) {
    return <TableSkeleton columns={4} rows={5} showHeader />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Assignee</TableHead>
          <TableHead>Due Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data?.tasks.map((task) => (
          <TableRow key={task.id}>
            <TableCell>{task.title}</TableCell>
            <TableCell>{task.status}</TableCell>
            <TableCell>{task.assignee}</TableCell>
            <TableCell>{task.dueDate}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### Infinite Scroll List with Loading

```tsx
import { useInfiniteQuery } from '@tanstack/react-query';
import { LoadingSpinner } from '@/shared/components/ui/loading';
import { TaskListSkeleton } from '@/shared/components/ui/loading';

export function InfiniteTaskList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['tasks'],
      queryFn: ({ pageParam = 0 }) => fetchTasks(pageParam),
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    });

  if (isLoading) {
    return <TaskListSkeleton count={10} />;
  }

  return (
    <div className="space-y-2">
      {data?.pages.map((page) =>
        page.tasks.map((task) => <TaskItem key={task.id} task={task} />)
      )}

      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <LoadingSpinner size="sm" label="Loading more..." />
        </div>
      )}

      {hasNextPage && !isFetchingNextPage && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => fetchNextPage()}
        >
          Load More
        </Button>
      )}
    </div>
  );
}
```

---

## Modals and Dialogs

### Modal with Loading Overlay

```tsx
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { LoadingOverlay } from '@/shared/components/ui/loading';
import { LoadingButton } from '@/shared/components/ui/loading-button';

export function CreatePlanDialog({ open, onOpenChange }) {
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (data) => {
    setIsCreating(true);
    try {
      await createPlan(data);
      onOpenChange(false);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="relative">
        <LoadingOverlay visible={isCreating} label="Creating plan..." />

        <DialogHeader>
          <DialogTitle>Create New Plan</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreate}>
          {/* Form fields */}

          <div className="mt-4 flex gap-2">
            <LoadingButton type="submit" loading={isCreating}>
              Create Plan
            </LoadingButton>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Lazy Loading

### Basic Lazy Component with Suspense

```tsx
import { lazy } from 'react';
import { SuspenseSpinner } from '@/shared/components/ui/suspense-wrapper';

const TaskList = lazy(() => import('./TaskList'));

export function TasksTab() {
  return (
    <SuspenseSpinner message="Loading tasks...">
      <TaskList />
    </SuspenseSpinner>
  );
}
```

### Dashboard with Multiple Lazy Sections

```tsx
import { lazy } from 'react';
import {
  SuspenseDashboard,
  SuspenseTaskList,
  SuspensePlanList,
} from '@/shared/components/ui/suspense-wrapper';

const DashboardStats = lazy(() => import('./DashboardStats'));
const RecentTasks = lazy(() => import('./RecentTasks'));
const ActivePlans = lazy(() => import('./ActivePlans'));

export function Dashboard() {
  return (
    <div className="space-y-6">
      <SuspenseDashboard>
        <DashboardStats />
      </SuspenseDashboard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SuspenseTaskList count={5}>
          <RecentTasks />
        </SuspenseTaskList>

        <SuspensePlanList count={3}>
          <ActivePlans />
        </SuspensePlanList>
      </div>
    </div>
  );
}
```

### Route-Based Lazy Loading

```tsx
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { DashboardGridSkeleton } from '@/shared/components/ui/loading';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Plans = lazy(() => import('./pages/Plans'));
const Settings = lazy(() => import('./pages/Settings'));

export function AppRoutes() {
  return (
    <Suspense fallback={<DashboardGridSkeleton columns={3} rows={2} />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

---

## Tips for Effective Loading States

1. **Match the skeleton to your content** - Users should recognize what's loading
2. **Delay showing skeletons** - Avoid flashing for fast operations (<300ms)
3. **Provide context** - Always tell users what's happening
4. **Disable interactions** - Prevent actions during loading
5. **Show progress when possible** - Use determinate progress bars
6. **Respect reduced motion** - All animations handle `prefers-reduced-motion`
7. **Use Suspense boundaries** - Isolate loading states to prevent cascading
8. **Test slow connections** - Throttle network in DevTools to test UX
