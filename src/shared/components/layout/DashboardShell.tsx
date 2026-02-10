'use client';

import {
  useState,
  useCallback,
  useEffect,
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import { cn } from '@/shared/lib/utils';
import {
  ChevronRight,
  ChevronLeft,
  Home,
  FolderGit2,
  ListTodo,
  Settings,
  HelpCircle,
  Menu,
  X,
  PanelRightOpen,
  PanelRightClose,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

/* ============================================
   TYPES & INTERFACES
   ============================================ */

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  badge?: string | number;
  active?: boolean;
}

export interface DashboardShellContextValue {
  /** Whether the sidebar is collapsed (icons only) */
  sidebarCollapsed: boolean;
  /** Set sidebar collapsed state */
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** Toggle sidebar collapsed state */
  toggleSidebar: () => void;
  /** Whether the right panel is open */
  rightPanelOpen: boolean;
  /** Set right panel open state */
  setRightPanelOpen: (open: boolean) => void;
  /** Toggle right panel open state */
  toggleRightPanel: () => void;
  /** Whether the mobile menu is open */
  mobileMenuOpen: boolean;
  /** Set mobile menu open state */
  setMobileMenuOpen: (open: boolean) => void;
  /** Current breakpoint */
  breakpoint: 'mobile' | 'tablet' | 'desktop';
}

export interface DashboardShellProps {
  children: ReactNode;
  /** Navigation items for the sidebar */
  navItems?: NavItem[];
  /** Bottom navigation items (e.g., Settings, Help) */
  bottomNavItems?: NavItem[];
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Content for the right panel (desktop only) */
  rightPanel?: ReactNode;
  /** Title for the right panel header */
  rightPanelTitle?: string;
  /** Content for the action bar */
  actionBar?: ReactNode;
  /** Header content for mobile (optional) */
  header?: ReactNode;
  /** Logo/brand content for sidebar */
  logo?: ReactNode;
  /** Custom class name for the shell container */
  className?: string;
}

/* ============================================
   CSS CUSTOM PROPERTIES FOR LAYOUT
   ============================================ */

const CSS_VARS = {
  sidebarWidth: '--sidebar-width',
  sidebarCollapsedWidth: '--sidebar-collapsed-width',
  rightPanelWidth: '--right-panel-width',
  headerHeight: '--header-height',
  maxContentWidth: '--max-content-width',
} as const;

const LAYOUT_SIZES = {
  sidebarWidth: '16rem', // 256px
  sidebarCollapsedWidth: '4rem', // 64px
  rightPanelWidth: '20rem', // 320px
  headerHeight: '3.5rem', // 56px
  maxContentWidth: '80rem', // 1280px
} as const;

/* ============================================
   CONTEXT
   ============================================ */

const DashboardShellContext = createContext<DashboardShellContextValue | null>(null);

export function useDashboardShell() {
  const context = useContext(DashboardShellContext);
  if (!context) {
    throw new Error('useDashboardShell must be used within a DashboardShell');
  }
  return context;
}

/* ============================================
   BREAKPOINT HOOK
   ============================================ */

function useBreakpoint(): 'mobile' | 'tablet' | 'desktop' {
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

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
   SIDEBAR NAVIGATION ITEM
   ============================================ */

interface SidebarNavItemProps {
  item: NavItem;
  collapsed: boolean;
  onClick?: () => void;
}

function SidebarNavItem({ item, collapsed, onClick }: SidebarNavItemProps) {
  const Icon = item.icon;

  const handleClick = () => {
    item.onClick?.();
    onClick?.();
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
        'transition-all duration-200 ease-in-out',
        'hover:bg-surface-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2',
        item.active
          ? 'bg-accent-primary-subtle text-accent-primary'
          : 'text-text-secondary hover:text-text-primary',
        collapsed ? 'justify-center px-2' : 'justify-start'
      )}
      title={collapsed ? item.label : undefined}
      aria-label={item.label}
      aria-current={item.active ? 'page' : undefined}
    >
      <Icon
        className={cn(
          'h-5 w-5 flex-shrink-0 transition-colors duration-200',
          item.active ? 'text-accent-primary' : 'text-text-muted group-hover:text-text-primary'
        )}
      />
      <span
        className={cn(
          'whitespace-nowrap transition-all duration-300 ease-in-out',
          collapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'
        )}
      >
        {item.label}
      </span>
      {item.badge !== undefined && !collapsed && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-primary px-1.5 text-xs font-semibold text-accent-primary-foreground">
          {item.badge}
        </span>
      )}
      {item.badge !== undefined && collapsed && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-primary px-1 text-[10px] font-semibold text-accent-primary-foreground">
          {item.badge}
        </span>
      )}
    </button>
  );
}

