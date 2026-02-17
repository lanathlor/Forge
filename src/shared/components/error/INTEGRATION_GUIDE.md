# Error Handling Integration Guide

Step-by-step guide for integrating the error handling system into your components.

## Quick Start Checklist

- [ ] Wrap your app/page with `ErrorBoundary`
- [ ] Use `ErrorState` for data fetching failures
- [ ] Use `InlineError` for form validation
- [ ] Use `useErrorHandler` for async operations
- [ ] Use error toasts for transient action errors
- [ ] Add error reporting to critical sections

---

## 1. Wrap Your Application

Start by wrapping your application with error boundaries:

```tsx
// app/layout.tsx or app/page.tsx
import { ErrorBoundary } from '@/shared/components/error';

export default function RootLayout({ children }) {
  return (
    <ErrorBoundary
      id="app-root"
      showReport={true}
      showDetails={process.env.NODE_ENV === 'development'}
    >
      {children}
    </ErrorBoundary>
  );
}
```

---

## 2. Add Error Boundaries to Major Sections

Wrap major UI sections to prevent cascading failures:

```tsx
// components/DashboardLayout.tsx
import { ErrorBoundary } from '@/shared/components/error';

export function DashboardLayout() {
  return (
    <div>
      <ErrorBoundary id="header" size="sm">
        <Header />
      </ErrorBoundary>

      <ErrorBoundary id="main-content">
        <MainContent />
      </ErrorBoundary>

      <ErrorBoundary id="sidebar" size="sm">
        <Sidebar />
      </ErrorBoundary>
    </div>
  );
}
```

---

## 3. Handle Data Fetching Errors

### Option A: RTK Query with ErrorState

```tsx
import { useGetDataQuery } from '@/store/api';
import { NetworkError, ServerError } from '@/shared/components/error';

function DataList() {
  const { data, error, isLoading, refetch } = useGetDataQuery();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    // RTK Query errors have a 'status' field
    const isServerError = 'status' in error && error.status >= 500;

    return isServerError ? (
      <ServerError onRetry={() => refetch()} />
    ) : (
      <NetworkError onRetry={() => refetch()} />
    );
  }

  return <div>{/* render data */}</div>;
}
```

### Option B: React Query with ErrorState

```tsx
import { useQuery } from '@tanstack/react-query';
import { ErrorState } from '@/shared/components/error';

function UserProfile({ userId }: { userId: string }) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });

  if (isLoading) return <LoadingSpinner />;

  if (error) {
    return (
      <ErrorState
        type="network"
        title="Failed to load user profile"
        message={error.message}
        onRetry={() => refetch()}
      />
    );
  }

  return <div>{/* render user */}</div>;
}
```

### Option C: useErrorHandler Hook

```tsx
import { useState, useEffect } from 'react';
import { useErrorHandler, ErrorState } from '@/shared/components/error';

function DataComponent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { wrapAsync } = useErrorHandler();

  const fetchData = wrapAsync(
    async () => {
      const response = await fetch('/api/data');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setData(data);
      setError(null);
    },
    {
      showToast: true,
      onError: (err) => setError(err as Error),
      onSuccess: () => setLoading(false),
    }
  );

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState type="network" onRetry={fetchData} />;

  return <div>{/* render data */}</div>;
}
```

---

## 4. Handle Form Validation Errors

Use `InlineError` for field-level validation:

```tsx
import { useState } from 'react';
import { InlineError } from '@/shared/components/error';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    // Submit form...
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {errors.email && (
          <InlineError type="validation" message={errors.email} />
        )}
      </div>

      <div>
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {errors.password && (
          <InlineError type="validation" message={errors.password} />
        )}
      </div>

      <button type="submit">Login</button>
    </form>
  );
}
```

---

## 5. Handle Action Errors (Mutations)

Use error toasts for non-critical action errors:

```tsx
import { useToast } from '@/shared/components/ui/toast';
import { useErrorHandler } from '@/shared/components/error';

function DataManager() {
  const { addToast } = useToast();
  const { wrapAsync } = useErrorHandler();

  const saveData = wrapAsync(
    async () => {
      const response = await fetch('/api/data', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to save');
    },
    {
      showToast: true,
      message: 'Failed to save data',
      onSuccess: () => {
        addToast({
          title: 'Saved successfully',
          variant: 'success',
        });
      },
    }
  );

  const deleteData = wrapAsync(
    async (id: string) => {
      const response = await fetch(`/api/data/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
    },
    {
      showToast: true,
      message: 'Failed to delete data',
      onSuccess: () => {
        addToast({
          title: 'Deleted successfully',
          variant: 'success',
        });
      },
    }
  );

  return (
    <div>
      <button onClick={saveData}>Save</button>
      <button onClick={() => deleteData('123')}>Delete</button>
    </div>
  );
}
```

---

## 6. Handle Card/Widget Errors

Use `CardError` for errors in card components:

```tsx
import { CardError } from '@/shared/components/error';

