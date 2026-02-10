import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Home, Settings, HelpCircle, FolderGit2 } from 'lucide-react';
import { DashboardShell, useDashboardShell, type NavItem } from '../DashboardShell';

// Mock resize observer
const mockResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

vi.stubGlobal('ResizeObserver', mockResizeObserver);

describe('DashboardShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render children content', () => {
    render(
      <DashboardShell>
        <div data-testid="content">Main Content</div>
      </DashboardShell>
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('should render navigation items', () => {
    const navItems: NavItem[] = [
      { id: 'home', label: 'Home', icon: Home },
      { id: 'repositories', label: 'Repositories', icon: FolderGit2 },
    ];

    render(
      <DashboardShell navItems={navItems}>
        <div>Content</div>
      </DashboardShell>
    );

    // Use getAllByText since mobile and desktop may both render
    expect(screen.getAllByText('Home').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Repositories').length).toBeGreaterThanOrEqual(1);
  });

  it('should render bottom navigation items', () => {
    const bottomNavItems: NavItem[] = [
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'help', label: 'Help', icon: HelpCircle },
    ];

    render(
      <DashboardShell bottomNavItems={bottomNavItems}>
        <div>Content</div>
      </DashboardShell>
    );

    expect(screen.getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Help').length).toBeGreaterThanOrEqual(1);
  });

  it('should apply custom className', () => {
    render(
      <DashboardShell className="custom-class">
        <div>Content</div>
      </DashboardShell>
    );

    const container = document.querySelector('.custom-class');
    expect(container).toBeInTheDocument();
  });

  it('should call onClick when nav item is clicked', () => {
    const onClick = vi.fn();
    const navItems: NavItem[] = [
      { id: 'home', label: 'Home', icon: Home, onClick },
    ];

    render(
      <DashboardShell navItems={navItems}>
        <div>Content</div>
      </DashboardShell>
    );

    // Get all Home buttons and click the first one
    const homeButtons = screen.getAllByText('Home');
    fireEvent.click(homeButtons[0]!);
    expect(onClick).toHaveBeenCalled();
  });

  it('should render right panel when provided', () => {
    render(
      <DashboardShell rightPanel={<div data-testid="right-panel">Panel Content</div>}>
        <div>Content</div>
      </DashboardShell>
    );

    expect(screen.getByTestId('right-panel')).toBeInTheDocument();
  });

  it('should render action bar when provided', () => {
    render(
      <DashboardShell actionBar={<div data-testid="action-bar">Action Bar</div>}>
        <div>Content</div>
      </DashboardShell>
    );

    expect(screen.getByTestId('action-bar')).toBeInTheDocument();
  });

  describe('useDashboardShell', () => {
    it('should throw error when used outside DashboardShell', () => {
      const TestComponent = () => {
        const context = useDashboardShell();
        return <div>{context.breakpoint}</div>;
      };

      expect(() => render(<TestComponent />)).toThrow(
        'useDashboardShell must be used within a DashboardShell'
      );
    });

    it('should provide context values within DashboardShell', () => {
      let contextValue: ReturnType<typeof useDashboardShell> | null = null;

      const TestComponent = () => {
        contextValue = useDashboardShell();
        return <div>Test</div>;
      };

      render(
        <DashboardShell>
          <TestComponent />
        </DashboardShell>
      );

      expect(contextValue).not.toBeNull();
      expect(typeof contextValue!.sidebarCollapsed).toBe('boolean');
      expect(typeof contextValue!.rightPanelOpen).toBe('boolean');
      expect(typeof contextValue!.mobileMenuOpen).toBe('boolean');
      expect(typeof contextValue!.breakpoint).toBe('string');
      expect(typeof contextValue!.toggleSidebar).toBe('function');
      expect(typeof contextValue!.toggleRightPanel).toBe('function');
      expect(typeof contextValue!.setSidebarCollapsed).toBe('function');
      expect(typeof contextValue!.setRightPanelOpen).toBe('function');
      expect(typeof contextValue!.setMobileMenuOpen).toBe('function');
    });

    it('should have toggle functions that can be called', () => {
      const TestComponent = () => {
        const context = useDashboardShell();
        return (
          <>
            <button onClick={context.toggleSidebar} data-testid="toggle">Toggle</button>
            <button onClick={context.toggleRightPanel} data-testid="toggle-panel">Toggle Panel</button>
          </>
        );
      };

      render(
        <DashboardShell rightPanel={<div>Panel</div>}>
          <TestComponent />
        </DashboardShell>
      );

      // Just verify the functions can be called without error
      fireEvent.click(screen.getByTestId('toggle'));
      fireEvent.click(screen.getByTestId('toggle-panel'));
    });
  });

  describe('breakpoint detection', () => {
    it('should detect desktop breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true });

      let contextValue: ReturnType<typeof useDashboardShell> | null = null;

      const TestComponent = () => {
        contextValue = useDashboardShell();
        return <div>Test</div>;
      };

      render(
        <DashboardShell>
          <TestComponent />
        </DashboardShell>
      );

      expect(contextValue!.breakpoint).toBe('desktop');
    });
  });
});