/* ============================================
   SIDEBAR COMPONENT (Desktop/Tablet)
   ============================================ */

interface SidebarProps {
  navItems: NavItem[];
  bottomNavItems: NavItem[];
  collapsed: boolean;
  onToggle: () => void;
  logo?: ReactNode;
  className?: string;
}

function Sidebar({
  navItems,
  bottomNavItems,
  collapsed,
  onToggle,
  logo,
  className,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border-default bg-surface-raised',
        'transition-[width] duration-300 ease-in-out will-change-[width]',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
      style={{
        [CSS_VARS.sidebarWidth]: collapsed ? LAYOUT_SIZES.sidebarCollapsedWidth : LAYOUT_SIZES.sidebarWidth,
      } as React.CSSProperties}
    >
      {/* Logo / Brand Area */}
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
              Dashboard
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

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 scrollbar-hide">
        <div className="space-y-1">
          {navItems.map((item) => (
            <SidebarNavItem key={item.id} item={item} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      {/* Bottom Navigation (Settings, Help, etc.) */}
      <div className="border-t border-border-default p-2">
        <div className="space-y-1">
          {bottomNavItems.map((item) => (
            <SidebarNavItem key={item.id} item={item} collapsed={collapsed} />
          ))}
        </div>
      </div>
    </aside>
  );
}

/* ============================================
   MOBILE SIDEBAR OVERLAY
   ============================================ */

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
  navItems: NavItem[];
  bottomNavItems: NavItem[];
  logo?: ReactNode;
}

function MobileSidebar({ open, onClose, navItems, bottomNavItems, logo }: MobileSidebarProps) {
  // Prevent body scroll when menu is open
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
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden',
          'transition-opacity duration-300 ease-in-out',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar Panel */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-surface-raised md:hidden',
          'shadow-elevation-highest safe-top safe-bottom',
          'transition-transform duration-300 ease-in-out will-change-transform',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Header with Close Button */}
        <div className="flex h-14 items-center justify-between border-b border-border-default px-4">
          {logo || <span className="text-lg font-semibold text-text-primary">Menu</span>}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 text-text-muted hover:text-text-primary"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 scrollbar-hide">
          <div className="space-y-1">
            {navItems.map((item) => (
              <SidebarNavItem key={item.id} item={item} collapsed={false} onClick={onClose} />
            ))}
          </div>
        </nav>

        {/* Bottom Navigation */}
        <div className="border-t border-border-default p-3">
          <div className="space-y-1">
            {bottomNavItems.map((item) => (
              <SidebarNavItem key={item.id} item={item} collapsed={false} onClick={onClose} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================================
   CONTEXTUAL ACTION BAR
   ============================================ */

export interface ActionBarProps {
  children: ReactNode;
  className?: string;
  /** Position of the action bar */
  position?: 'top' | 'bottom' | 'floating';
}

export function ActionBar({ children, className, position = 'top' }: ActionBarProps) {
  const positionClasses = {
    top: 'relative',
    bottom: 'relative',
    floating: 'fixed bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-3xl w-[calc(100%-2rem)]',
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-lg border border-border-default bg-surface-raised px-4 py-2',
        'shadow-elevation-low',
        'transition-all duration-200 ease-in-out',
        positionClasses[position],
        className
      )}
      role="toolbar"
      aria-label="Actions"
    >
      {children}
    </div>
  );
}

/* ============================================
   ACTION BAR SECTION (for grouping items)
   ============================================ */

export interface ActionBarSectionProps {
  children: ReactNode;
  className?: string;
  /** Alignment within the section */
  align?: 'start' | 'center' | 'end';
}

export function ActionBarSection({ children, className, align = 'start' }: ActionBarSectionProps) {
  const alignClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
  };

  return (
    <div className={cn('flex items-center gap-2', alignClasses[align], className)}>{children}</div>
  );
}

/* ============================================
   RIGHT PANEL COMPONENT
   ============================================ */

interface RightPanelProps {
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  title?: string;
  className?: string;
}

function RightPanel({ children, open, onClose, title = 'Details', className }: RightPanelProps) {
  return (
    <aside
      className={cn(
        'hidden xl:flex h-full flex-col border-l border-border-default bg-surface-raised',
        'transition-[width,opacity] duration-300 ease-in-out will-change-[width,opacity]',
        'overflow-hidden',
        open ? 'w-80 opacity-100' : 'w-0 opacity-0',
        className
      )}
      aria-hidden={!open}
      aria-label={title}
    >
      <div
        className={cn(
          'flex h-14 min-w-80 items-center justify-between border-b border-border-default px-4',
          'transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0'
        )}
      >
        <span className="text-sm font-medium text-text-primary">{title}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7 text-text-muted hover:text-text-primary"
          aria-label="Close panel"
          tabIndex={open ? 0 : -1}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div
        className={cn(
          'flex-1 min-w-80 overflow-y-auto p-4 scrollbar-hide',
          'transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0'
        )}
      >
        {children}
      </div>
    </aside>
  );
}

/* ============================================
   MAIN CONTENT AREA
   ============================================ */

interface MainContentProps {
  children: ReactNode;
  actionBar?: ReactNode;
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  hasRightPanel: boolean;
  className?: string;
}

function MainContent({
  children,
  actionBar,
  rightPanelOpen,
  onToggleRightPanel,
  hasRightPanel,
  className,
}: MainContentProps) {
  return (
    <main
      className={cn(
        'flex flex-1 flex-col overflow-hidden bg-surface-base',
        'transition-all duration-300 ease-in-out',
        className
      )}
      role="main"
    >
      {/* Action Bar Area (contextual actions) */}
      {actionBar && (
        <div className="flex-shrink-0 border-b border-border-default bg-surface-base px-4 py-3 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{actionBar}</div>
        </div>
      )}

      {/* Content Area with max-width constraint */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="mx-auto h-full w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </div>

      {/* Right Panel Toggle (desktop only, when right panel content exists) */}
      {hasRightPanel && (
        <div className="hidden xl:block fixed right-4 top-4 z-20">
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleRightPanel}
            className={cn(
              'h-9 w-9 bg-surface-raised shadow-elevation-low border-border-default',
              'transition-all duration-200 ease-in-out',
              rightPanelOpen ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 scale-100'
            )}
            aria-label={rightPanelOpen ? 'Close details panel' : 'Open details panel'}
            aria-expanded={rightPanelOpen}
          >
            <PanelRightOpen className="h-5 w-5" />
          </Button>
        </div>
      )}
    </main>
  );
}

/* ============================================
   MOBILE HEADER
   ============================================ */

interface MobileHeaderProps {
  onMenuClick: () => void;
  header?: ReactNode;
}

function MobileHeader({ onMenuClick, header }: MobileHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border-default bg-surface-raised px-4 md:hidden safe-top">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="h-9 w-9 text-text-muted hover:text-text-primary"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      {header || <span className="text-lg font-semibold text-text-primary">Dashboard</span>}
      <div className="w-9" aria-hidden="true" />
    </header>
  );
}

/* ============================================
   DEFAULT NAV ITEMS
   ============================================ */

const defaultNavItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, active: true },
  { id: 'repositories', label: 'Repositories', icon: FolderGit2 },
  { id: 'tasks', label: 'Tasks', icon: ListTodo, badge: 3 },
];