function StatsCard() {
  const { data, error, refetch } = useGetStatsQuery();

  if (error) {
    return (
      <CardError
        type="server"
        title="Failed to load statistics"
        message="Unable to fetch the latest stats"
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Statistics</CardTitle>
      </CardHeader>
      <CardContent>{/* render stats */}</CardContent>
    </Card>
  );
}
```

---

## 7. Integration with Existing Components

### Before (without error handling):

```tsx
function MyComponent() {
  const { data, error } = useGetDataQuery();

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return <div>{/* render data */}</div>;
}
```

### After (with error handling):

```tsx
import { ErrorBoundary, NetworkError } from '@/shared/components/error';

function MyComponent() {
  const { data, error, refetch } = useGetDataQuery();

  if (error) {
    return <NetworkError onRetry={() => refetch()} />;
  }

  return <div>{/* render data */}</div>;
}

// Wrap with ErrorBoundary
export default function MyComponentWithBoundary() {
  return (
    <ErrorBoundary id="my-component">
      <MyComponent />
    </ErrorBoundary>
  );
}
```

---

## 8. Pattern: Combining Error Handling Strategies

```tsx
import {
  ErrorBoundary,
  ErrorState,
  useErrorHandler,
} from '@/shared/components/error';
import { useState, useEffect } from 'react';

function CompleteExample() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { wrapAsync } = useErrorHandler();

  // Data fetching with error handling
  const fetchData = wrapAsync(
    async () => {
      setLoading(true);
      const response = await fetch('/api/data');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setData(data);
      setError(null);
      setLoading(false);
    },
    {
      showToast: false, // Don't show toast, we have ErrorState
      onError: (err) => {
        setError(err as Error);
        setLoading(false);
      },
    }
  );

  // Action with toast notification
  const saveData = wrapAsync(
    async () => {
      const response = await fetch('/api/data', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to save');
    },
    {
      showToast: true, // Show toast for actions
      message: 'Failed to save data',
    }
  );

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <ErrorState type="network" message={error.message} onRetry={fetchData} />
    );
  }

  return (
    <div>
      {/* render data */}
      <button onClick={saveData}>Save</button>
    </div>
  );
}

// Wrap with ErrorBoundary to catch render errors
export default function CompleteExampleWithBoundary() {
  return (
    <ErrorBoundary id="complete-example" showReport={true}>
      <CompleteExample />
    </ErrorBoundary>
  );
}
```

---

## 9. Error Reporting Integration

Set up global error tracking:

```tsx
// app/layout.tsx or _app.tsx
import * as Sentry from '@sentry/react';

// Initialize Sentry or other error tracking
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

// Configure global error tracker for ErrorBoundary
if (typeof window !== 'undefined') {
  window.errorTracker = {
    logError: (error, context) => {
      Sentry.captureException(error, {
        extra: context,
      });
    },
  };
}

// Use ErrorBoundary with automatic reporting
export default function App() {
  return (
    <ErrorBoundary
      id="app"
      showReport={true}
      onError={(error, errorInfo) => {
        // Custom error handling
        console.error('App error:', error);

        // Report to analytics
        analytics.track('Error Occurred', {
          error: error.message,
          component: errorInfo.componentStack,
        });
      }}
    >
      <YourApp />
    </ErrorBoundary>
  );
}
```

---

## 10. Testing Error States

Test your error handling:

```tsx
import { render, screen } from '@testing-library/react';
import { NetworkError } from '@/shared/components/error';

describe('Error Handling', () => {
  it('shows network error with retry button', () => {
    const onRetry = jest.fn();

    render(<NetworkError onRetry={onRetry} />);

    expect(screen.getByText(/network error/i)).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /try again/i });
    retryButton.click();

    expect(onRetry).toHaveBeenCalled();
  });

  it('shows error state for failed data fetch', () => {
    const { container } = render(
      <ErrorState
        type="server"
        message="Failed to load data"
        onRetry={() => {}}
      />
    );

    expect(screen.getByText(/failed to load data/i)).toBeInTheDocument();
  });
});
```

---

## Common Patterns Summary

### ✅ DO

- Wrap major sections with `ErrorBoundary`
- Use `ErrorState` for data fetching failures
- Use `InlineError` for form validation
- Use error toasts for transient action errors
- Provide retry actions for recoverable errors
- Show error details in development mode
- Report errors to tracking services

### ❌ DON'T

- Don't show raw error messages to users
- Don't use toasts for critical errors (use `ErrorState`)
- Don't forget to provide retry actions
- Don't skip error boundaries on async components
- Don't ignore error reporting

---

## Troubleshooting

### Error boundary not catching errors

**Problem**: ErrorBoundary doesn't catch async errors
**Solution**: Use `useErrorHandler` hook for async operations

```tsx
const { wrapAsync } = useErrorHandler();
const fetchData = wrapAsync(async () => {
  // async code
});
```

### Toast not showing

**Problem**: Toast notification not appearing
**Solution**: Ensure `ToastProvider` is in your app:

```tsx
import { ToastProvider } from '@/shared/components/ui/toast';

export default function App() {
  return (
    <ToastProvider>
      <YourApp />
    </ToastProvider>
  );
}
```

### Error message not user-friendly

**Problem**: Technical error messages shown to users
**Solution**: Use custom error messages:

```tsx
<ErrorState
  type="network"
  message="We couldn't load your data. Please check your connection and try again."
  onRetry={refetch}
/>
```

---

## Next Steps

1. Start with wrapping your app in `ErrorBoundary`
2. Replace basic error displays with `ErrorState`
3. Add `InlineError` to forms
4. Use `useErrorHandler` for async operations
5. Integrate error reporting
6. Test error scenarios thoroughly

For more details, see [README.md](./README.md)
