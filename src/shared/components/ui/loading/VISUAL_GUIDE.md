# Loading States - Visual Guide

Quick visual reference for choosing the right loading component.

## 🎯 Quick Decision Tree

```
What are you loading?
│
├─ Dashboard Cards/Metrics? → StatCardSkeleton
├─ Action Card/CTA? → ActionCardSkeleton
├─ List of Items? → ListCardSkeleton
├─ Task List? → TaskListSkeleton
├─ Plan List? → PlanListSkeleton
├─ Table? → TableSkeleton
├─ Repository Selector? → RepositorySelectorSkeleton
├─ Session Summary? → SessionSummarySkeleton
├─ QA Gates Config? → QAGatesConfigSkeleton
├─ Dashboard Grid? → DashboardGridSkeleton
├─ Detail Panel? → DetailPanelSkeleton
├─ Small Component? → LoadingSpinner
├─ Full Page/Modal? → LoadingOverlay
└─ Custom? → Skeleton + SkeletonGroup
```

## 📊 Component Previews

### LoadingSpinner

```
┌─────────────────────────┐
│                         │
│      ⟳  Loading...      │
│                         │
└─────────────────────────┘

Sizes: xs, sm, default, lg, xl
Variants: default, primary, success, warning, error
```

**Use when:**
- Loading a small component
- Inline loading state
- Simple async operation
- No complex content structure

### ProgressBar

```
┌──────────────────────────────────┐
│ Uploading files            75%   │
│ ████████████████░░░░░░░░         │
└──────────────────────────────────┘

Sizes: sm, default, lg
Variants: default, primary, success, warning, error
```

**Use when:**
- Upload/download progress
- Multi-step process with known steps
- Processing with calculable progress
- Batch operations

### IndeterminateProgress

```
┌──────────────────────────────────┐
│ Analyzing codebase...            │
│ ░░░░░░░░░░████░░░░░░░░░░░░░░░░  │
└──────────────────────────────────┘

Moving bar animation
```

**Use when:**
- Unknown duration operation
- Processing with unknown steps
- Background task
- Server-side operation

### Skeleton

```
┌──────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓          │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                │
└──────────────────────────────────┘

Variants: default, text, circular, rectangular
```

**Use when:**
- Custom loading layout
- Building your own skeleton
- Non-standard content
- Fine-grained control

### StatCardSkeleton

```
┌──────────────────────────────┐
│ ⬤  ▓▓▓▓▓▓▓▓         ▓▓▓▓▓▓  │
│                              │
│ ▓▓▓▓▓▓▓▓                    │
│ ▓▓▓▓▓▓▓▓▓▓▓▓                │
└──────────────────────────────┘

Shows: icon, value, label, optional trend
```

**Use when:**
- Loading dashboard metrics
- Loading statistics cards
- Loading KPI displays

### ActionCardSkeleton

```
┌────────────────────────────────────┐
│ ⬤  ▓▓▓▓▓▓▓▓▓▓▓▓                  │
│    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓          │
│                                    │
│ ─────────────────────────────────  │
│ ▓▓▓▓▓▓▓                            │
└────────────────────────────────────┘

Shows: icon, title, description, optional action
```

**Use when:**
- Loading action cards
- Loading CTA components
- Loading feature cards

### TaskListSkeleton

```
┌────────────────────────────────────┐
│ ⬤ ▓▓▓▓▓▓▓  ▓▓▓▓▓▓                │
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                │
├────────────────────────────────────┤
│ ⬤ ▓▓▓▓▓▓▓  ▓▓▓▓▓▓                │
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                │
└────────────────────────────────────┘

Shows: multiple task items with status, title, meta
```

**Use when:**
- Loading task lists
- Loading to-do items
- Loading work items

### TableSkeleton

```
┌────────────────────────────────────┐
│ ▓▓▓▓▓▓  ▓▓▓▓▓▓  ▓▓▓▓▓▓  ▓▓▓▓▓▓  │ Header
├────────────────────────────────────┤
│ ▓▓▓▓▓▓  ▓▓▓▓▓▓  ▓▓▓▓▓▓  ▓▓▓▓▓▓  │
│ ▓▓▓▓▓▓  ▓▓▓▓▓▓  ▓▓▓▓▓▓  ▓▓▓▓▓▓  │
│ ▓▓▓▓▓▓  ▓▓▓▓▓▓  ▓▓▓▓▓▓  ▓▓▓▓▓▓  │
└────────────────────────────────────┘

Shows: table with columns and rows
```

