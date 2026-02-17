# Error Handling System

Comprehensive error handling system for the autobot application with error boundaries, error states, toast notifications, and error handling utilities.

## Table of Contents

- [Error Boundaries](#error-boundaries)
- [Error State Components](#error-state-components)
- [Error Toast Notifications](#error-toast-notifications)
- [Error Handler Hook](#error-handler-hook)
- [Usage Patterns](#usage-patterns)
- [Best Practices](#best-practices)

---

## Error Boundaries

Error boundaries catch JavaScript errors in component trees and display fallback UI.

### Basic ErrorBoundary

```tsx
import { ErrorBoundary } from '@/shared/components/error';

<ErrorBoundary id="user-profile">
  <UserProfile />
</ErrorBoundary>;
```

**Props:**

- `id`: Unique identifier for debugging
- `children`: Child components to protect
- `fallback`: Custom fallback UI
- `onError`: Callback when error is caught
- `showReport`: Show "Report Issue" button (default: true)
- `showDetails`: Show error stack trace (default: false)
- `errorTitle`: Custom error title
- `size`: Size of error UI ('sm', 'md', 'lg')

### Features

✅ **Friendly Error UI** - User-friendly error messages with retry button
✅ **Error Reporting** - One-click GitHub issue creation
✅ **Copy to Clipboard** - Copy error details for debugging
✅ **Automatic Logging** - Logs errors to console and error tracking
✅ **Customizable** - Custom fallback UI and error handlers

### With Custom Fallback

```tsx
<ErrorBoundary
  id="critical-section"
  fallback={
    <div className="p-4 text-red-600">
      Critical error occurred. Please contact support.
    </div>
  }
>
  <CriticalComponent />
</ErrorBoundary>
```

### With Error Handler

```tsx
<ErrorBoundary
  id="analytics-dashboard"
  onError={(error, errorInfo) => {
    // Send to error tracking service
    trackError(error, {
      component: 'analytics-dashboard',
      stack: errorInfo.componentStack,
    });
  }}
  showDetails={process.env.NODE_ENV === 'development'}
>
  <AnalyticsDashboard />
</ErrorBoundary>
```

### Higher-Order Component

Wrap components with error boundaries using HOC:

```tsx
import { withErrorBoundary } from '@/shared/components/error';

const SafeUserProfile = withErrorBoundary(UserProfile, {
  id: 'user-profile',
  errorTitle: 'Failed to load user profile',
  onError: (error) => logError(error),
});

// Use it
<SafeUserProfile userId="123" />;
```

### Create Custom Wrapper

```tsx
import { createErrorBoundaryWrapper } from '@/shared/components/error';

const createSafeComponent = createErrorBoundaryWrapper({
  showReport: true,
  showDetails: true,
  onError: (error) => trackError(error),
});

const SafeComponent1 = createSafeComponent(Component1, { id: 'component-1' });
const SafeComponent2 = createSafeComponent(Component2, { id: 'component-2' });
```

---

## Error State Components

Display friendly error messages for failed operations.

### ErrorState

Generic error state component with retry and report actions:

```tsx
import { ErrorState } from '@/shared/components/error';

<ErrorState
  type="network"
  message="Failed to connect to the server"
  onRetry={() => refetch()}
  showRetry={true}
  showReport={true}
  size="md"
/>;
```

**Props:**

- `type`: Error type (see Error Types below)
- `title`: Custom title (auto-generated if not provided)
- `message`: Error message
- `onRetry`: Retry callback
- `onReport`: Custom report callback
- `action`: Additional action button `{ label: string, onClick: () => void }`
- `showRetry`: Show retry button (default: true)
- `showReport`: Show report button (default: true)
- `size`: Size variant ('sm', 'md', 'lg')
- `className`: Additional CSS classes

### Convenience Components

Pre-configured error state components:

```tsx
import {
  NetworkError,
  TimeoutError,
  NotFoundError,
  ValidationError,
  ServerError,
  UnauthorizedError,
  ForbiddenError,
} from '@/shared/components/error';

// Network Error
<NetworkError onRetry={() => refetch()} />

// Timeout Error
<TimeoutError message="Request took too long" />

// Not Found
<NotFoundError message="User not found" />

// Validation Error
<ValidationError message="Invalid email format" />

// Server Error
<ServerError onRetry={() => refetch()} />

// Unauthorized
<UnauthorizedError
  action={{ label: 'Login', onClick: () => router.push('/login') }}
/>

// Forbidden
<ForbiddenError message="You don't have access to this resource" />
```

### InlineError

Compact error for inline use (forms, small sections):

```tsx
import { InlineError } from '@/shared/components/error';

<InlineError
  type="validation"
  message="Email is required"
  onRetry={() => validateForm()}
/>;
```

### CardError

Error state for card components:

```tsx
import { CardError } from '@/shared/components/error';

<CardError
  type="server"
  title="Failed to Load"
  message="Unable to fetch statistics"
  onRetry={() => refetch()}
/>;
```

---

## Error Toast Notifications

Transient error notifications for non-critical errors.

### useErrorToast Hook

```tsx
import { useToast } from '@/shared/components/ui/toast';
import { useErrorToast } from '@/shared/components/error';

function MyComponent() {
  const { addToast } = useToast();
  const showError = useErrorToast(addToast);

  const handleFetch = async () => {
    try {
      await fetchData();
    } catch (error) {
      // Auto-format and show error toast
      showError.fromError(error, handleFetch);
    }
  };

  // Specific error types
  showError.network('Connection lost', handleFetch);
  showError.timeout();
  showError.validation('Invalid email format');
  showError.server('Server error occurred', handleFetch);
}
```

### Error Toast Helpers

```tsx
import { useToast } from '@/shared/components/ui/toast';
import { errorToastHelpers } from '@/shared/components/error';

function MyComponent() {
  const { addToast } = useToast();

  errorToastHelpers.network(addToast, 'Failed to connect', retry);
  errorToastHelpers.timeout(addToast);
  errorToastHelpers.validation(addToast, 'Invalid input');
  errorToastHelpers.server(addToast);
  errorToastHelpers.fromError(addToast, error, retry);
}
```

---

## Error Handler Hook

Consistent error handling with automatic toast notifications.

### useErrorHandler

```tsx
import { useErrorHandler } from '@/shared/components/error';

function MyComponent() {
  const { handleError, wrapAsync, wrapSync } = useErrorHandler();

  // Manual error handling
  const handleManualError = (error: unknown) => {
    handleError(error, {
      showToast: true,
      message: 'Failed to save data',
      onRetry: () => save(),
      onError: (err) => console.error('Custom handler:', err),
    });
  };

  // Wrap async function
  const fetchData = wrapAsync(
    async () => {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    {
      showToast: true,
      message: 'Failed to fetch data',
      onSuccess: (data) => console.log('Fetched:', data),
      onError: (error) => console.error('Error:', error),
    }
  );

  // Wrap sync function
  const parseData = wrapSync(() => JSON.parse(rawData), {
    showToast: true,
    message: 'Failed to parse data',
  });

  // Usage
  const handleClick = async () => {
    const data = await fetchData();
    if (data) {
      const parsed = parseData();
    }
  };

  return <button onClick={handleClick}>Fetch Data</button>;
}
```

### createSafeAsync

Create reusable safe async functions:

```tsx
import { createSafeAsync } from '@/shared/components/error';

const fetchUser = createSafeAsync(
  async (id: string) => {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) throw new Error('Failed to fetch user');
    return res.json();
  },
  {
    onError: (error) => console.error('Failed to fetch user:', error),
    onSuccess: (user) => console.log('Fetched user:', user),
  }
);

// Usage
const user = await fetchUser('123');
```

---

## Usage Patterns

### 1. Component Error Boundaries

Wrap entire components or sections:

```tsx
<ErrorBoundary id="dashboard">
  <Dashboard />
</ErrorBoundary>

<ErrorBoundary id="sidebar" size="sm">
  <Sidebar />
</ErrorBoundary>
```

### 2. Data Fetching Errors

```tsx
import { useQuery } from '@tanstack/react-query';
import { ErrorState } from '@/shared/components/error';

function UserList() {
  const { data, error, refetch, isError } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });

  if (isError) {
    return <NetworkError onRetry={() => refetch()} />;
  }

  return <div>{/* render data */}</div>;
}
```

### 3. Form Validation

```tsx
import { InlineError } from '@/shared/components/error';

function LoginForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form>
      <input name="email" />
      {errors.email && <InlineError type="validation" message={errors.email} />}
    </form>
  );
}
```

### 4. Card Loading Errors

```tsx
import { CardError } from '@/shared/components/error';

function StatsCard() {
  const { data, error, refetch } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
  });

  if (error) {
    return <CardError type="server" onRetry={() => refetch()} />;
  }

  return <Card>{/* stats */}</Card>;
}
```

### 5. Action Errors (Toast)

```tsx
import { useErrorHandler } from '@/shared/components/error';

function DataManager() {
  const { wrapAsync } = useErrorHandler();

  const saveData = wrapAsync(
    async () => {
      await api.save(data);
    },
    {
      showToast: true,
      onSuccess: () => toast({ title: 'Saved!', variant: 'success' }),
    }
  );

  return <button onClick={saveData}>Save</button>;
}
```

---

## Error Types

| Type           | Description                   | Use Case                    |
| -------------- | ----------------------------- | --------------------------- |
| `network`      | Connection/network errors     | Failed API calls, offline   |
| `timeout`      | Request timeout               | Long-running requests       |
| `not-found`    | Resource not found (404)      | Missing data, invalid IDs   |
| `validation`   | Input validation errors       | Form validation             |
| `server`       | Server errors (5xx)           | Internal server errors      |
| `unauthorized` | Authentication required (401) | Login required              |
| `forbidden`    | Permission denied (403)       | Access control              |
| `generic`      | General errors                | Fallback for unknown errors |

---

## Best Practices

### 1. Use Error Boundaries for Component Trees

Wrap major sections of your app:

```tsx
<ErrorBoundary id="main-app">
  <ErrorBoundary id="header">
    <Header />
  </ErrorBoundary>
  <ErrorBoundary id="content">
    <MainContent />
  </ErrorBoundary>
  <ErrorBoundary id="footer">
    <Footer />
  </ErrorBoundary>
</ErrorBoundary>
```

### 2. Choose the Right Error Display

- **ErrorBoundary**: React component errors
- **ErrorState**: Full-page or section errors (data fetch fails)
- **InlineError**: Form validation, inline errors
- **CardError**: Card component errors
- **Toast**: Transient action errors (save, delete, update)

### 3. Always Provide Retry Actions

```tsx
<ErrorState type="network" onRetry={() => refetch()} showRetry={true} />
```

### 4. Use Error Handler Hook for Consistency

```tsx
const { wrapAsync } = useErrorHandler();

const fetchData = wrapAsync(
  async () => {
    // ... fetch logic
  },
  { showToast: true }
);
```

### 5. Enable Error Reporting

```tsx
<ErrorBoundary
  id="critical-section"
  showReport={true}
  onError={(error) => trackError(error)}
>
  <CriticalComponent />
</ErrorBoundary>
```

### 6. Show Details in Development

```tsx
<ErrorBoundary id="app" showDetails={process.env.NODE_ENV === 'development'}>
  <App />
</ErrorBoundary>
```

---

## Accessibility

All error components include:

✅ Proper ARIA attributes (`role="alert"`, `aria-live="assertive"`)
✅ Semantic HTML
✅ Keyboard navigation support
✅ Screen reader friendly text
✅ Color contrast compliant (WCAG AA)
✅ Focus management for retry buttons

---

## Integration with Error Tracking

```tsx
// Configure global error tracking
window.errorTracker = {
  logError: (error, context) => {
    // Send to Sentry, LogRocket, etc.
    Sentry.captureException(error, { extra: context });
  },
};

// ErrorBoundary will automatically use it
<ErrorBoundary id="app">
  <App />
</ErrorBoundary>;
```

---

## Complete Example

```tsx
import {
  ErrorBoundary,
  ErrorState,
  useErrorHandler,
} from '@/shared/components/error';
import { useState, useEffect } from 'react';

function DataFetchingComponent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { wrapAsync } = useErrorHandler();

  const fetchData = wrapAsync(
    async () => {
      const response = await fetch('/api/data');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
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

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <ErrorState type="network" message={error.message} onRetry={fetchData} />
    );
  }

  return <div>{/* Render data */}</div>;
}

// Wrap with ErrorBoundary to catch render errors
function App() {
  return (
    <ErrorBoundary id="app-root" showReport={true}>
      <DataFetchingComponent />
    </ErrorBoundary>
  );
}
```
