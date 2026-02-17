/* eslint-disable complexity */
'use client';

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  createContext,
  useContext,
  useMemo,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/shared/lib/utils';
import {
  ChevronRight,
  ChevronLeft,
  FolderGit2,
  ListTodo,
  Settings,
  HelpCircle,
  Menu,
  X,
  Map,
  Circle,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

/* ============================================
   TYPES & INTERFACES
   ============================================ */

export type NavItemPriority = 'primary' | 'secondary';
export type NavItemStatus =
  | 'default'
  | 'active'
  | 'running'
  | 'error'
  | 'success';

export interface NavItem {
  /** Unique identifier for the nav item */
  id: string;
  /** Display label */
  label: string;
  /** Icon component */
  icon: LucideIcon;
  /** Optional href for link items */
  href?: string;
  /** Click handler */
  onClick?: () => void;
  /** Badge content (string or number) */
  badge?: string | number;
  /** Whether this item is currently active */
  active?: boolean;
  /** Priority level (primary = main nav, secondary = settings/help) */
  priority: NavItemPriority;
  /** Item status for visual indicators */
  status?: NavItemStatus;
  /** Keyboard shortcut hint (e.g., "⌘1") */
  shortcutHint?: string;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Tooltip text */
  tooltip?: string;
}

export interface StatusIndicator {
  /** Unique identifier */
  id: string;
  /** Label text */
  label: string;
  /** Value to display */
  value: string | number;
  /** Status type for styling */
  type: 'info' | 'success' | 'warning' | 'error' | 'neutral';
  /** Whether this indicator is pulsing/animated */
  pulse?: boolean;
  /** Click handler */
  onClick?: () => void;
}

export interface NavigationContextValue {
  /** Whether the sidebar is collapsed (icons only) */
  collapsed: boolean;
  /** Set collapsed state */
  setCollapsed: (collapsed: boolean) => void;
  /** Toggle collapsed state */
  toggleCollapsed: () => void;
  /** Whether mobile menu is open */
  mobileMenuOpen: boolean;
  /** Set mobile menu state */
  setMobileMenuOpen: (open: boolean) => void;
  /** Currently focused nav item index */
  focusedIndex: number;
  /** Set focused index */
  setFocusedIndex: (index: number) => void;
  /** Current breakpoint */
  breakpoint: 'mobile' | 'tablet' | 'desktop';
}

export interface NavigationProps {
  /** Navigation items (will be grouped by priority) */
  items: NavItem[];
  /** Status indicators to show in the header area */
  statusIndicators?: StatusIndicator[];
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Controlled collapsed state */
  collapsed?: boolean;
  /** Callback when collapsed state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Logo/brand content */
  logo?: ReactNode;
  /** Custom header content for mobile */
  mobileHeader?: ReactNode;
  /** Additional class name */
  className?: string;
  /** Keyboard shortcuts for navigation items (item.id -> shortcut key) */
  shortcuts?: Record<string, string>;
}

/* ============================================
   CONSTANTS
   ============================================ */

const SIDEBAR_WIDTH = '16rem'; // 256px
const SIDEBAR_COLLAPSED_WIDTH = '4rem'; // 64px
const MOBILE_DRAWER_WIDTH = '18rem'; // 288px

/* ============================================
   CONTEXT
   ============================================ */

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a Navigation component');
  }
  return context;
}

/* ============================================
   BREAKPOINT HOOK
   ============================================ */

function useBreakpoint(): 'mobile' | 'tablet' | 'desktop' {
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>(
    'desktop'
  );

  useEffect(() => {
    const checkBreakpoint = () => {
      if (typeof window === 'undefined') return;
      const width = window.innerWidth;
      if (width < 768) {
        setBreakpoint('mobile');
      } else if (width < 1280) {
        setBreakpoint('tablet');
      } else {
        setBreakpoint('desktop');
      }
    };

    checkBreakpoint();
    window.addEventListener('resize', checkBreakpoint);
    return () => window.removeEventListener('resize', checkBreakpoint);
  }, []);

  return breakpoint;
}

/* ============================================
   STATUS INDICATOR COMPONENT
   ============================================ */

interface StatusIndicatorBadgeProps {
  indicator: StatusIndicator;
  collapsed?: boolean;
}

