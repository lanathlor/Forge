import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navigation, useNavigation, type NavItem } from '../Navigation';
import { Activity, Map, Settings, HelpCircle } from 'lucide-react';

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/dashboard'),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
}));

// Mock window.matchMedia for breakpoint detection
const mockMatchMedia = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

// Helper to get the desktop sidebar
const getDesktopSidebar = () => {
  return screen.getByRole('navigation', { name: /main navigation/i });
};

// Test navigation items
const testNavItems: NavItem[] = [
  {
    id: 'sessions',
    label: 'Sessions',
    icon: Activity,
    priority: 'primary',
    active: true,
  },
  {
    id: 'plans',
    label: 'Plans',
    icon: Map,
    priority: 'primary',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    priority: 'secondary',
  },
  {
    id: 'help',
    label: 'Help',
    icon: HelpCircle,
    priority: 'secondary',
  },
];

describe('Navigation Component', () => {
  beforeEach(() => {
    // Default to desktop viewport
    mockMatchMedia(1280);
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render navigation items in desktop sidebar', () => {
      render(<Navigation items={testNavItems} />);

      const sidebar = getDesktopSidebar();
      expect(within(sidebar).getByText('Sessions')).toBeInTheDocument();
      expect(within(sidebar).getByText('Plans')).toBeInTheDocument();
      expect(within(sidebar).getByText('Settings')).toBeInTheDocument();
      expect(within(sidebar).getByText('Help')).toBeInTheDocument();
    });

    it('should render with default logo text', () => {
      render(<Navigation items={testNavItems} />);
      const sidebar = getDesktopSidebar();
      expect(within(sidebar).getByText('Autobot')).toBeInTheDocument();
    });

    it('should render custom logo', () => {
      render(
        <Navigation items={testNavItems} logo={<span data-testid="custom-logo">Custom Logo</span>} />
      );
      const sidebar = getDesktopSidebar();
      expect(within(sidebar).getByTestId('custom-logo')).toBeInTheDocument();
    });

    it('should have proper navigation role', () => {
      render(<Navigation items={testNavItems} />);
      expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
    });
  });

  describe('active state', () => {
    it('should apply active styling to active item', () => {
      render(<Navigation items={testNavItems} />);

      const sidebar = getDesktopSidebar();
      const sessionsButton = within(sidebar).getByRole('button', { name: 'Sessions' });
      expect(sessionsButton).toHaveAttribute('aria-current', 'page');
    });

    it('should not apply aria-current to inactive items', () => {
      render(<Navigation items={testNavItems} />);

      const sidebar = getDesktopSidebar();
      const plansButton = within(sidebar).getByRole('button', { name: 'Plans' });
      expect(plansButton).not.toHaveAttribute('aria-current');
    });
  });

  describe('collapsed state', () => {
    it('should start expanded by default', () => {
      render(<Navigation items={testNavItems} />);

      const sidebar = getDesktopSidebar();
      const collapseButton = within(sidebar).getByRole('button', { name: /collapse sidebar/i });
      expect(collapseButton).toBeInTheDocument();
    });

    it('should toggle collapsed state on button click', async () => {
      const user = userEvent.setup();
      render(<Navigation items={testNavItems} />);

      const sidebar = getDesktopSidebar();
      const collapseButton = within(sidebar).getByRole('button', { name: /collapse sidebar/i });
      await user.click(collapseButton);

      expect(within(sidebar).getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
    });

    it('should start collapsed when defaultCollapsed is true', () => {
      render(<Navigation items={testNavItems} defaultCollapsed />);

      const sidebar = getDesktopSidebar();
      expect(within(sidebar).getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
    });

    it('should call onCollapsedChange when toggled', async () => {
      const user = userEvent.setup();
      const onCollapsedChange = vi.fn();

      render(
        <Navigation items={testNavItems} onCollapsedChange={onCollapsedChange} />
      );

      const sidebar = getDesktopSidebar();
      const collapseButton = within(sidebar).getByRole('button', { name: /collapse sidebar/i });
      await user.click(collapseButton);

      expect(onCollapsedChange).toHaveBeenCalledWith(true);
    });

    it('should support controlled collapsed state', () => {
      const { rerender } = render(
        <Navigation items={testNavItems} collapsed={false} />
      );

      const sidebar = getDesktopSidebar();
      expect(within(sidebar).getByRole('button', { name: /collapse sidebar/i })).toBeInTheDocument();

      rerender(<Navigation items={testNavItems} collapsed={true} />);

      expect(within(sidebar).getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
    });
  });

  describe('status indicators', () => {
    const statusIndicators = [
      { id: 'session', label: 'Session', value: 'Active', type: 'success' as const },
      { id: 'tasks', label: 'Running', value: 3, type: 'info' as const, pulse: true },
    ];

    it('should render status indicators', () => {
      render(
        <Navigation items={testNavItems} statusIndicators={statusIndicators} />
      );

      const sidebar = getDesktopSidebar();
      expect(within(sidebar).getByText('Active')).toBeInTheDocument();
      expect(within(sidebar).getByText('3')).toBeInTheDocument();
    });

    it('should apply pulse animation when pulse is true', () => {
      render(
        <Navigation items={testNavItems} statusIndicators={statusIndicators} />
      );

      const sidebar = getDesktopSidebar();
      // Check for animate-ping class on pulse indicator
      const pulsingElements = sidebar.querySelectorAll('.animate-ping');
      expect(pulsingElements.length).toBeGreaterThan(0);
    });
  });

  describe('badges', () => {
    it('should render badge on items with badge prop', () => {
      const itemsWithBadge: NavItem[] = [
        ...testNavItems,
        {
          id: 'tasks',
          label: 'Tasks',
          icon: Activity,
          priority: 'primary',
          badge: 5,
        },
      ];

      render(<Navigation items={itemsWithBadge} />);
      const sidebar = getDesktopSidebar();
      expect(within(sidebar).getByText('5')).toBeInTheDocument();
    });

    it('should not render badge when badge is undefined', () => {
      render(<Navigation items={testNavItems} />);

      const sidebar = getDesktopSidebar();
      // Sessions has no badge - check the button doesn't contain badge styling
      const sessionsButton = within(sidebar).getByRole('button', { name: 'Sessions' });
      // Badge would have min-w-5 class, check it's not there
      expect(sessionsButton.querySelector('.min-w-5')).toBeNull();
    });
  });

  describe('click handlers', () => {
    it('should call onClick when item is clicked', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      const itemsWithClick: NavItem[] = testNavItems.map(item => ({
        ...item,
        onClick: item.id === 'sessions' ? onClick : undefined,
      }));

      render(<Navigation items={itemsWithClick} />);

      const sidebar = getDesktopSidebar();
      await user.click(within(sidebar).getByRole('button', { name: 'Sessions' }));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when item is disabled', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      const itemsWithDisabled: NavItem[] = testNavItems.map(item => ({
        ...item,
        onClick: item.id === 'sessions' ? onClick : undefined,
        disabled: item.id === 'sessions',
      }));

      render(<Navigation items={itemsWithDisabled} />);

      const sidebar = getDesktopSidebar();
      await user.click(within(sidebar).getByRole('button', { name: 'Sessions' }));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('keyboard navigation', () => {
    it('should move focus with arrow keys', async () => {
      const user = userEvent.setup();
      render(<Navigation items={testNavItems} />);

      const sidebar = getDesktopSidebar();
      const sessionsButton = within(sidebar).getByRole('button', { name: 'Sessions' });
      sessionsButton.focus();

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(document.activeElement).toBe(within(sidebar).getByRole('button', { name: 'Plans' }));
      });
    });

    it('should wrap focus at the end using ArrowUp from first item', async () => {
      const user = userEvent.setup();
      render(<Navigation items={testNavItems} />);

      const sidebar = getDesktopSidebar();
      const sessionsButton = within(sidebar).getByRole('button', { name: 'Sessions' });
      sessionsButton.focus();

      // Navigate up from first item, should wrap to last
      await user.keyboard('{ArrowUp}');

      await waitFor(() => {
        expect(document.activeElement).toBe(within(sidebar).getByRole('button', { name: 'Help' }));
      });
    });

    it('should navigate to first item on Home key', async () => {
      const user = userEvent.setup();
      render(<Navigation items={testNavItems} />);

      const sidebar = getDesktopSidebar();
      const plansButton = within(sidebar).getByRole('button', { name: 'Plans' });
      plansButton.focus();

      await user.keyboard('{Home}');

      await waitFor(() => {
        expect(document.activeElement).toBe(within(sidebar).getByRole('button', { name: 'Sessions' }));
      });
    });

    it('should navigate to last item on End key', async () => {
      const user = userEvent.setup();
      render(<Navigation items={testNavItems} />);

      const sidebar = getDesktopSidebar();
      const sessionsButton = within(sidebar).getByRole('button', { name: 'Sessions' });
      sessionsButton.focus();

      await user.keyboard('{End}');

      await waitFor(() => {
        expect(document.activeElement).toBe(within(sidebar).getByRole('button', { name: 'Help' }));
      });
    });

    it('should trigger click on Enter key', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      const itemsWithClick: NavItem[] = testNavItems.map(item => ({
        ...item,
        onClick: item.id === 'sessions' ? onClick : undefined,
      }));

      render(<Navigation items={itemsWithClick} />);

      const sidebar = getDesktopSidebar();
      const sessionsButton = within(sidebar).getByRole('button', { name: 'Sessions' });
      sessionsButton.focus();

      await user.keyboard('{Enter}');
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should trigger click on Space key', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      const itemsWithClick: NavItem[] = testNavItems.map(item => ({
        ...item,
        onClick: item.id === 'sessions' ? onClick : undefined,
      }));

      render(<Navigation items={itemsWithClick} />);

      const sidebar = getDesktopSidebar();
      const sessionsButton = within(sidebar).getByRole('button', { name: 'Sessions' });
      sessionsButton.focus();

      await user.keyboard(' ');
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('shortcut hints', () => {
    it('should display shortcut hints when provided', () => {
      const itemsWithShortcuts: NavItem[] = testNavItems.map(item => ({
        ...item,
        shortcutHint: item.id === 'sessions' ? '⌘1' : undefined,
      }));

      render(<Navigation items={itemsWithShortcuts} />);
      const sidebar = getDesktopSidebar();
      expect(within(sidebar).getByText('⌘1')).toBeInTheDocument();
    });
  });

  describe('visual hierarchy', () => {
    it('should render primary and secondary items in separate sections', () => {
      render(<Navigation items={testNavItems} />);

      const sidebar = getDesktopSidebar();
      const navSections = within(sidebar).getAllByRole('list');
      expect(navSections.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('accessibility', () => {
    it('should have proper aria-labels on navigation sections', () => {
      render(<Navigation items={testNavItems} />);

      const sidebar = getDesktopSidebar();
      expect(within(sidebar).getByLabelText(/primary navigation/i)).toBeInTheDocument();
      expect(within(sidebar).getByLabelText(/secondary navigation/i)).toBeInTheDocument();
    });

    it('should mark disabled items with aria-disabled', () => {
      const itemsWithDisabled: NavItem[] = testNavItems.map(item => ({
        ...item,
        disabled: item.id === 'sessions',
      }));

      render(<Navigation items={itemsWithDisabled} />);

      const sidebar = getDesktopSidebar();
      const sessionsButton = within(sidebar).getByRole('button', { name: 'Sessions' });
      expect(sessionsButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('should have proper collapse button aria attributes', () => {
      render(<Navigation items={testNavItems} />);

      const sidebar = getDesktopSidebar();
      const collapseButton = within(sidebar).getByRole('button', { name: /collapse sidebar/i });
      expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
    });
  });
});

describe('Navigation with mobile viewport', () => {
  beforeEach(() => {
    mockMatchMedia(375);
    vi.clearAllMocks();
  });

  it('should show mobile header on small screens', async () => {
    render(<Navigation items={testNavItems} />);

    // Mobile header should show the hamburger menu button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open navigation menu/i })).toBeInTheDocument();
    });
  });

  it('should open mobile drawer when hamburger is clicked', async () => {
    const user = userEvent.setup();
    render(<Navigation items={testNavItems} />);

    const hamburgerButton = screen.getByRole('button', { name: /open navigation menu/i });
    await user.click(hamburgerButton);

    // Drawer should be open - use queryBy to get the element
    await waitFor(() => {
      const drawer = document.querySelector('[role="dialog"][aria-label="Navigation menu"]');
      expect(drawer).toHaveAttribute('data-state', 'open');
    });
  });

  it('should close mobile drawer on close button click', async () => {
    const user = userEvent.setup();
    render(<Navigation items={testNavItems} />);

    // Open drawer
    await user.click(screen.getByRole('button', { name: /open navigation menu/i }));

    // Wait for drawer to open
    await waitFor(() => {
      const drawer = document.querySelector('[role="dialog"][aria-label="Navigation menu"]');
      expect(drawer).toHaveAttribute('data-state', 'open');
    });

    // Close drawer
    await user.click(screen.getByRole('button', { name: /close menu/i }));

    // Drawer should be closed
    await waitFor(() => {
      const drawer = document.querySelector('[role="dialog"][aria-label="Navigation menu"]');
      expect(drawer).toHaveAttribute('data-state', 'closed');
    });
  });
});

// Test the useNavigation hook
describe('useNavigation hook', () => {
  beforeEach(() => {
    mockMatchMedia(1280);
    vi.clearAllMocks();
  });

  function TestComponent() {
    const { collapsed, toggleCollapsed, breakpoint } = useNavigation();
    return (
      <div>
        <span data-testid="collapsed">{collapsed ? 'true' : 'false'}</span>
        <span data-testid="breakpoint">{breakpoint}</span>
        <button onClick={toggleCollapsed}>Toggle</button>
      </div>
    );
  }

  it('should throw when used outside Navigation', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useNavigation must be used within a Navigation component');

    consoleSpy.mockRestore();
  });
});

describe('Navigation priority indicators', () => {
  beforeEach(() => {
    mockMatchMedia(1280);
    vi.clearAllMocks();
  });

  it('should render section labels when sidebar is expanded', () => {
    render(<Navigation items={testNavItems} />);

    const sidebar = screen.getByRole('navigation', { name: /main navigation/i });
    expect(within(sidebar).getByText('Main')).toBeInTheDocument();
    expect(within(sidebar).getByText('More')).toBeInTheDocument();
  });

  it('should apply data-priority attribute to nav items', () => {
    render(<Navigation items={testNavItems} />);

    const sidebar = screen.getByRole('navigation', { name: /main navigation/i });
    const sessionsButton = within(sidebar).getByRole('button', { name: 'Sessions' });
    expect(sessionsButton).toHaveAttribute('data-priority', 'primary');

    const settingsButton = within(sidebar).getByRole('button', { name: 'Settings' });
    expect(settingsButton).toHaveAttribute('data-priority', 'secondary');
  });

  it('should display different badge colors based on status', () => {
    const itemsWithStatus: NavItem[] = [
      {
        id: 'running-item',
        label: 'Running Task',
        icon: Activity,
        priority: 'primary',
        badge: 5,
        status: 'running',
      },
      {
        id: 'error-item',
        label: 'Error Task',
        icon: Activity,
        priority: 'primary',
        badge: 2,
        status: 'error',
      },
    ];

    render(<Navigation items={itemsWithStatus} />);

    const sidebar = screen.getByRole('navigation', { name: /main navigation/i });

    // Check running badge has info styling
    const runningBadge = within(sidebar).getByText('5');
    expect(runningBadge).toHaveClass('bg-info');

    // Check error badge has error styling
    const errorBadge = within(sidebar).getByText('2');
    expect(errorBadge).toHaveClass('bg-error');
  });
});

describe('Navigation keyboard navigation enhancements', () => {
  beforeEach(() => {
    mockMatchMedia(1280);
    vi.clearAllMocks();
  });

  it('should skip disabled items when navigating with arrow keys', async () => {
    const user = userEvent.setup();

    const itemsWithDisabled: NavItem[] = [
      { id: 'first', label: 'First', icon: Activity, priority: 'primary' },
      { id: 'disabled', label: 'Disabled', icon: Map, priority: 'primary', disabled: true },
      { id: 'third', label: 'Third', icon: Settings, priority: 'secondary' },
    ];

    render(<Navigation items={itemsWithDisabled} />);

    const sidebar = screen.getByRole('navigation', { name: /main navigation/i });
    const firstButton = within(sidebar).getByRole('button', { name: 'First' });
    firstButton.focus();

    // Navigate down - should skip disabled and go to Third
    await user.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(document.activeElement).toBe(within(sidebar).getByRole('button', { name: 'Third' }));
    });
  });

  it('should support ArrowRight for forward navigation', async () => {
    const user = userEvent.setup();
    render(<Navigation items={testNavItems} />);

    const sidebar = screen.getByRole('navigation', { name: /main navigation/i });
    const sessionsButton = within(sidebar).getByRole('button', { name: 'Sessions' });
    sessionsButton.focus();

    await user.keyboard('{ArrowRight}');

    await waitFor(() => {
      expect(document.activeElement).toBe(within(sidebar).getByRole('button', { name: 'Plans' }));
    });
  });

  it('should support ArrowLeft for backward navigation', async () => {
    const user = userEvent.setup();
    render(<Navigation items={testNavItems} />);

    const sidebar = screen.getByRole('navigation', { name: /main navigation/i });
    const plansButton = within(sidebar).getByRole('button', { name: 'Plans' });
    plansButton.focus();

    await user.keyboard('{ArrowLeft}');

    await waitFor(() => {
      expect(document.activeElement).toBe(within(sidebar).getByRole('button', { name: 'Sessions' }));
    });
  });
});
