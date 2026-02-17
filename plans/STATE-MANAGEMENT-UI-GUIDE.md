# State Management & UI Component Guide

This document provides comprehensive guidance on using RTK Query for API calls and shadcn/ui for UI components throughout the Autobot project.

---

## RTK Query Integration

### Philosophy

**Never use `fetch` directly in components.** All API calls should go through RTK Query for:

- Automatic caching and deduplication
- Loading and error state management
- Optimistic updates
- Cache invalidation
- Background refetching

### Setup (Already Configured)

The project includes:

- Redux store at `src/store/index.ts`
- RTK Query API at `src/store/api.ts`
- Provider wrapper at `src/app/providers.tsx`
- Custom hooks at `src/hooks/index.ts`

### Available RTK Query Hooks

```typescript
import {
  // Repositories
  useGetRepositoriesQuery,
  useRescanRepositoriesMutation,

  // Sessions
  useGetSessionsQuery,
  useGetSessionQuery,
  useCreateSessionMutation,
  useEndSessionMutation,
  usePauseSessionMutation,
  useResumeSessionMutation,

  // Tasks
  useCreateTaskMutation,
  useGetTaskQuery,
  useApproveTaskMutation,
  useCommitTaskMutation,
  useRejectTaskMutation,
  useCancelTaskMutation,
  useRegenerateCommitMessageMutation,

  // QA Gates
  useGetQAGatesQuery,
  useUpdateQAGateMutation,
  useRunQAGatesMutation,
} from '@/store/api';
```

---

## Component Patterns

### Pattern 1: Query Hook (Fetching Data)

```typescript
'use client';

import { useGetRepositoriesQuery } from '@/store/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function RepositoryList() {
  const { data, isLoading, isError, error } = useGetRepositoriesQuery();

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error: {error.toString()}</div>;

  return (
    <div>
      {data?.repositories.map(repo => (
        <Card key={repo.id}>
          <h3>{repo.name}</h3>
          <p>{repo.currentBranch}</p>
        </Card>
      ))}
    </div>
  );
}
```

**Key Points:**

- RTK Query provides `isLoading`, `isError`, `error` automatically
- Data is cached - subsequent renders use cached data
- Automatically refetches on window focus (configurable)

### Pattern 2: Mutation Hook (Creating/Updating Data)

```typescript
'use client';

import { useCreateTaskMutation } from '@/store/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

export function TaskPromptInput({ sessionId }: { sessionId: string }) {
  const [prompt, setPrompt] = useState('');
  const [createTask, { isLoading }] = useCreateTaskMutation();
  const { toast } = useToast();

  async function handleSubmit() {
    try {
      const result = await createTask({
        sessionId,
        prompt,
      }).unwrap(); // .unwrap() throws on error

      toast({
        title: 'Task created',
        description: `Task ${result.task.id} started`,
      });

      setPrompt('');
    } catch (error) {
      toast({
        title: 'Failed to create task',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="space-y-4">
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe what you want Claude to do..."
        rows={4}
      />
      <Button
        onClick={handleSubmit}
        disabled={!prompt.trim() || isLoading}
      >
        {isLoading ? 'Creating task...' : 'Submit Task'}
      </Button>
    </div>
  );
}
```

**Key Points:**

- Mutations return `[trigger, { isLoading, isError, error }]`
- Use `.unwrap()` to get the result or throw on error
- RTK Query automatically invalidates related caches
- Loading state is built-in

### Pattern 3: Optimistic Updates

```typescript
'use client';

import { useApproveTaskMutation, useGetTaskQuery } from '@/store/api';
import { Button } from '@/components/ui/button';

export function ApprovalButton({ taskId }: { taskId: string }) {
  const { data: task } = useGetTaskQuery(taskId);
  const [approveTask, { isLoading }] = useApproveTaskMutation();

  async function handleApprove() {
    try {
      await approveTask(taskId).unwrap();
      // RTK Query automatically updates the cache
      // Component re-renders with new data
    } catch (error) {
      console.error('Approval failed:', error);
    }
  }

  return (
    <Button
      onClick={handleApprove}
      disabled={isLoading || task?.status !== 'waiting_approval'}
    >
      {isLoading ? 'Approving...' : 'Approve Changes'}
    </Button>
  );
}
```