**Use when:**
- Loading data tables
- Loading grids
- Loading tabular data

### LoadingOverlay

```
┌────────────────────────────────────┐
│                                    │
│    ╔════════════════════╗          │
│    ║                    ║          │
│    ║    ⟳  Loading...   ║          │
│    ║                    ║          │
│    ╚════════════════════╝          │
│                                    │
└────────────────────────────────────┘

Blurred background, centered spinner
```

**Use when:**
- Blocking modal/dialog interaction
- Full-screen loading
- Critical operation in progress
- Preventing user interaction

### LoadingButton

```
┌─────────────────────┐
│  ⟳  Saving...       │  Disabled + Spinner
└─────────────────────┘

Auto-sized spinner, disabled state
```

**Use when:**
- Form submission
- Any button-triggered async action
- Save/delete/update operations
- API calls from buttons

## 🎨 Animation Styles

### Pulse (Default)

```
Opacity: 1 → 0.5 → 1 (repeating)
Duration: 2s
Use: Most skeletons
```

### Shimmer

```
Gradient moving left to right
Duration: 2s
Use: Progress bars, premium feel
```

### Spin

```
360° rotation
Duration: 1s
Use: Loading spinners
```

### Indeterminate

```
Bar moving left to right
Duration: 1.5s
Use: Indeterminate progress
```

## 📏 Size Guidelines

### Spinner Sizes

```
xs:      12px  ⟳  Small inline
sm:      16px  ⟳  Button icons
default: 24px  ⟳  Standard loading
lg:      32px  ⟳  Card centers
xl:      48px  ⟳  Page loading
```

### Skeleton Heights

```
Text line:     h-4   (16px)
Small element: h-8   (32px)
Medium card:   h-12  (48px)
Large card:    h-32  (128px)
```

## 🎯 Common Patterns

### Pattern: Card Grid Loading

```tsx
<div className="grid grid-cols-3 gap-4">
  <StatCardSkeleton />
  <StatCardSkeleton />
  <StatCardSkeleton />
</div>

// OR use shorthand:
<DashboardGridSkeleton columns={3} rows={1} />
```

### Pattern: List Loading

```tsx
// Simple list
<TaskListSkeleton count={5} />

// List with header
<ListCardSkeleton
  showHeader
  itemCount={10}
/>
```

### Pattern: Modal Loading

```tsx
<Dialog>
  <DialogContent className="relative">
    <LoadingOverlay visible={isLoading} />
    {/* Content */}
  </DialogContent>
</Dialog>
```

### Pattern: Button Loading

```tsx
<LoadingButton
  loading={isSaving}
  loadingText="Saving..."
>
  Save Changes
</LoadingButton>
```

## 🚦 State Transitions

### Good: Skeleton → Content

```
[Skeleton Layout]
    ↓ (smooth fade)
[Actual Content]
```

### Avoid: Spinner → Content (for complex layouts)

```
[Generic Spinner]
    ↓ (jarring jump)
[Complex Layout]
```

### Good: Skeleton → Error

```
[Skeleton Layout]
    ↓
[Error Message with Retry]
```

### Good: Progress → Success

```
[75% Complete]
    ↓
[✓ Done!]
```

## ⚡ Performance Tips

1. **Use Skeleton over Spinner** for complex layouts
2. **Delay showing skeleton** for fast operations (<300ms)
3. **Use CSS animations** (already implemented)
4. **Memoize loading components** (already done)
5. **Lazy load with Suspense** for code splitting

## ♿ Accessibility

All loading components:
- ✅ Respect `prefers-reduced-motion`
- ✅ Include ARIA attributes where appropriate
- ✅ Provide text alternatives
- ✅ Maintain keyboard accessibility
- ✅ Have sufficient color contrast

## 🎨 Color Variants

```
default:  Muted gray (neutral)
primary:  Blue (brand color)
success:  Green (completed)
warning:  Yellow/amber (caution)
error:    Red (failed)
```

Use variants to match the context:
- Progress bars → primary
- Success states → success
- Error retries → error
- Neutral loading → default
