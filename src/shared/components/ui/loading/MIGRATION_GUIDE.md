# Loading States - Migration Guide

How to add loading states to existing components.

## 🎯 Overview

This guide shows how to add loading states to your existing components with minimal changes.

## 📋 Quick Checklist

- [ ] Import the appropriate loading component
- [ ] Add loading state to your component
- [ ] Show skeleton during loading
- [ ] Test with throttled network (DevTools)
- [ ] Verify accessibility (keyboard, screen readers)

## 🔄 Migration Patterns

### Pattern 1: Simple Component → With Skeleton

**Before:**

```tsx
function TaskList() {
  const { data } = useGetTasksQuery();

  return (
    <div>
      {data?.tasks.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </div>
  );
}
```

**After:**

```tsx
import { TaskListSkeleton } from '@/shared/components/ui/loading';

function TaskList() {
  const { data, isLoading } = useGetTasksQuery(); // ✨ Add isLoading

  // ✨ Add loading check
  if (isLoading) {
    return <TaskListSkeleton count={5} />;
  }

  return (
    <div>
      {data?.tasks.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </div>
  );
}
```

**Changes:**

1. Import `TaskListSkeleton`
2. Destructure `isLoading` from query
3. Add early return with skeleton

---

### Pattern 2: Dashboard Cards → With Loading Prop

**Before:**

```tsx
function DashboardStats() {
  const { data } = useGetStatsQuery();

  return (
    <div className="grid grid-cols-3 gap-4">
      <StatCard
        icon={<CheckIcon />}
        value={data?.completed ?? 0}
        label="Completed"
      />
    </div>
  );
}
```

**After:**

```tsx
function DashboardStats() {
  const { data, isLoading } = useGetStatsQuery(); // ✨ Add isLoading

  return (
    <div className="grid grid-cols-3 gap-4">
      <StatCard
        loading={isLoading} // ✨ Add loading prop
        icon={<CheckIcon />}
        value={data?.completed ?? 0}
        label="Completed"
      />
    </div>
  );
}
```

**Changes:**

1. Destructure `isLoading`
2. Add `loading={isLoading}` prop to StatCard

---

### Pattern 3: Button → LoadingButton

**Before:**

```tsx
function SettingsForm() {
  const [isSaving, setIsSaving] = useState(false);

  return (
    <Button onClick={handleSave} disabled={isSaving}>
      {isSaving ? 'Saving...' : 'Save Changes'}
    </Button>
  );
}
```

**After:**

```tsx
import { LoadingButton } from '@/shared/components/ui/loading-button'; // ✨ Import

function SettingsForm() {
  const [isSaving, setIsSaving] = useState(false);

  return (
    <LoadingButton // ✨ Use LoadingButton
      onClick={handleSave}
      loading={isSaving} // ✨ Use loading prop
      loadingText="Saving..." // ✨ Optional custom text
    >
      Save Changes
    </LoadingButton>
  );
}
```

**Changes:**

1. Import `LoadingButton`
2. Replace `Button` with `LoadingButton`
3. Use `loading` prop instead of `disabled`
4. Remove conditional text rendering
5. Optional: Add `loadingText` prop

---

### Pattern 4: Modal/Dialog → With LoadingOverlay

**Before:**

```tsx
function EditDialog({ open }) {
  const [isSaving, setIsSaving] = useState(false);

  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
        </DialogHeader>
        <form>
          {/* Form fields */}
          <Button onClick={handleSave} disabled={isSaving}>
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**After:**

```tsx
import { LoadingOverlay } from '@/shared/components/ui/loading'; // ✨ Import
import { LoadingButton } from '@/shared/components/ui/loading-button';

