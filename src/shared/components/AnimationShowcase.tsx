'use client';

/**
 * Animation Showcase Component
 *
 * Demonstrates all available animations and micro-interactions.
 * Useful for:
 * - Testing animations during development
 * - Documentation and design review
 * - Accessibility testing
 *
 * To view: Import this component in a page temporarily
 */

import { useState } from 'react';
import { Button } from './ui/button';
import { StatCard, ActionCard, ListCard } from './ui/dashboard-cards';
import {
  SuccessCheckmark,
  ErrorIndicator,
  WarningIndicator,
  InfoIndicator,
  SuccessFlash,
  ErrorFlash,
  LoadingSpinner,
  Skeleton,
  useRipple,
} from './ui/feedback-animations';
import {
  Check,
  AlertTriangle,
  Info,
  Zap,
  Activity,
  Plus,
  Settings,
} from 'lucide-react';

export function AnimationShowcase() {
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [successTrigger, setSuccessTrigger] = useState(false);
  const [errorTrigger, setErrorTrigger] = useState(false);

  const { addRipple, RippleContainer } = useRipple();

  const handleSuccessClick = () => {
    setShowSuccess(true);
    setSuccessTrigger(true);
    setTimeout(() => {
      setShowSuccess(false);
      setSuccessTrigger(false);
    }, 2000);
  };

  const handleErrorClick = () => {
    setShowError(true);
    setErrorTrigger(true);
    setTimeout(() => {
      setShowError(false);
      setErrorTrigger(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen space-y-12 bg-background p-8">
      <div>
        <h1 className="mb-2 text-3xl font-bold">Animation Showcase</h1>
        <p className="text-muted-foreground">
          All micro-interactions and animations available in the design system
        </p>
      </div>

      {/* Button Animations */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">Button Animations</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Hover, focus, and active states with lift and scale effects
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="default">Default Button</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Feedback Indicators */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">Feedback Indicators</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Animated feedback for success, error, warning, and info states
        </p>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <div className="flex flex-col items-center gap-2">
            <Button onClick={handleSuccessClick} variant="outline" size="sm">
              Show Success
            </Button>
            <SuccessCheckmark show={showSuccess} size="md" />
            <p className="text-center text-xs">Bounce + Checkmark</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button onClick={handleErrorClick} variant="outline" size="sm">
              Show Error
            </Button>
            <ErrorIndicator show={showError} size="md" />
            <p className="text-center text-xs">Shake Animation</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button
              onClick={() => setShowWarning(!showWarning)}
              variant="outline"
              size="sm"
            >
              Toggle Warning
            </Button>
            <WarningIndicator show={showWarning} size="md" />
            <p className="text-center text-xs">Pulse Animation</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button
              onClick={() => setShowInfo(!showInfo)}
              variant="outline"
              size="sm"
            >
              Toggle Info
            </Button>
            <InfoIndicator show={showInfo} size="md" />
            <p className="text-center text-xs">Fade In</p>
          </div>
        </div>
      </section>

      {/* Flash Feedback */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">Flash Feedback</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Background flash animations for row/element feedback
        </p>
        <div className="grid gap-4">
          <SuccessFlash trigger={successTrigger}>
            <div className="rounded-lg border p-4">
              <p className="font-medium">Success Flash</p>
              <p className="text-sm text-muted-foreground">
                Click "Show Success" above to see this flash green
              </p>
            </div>
          </SuccessFlash>
          <ErrorFlash trigger={errorTrigger}>
            <div className="rounded-lg border p-4">
              <p className="font-medium">Error Flash</p>
              <p className="text-sm text-muted-foreground">
                Click "Show Error" above to see this flash red
              </p>
            </div>
          </ErrorFlash>
        </div>
      </section>

      {/* Dashboard Cards */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">Dashboard Cards</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Hover lift, scale, and colored shadow effects
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            variant="default"
            icon={<Activity className="h-5 w-5" />}
            value="42"
            label="Total Tasks"
          />
          <StatCard
            variant="primary"
            icon={<Zap className="h-5 w-5" />}
            value="12"
            label="Active Tasks"
            trend={{ value: '+15%', direction: 'up', label: 'from last week' }}
          />
          <StatCard
            variant="success"
            icon={<Check className="h-5 w-5" />}
            value="28"
            label="Completed"
            trend={{ value: '+8', direction: 'up' }}
          />
          <StatCard
            variant="warning"
            icon={<AlertTriangle className="h-5 w-5" />}
            value="2"
            label="Needs Attention"
          />
        </div>
      </section>

      {/* Action Cards */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">Action Cards</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Icon rotation, scale, and interactive feedback
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <ActionCard
            variant="primary"
            icon={<Plus className="h-6 w-6" />}
            title="Create New Task"
            description="Start a new task in your current session"
            action={{ label: 'Create Task', onClick: () => {} }}
          />
          <ActionCard
            variant="default"
            icon={<Settings className="h-6 w-6" />}
            title="Configure Settings"
            description="Customize your dashboard preferences"
            onClick={() => {}}
          />
        </div>
      </section>

      {/* List Card */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">List Card</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Hover indent, stagger animation, and smooth transitions
        </p>
        <ListCard
          title="Recent Activity"
          description="Last 5 actions"
          items={[
            {
              id: '1',
              content: (
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10">
                    <Check className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Task completed</p>
                    <p className="text-xs text-muted-foreground">
                      2 minutes ago
                    </p>
                  </div>
                </div>
              ),
              onClick: () => {},
            },
            {
              id: '2',
              content: (
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <Plus className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">New task created</p>
                    <p className="text-xs text-muted-foreground">
                      5 minutes ago
                    </p>
                  </div>
                </div>
              ),
              onClick: () => {},
            },
            {
              id: '3',
              content: (
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/10">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Needs attention</p>
                    <p className="text-xs text-muted-foreground">
                      10 minutes ago
                    </p>
                  </div>
                </div>
              ),
              onClick: () => {},
            },
          ]}
          maxHeight={300}
        />
      </section>

      {/* Loading States */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">Loading States</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Spinners and skeleton loaders with pulse animations
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-medium">Loading Spinners</p>
            <div className="flex items-center gap-6">
              <LoadingSpinner size="sm" />
              <LoadingSpinner size="md" />
              <LoadingSpinner size="lg" />
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium">Skeleton Loaders</p>
            <div className="space-y-2">
              <Skeleton width="100%" height={20} />
              <Skeleton width="80%" height={20} />
              <Skeleton width="60%" height={20} />
            </div>
          </div>
        </div>
      </section>

      {/* Ripple Effect */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">Ripple Effect</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Material Design-style click feedback
        </p>
        <div
          className="relative cursor-pointer select-none overflow-hidden rounded-lg border bg-primary p-8 text-primary-foreground"
          onClick={addRipple}
        >
          <p className="relative z-10 text-center font-medium">
            Click anywhere to see ripple effect
          </p>
          <RippleContainer />
        </div>
      </section>

      {/* Hover Classes */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">Hover Effect Classes</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Utility classes for custom components
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="hover-lift cursor-pointer rounded-lg border bg-card p-6">
            <p className="mb-1 font-medium">hover-lift</p>
            <p className="text-sm text-muted-foreground">
              Lifts element with shadow
            </p>
          </div>
          <div className="hover-scale cursor-pointer rounded-lg border bg-card p-6">
            <p className="mb-1 font-medium">hover-scale</p>
            <p className="text-sm text-muted-foreground">Scales to 1.02</p>
          </div>
          <div className="hover-glow cursor-pointer rounded-lg border bg-card p-6">
            <p className="mb-1 font-medium">hover-glow</p>
            <p className="text-sm text-muted-foreground">Ring glow effect</p>
          </div>
        </div>
      </section>

      {/* Animation Classes */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">Animation Classes</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Keyframe animations for various use cases
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="animate-fade-in mb-2 h-12 w-12 rounded-full bg-primary" />
            <p className="text-sm font-medium">animate-fade-in</p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="animate-slide-in-up mb-2 h-12 w-12 rounded-full bg-primary" />
            <p className="text-sm font-medium">animate-slide-in-up</p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="animate-scale-in mb-2 h-12 w-12 rounded-full bg-primary" />
            <p className="text-sm font-medium">animate-scale-in</p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="animate-bounce-in mb-2 h-12 w-12 rounded-full bg-primary" />
            <p className="text-sm font-medium">animate-bounce-in</p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="animate-shake mb-2 h-12 w-12 rounded-full bg-destructive" />
            <p className="text-sm font-medium">animate-shake</p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="animate-pulse-alert mb-2 h-12 w-12 rounded-full bg-warning" />
            <p className="text-sm font-medium">animate-pulse-alert</p>
          </div>
        </div>
      </section>

      {/* Accessibility Notice */}
      <section className="rounded-lg border-2 border-dashed bg-muted/30 p-6">
        <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
          <Info className="h-5 w-5" />
          Accessibility Note
        </h3>
        <p className="text-sm text-muted-foreground">
          All animations respect the{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            prefers-reduced-motion
          </code>{' '}
          media query. Users who prefer reduced motion will see instant
          transitions instead of animations. Try enabling "Reduce motion" in
          your system settings to see the difference.
        </p>
      </section>
    </div>
  );
}