### Pattern 4: Polling (Real-time Updates)

```typescript
'use client';

import { useGetTaskQuery } from '@/store/api';

export function TaskStatus({ taskId }: { taskId: string }) {
  // Poll every 2 seconds while task is running
  const { data: task } = useGetTaskQuery(taskId, {
    pollingInterval: task?.status === 'running' ? 2000 : 0,
    skipPolling: !['running', 'qa_running'].includes(task?.status || ''),
  });

  return (
    <div>
      Status: {task?.status}
      {task?.status === 'running' && <span className="animate-pulse">...</span>}
    </div>
  );
}
```

### Pattern 5: Manual Refetch

```typescript
'use client';

import { useGetSessionQuery } from '@/store/api';
import { Button } from '@/components/ui/button';

export function SessionSummary({ sessionId }: { sessionId: string }) {
  const { data: session, refetch, isFetching } = useGetSessionQuery(sessionId);

  return (
    <div>
      <h2>Session: {session?.repository.name}</h2>
      <p>Tasks: {session?.tasks.length}</p>

      <Button onClick={() => refetch()} disabled={isFetching}>
        {isFetching ? 'Refreshing...' : 'Refresh'}
      </Button>
    </div>
  );
}
```

---

## shadcn/ui Component Usage

### Available Components

All components are in `src/components/ui/`:

- `button` - Buttons with variants
- `card` - Container cards
- `dialog` - Modals
- `textarea` - Text input
- `badge` - Status badges
- `select` - Dropdowns
- `tabs` - Tab navigation
- `toast` - Notifications
- And more...

### Component Examples

#### Button Variants

```typescript
import { Button } from '@/components/ui/button';

<Button>Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button disabled>Disabled</Button>
<Button loading>Loading...</Button>
```

#### Card Component

```typescript
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Task Execution</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Task is running...</p>
  </CardContent>
  <CardFooter>
    <Button>Cancel</Button>
  </CardFooter>
</Card>
```

#### Dialog (Modal)

```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useState } from 'react';

export function RejectModal({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);
  const [rejectTask] = useRejectTaskMutation();

  async function handleReject() {
    await rejectTask({ id: taskId, reason: 'Type errors' }).unwrap();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Changes</DialogTitle>
        </DialogHeader>

        <p>This will revert all changes. Are you sure?</p>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleReject}>
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### Tabs Component

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

<Tabs defaultValue="diff">
  <TabsList>
    <TabsTrigger value="diff">Diff</TabsTrigger>
    <TabsTrigger value="output">Output</TabsTrigger>
    <TabsTrigger value="qa">QA Results</TabsTrigger>
  </TabsList>

  <TabsContent value="diff">
    <DiffViewer taskId={taskId} />
  </TabsContent>

  <TabsContent value="output">
    <ClaudeOutput taskId={taskId} />
  </TabsContent>

  <TabsContent value="qa">
    <QAGateResults taskId={taskId} />
  </TabsContent>
</Tabs>
```

#### Toast Notifications

```typescript
import { useToast } from '@/components/ui/use-toast';

export function Example() {
  const { toast } = useToast();

  function showSuccess() {
    toast({
      title: 'Success',
      description: 'Task completed successfully',
    });
  }

  function showError() {
    toast({
      title: 'Error',
      description: 'Failed to execute task',
      variant: 'destructive',
    });
  }

  return <Button onClick={showSuccess}>Show Toast</Button>;
}
```

#### Badge for Status

```typescript
import { Badge } from '@/components/ui/badge';

function TaskStatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'secondary',
    running: 'default',
    completed: 'outline',
    failed: 'destructive',
  };

  return <Badge variant={variants[status]}>{status}</Badge>;
}
```

---

## Complete Component Example

Here's a full example combining RTK Query with shadcn/ui:

