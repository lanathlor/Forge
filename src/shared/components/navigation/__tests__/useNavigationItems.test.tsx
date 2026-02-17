import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useNavigationItems } from '../useNavigationItems';

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

// Create a mock store
const createMockStore = (sessionState = {}) =>
  configureStore({
    reducer: {
      session: () => ({
        currentSessionId: null,
        currentRepositoryId: null,
        ...sessionState,
      }),
    },
  });

// Wrapper component that provides Redux store
const createWrapper = (store: ReturnType<typeof createMockStore>) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
};

describe('useNavigationItems', () => {
  it('should return navigation items', () => {
    const store = createMockStore();
    const { result } = renderHook(() => useNavigationItems(), {
      wrapper: createWrapper(store),
    });

    expect(result.current.items).toBeDefined();
    expect(result.current.items.length).toBeGreaterThan(0);
  });

  it('should return sessions item with correct defaults', () => {
    const store = createMockStore();
    const { result } = renderHook(() => useNavigationItems(), {
      wrapper: createWrapper(store),
    });

    const dashboardItem = result.current.items.find((item) => item.id === 'dashboard');
    expect(dashboardItem).toBeDefined();
    expect(dashboardItem?.label).toBe('Dashboard');
    expect(dashboardItem?.active).toBe(true); // Default active item
    expect(dashboardItem?.priority).toBe('primary');
  });

  it('should return correct shortcuts map', () => {
    const store = createMockStore();
    const { result } = renderHook(() => useNavigationItems(), {
      wrapper: createWrapper(store),
    });

    expect(result.current.shortcuts).toEqual({
      dashboard: '1',
      tasks: '2',
      plans: '3',
      repositories: '4',
      settings: ',',
      help: '/',
    });
  });

  it('should set active item based on activeItemId', () => {
    const store = createMockStore();
    const { result } = renderHook(
      () => useNavigationItems({ activeItemId: 'plans' }),
      { wrapper: createWrapper(store) }
    );

    const dashboardItem = result.current.items.find((item) => item.id === 'dashboard');
    const plansItem = result.current.items.find((item) => item.id === 'plans');

    expect(dashboardItem?.active).toBe(false);
    expect(plansItem?.active).toBe(true);
  });

  it('should call onNavigate when item onClick is called', () => {
    const store = createMockStore();
    const onNavigate = vi.fn();
    const { result } = renderHook(
      () => useNavigationItems({ onNavigate }),
      { wrapper: createWrapper(store) }
    );

    const plansItem = result.current.items.find((item) => item.id === 'plans');
    plansItem?.onClick?.();

    expect(onNavigate).toHaveBeenCalledWith('plans');
  });

  it('should show task badge when tasks are running', () => {
    const store = createMockStore();
    const { result } = renderHook(
      () => useNavigationItems({ runningTasksCount: 3, pendingTasksCount: 2 }),
      { wrapper: createWrapper(store) }
    );

    const tasksItem = result.current.items.find((item) => item.id === 'tasks');
    expect(tasksItem?.badge).toBe(5); // 3 + 2
    expect(tasksItem?.status).toBe('running');
  });

  it('should return status indicators when session is active', () => {
    const store = createMockStore({ currentSessionId: 'session-1' });
    const { result } = renderHook(
      () => useNavigationItems({ hasActiveSession: true, sessionStatus: 'running' }),
      { wrapper: createWrapper(store) }
    );

    const sessionIndicator = result.current.statusIndicators.find((i) => i.id === 'session');
    expect(sessionIndicator).toBeDefined();
    expect(sessionIndicator?.value).toBe('Running');
    expect(sessionIndicator?.type).toBe('success');
    expect(sessionIndicator?.pulse).toBe(true);
  });

  it('should show running tasks indicator', () => {
    const store = createMockStore();
    const { result } = renderHook(
      () => useNavigationItems({ runningTasksCount: 5 }),
      { wrapper: createWrapper(store) }
    );

    const runningIndicator = result.current.statusIndicators.find((i) => i.id === 'running-tasks');
    expect(runningIndicator).toBeDefined();
    expect(runningIndicator?.value).toBe(5);
    expect(runningIndicator?.pulse).toBe(true);
  });

  it('should show pending tasks indicator when no running tasks', () => {
    const store = createMockStore();
    const { result } = renderHook(
      () => useNavigationItems({ runningTasksCount: 0, pendingTasksCount: 3 }),
      { wrapper: createWrapper(store) }
    );

    const pendingIndicator = result.current.statusIndicators.find((i) => i.id === 'pending-tasks');
    expect(pendingIndicator).toBeDefined();
    expect(pendingIndicator?.value).toBe(3);
  });

  it('should not show pending indicator when there are running tasks', () => {
    const store = createMockStore();
    const { result } = renderHook(
      () => useNavigationItems({ runningTasksCount: 2, pendingTasksCount: 3 }),
      { wrapper: createWrapper(store) }
    );

    const pendingIndicator = result.current.statusIndicators.find((i) => i.id === 'pending-tasks');
    expect(pendingIndicator).toBeUndefined();
  });

  it('should return primary and secondary navigation items', () => {
    const store = createMockStore();
    const { result } = renderHook(() => useNavigationItems(), {
      wrapper: createWrapper(store),
    });

    const primaryItems = result.current.items.filter((item) => item.priority === 'primary');
    const secondaryItems = result.current.items.filter((item) => item.priority === 'secondary');

    expect(primaryItems.length).toBe(4); // dashboard, tasks, plans, repositories
    expect(secondaryItems.length).toBe(2); // settings, help
  });

  it('should use Redux session state', () => {
    const store = createMockStore({ currentSessionId: 'session-1' });
    const { result } = renderHook(() => useNavigationItems(), {
      wrapper: createWrapper(store),
    });

    // Should detect active session from Redux state
    const sessionIndicator = result.current.statusIndicators.find((i) => i.id === 'session');
    expect(sessionIndicator).toBeDefined();
  });

  it('should show paused session status', () => {
    const store = createMockStore();
    const { result } = renderHook(
      () => useNavigationItems({ hasActiveSession: true, sessionStatus: 'paused' }),
      { wrapper: createWrapper(store) }
    );

    const sessionIndicator = result.current.statusIndicators.find((i) => i.id === 'session');
    expect(sessionIndicator?.value).toBe('Paused');
    expect(sessionIndicator?.type).toBe('info');
  });

  it('should show error session status', () => {
    const store = createMockStore();
    const { result } = renderHook(
      () => useNavigationItems({ hasActiveSession: true, sessionStatus: 'error' }),
      { wrapper: createWrapper(store) }
    );

    const dashboardItem = result.current.items.find((item) => item.id === 'dashboard');
    expect(dashboardItem?.status).toBe('error');
  });

  it('should return no badge for tasks when count is 0', () => {
    const store = createMockStore();
    const { result } = renderHook(
      () => useNavigationItems({ runningTasksCount: 0, pendingTasksCount: 0 }),
      { wrapper: createWrapper(store) }
    );

    const tasksItem = result.current.items.find((item) => item.id === 'tasks');
    expect(tasksItem?.badge).toBeUndefined();
  });

  it('should have correct tooltips', () => {
    const store = createMockStore();
    const { result } = renderHook(() => useNavigationItems(), {
      wrapper: createWrapper(store),
    });

    const settingsItem = result.current.items.find((item) => item.id === 'settings');
    expect(settingsItem?.tooltip).toBe('Application settings');

    const helpItem = result.current.items.find((item) => item.id === 'help');
    expect(helpItem?.tooltip).toBe('Help and documentation');
  });
});