function EditDialog({ open }) {
  const [isSaving, setIsSaving] = useState(false);

  return (
    <Dialog open={open}>
      <DialogContent className="relative">
        {' '}
        {/* ✨ Add relative */}
        <LoadingOverlay // ✨ Add overlay
          visible={isSaving}
          label="Saving changes..."
        />
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
        </DialogHeader>
        <form>
          {/* Form fields */}
          <LoadingButton // ✨ Use LoadingButton
            onClick={handleSave}
            loading={isSaving}
          >
            Save
          </LoadingButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Changes:**

1. Import `LoadingOverlay` and `LoadingButton`
2. Add `className="relative"` to DialogContent
3. Add `LoadingOverlay` as first child
4. Replace Button with LoadingButton

---

### Pattern 5: Lazy Component → With Suspense

**Before:**

```tsx
import { lazy } from 'react';

const TaskList = lazy(() => import('./TaskList'));

function TasksTab() {
  return <TaskList />;
}
```

**After:**

```tsx
import { lazy } from 'react';
import { SuspenseTaskList } from '@/shared/components/ui/suspense-wrapper'; // ✨ Import

const TaskList = lazy(() => import('./TaskList'));

function TasksTab() {
  return (
    <SuspenseTaskList count={5}>
      {' '}
      {/* ✨ Wrap with Suspense */}
      <TaskList />
    </SuspenseTaskList>
  );
}
```

**Changes:**

1. Import `SuspenseTaskList`
2. Wrap lazy component with `SuspenseTaskList`
3. Specify skeleton `count` if needed

---

### Pattern 6: File Upload → With Progress

**Before:**

```tsx
function FileUploader() {
  const handleUpload = async (files: FileList) => {
    await uploadFiles(files);
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files)} />
    </div>
  );
}
```

**After:**

```tsx
import { ProgressBar } from '@/shared/components/ui/loading'; // ✨ Import

function FileUploader() {
  const [progress, setProgress] = useState(0); // ✨ Add state
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (files: FileList) => {
    setIsUploading(true);
    setProgress(0);

    // ✨ Update progress during upload
    await uploadFiles(files, (p) => setProgress(p));

    setIsUploading(false);
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        onChange={(e) => handleUpload(e.target.files)}
        disabled={isUploading} // ✨ Disable during upload
      />

      {isUploading && ( // ✨ Show progress bar
        <ProgressBar
          value={progress}
          label="Uploading files"
          showPercentage
          animated
        />
      )}
    </div>
  );
}
```

**Changes:**

1. Import `ProgressBar`
2. Add `progress` and `isUploading` state
3. Update progress in upload callback
4. Show `ProgressBar` when uploading
5. Disable input during upload

---

### Pattern 7: Table → With TableSkeleton

**Before:**

```tsx
function DataTable() {
  const { data } = useGetDataQuery();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data?.items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{item.name}</TableCell>
            <TableCell>{item.status}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

**After:**

```tsx
import { TableSkeleton } from '@/shared/components/ui/loading'; // ✨ Import

function DataTable() {
  const { data, isLoading } = useGetDataQuery(); // ✨ Add isLoading

  // ✨ Add loading check
  if (isLoading) {
    return <TableSkeleton columns={2} rows={5} showHeader />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data?.items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{item.name}</TableCell>
            <TableCell>{item.status}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

**Changes:**

1. Import `TableSkeleton`
2. Add `isLoading` from query
3. Return `TableSkeleton` when loading
4. Match column count to actual table

---

## 🎨 Component-Specific Guides

### Migrating: Repository List

```tsx
// Before
function RepositoryList() {
  const { data } = useGetRepositoriesQuery();
  return <div>{data?.repos.map(...)}</div>;
}

// After
import { RepositorySelectorSkeleton } from '@/shared/components/ui/loading';

function RepositoryList() {
  const { data, isLoading } = useGetRepositoriesQuery();

  if (isLoading) {
    return <RepositorySelectorSkeleton />;
  }

  return <div>{data?.repos.map(...)}</div>;
}
```

### Migrating: Session Summary

```tsx
// Before
function SessionSummary() {
  const { data } = useGetSessionQuery();
  return <div>{/* Summary content */}</div>;
}

// After
import { SessionSummarySkeleton } from '@/shared/components/ui/loading';

function SessionSummary() {
  const { data, isLoading } = useGetSessionQuery();

  if (isLoading) {
    return <SessionSummarySkeleton />;
  }

  return <div>{/* Summary content */}</div>;
}
```

### Migrating: QA Gates Config

```tsx
// Before
function QAGatesConfig() {
  const { data } = useGetQAGatesQuery();
  return <div>{/* Config UI */}</div>;
}

// After
import { QAGatesConfigSkeleton } from '@/shared/components/ui/loading';

function QAGatesConfig() {
  const { data, isLoading } = useGetQAGatesQuery();

  if (isLoading) {
    return <QAGatesConfigSkeleton />;
  }

  return <div>{/* Config UI */}</div>;
}
```

---

## 🚀 Advanced Patterns

### Delayed Loading (Prevent Flashing)

```tsx
function useDelayedLoading(isLoading: boolean, delay = 300) {
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowLoading(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [isLoading, delay]);

  return showLoading;
}

// Usage
function MyComponent() {
  const { data, isLoading } = useQuery();
  const showSkeleton = useDelayedLoading(isLoading);

  if (showSkeleton) {
    return <ComponentSkeleton />;
  }

  return <ActualComponent data={data} />;
}
```

### Optimistic Updates with Loading

```tsx
function TaskItem({ task }) {
  const [updateTask, { isLoading }] = useUpdateTaskMutation();

  const handleToggle = async () => {
    // Optimistic update
    await updateTask({ id: task.id, completed: !task.completed });
  };

  return (
    <div className={isLoading ? 'opacity-50' : ''}>
      <LoadingButton
        variant="ghost"
        size="sm"
        loading={isLoading}
        onClick={handleToggle}
      >
        {task.completed ? 'Mark Incomplete' : 'Mark Complete'}
      </LoadingButton>
    </div>
  );
}
```

### Retry with Loading

```tsx
function DataDisplay() {
  const { data, isLoading, error, refetch } = useQuery();

  if (isLoading) {
    return <ComponentSkeleton />;
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="mb-4 text-error">Failed to load data</p>
        <LoadingButton onClick={() => refetch()} loading={isLoading}>
          Retry
        </LoadingButton>
      </div>
    );
  }

  return <ActualComponent data={data} />;
}
```

---

## ✅ Testing Your Migration

### 1. Test Loading States

```tsx
// In Chrome DevTools:
// 1. Open DevTools (F12)
// 2. Go to Network tab
// 3. Set throttling to "Slow 3G" or "Fast 3G"
// 4. Reload page
// 5. Verify skeletons appear correctly
```

### 2. Test Accessibility

```tsx
// 1. Turn on VoiceOver (Mac) or NVDA (Windows)
// 2. Navigate through loading states
// 3. Verify announcements make sense
// 4. Check keyboard navigation works
```

### 3. Test Reduced Motion

```tsx
// In Browser Settings:
// 1. Enable "prefers-reduced-motion"
// 2. Verify animations are minimal/disabled
// 3. Check functionality still works
```

---

## 📚 Resources

- **Component Documentation**: `/src/shared/components/ui/loading/README.md`
- **Code Examples**: `/src/shared/components/ui/loading/EXAMPLES.md`
- **Visual Guide**: `/src/shared/components/ui/loading/VISUAL_GUIDE.md`
- **Implementation Summary**: `/LOADING_STATES_IMPLEMENTATION.md`

---

## 🎯 Quick Reference

| Component Type  | Import             | Component                        |
| --------------- | ------------------ | -------------------------------- |
| Task List       | `loading`          | `TaskListSkeleton`               |
| Plan List       | `loading`          | `PlanListSkeleton`               |
| Dashboard Stats | `dashboard-cards`  | `StatCard` with `loading` prop   |
| Action Cards    | `dashboard-cards`  | `ActionCard` with `loading` prop |
| Tables          | `loading`          | `TableSkeleton`                  |
| Buttons         | `loading-button`   | `LoadingButton`                  |
| Modals          | `loading`          | `LoadingOverlay`                 |
| Progress        | `loading`          | `ProgressBar`                    |
| Lazy Components | `suspense-wrapper` | `SuspenseWrapper` variants       |

---

## 🐛 Common Issues

### Issue: Skeleton doesn't match content

**Solution:** Use a specialized skeleton or build a custom one with `Skeleton` components

### Issue: Loading flashes too quickly

**Solution:** Use delayed loading pattern (see Advanced Patterns)

### Issue: Button disabled but no visual feedback

**Solution:** Use `LoadingButton` instead of manually managing disabled state

### Issue: Suspense boundary too large

**Solution:** Move Suspense boundaries closer to lazy components for better UX

---

## 💡 Best Practices

1. ✅ **Match skeleton to content structure**
2. ✅ **Use specialized skeletons when available**
3. ✅ **Add loading labels for context**
4. ✅ **Disable interactions during loading**
5. ✅ **Show progress for long operations**
6. ✅ **Test with slow network**
7. ✅ **Verify accessibility**
8. ✅ **Use Suspense for code splitting**

---

## 🎉 You're Done!

Your component now has professional loading states. Users will see:

- Smooth skeleton animations during load
- Clear progress indicators
- Proper disabled states
- Accessible loading experience
