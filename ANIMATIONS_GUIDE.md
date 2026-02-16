# Animation & Micro-Interactions Guide

This document describes all the animations and micro-interactions implemented in the dashboard.

## 🎨 Animation System Overview

The application now features a comprehensive animation system with:
- **Smooth transitions** for all interactive elements
- **Feedback animations** for user actions
- **List animations** with stagger effects
- **Modal/panel animations** for dialogs and sidebars
- **Accessibility** - respects `prefers-reduced-motion`

## 📦 Core Files

### `/src/shared/styles/animations.css`
Central animation definitions with:
- Keyframe animations (fade, slide, scale, shake, bounce, etc.)
- Animation utility classes
- Hover effects
- Focus states
- List item transitions
- Modal/panel transitions
- Loading states
- Reduced motion media queries

### `/src/shared/components/ui/feedback-animations.tsx`
Reusable feedback components:
- `<SuccessCheckmark />` - Animated checkmark for success states
- `<ErrorIndicator />` - Shake animation for errors
- `<WarningIndicator />` - Pulse animation for warnings
- `<InfoIndicator />` - Fade-in for info messages
- `<SuccessFlash />` - Flash background for success
- `<ErrorFlash />` - Flash background for errors
- `<LoadingSpinner />` - Animated spinner
- `useRipple()` - Click ripple effect hook
- `<Skeleton />` - Loading skeleton with pulse

## 🎯 Implemented Micro-Interactions

### 1. **Buttons**
**File:** `src/shared/components/ui/button.tsx`

**Animations:**
- Hover: Lift effect with shadow (`hover:-translate-y-0.5 hover:shadow-md`)
- Active: Scale down (`active:scale-95`)
- Focus: Ring animation with offset
- Smooth transitions for all states

**Usage:**
```tsx
<Button variant="default">Click me</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
```

### 2. **Dashboard Cards**
**File:** `src/shared/components/ui/dashboard-cards.tsx`

**Animations:**

#### StatCard
- Hover: Subtle lift + scale (`hover:scale-[1.01] hover:-translate-y-0.5`)
- Colored shadows based on variant (success, warning, error)
- Smooth transitions (200ms)

#### ActionCard
- Hover: Lift + scale with colored shadow
- Icon rotation on hover (`group-hover:rotate-3`)
- Icon scale animation (`group-hover:scale-110`)
- Active press effect (`active:scale-[0.99]`)

#### ListCard
- List items slide right on hover (`hover:pl-5`)
- Smooth background transition
- Active press effect
- Stagger animation for initial render

**Usage:**
```tsx
<StatCard
  variant="success"
  icon={<CheckCircle />}
  value="24"
  label="Completed Tasks"
  trend={{ value: "+12%", direction: "up" }}
/>

<ActionCard
  variant="primary"
  icon={<Plus />}
  title="Create Task"
  description="Start a new task"
  action={{ label: "Create", onClick: handleCreate }}
/>
```

### 3. **Repository Selector**
**File:** `src/features/repositories/components/RepositorySelector.tsx`

**Animations:**
- Rows slide right on hover (`hover:pl-4`)
- Focused item has slide-in animation (`animate-slide-in-right`)
- Active repos with needs-attention pulse (`animate-pulse-alert`)
- Section headers fade in (`animate-slide-in-down`)
- List items stagger on mount (`stagger-children`)
- Search input focus ring animation

**User Experience:**
- Visual feedback when hovering repos
- Keyboard navigation shows focus clearly
- Urgent items pulse to draw attention
- Smooth list transitions

### 4. **Tabs Navigation**
**File:** `src/app/components/DashboardLayout.tsx`

**Animations:**
- Tab buttons: Scale up on hover (`hover:scale-105`)
- Active press: Scale down (`active:scale-95`)
- Tab content: Slide up fade when switching (`animate-slide-up-fade`)
- Connection status bar: Hover lift with shadow
- Plan count badge: Ping animation for active plans

**User Experience:**
- Clear visual feedback when switching tabs
- Smooth content transitions
- Attention-grabbing badge for active work

### 5. **Needs Attention Component**
**File:** `src/app/components/NeedsAttention.tsx`

**Animations:**
- Critical alerts: Pulse + bounce icon (`animate-pulse` + `animate-bounce`)
- High severity: Ring glow effect
- Live duration counter updates every second
- Smooth collapse/expand transitions
- Alert items fade in on mount

