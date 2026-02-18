import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { AppLayout } from '../AppLayout';
import { ToastProvider } from '@/shared/components/ui/toast';
import { SSEProvider } from '@/shared/contexts/SSEContext';

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

// Create a mock store
const createMockStore = (sessionState = {}) =>
  configureStore({
    reducer: {
      session: () => ({
        currentSessionId: null,
        currentRepositoryId: null,
        isSidebarCollapsed: false,
        ...sessionState,
      }),
    },
  });

// Wrapper component that provides Redux store, ToastProvider, and SSEProvider
const createWrapper = (store: ReturnType<typeof createMockStore>) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>
      <SSEProvider>
        <ToastProvider>{children}</ToastProvider>
      </SSEProvider>
    </Provider>
  );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
};

describe('AppLayout', () => {
  beforeEach(() => {
    // Default to desktop viewport
    mockMatchMedia(1280);
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render children content', () => {
      const store = createMockStore();
      render(
        <Provider store={store}>
          <SSEProvider>
            <ToastProvider>
              <AppLayout>
                <div data-testid="test-content">Test Content</div>
              </AppLayout>
            </ToastProvider>
          </SSEProvider>
        </Provider>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should render navigation sidebar', () => {
      const store = createMockStore();
      render(
        <Provider store={store}>
          <SSEProvider>
            <ToastProvider>
              <AppLayout>
                <div>Content</div>
              </AppLayout>
            </ToastProvider>
          </SSEProvider>
        </Provider>
      );

      expect(
        screen.getByRole('navigation', { name: /main navigation/i })
      ).toBeInTheDocument();
    });

    it('should render with custom logo', () => {
      const store = createMockStore();
      render(
        <Provider store={store}>
          <SSEProvider>
            <ToastProvider>
              <AppLayout>
                <div>Content</div>
              </AppLayout>
            </ToastProvider>
          </SSEProvider>
        </Provider>
      );

      const sidebar = screen.getByRole('navigation', {
        name: /main navigation/i,
      });
      expect(within(sidebar).getByText('Forge')).toBeInTheDocument();
    });

    it('should render all navigation items', () => {
      const store = createMockStore();
      render(
        <Provider store={store}>
          <SSEProvider>
            <ToastProvider>
              <AppLayout>
                <div>Content</div>
              </AppLayout>
            </ToastProvider>
          </SSEProvider>
        </Provider>
      );

      const sidebar = screen.getByRole('navigation', {
        name: /main navigation/i,
      });
      expect(within(sidebar).getByText('Dashboard')).toBeInTheDocument();
      expect(within(sidebar).getByText('Tasks')).toBeInTheDocument();
      expect(within(sidebar).getByText('Plans')).toBeInTheDocument();
      expect(within(sidebar).getByText('Repositories')).toBeInTheDocument();
      expect(within(sidebar).getByText('Settings')).toBeInTheDocument();
      expect(within(sidebar).getByText('Help')).toBeInTheDocument();
    });
  });

  describe('active navigation item', () => {
    it('should set sessions as active by default', () => {
      const store = createMockStore();
      render(
        <Provider store={store}>
          <SSEProvider>
            <ToastProvider>
              <AppLayout>
                <div>Content</div>
              </AppLayout>
            </ToastProvider>
          </SSEProvider>
        </Provider>
      );

      const sidebar = screen.getByRole('navigation', {
        name: /main navigation/i,
      });
      const dashboardLink = within(sidebar).getByRole('link', {
        name: 'Dashboard',
      });
      expect(dashboardLink).toHaveAttribute('aria-current', 'page');
    });

    it('should set custom active nav item', () => {
      const store = createMockStore();
      render(
        <Provider store={store}>
          <SSEProvider>
            <ToastProvider>
              <AppLayout activeNavItem="plans">
                <div>Content</div>
              </AppLayout>
            </ToastProvider>
          </SSEProvider>
        </Provider>
      );

      const sidebar = screen.getByRole('navigation', {
        name: /main navigation/i,
      });
      const plansLink = within(sidebar).getByRole('link', { name: 'Plans' });
      expect(plansLink).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('sidebar collapse', () => {
    it('should render expanded sidebar by default', () => {
      const store = createMockStore({ isSidebarCollapsed: false });
      render(
        <Provider store={store}>
          <SSEProvider>
            <ToastProvider>
              <AppLayout>
                <div>Content</div>
              </AppLayout>
            </ToastProvider>
          </SSEProvider>
        </Provider>
      );

      const sidebar = screen.getByRole('navigation', {
        name: /main navigation/i,
      });
      const collapseButton = within(sidebar).getByRole('button', {
        name: /collapse sidebar/i,
      });
      expect(collapseButton).toBeInTheDocument();
    });

    it('should render collapsed sidebar when isSidebarCollapsed is true', () => {
      const store = createMockStore({ isSidebarCollapsed: true });
      render(
        <Provider store={store}>
          <SSEProvider>
            <ToastProvider>
              <AppLayout>
                <div>Content</div>
              </AppLayout>
            </ToastProvider>
          </SSEProvider>
        </Provider>
      );

      const sidebar = screen.getByRole('navigation', {
        name: /main navigation/i,
      });
      const expandButton = within(sidebar).getByRole('button', {
        name: /expand sidebar/i,
      });
      expect(expandButton).toBeInTheDocument();
    });

    it('should dispatch setSidebarCollapsed when toggle is clicked', async () => {
      const user = userEvent.setup();

      // Create store with action tracking
      const actionLog: unknown[] = [];
      const store = configureStore({
        reducer: {
          session: (state = { isSidebarCollapsed: false }, action) => {
            actionLog.push(action);
            if (action.type === 'session/setSidebarCollapsed') {
              return { ...state, isSidebarCollapsed: action.payload };
            }
            return state;
          },
        },
      });

      render(
        <Provider store={store}>
          <SSEProvider>
            <ToastProvider>
              <AppLayout>
                <div>Content</div>
              </AppLayout>
            </ToastProvider>
          </SSEProvider>
        </Provider>
      );

      const sidebar = screen.getByRole('navigation', {
        name: /main navigation/i,
      });
      const collapseButton = within(sidebar).getByRole('button', {
        name: /collapse sidebar/i,
      });
      await user.click(collapseButton);

      // Verify the action was dispatched
      const collapsedActions = actionLog.filter(
        (a: unknown) =>
          (a as { type?: string }).type === 'session/setSidebarCollapsed'
      );
      expect(collapsedActions.length).toBeGreaterThan(0);
    });
  });

  describe('layout structure', () => {
    it('should have proper flex layout', () => {
      const store = createMockStore();
      const { container } = render(
        <Provider store={store}>
          <SSEProvider>
            <ToastProvider>
              <AppLayout>
                <div>Content</div>
              </AppLayout>
            </ToastProvider>
          </SSEProvider>
        </Provider>
      );

      const layoutContainer = container.firstChild;
      expect(layoutContainer).toHaveClass('flex');
      expect(layoutContainer).toHaveClass('h-screen');
    });

    it('should render main content area', () => {
      const store = createMockStore();
      render(
        <Provider store={store}>
          <SSEProvider>
            <ToastProvider>
              <AppLayout>
                <div>Content</div>
              </AppLayout>
            </ToastProvider>
          </SSEProvider>
        </Provider>
      );

      const mainContent = screen.getByRole('main');
      expect(mainContent).toBeInTheDocument();
      expect(mainContent).toHaveClass('flex-1');
    });

    it('should apply custom className', () => {
      const store = createMockStore();
      const { container } = render(
        <Provider store={store}>
          <SSEProvider>
            <ToastProvider>
              <AppLayout className="custom-class">
                <div>Content</div>
              </AppLayout>
            </ToastProvider>
          </SSEProvider>
        </Provider>
      );

      const layoutContainer = container.firstChild;
      expect(layoutContainer).toHaveClass('custom-class');
    });
  });

  describe('accessibility', () => {
    it('should have proper landmark roles', () => {
      const store = createMockStore();
      render(
        <Provider store={store}>
          <SSEProvider>
            <ToastProvider>
              <AppLayout>
                <div>Content</div>
              </AppLayout>
            </ToastProvider>
          </SSEProvider>
        </Provider>
      );

      // Navigation component renders with main navigation role
      expect(
        screen.getByRole('navigation', { name: /main navigation/i })
      ).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('should support keyboard navigation in nav items', async () => {
      const user = userEvent.setup();
      const store = createMockStore();
      render(
        <Provider store={store}>
          <SSEProvider>
            <ToastProvider>
              <AppLayout>
                <div>Content</div>
              </AppLayout>
            </ToastProvider>
          </SSEProvider>
        </Provider>
      );

      const sidebar = screen.getByRole('navigation', {
        name: /main navigation/i,
      });
      const dashboardLink = within(sidebar).getByRole('link', {
        name: 'Dashboard',
      });

      // Focus the first nav item
      dashboardLink.focus();
      expect(document.activeElement).toBe(dashboardLink);

      // Navigate with arrow key
      await user.keyboard('{ArrowDown}');

      // Should move focus to next item
      const tasksLink = within(sidebar).getByRole('link', { name: 'Tasks' });
      expect(document.activeElement).toBe(tasksLink);
    });
  });
});

describe('AppLayout with mobile viewport', () => {
  beforeEach(() => {
    mockMatchMedia(375);
    vi.clearAllMocks();
  });

  it('should show mobile header on small screens', async () => {
    const store = createMockStore();
    render(
      <Provider store={store}>
        <SSEProvider>
          <ToastProvider>
            <AppLayout>
              <div>Content</div>
            </AppLayout>
          </ToastProvider>
        </SSEProvider>
      </Provider>
    );

    // Mobile header should show the hamburger menu button
    expect(
      screen.getByRole('button', { name: /open navigation menu/i })
    ).toBeInTheDocument();
  });

  it('should add padding top for mobile header', () => {
    const store = createMockStore();
    render(
      <Provider store={store}>
        <SSEProvider>
          <ToastProvider>
            <AppLayout>
              <div>Content</div>
            </AppLayout>
          </ToastProvider>
        </SSEProvider>
      </Provider>
    );

    const mainContent = screen.getByRole('main');
    expect(mainContent).toHaveClass('pt-14');
  });
});