function StatusIndicatorBadge({
  indicator,
  collapsed = false,
}: StatusIndicatorBadgeProps) {
  const statusColors = {
    info: 'bg-info text-info-foreground',
    success: 'bg-success text-success-foreground',
    warning: 'bg-warning text-warning-foreground',
    error: 'bg-error text-error-foreground',
    neutral: 'bg-surface-elevated text-text-secondary',
  };

  const pulseColors = {
    info: 'bg-info',
    success: 'bg-success',
    warning: 'bg-warning',
    error: 'bg-error',
    neutral: 'bg-text-muted',
  };

  const content = (
    <div
      className={cn(
        'relative flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
        'transition-all duration-200 ease-in-out',
        statusColors[indicator.type],
        indicator.onClick && 'cursor-pointer hover:opacity-80',
        collapsed && 'px-1.5'
      )}
      onClick={indicator.onClick}
      role={indicator.onClick ? 'button' : undefined}
      tabIndex={indicator.onClick ? 0 : undefined}
      aria-label={`${indicator.label}: ${indicator.value}`}
    >
      {indicator.pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              pulseColors[indicator.type]
            )}
          />
          <span
            className={cn(
              'relative inline-flex h-2 w-2 rounded-full',
              pulseColors[indicator.type]
            )}
          />
        </span>
      )}
      {!collapsed && (
        <span className="sr-only sm:not-sr-only">{indicator.label}:</span>
      )}
      <span className="font-semibold">{indicator.value}</span>
    </div>
  );

  return content;
}

/* ============================================
   NAV ITEM COMPONENT
   ============================================ */

interface NavItemButtonProps {
  item: NavItem;
  collapsed: boolean;
  focused: boolean;
  onClick?: () => void;
  onFocus?: () => void;
  tabIndex?: number;
}

