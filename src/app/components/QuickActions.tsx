'use client';

import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import { Plus, PlayCircle, Map, FolderGit2 } from 'lucide-react';

/* ============================================
   TYPES & INTERFACES
   ============================================ */

export interface QuickActionItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  href?: string;
  variant?: 'default' | 'primary';
  shortcut?: {
    key: string;
    modKey?: boolean;
  };
  disabled?: boolean;
}

export interface QuickActionsProps {
  onNewTask?: () => void;
  onStartSession?: () => void;
  onBrowsePlans?: () => void;
  onViewRepositories?: () => void;
  loading?: boolean;
  className?: string;
}

/* ============================================
   KEYBOARD SHORTCUT COMPONENT
   ============================================ */

interface KeyboardShortcutProps {
  shortcut: NonNullable<QuickActionItem['shortcut']>;
  className?: string;
}

function KeyboardShortcut({ shortcut, className }: KeyboardShortcutProps) {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKeyLabel = isMac ? '⌘' : 'Ctrl';

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {shortcut.modKey && (
        <>
          <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 text-[10px] font-medium text-text-muted">
            {modKeyLabel}
          </kbd>
          <span className="text-[10px] text-text-muted">+</span>
        </>
      )}
      <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 text-[10px] font-medium text-text-muted">
        {shortcut.key}
      </kbd>
    </div>
  );
}

/* ============================================
   ACTION CARD HELPER COMPONENTS
   ============================================ */

interface ActionCardIconProps {
  icon: React.ComponentType<{ className?: string }>;
  isPrimary: boolean;
}

function ActionCardIcon({ icon: Icon, isPrimary }: ActionCardIconProps) {
  return (
    <div
      className={cn(
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-200',
        isPrimary
          ? 'bg-accent-primary text-white shadow-sm group-hover:scale-105 group-hover:shadow-md'
          : 'bg-muted text-text-secondary group-hover:bg-muted/80 group-hover:text-text-primary'
      )}
    >
      <Icon className="h-6 w-6" />
    </div>
  );
}

interface ActionCardContentProps {
  action: QuickActionItem;
  isPrimary: boolean;
  isInteractive: boolean;
}

function ActionCardContent({ action, isPrimary, isInteractive }: ActionCardContentProps) {
  return (
    <>
      <ActionCardIcon icon={action.icon} isPrimary={isPrimary} />
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <span
          className={cn(
            'text-base font-semibold transition-colors',
            isPrimary ? 'text-text-primary' : 'text-text-primary',
            isInteractive && 'group-hover:text-accent-primary'
          )}
        >
          {action.title}
        </span>
        <span className="text-sm text-text-muted line-clamp-2">{action.description}</span>
      </div>
      {action.shortcut && (
        <div className="hidden sm:flex shrink-0">
          <KeyboardShortcut shortcut={action.shortcut} />
        </div>
      )}
    </>
  );
}

function getActionCardClasses(isPrimary: boolean, isInteractive: boolean, disabled?: boolean, loading?: boolean) {
  return cn(
    'group relative flex items-center gap-4 p-4 sm:p-5',
    'rounded-xl border bg-card text-card-foreground',
    'transition-all duration-200',
    'min-h-[88px] sm:min-h-[96px]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    isPrimary
      ? 'border-accent-primary/20 shadow-sm hover:border-accent-primary/40 hover:shadow-md hover:bg-accent-primary/5'
      : 'border-border hover:border-border-strong hover:shadow-sm',
    isInteractive && !disabled && 'cursor-pointer',
    disabled && 'pointer-events-none opacity-50',
    loading && 'animate-pulse'
  );
}

/* ============================================
   ACTION CARD COMPONENT
   ============================================ */

interface ActionCardProps {
  action: QuickActionItem;
  loading?: boolean;
}