const defaultBottomNavItems: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'help', label: 'Help', icon: HelpCircle },
];

/* ============================================
   DASHBOARD SHELL COMPONENT
   ============================================ */

export function DashboardShell({
  children,
  navItems = defaultNavItems,
  bottomNavItems = defaultBottomNavItems,
  defaultCollapsed = false,
  rightPanel,
  rightPanelTitle,
  actionBar,
  header,
  logo,
  className,
}: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(defaultCollapsed);
  const [rightPanelOpen, setRightPanelOpen] = useState(!!rightPanel);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const breakpoint = useBreakpoint();

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const toggleRightPanel = useCallback(() => {
    setRightPanelOpen((prev) => !prev);
  }, []);

  // Close mobile menu when breakpoint changes to tablet/desktop
  useEffect(() => {
    if (breakpoint !== 'mobile' && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [breakpoint, mobileMenuOpen]);

  // Sync right panel state when prop changes
  useEffect(() => {
    if (rightPanel && !rightPanelOpen) {
      setRightPanelOpen(true);
    }
  }, [rightPanel]);

  const contextValue: DashboardShellContextValue = {
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebar,
    rightPanelOpen,
    setRightPanelOpen,
    toggleRightPanel,
    mobileMenuOpen,
    setMobileMenuOpen,
    breakpoint,
  };

  return (
    <DashboardShellContext.Provider value={contextValue}>
      {/*
        CSS Grid Layout:
        - Mobile: Single column with stacked header + content
        - Tablet: Sidebar + Content (2 columns)
        - Desktop: Sidebar + Content + Right Panel (3 columns with optional panel)

        The layout uses CSS Grid at the outer level for the responsive structure,
        and Flexbox inside for the horizontal panel arrangement.
      */}
      <div
        className={cn(
          // Base: Full viewport height and width
          'h-screen w-full overflow-hidden bg-surface-base',
          // CSS Grid for responsive layout structure
          'grid',
          // Mobile: stacked layout (header row + content row)
          'grid-rows-[auto_1fr] grid-cols-1',
          // Tablet+: single row, columns handled by flex children
          'md:grid-rows-1 md:grid-cols-1',
          className
        )}
        style={{
          // CSS custom properties for layout calculations
          [CSS_VARS.sidebarWidth]: sidebarCollapsed ? LAYOUT_SIZES.sidebarCollapsedWidth : LAYOUT_SIZES.sidebarWidth,
          [CSS_VARS.rightPanelWidth]: rightPanelOpen ? LAYOUT_SIZES.rightPanelWidth : '0px',
          [CSS_VARS.headerHeight]: LAYOUT_SIZES.headerHeight,
          [CSS_VARS.maxContentWidth]: LAYOUT_SIZES.maxContentWidth,
        } as React.CSSProperties}
      >
        {/* Mobile Header - visible on mobile only */}
        <div className="md:hidden">
          <MobileHeader onMenuClick={() => setMobileMenuOpen(true)} header={header} />
        </div>

        {/* Mobile Sidebar Overlay */}
        <MobileSidebar
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          navItems={navItems}
          bottomNavItems={bottomNavItems}
          logo={logo}
        />

        {/*
          Main Layout Container - Uses Flexbox for horizontal arrangement
          This allows the sidebar and right panel to animate their width
          while the main content fills the remaining space.
        */}
        <div className="flex min-h-0 w-full overflow-hidden">
          {/* Desktop/Tablet Sidebar - hidden on mobile */}
          <div className="hidden md:block flex-shrink-0">
            <Sidebar
              navItems={navItems}
              bottomNavItems={bottomNavItems}
              collapsed={sidebarCollapsed}
              onToggle={toggleSidebar}
              logo={logo}
            />
          </div>

          {/* Main Content - grows to fill available space */}
          <MainContent
            actionBar={actionBar}
            rightPanelOpen={rightPanelOpen}
            onToggleRightPanel={toggleRightPanel}
            hasRightPanel={!!rightPanel}
          >
            {children}
          </MainContent>

          {/* Right Panel - desktop only (xl breakpoint), animates width */}
          {rightPanel && (
            <RightPanel
              open={rightPanelOpen}
              onClose={() => setRightPanelOpen(false)}
              title={rightPanelTitle}
            >
              {rightPanel}
            </RightPanel>
          )}
        </div>
      </div>
    </DashboardShellContext.Provider>
  );
}