```typescript
'use client';

import { useState } from 'react';
import { useGetTaskQuery, useApproveTaskMutation, useRejectTaskMutation } from '@/store/api';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { DiffViewer } from './DiffViewer';
import { QAGateResults } from './QAGateResults';

export function TaskReviewPanel({ taskId }: { taskId: string }) {
  const { data: task, isLoading } = useGetTaskQuery(taskId);
  const [approveTask, { isLoading: isApproving }] = useApproveTaskMutation();
  const [rejectTask, { isLoading: isRejecting }] = useRejectTaskMutation();
  const { toast } = useToast();

  async function handleApprove() {
    try {
      await approveTask(taskId).unwrap();
      toast({
        title: 'Task approved',
        description: 'Generating commit message...',
      });
    } catch (error) {
      toast({
        title: 'Approval failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  async function handleReject() {
    try {
      await rejectTask({ id: taskId, reason: 'User rejected' }).unwrap();
      toast({
        title: 'Changes reverted',
        description: 'All changes have been undone',
      });
    } catch (error) {
      toast({
        title: 'Rejection failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  if (isLoading) {
    return <div>Loading task...</div>;
  }

  if (!task) {
    return <div>Task not found</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>{task.prompt}</CardTitle>
          <Badge>{task.status}</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="diff">
          <TabsList>
            <TabsTrigger value="diff">Changes</TabsTrigger>
            <TabsTrigger value="qa">QA Results</TabsTrigger>
          </TabsList>

          <TabsContent value="diff">
            <DiffViewer taskId={taskId} />
          </TabsContent>

          <TabsContent value="qa">
            <QAGateResults taskId={taskId} />
          </TabsContent>
        </Tabs>
      </CardContent>

      {task.status === 'waiting_approval' && (
        <CardFooter className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isRejecting}
          >
            {isRejecting ? 'Rejecting...' : 'Reject & Revert'}
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isApproving}
          >
            {isApproving ? 'Approving...' : 'Approve Changes'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
```

---

## Best Practices

### RTK Query

1. **Always use hooks, never fetch directly**

   ```typescript
   // ❌ Bad
   const data = await fetch('/api/tasks');

   // ✅ Good
   const { data } = useGetTaskQuery(taskId);
   ```

2. **Use `.unwrap()` in mutation handlers**

   ```typescript
   // ✅ Good
   try {
     const result = await createTask(data).unwrap();
   } catch (error) {
     // Handle error
   }
   ```

3. **Leverage automatic cache invalidation**
   - Mutations automatically invalidate related queries
   - No manual cache management needed

4. **Use polling for long-running tasks**
   ```typescript
   const { data } = useGetTaskQuery(id, {
     pollingInterval: 2000, // Poll every 2 seconds
   });
   ```

### shadcn/ui

1. **Use semantic variants**

   ```typescript
   <Button variant="destructive">Delete</Button>
   <Badge variant="secondary">Pending</Badge>
   ```

2. **Compose components**

   ```typescript
   <Card>
     <CardHeader>
       <CardTitle>Title</CardTitle>
     </CardHeader>
     <CardContent>Content</CardContent>
   </Card>
   ```

3. **Use toasts for notifications**
   - Success, errors, info
   - Better UX than alerts

4. **Leverage built-in accessibility**
   - All components are accessible by default
   - Keyboard navigation included

---

## Migration Guide

If you see old code using `fetch`, replace it:

### Before (fetch)

```typescript
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);

useEffect(() => {
  setLoading(true);
  fetch('/api/tasks')
    .then((res) => res.json())
    .then((data) => setData(data))
    .finally(() => setLoading(false));
}, []);
```

### After (RTK Query)

```typescript
const { data, isLoading } = useGetTasksQuery();
```

That's it! RTK Query handles everything.

---

## Adding New Endpoints

When you need a new API endpoint:

1. **Add it to `src/store/api.ts`**:

   ```typescript
   export const api = createApi({
     // ... existing code
     endpoints: (builder) => ({
       // ... existing endpoints

       getTaskDiff: builder.query({
         query: (taskId) => `/tasks/${taskId}/diff`,
         providesTags: (result, error, taskId) => [
           { type: 'Task', id: taskId },
         ],
       }),
     }),
   });
   ```

2. **Export the hook**:

   ```typescript
   export const { useGetTaskDiffQuery } = api;
   ```

3. **Use it in components**:
   ```typescript
   const { data: diff } = useGetTaskDiffQuery(taskId);
   ```

---

## Summary

- **RTK Query**: All API calls, automatic caching, loading states
- **shadcn/ui**: All UI components, consistent design, accessible
- **Never use fetch directly**: Always use RTK Query hooks
- **Leverage built-in features**: Loading states, error handling, caching

This approach gives you a fast, maintainable, type-safe application with minimal boilerplate.