function NavItemButton({
  item,
  collapsed,
  focused,
  onClick,
  onFocus,
  tabIndex = 0,
}: NavItemButtonProps) {
  const Icon = item.icon;
  const buttonRef = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
  const router = useRouter();

  // Focus management
  useEffect(() => {
    if (focused && buttonRef.current) {
      buttonRef.current.focus();
    }
  }, [focused]);

  const handleClick = (e?: React.MouseEvent) => {
    if (item.disabled) return;

    // If href is provided, use Next.js router for client-side navigation
    if (item.href && !e?.ctrlKey && !e?.metaKey) {
      e?.preventDefault();
      router.push(item.href);
    }

    item.onClick?.();
    onClick?.();
  };

  // Enhanced status styles with priority consideration
  const statusStyles = {
    default: '',
    active:
      'bg-accent-primary-subtle text-accent-primary border-l-2 border-accent-primary',
    running: 'text-info',
    error: 'text-error',
    success: 'text-success',
  };

  const iconStatusStyles = {
    default: 'text-text-muted group-hover:text-text-primary',
    active: 'text-accent-primary',
    running: 'text-info',
    error: 'text-error',
    success: 'text-success',
  };

  // Priority-based styling: primary items are more prominent
  const isPrimary = item.priority === 'primary';

  const sharedClassName = cn(
    'group relative flex w-full items-center gap-3 rounded-lg text-sm font-medium',
    'transition-all duration-200 ease-in-out',
    'hover:bg-surface-interactive',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-inset',
    // Priority-based sizing
    isPrimary ? 'px-3 py-2.5' : 'px-3 py-2',
    item.active
      ? statusStyles.active
      : statusStyles[item.status || 'default'] ||
          'text-text-secondary hover:text-text-primary',
    collapsed ? 'justify-center px-2' : 'justify-start',
    item.disabled && 'cursor-not-allowed opacity-50',
    // Priority indicator for primary items
    isPrimary && !item.active && 'hover:translate-x-0.5'
  );

  const content = (
    <>
      {/* Running indicator pulse */}
      {item.status === 'running' && (
        <span
          className="absolute left-1 top-1/2 -translate-y-1/2"
          aria-hidden="true"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-info" />
          </span>
        </span>
      )}

      {/* Priority indicator dot for active primary items */}
      {isPrimary && item.active && !collapsed && (
        <span
          className="absolute -left-0.5 top-1/2 -translate-y-1/2"
          aria-hidden="true"
        >
          <Circle className="h-1.5 w-1.5 fill-accent-primary text-accent-primary" />
        </span>
      )}

      {/* Icon */}
      <Icon
        className={cn(
          'flex-shrink-0 transition-colors duration-200',
          isPrimary ? 'h-5 w-5' : 'h-4 w-4',
          item.active
            ? iconStatusStyles.active
            : iconStatusStyles[item.status || 'default']
        )}
      />

      {/* Label */}
      <span
        className={cn(
          'whitespace-nowrap transition-all duration-300 ease-in-out',
          collapsed ? 'w-0 overflow-hidden opacity-0' : 'w-auto opacity-100',
          isPrimary ? 'font-medium' : 'font-normal text-text-secondary'
        )}
      >
        {item.label}
      </span>

      {/* Shortcut hint */}
      {item.shortcutHint && !collapsed && (
        <span className="ml-auto text-xs text-text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {item.shortcutHint}
        </span>
      )}

      {/* Badge - inline when expanded */}
      {item.badge !== undefined && !collapsed && !item.shortcutHint && (
        <span
          className={cn(
            'ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold',
            'transition-transform duration-200 group-hover:scale-110',
            item.status === 'running'
              ? 'bg-info text-info-foreground'
              : item.status === 'error'
                ? 'bg-error text-error-foreground'
                : item.status === 'success'
                  ? 'bg-success text-success-foreground'
                  : 'bg-accent-primary text-accent-primary-foreground'
          )}
        >
          {item.badge}
        </span>
      )}

      {/* Badge - positioned when collapsed */}
      {item.badge !== undefined && collapsed && (
        <span
          className={cn(
            'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
            'duration-200 animate-in fade-in zoom-in-95',
            item.status === 'running'
              ? 'bg-info text-info-foreground'
              : item.status === 'error'
                ? 'bg-error text-error-foreground'
                : item.status === 'success'
                  ? 'bg-success text-success-foreground'
                  : 'bg-accent-primary text-accent-primary-foreground'
          )}
        >
          {item.badge}
        </span>
      )}
    </>
  );

  // Render as Link if href is provided, otherwise as button
  if (item.href) {
    return (
      <Link
        ref={buttonRef as React.Ref<HTMLAnchorElement>}
        href={item.href}
        onClick={handleClick}
        onFocus={onFocus}
        tabIndex={item.disabled ? -1 : tabIndex}
        className={sharedClassName}
        title={collapsed ? item.label : item.tooltip}
        aria-label={item.label}
        aria-current={item.active ? 'page' : undefined}
        aria-disabled={item.disabled}
        data-priority={item.priority}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      ref={buttonRef as React.Ref<HTMLButtonElement>}
      onClick={handleClick}
      onFocus={onFocus}
      tabIndex={item.disabled ? -1 : tabIndex}
      disabled={item.disabled}
      className={sharedClassName}
      title={collapsed ? item.label : item.tooltip}
      aria-label={item.label}
      aria-current={item.active ? 'page' : undefined}
      aria-disabled={item.disabled}
      data-priority={item.priority}
    >
      {content}
    </button>
  );
}

/* ============================================
   DESKTOP/TABLET SIDEBAR
   ============================================ */

interface SidebarProps {
  primaryItems: NavItem[];
  secondaryItems: NavItem[];
  statusIndicators: StatusIndicator[];
  collapsed: boolean;
  onToggle: () => void;
  logo?: ReactNode;
  focusedIndex: number;
  onFocusChange: (index: number) => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  className?: string;
}

function Sidebar({
  primaryItems,
  secondaryItems,
  statusIndicators,
  collapsed,
  onToggle,
  logo,
  focusedIndex,
  onFocusChange,
  onKeyDown,
  className,
}: SidebarProps) {
  const _allItems = [...primaryItems, ...secondaryItems];

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border-default bg-surface-raised',
        'transition-[width] duration-300 ease-in-out will-change-[width]',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
      style={
        {
          '--sidebar-width': collapsed
            ? SIDEBAR_COLLAPSED_WIDTH
            : SIDEBAR_WIDTH,
        } as React.CSSProperties
      }
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Header / Logo Area */}
      <div
        className={cn(
          'flex h-14 items-center border-b border-border-default',
          'transition-all duration-300 ease-in-out',
          collapsed ? 'justify-center px-2' : 'justify-between px-4'
        )}
      >
        <div
          className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out',
            collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
          )}
        >
          {logo || (
            <span className="whitespace-nowrap text-lg font-semibold text-text-primary">
              Forge
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className={cn(
            'h-8 w-8 flex-shrink-0 text-text-muted hover:text-text-primary',
            'transition-transform duration-300 ease-in-out'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Status Indicators */}
      {statusIndicators.length > 0 && (
        <div
          className={cn(
            'flex flex-wrap gap-2 border-b border-border-default px-3 py-2.5',
            'transition-all duration-300 ease-in-out',
            collapsed && 'flex-col items-center gap-1.5 px-2'
          )}
        >
          {statusIndicators.map((indicator) => (
            <StatusIndicatorBadge
              key={indicator.id}
              indicator={indicator}
              collapsed={collapsed}
            />
          ))}
        </div>
      )}

      {/* Primary Navigation */}
      <nav
        className="scrollbar-hide flex-1 overflow-y-auto overflow-x-hidden p-2"
        onKeyDown={onKeyDown}
        aria-label="Primary navigation"
      >
        {/* Section label - only visible when not collapsed */}
        {!collapsed && (
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Main
          </div>
        )}
        <div className="space-y-1" role="list">
          {primaryItems.map((item, index) => (
            <NavItemButton
              key={item.id}
              item={item}
              collapsed={collapsed}
              focused={focusedIndex === index}
              onFocus={() => onFocusChange(index)}
              tabIndex={focusedIndex === index ? 0 : -1}
            />
          ))}
        </div>
      </nav>

      {/* Secondary Navigation (Settings, Help) */}
      <div
        className="border-t border-border-default p-2"
        role="list"
        aria-label="Secondary navigation"
      >
        {/* Section label - only visible when not collapsed */}
        {!collapsed && (
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
            More
          </div>
        )}
        <div className="space-y-1">
          {secondaryItems.map((item, index) => (
            <NavItemButton
              key={item.id}
              item={item}
              collapsed={collapsed}
              focused={focusedIndex === primaryItems.length + index}
              onFocus={() => onFocusChange(primaryItems.length + index)}
              tabIndex={focusedIndex === primaryItems.length + index ? 0 : -1}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

/* ============================================
   MOBILE DRAWER
   ============================================ */

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  primaryItems: NavItem[];
  secondaryItems: NavItem[];
  statusIndicators: StatusIndicator[];
  logo?: ReactNode;
  focusedIndex: number;
  onFocusChange: (index: number) => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}

function MobileDrawer({
  open,
  onClose,
  primaryItems,
  secondaryItems,
  statusIndicators,
  logo,
  focusedIndex,
  onFocusChange,
  onKeyDown,
}: MobileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef<number | null>(null);
  const isDragging = useRef(false);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Focus trap and initial focus
  useEffect(() => {
    if (open && closeButtonRef.current) {
      // Focus the close button when drawer opens for immediate keyboard accessibility
      closeButtonRef.current.focus();
    }
  }, [open]);

  // Touch swipe to close
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartX.current = touch.clientX;
      isDragging.current = true;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging.current || touchStartX.current === null) return;

      const touch = e.touches[0];
      if (!touch) return;

      const currentX = touch.clientX;
      const diff = touchStartX.current - currentX;

      // If swiping left more than 50px, close the drawer
      if (diff > 50) {
        isDragging.current = false;
        onClose();
      }
    },
    [onClose]
  );

  const handleTouchEnd = useCallback(() => {
    touchStartX.current = null;
    isDragging.current = false;
  }, []);

  return (
    <>
      {/* Backdrop with fade animation */}
      <div
        className={cn(
          'fixed inset-0 z-overlay bg-black/60 backdrop-blur-sm md:hidden',
          'transition-all duration-300 ease-out',
          open
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel with slide animation */}
      <div
        ref={drawerRef}
        className={cn(
          'fixed inset-y-0 left-0 z-modal flex flex-col bg-surface-raised md:hidden',
          'safe-top safe-bottom shadow-elevation-highest',
          'transition-transform duration-300 ease-out will-change-transform',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ width: MOBILE_DRAWER_WIDTH }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!open}
        data-state={open ? 'open' : 'closed'}
        inert={!open ? true : undefined}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header with close button */}
        <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border-default px-4">
          <div className="flex items-center gap-3">
            {logo || (
              <span className="text-lg font-semibold text-text-primary">
                Forge
              </span>
            )}
          </div>
          <Button
            ref={closeButtonRef}
            variant="ghost"
            size="icon"
            onClick={onClose}
            className={cn(
              'h-9 w-9 text-text-muted hover:text-text-primary',
              'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus'
            )}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Status Indicators - compact horizontal list */}
        {statusIndicators.length > 0 && (
          <div className="flex flex-shrink-0 flex-wrap gap-2 border-b border-border-default px-4 py-3">
            {statusIndicators.map((indicator) => (
              <StatusIndicatorBadge key={indicator.id} indicator={indicator} />
            ))}
          </div>
        )}

        {/* Primary Navigation - scrollable */}
        <nav
          className="scrollbar-hide min-h-0 flex-1 overflow-y-auto p-3"
          onKeyDown={onKeyDown}
          aria-label="Primary navigation"
        >
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Main
          </div>
          <div className="space-y-1" role="list">
            {primaryItems.map((item, index) => (
              <NavItemButton
                key={item.id}
                item={item}
                collapsed={false}
                focused={focusedIndex === index}
                onClick={onClose}
                onFocus={() => onFocusChange(index)}
                tabIndex={focusedIndex === index ? 0 : -1}
              />
            ))}
          </div>
        </nav>

        {/* Secondary Navigation - fixed at bottom */}
        <div
          className="flex-shrink-0 border-t border-border-default p-3"
          role="list"
          aria-label="Secondary navigation"
        >
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
            More
          </div>
          <div className="space-y-1">
            {secondaryItems.map((item, index) => (
              <NavItemButton
                key={item.id}
                item={item}
                collapsed={false}
                focused={focusedIndex === primaryItems.length + index}
                onClick={onClose}
                onFocus={() => onFocusChange(primaryItems.length + index)}
                tabIndex={focusedIndex === primaryItems.length + index ? 0 : -1}
              />
            ))}
          </div>
        </div>

        {/* Swipe hint indicator */}
        <div
          className="absolute right-0 top-1/2 h-16 w-1 -translate-y-1/2 rounded-l bg-border-default opacity-50"
          aria-hidden="true"
        />
      </div>
    </>
  );
}

/* ============================================
   MOBILE HEADER
   ============================================ */

interface MobileHeaderProps {
  onMenuOpen: () => void;
  statusIndicators: StatusIndicator[];
  header?: ReactNode;
}

function MobileHeader({
  onMenuOpen,
  statusIndicators,
  header,
}: MobileHeaderProps) {
  // Show only the most important indicators on mobile (max 2)
  const visibleIndicators = statusIndicators.slice(0, 2);
  const hasRunningIndicator = statusIndicators.some((i) => i.pulse);

  return (
    <header className="safe-top flex h-14 items-center justify-between border-b border-border-default bg-surface-raised px-4 md:hidden">
      {/* Hamburger menu button with optional running indicator */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuOpen}
          className={cn(
            'h-10 w-10 text-text-muted hover:text-text-primary',
            'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus'
          )}
          aria-label="Open navigation menu"
          aria-expanded="false"
        >
          <Menu className="h-5 w-5" />
        </Button>
        {/* Running tasks indicator dot */}
        {hasRunningIndicator && (
          <span
            className="absolute right-1 top-1 flex h-2.5 w-2.5"
            aria-hidden="true"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-info" />
          </span>
        )}
      </div>

      {/* Center logo/title */}
      <div className="flex flex-1 justify-center">
        {header || (
          <span className="text-lg font-semibold text-text-primary">
            Forge
          </span>
        )}
      </div>

      {/* Mobile status indicators (compact) */}
      <div className="flex min-w-10 items-center justify-end gap-1.5">
        {visibleIndicators.map((indicator) => (
          <StatusIndicatorBadge
            key={indicator.id}
            indicator={indicator}
            collapsed
          />
        ))}
      </div>
    </header>
  );
}

/* ============================================
   DEFAULT NAV ITEMS
   ============================================ */

export const defaultNavItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    priority: 'primary',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: ListTodo,
    href: '/tasks',
    priority: 'primary',
    badge: 0,
  },
  {
    id: 'plans',
    label: 'Plans',
    icon: Map,
    href: '/plans',
    priority: 'primary',
  },
  {
    id: 'repositories',
    label: 'Repositories',
    icon: FolderGit2,
    href: '/repositories',
    priority: 'primary',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    href: '/settings',
    priority: 'secondary',
  },
  { id: 'help', label: 'Help', icon: HelpCircle, priority: 'secondary' },
];