**User Experience:**
- Critical issues immediately grab attention
- Clear visual hierarchy by severity
- Real-time feedback on stuck duration

## 🎬 Animation Patterns

### Hover Effects

#### Lift Effect
```css
.hover-lift {
  transition: transform 200ms ease-out, box-shadow 200ms ease-out;
}
.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
```

#### Scale Effect
```css
.hover-scale:hover {
  transform: scale(1.02);
}
```

#### Glow Effect
```css
.hover-glow:hover {
  box-shadow: 0 0 0 2px hsl(var(--primary) / 0.2),
              0 0 16px hsl(var(--primary) / 0.1);
}
```

### Feedback Animations

#### Success Flash
```tsx
<SuccessFlash trigger={saved}>
  <div>Content saved!</div>
</SuccessFlash>
```

#### Error Shake
```tsx
<ErrorIndicator show={hasError} size="md" />
```

#### Warning Pulse
```tsx
<WarningIndicator show={needsAttention} size="lg" />
```

### List Animations

#### Stagger Effect
```tsx
<div className="stagger-children">
  {items.map(item => <Item key={item.id} {...item} />)}
</div>
```

#### Enter/Exit
```tsx
<div className="list-item-enter">Item content</div>
<div className="list-item-exit">Removing...</div>
```

### Modal/Panel Animations

#### Modal Fade + Scale
```tsx
<div className="modal-backdrop-enter">
  <div className="modal-content-enter">
    Modal content
  </div>
</div>
```

#### Panel Slide
```tsx
<div className="panel-slide-in-right">
  Panel content
</div>
```

## ♿ Accessibility

### Reduced Motion Support

All animations respect the user's motion preferences:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Focus Indicators

Enhanced focus states for keyboard navigation:
- 2px ring with offset
- Clear visual indication
- Consistent across all components
- Works with :focus-visible

### ARIA Support

All animated components include proper ARIA attributes:
- `role="status"` for live regions
- `aria-live="polite"` for updates
- `aria-label` for icon-only buttons
- `aria-hidden="true"` for decorative elements

## 📱 Performance Considerations

### Optimizations

1. **CSS-based animations** - Hardware accelerated
2. **will-change hints** - For frequently animated properties
3. **transform/opacity** - GPU-optimized properties
4. **Debounced updates** - For high-frequency changes
5. **Lazy loading** - Heavy components load on demand

### Best Practices

- Use `transform` and `opacity` for smooth 60fps animations
- Avoid animating `width`, `height`, `top`, `left`
- Keep durations between 150-300ms for UI feedback
- Use `cubic-bezier` easing for natural motion
- Limit simultaneous animations

## 🎨 Design Tokens

### Durations
- `--duration-instant`: 0ms
- `--duration-fast`: 100ms (quick feedback)
- `--duration-normal`: 200ms (most UI interactions)
- `--duration-slow`: 300ms (emphasis)
- `--duration-slower`: 500ms
- `--duration-slowest`: 700ms

### Easing Functions
- `--ease-linear`: Linear motion
- `--ease-in`: Accelerating
- `--ease-out`: Decelerating (most common)
- `--ease-in-out`: Smooth start/end
- `--ease-bounce`: Spring effect

## 🔮 Future Enhancements

Potential additions:
- [ ] Loading skeleton shimmer effect for empty states
- [ ] Progress bar indeterminate animation
- [ ] Toast notification slide-ins
- [ ] Drag-and-drop visual feedback
- [ ] Confetti animation for major milestones
- [ ] Typewriter effect for AI responses
- [ ] Parallax scrolling effects
- [ ] Particle effects for celebrations

## 📚 Resources

- [Framer Motion](https://www.framer.com/motion/) - For complex React animations
- [Animate.css](https://animate.style/) - Animation inspiration
- [Tailwind CSS Animations](https://tailwindcss.com/docs/animation) - Built-in utilities
- [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API) - JavaScript animations

## 🤝 Contributing

When adding new animations:

1. **Respect reduced motion** - Always add media query support
2. **Use design tokens** - Reference CSS variables for consistency
3. **Test performance** - Check frame rates with Chrome DevTools
4. **Document usage** - Add examples to this guide
5. **Follow patterns** - Use existing animation classes when possible
6. **Consider accessibility** - Ensure keyboard users get visual feedback
