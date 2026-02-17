# Performance Optimization Components

This directory contains components and utilities for optimizing React application performance.

## Components

### LazyLoad

Defers rendering of components until they enter the viewport using IntersectionObserver API.

**When to use:**

- Below-the-fold content
- Heavy components that aren't immediately visible
- Content that may never be viewed by the user

**Example:**

```tsx
import { LazyLoad } from '@/shared/components/performance';

<LazyLoad
  fallback={<Skeleton className="h-96" />}
  rootMargin="100px"
  threshold={0.01}
  height={400}
>
  <HeavyComponent />
</LazyLoad>;
```

**Props:**

- `children` - Content to render when visible
- `fallback` - Placeholder content (optional)
- `rootMargin` - Margin around viewport for preloading (default: '200px')
- `threshold` - Visibility threshold (default: 0.01)
- `className` - Additional CSS classes
- `height` - Height placeholder to prevent layout shift

### PerformanceProfiler

Wraps components to measure and monitor render performance using React Profiler API.

**When to use:**

- During development to identify performance bottlenecks
- For critical user-facing components
- When investigating slow renders

**Example:**

```tsx
import { PerformanceProfiler } from '@/shared/components/performance';

<PerformanceProfiler id="DashboardLayout">
  <DashboardLayout />
</PerformanceProfiler>;
```

**Props:**

- `id` - Unique identifier for the profiler
- `children` - Components to profile
- `onRender` - Custom callback for profiler data (optional)
- `enabled` - Enable/disable profiling (default: development mode only)

**Automatic Features:**

- Logs renders that take >16ms (60fps threshold)
- Only active in development mode by default
- Provides detailed timing information

## Utilities

See `/src/shared/utils/performance.ts` for utility functions:

### debounce

```tsx
import { debounce } from '@/shared/utils/performance';

const handleSearch = debounce((query: string) => {
  // Search logic
}, 300);
```

### throttle

```tsx
import { throttle } from '@/shared/utils/performance';

const handleScroll = throttle(() => {
  // Scroll logic
}, 100);
```

### prefersReducedMotion

```tsx
import { prefersReducedMotion } from '@/shared/utils/performance';

if (!prefersReducedMotion()) {
  // Enable animations
}
```

## Best Practices

### Component Memoization

Use React.memo for components that:

- Render frequently with the same props
- Have expensive render logic
- Receive complex props that don't change often

```tsx
export const MyComponent = React.memo(function MyComponent(props) {
  // Component logic
});
```

### Hook Memoization

Use useMemo for:

- Expensive calculations
- Derived data from props/state
- Complex object/array transformations

```tsx
const sortedData = useMemo(() => {
  return data.sort((a, b) => a.value - b.value);
}, [data]);
```

Use useCallback for:

- Callbacks passed to memoized children
- Callbacks used as dependencies in other hooks
- Event handlers in frequently re-rendering components

```tsx
const handleClick = useCallback(() => {
  onClick?.(id);
}, [onClick, id]);
```

### Code Splitting

Use React.lazy for:

- Large third-party libraries (Monaco editor, charts)
- Route-based components
- Modal/dialog content
- Features used by small percentage of users

```tsx
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

<Suspense fallback={<Loading />}>
  <HeavyComponent />
</Suspense>;
```

## Performance Checklist

Before optimizing:

- [ ] Profile the component to identify actual bottlenecks
- [ ] Measure current performance metrics
- [ ] Identify which renders are slow (>16ms)

When optimizing:

- [ ] Start with React.memo for expensive components
- [ ] Add useMemo/useCallback where beneficial
- [ ] Implement code splitting for heavy bundles
- [ ] Use LazyLoad for below-the-fold content
- [ ] Add PerformanceProfiler to monitor changes

After optimizing:

- [ ] Measure new performance metrics
- [ ] Verify no regressions in functionality
- [ ] Document optimizations made
- [ ] Monitor production metrics

## Common Pitfalls

### Don't Over-Optimize

- Not all components need React.memo
- useMemo/useCallback have overhead
- Profile first, optimize second

### Avoid Premature Optimization

- Focus on actual bottlenecks
- Use browser DevTools to identify issues
- Measure before and after

### Watch Out For

- Unstable dependencies in useMemo/useCallback
- Memoizing cheap operations (adds overhead)
- Code splitting too aggressively (waterfall loading)
- Lazy loading above-the-fold content (delays FCP)

## Monitoring Performance

### Development

```tsx
// Enable profiler
<PerformanceProfiler id="MyComponent" enabled={true}>
  <MyComponent />
</PerformanceProfiler>

// Check console for warnings
// [Performance] Slow mount render detected: { component: "MyComponent", actualDuration: "23.45ms" }
```

### Production

Consider implementing:

- Core Web Vitals monitoring
- Real User Monitoring (RUM)
- Performance budgets
- Automated Lighthouse CI

## Resources

- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [React DevTools Profiler](https://react.dev/learn/react-developer-tools#profiler)
- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