/* ============================================
   MAIN NAVIGATION COMPONENT
   ============================================ */

export function Navigation({
  items = defaultNavItems,
  statusIndicators = [],
  defaultCollapsed = false,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  logo,
  mobileHeader,
  className,
  shortcuts = {},
}: NavigationProps) {
  // State
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const breakpoint = useBreakpoint();

  // Controlled vs uncontrolled collapsed state
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = useCallback(
    (value: boolean) => {
      setInternalCollapsed(value);
      onCollapsedChange?.(value);
    },
    [onCollapsedChange]
  );

  const toggleCollapsed = useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  // Split items by priority
  const primaryItems = useMemo(
    () => items.filter((item) => item.priority === 'primary'),
    [items]
  );
  const secondaryItems = useMemo(
    () => items.filter((item) => item.priority === 'secondary'),
    [items]
  );
  const allItems = useMemo(
    () => [...primaryItems, ...secondaryItems],
    [primaryItems, secondaryItems]
  );

  // Close mobile menu on breakpoint change
  useEffect(() => {
    if (breakpoint !== 'mobile' && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [breakpoint, mobileMenuOpen]);

  // Enhanced keyboard navigation with skip functionality
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      const itemCount = allItems.length;

      // Skip disabled items when navigating
      const findNextEnabled = (
        startIndex: number,
        direction: 1 | -1
      ): number => {
        let index = startIndex;
        let attempts = 0;
        while (attempts < itemCount) {
          index = (index + direction + itemCount) % itemCount;
          if (!allItems[index]?.disabled) {
            return index;
          }
          attempts++;
        }
        return startIndex; // Fallback if all items are disabled
      };

      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault();
          setFocusedIndex(findNextEnabled(focusedIndex, 1));
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault();
          setFocusedIndex(findNextEnabled(focusedIndex, -1));
          break;
        case 'Home':
          e.preventDefault();
          // Find first non-disabled item
          for (let i = 0; i < itemCount; i++) {
            if (!allItems[i]?.disabled) {
              setFocusedIndex(i);
              break;
            }
          }
          break;
        case 'End':
          e.preventDefault();
          // Find last non-disabled item
          for (let i = itemCount - 1; i >= 0; i--) {
            if (!allItems[i]?.disabled) {
              setFocusedIndex(i);
              break;
            }
          }
          break;
        case 'Enter':
        case ' ': {
          e.preventDefault();
          const item = allItems[focusedIndex];
          if (item && !item.disabled) {
            item.onClick?.();
            if (breakpoint === 'mobile') {
              setMobileMenuOpen(false);
            }
          }
          break;
        }
        case 'Tab':
          // Allow normal tab behavior but announce current position
          break;
      }
    },
    [allItems, focusedIndex, breakpoint]
  );

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      // Check for modifier key (Cmd on Mac, Ctrl on others)
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifierPressed = isMac ? e.metaKey : e.ctrlKey;

      if (!modifierPressed) return;

      // Check for registered shortcuts
      for (const [itemId, key] of Object.entries(shortcuts)) {
        if (e.key === key) {
          e.preventDefault();
          const item = allItems.find((i) => i.id === itemId);
          if (item && !item.disabled) {
            item.onClick?.();
          }
          break;
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [shortcuts, allItems]);

  // Context value
  const contextValue: NavigationContextValue = {
    collapsed,
    setCollapsed,
    toggleCollapsed,
    mobileMenuOpen,
    setMobileMenuOpen,
    focusedIndex,
    setFocusedIndex,
    breakpoint,
  };

  return (
    <NavigationContext.Provider value={contextValue}>
      <div className={cn('flex h-full', className)}>
        {/* Mobile Header */}
        <div className="fixed left-0 right-0 top-0 z-sticky md:hidden">
          <MobileHeader
            onMenuOpen={() => setMobileMenuOpen(true)}
            statusIndicators={statusIndicators}
            header={mobileHeader}
          />
        </div>

        {/* Mobile Drawer */}
        <MobileDrawer
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          primaryItems={primaryItems}
          secondaryItems={secondaryItems}
          statusIndicators={statusIndicators}
          logo={logo}
          focusedIndex={focusedIndex}
          onFocusChange={setFocusedIndex}
          onKeyDown={handleKeyDown}
        />

        {/* Desktop/Tablet Sidebar */}
        <div className="hidden h-full md:block">
          <Sidebar
            primaryItems={primaryItems}
            secondaryItems={secondaryItems}
            statusIndicators={statusIndicators}
            collapsed={collapsed}
            onToggle={toggleCollapsed}
            logo={logo}
            focusedIndex={focusedIndex}
            onFocusChange={setFocusedIndex}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>
    </NavigationContext.Provider>
  );
}

export default Navigation;