function ActionCard({ action, loading }: ActionCardProps) {
  const isInteractive = !!(action.onClick || action.href);
  const isPrimary = action.variant === 'primary';

  const handleClick = React.useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      if (action.disabled || loading || action.href) return;
      if (action.onClick) {
        e.preventDefault();
        action.onClick();
      }
    },
    [action, loading]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick(e);
      }
    },
    [handleClick]
  );

  const baseClasses = getActionCardClasses(isPrimary, isInteractive, action.disabled, loading);
  const content = <ActionCardContent action={action} isPrimary={isPrimary} isInteractive={isInteractive} />;

  if (action.href && !action.disabled) {
    return (
      <a href={action.href} className={baseClasses} tabIndex={0} aria-label={action.title}>
        {content}
      </a>
    );
  }

  return (
    <div
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive && !action.disabled ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      className={baseClasses}
      aria-label={action.title}
      aria-disabled={action.disabled}
    >
      {content}
    </div>
  );
}

/* ============================================
   SKELETON LOADER
   ============================================ */

function ActionCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 sm:p-5 rounded-xl border border-border bg-card min-h-[88px] sm:min-h-[96px]">
      <div className="h-12 w-12 rounded-xl bg-muted animate-pulse" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-5 w-24 rounded bg-muted animate-pulse" />
        <div className="h-4 w-36 rounded bg-muted animate-pulse" />
      </div>
      <div className="hidden sm:block h-5 w-12 rounded bg-muted animate-pulse" />
    </div>
  );
}

/* ============================================
   DEFAULT ACTIONS
   ============================================ */

function getDefaultActions(props: QuickActionsProps): QuickActionItem[] {
  return [
    {
      id: 'new-task',
      title: 'New Task',
      description: 'Create a new automated task',
      icon: Plus,
      variant: 'primary',
      onClick: props.onNewTask,
      shortcut: { key: 'N', modKey: true },
    },
    {
      id: 'start-session',
      title: 'Start Session',
      description: 'Begin a new work session',
      icon: PlayCircle,
      onClick: props.onStartSession,
      shortcut: { key: '1', modKey: true },
    },
    {
      id: 'browse-plans',
      title: 'Browse Plans',
      description: 'View and manage your plans',
      icon: Map,
      onClick: props.onBrowsePlans,
      shortcut: { key: '2', modKey: true },
    },
    {
      id: 'view-repositories',
      title: 'View Repositories',
      description: 'Browse connected repositories',
      icon: FolderGit2,
      onClick: props.onViewRepositories,
      shortcut: { key: '3', modKey: true },
    },
  ];
}

/* ============================================
   MAIN COMPONENT
   ============================================ */

/**
 * QuickActions Component
 *
 * A responsive grid of large, touch-friendly action buttons for the dashboard.
 * Features:
 * - 2x2 grid on mobile, 1x4 row on desktop
 * - Large touch targets (min 88px height)
 * - Optional keyboard shortcuts displayed
 * - Primary CTA styling for New Task
 * - Accessible with keyboard navigation
 */
export function QuickActions({
  onNewTask,
  onStartSession,
  onBrowsePlans,
  onViewRepositories,
  loading = false,
  className,
}: QuickActionsProps) {
  const actions = React.useMemo(
    () =>
      getDefaultActions({
        onNewTask,
        onStartSession,
        onBrowsePlans,
        onViewRepositories,
      }),
    [onNewTask, onStartSession, onBrowsePlans, onViewRepositories]
  );

  return (
    <section aria-labelledby="quick-actions-heading" className={cn('', className)}>
      <div className="mb-4">
        <h2 id="quick-actions-heading" className="text-lg font-semibold text-text-primary">
          Quick Actions
        </h2>
        <p className="mt-1 text-sm text-text-muted">Get started with common tasks</p>
      </div>

      {/* Responsive Grid: 2x2 on mobile (grid-cols-2), 1x4 on desktop (lg:grid-cols-4) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <ActionCardSkeleton key={i} />)
          : actions.map((action) => (
              <ActionCard key={action.id} action={action} loading={loading} />
            ))}
      </div>
    </section>
  );
}

export default QuickActions;
