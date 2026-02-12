import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the plans API
vi.mock('@/features/plans/store/plansApi', () => ({
  useGetPlanQuery: vi.fn().mockReturnValue({ refetch: vi.fn() }),
}));

import { usePlanStream } from '../usePlanStream';
import { useGetPlanQuery } from '@/features/plans/store/plansApi';

type EventListenerMap = Record<string, ((e: MessageEvent) => void)>;

class MockEventSource {
  static instances: MockEventSource[] = [];
  listeners: EventListenerMap = {};
  onerror: (() => void) | null = null;
  closed = false;

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, handler: (e: MessageEvent) => void) {
    this.listeners[event] = handler;
  }

  close() {
    this.closed = true;
  }

  // Helper to simulate events
  simulateEvent(type: string, data: unknown) {
    const handler = this.listeners[type];
    if (handler) {
      handler({ data: JSON.stringify(data) } as MessageEvent);
    }
  }

  simulateError() {
    if (this.onerror) this.onerror();
  }
}

describe('usePlanStream', () => {
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    (globalThis as Record<string, unknown>).EventSource = MockEventSource;
    vi.mocked(useGetPlanQuery).mockReturnValue({ refetch: mockRefetch } as ReturnType<typeof useGetPlanQuery>);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (globalThis as Record<string, unknown>).EventSource;
  });

  it('should return default state when planId is null', () => {
    const { result } = renderHook(() => usePlanStream(null));
    expect(result.current.events).toEqual([]);
    expect(result.current.connected).toBe(false);
    expect(result.current.latestEvent).toBeNull();
    expect(result.current.taskOutputs).toEqual(new Map());
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('should not connect when enabled is false', () => {
    const { result } = renderHook(() => usePlanStream('plan-1', { enabled: false }));
    expect(result.current.connected).toBe(false);
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('should connect to SSE when planId is provided', () => {
    renderHook(() => usePlanStream('plan-1'));
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0]!.url).toBe('/api/sse');
  });

  it('should set connected to true on connected event', () => {
    const { result } = renderHook(() => usePlanStream('plan-1'));
    const es = MockEventSource.instances[0]!;

    act(() => {
      es.simulateEvent('connected', {});
    });

    expect(result.current.connected).toBe(true);
  });

  it('should process plan execution events matching planId', () => {
    const { result } = renderHook(() => usePlanStream('plan-1'));
    const es = MockEventSource.instances[0]!;

    const event = {
      planId: 'plan-1',
      type: 'task_started',
      taskId: 'task-1',
      timestamp: '2026-01-01T00:00:00Z',
    };

    act(() => {
      es.simulateEvent('plan_execution', event);
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.latestEvent).toEqual(event);
  });

  it('should ignore plan execution events for different planId', () => {
    const { result } = renderHook(() => usePlanStream('plan-1'));
    const es = MockEventSource.instances[0]!;

    act(() => {
      es.simulateEvent('plan_execution', {
        planId: 'plan-2',
        type: 'task_started',
        timestamp: '2026-01-01T00:00:00Z',
      });
    });

    expect(result.current.events).toHaveLength(0);
    expect(result.current.latestEvent).toBeNull();
  });

  it('should refetch on significant events', () => {
    renderHook(() => usePlanStream('plan-1'));
    const es = MockEventSource.instances[0]!;

    act(() => {
      es.simulateEvent('plan_execution', {
        planId: 'plan-1',
        type: 'task_completed',
        timestamp: '2026-01-01T00:00:00Z',
      });
    });

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('should not refetch on non-significant events', () => {
    renderHook(() => usePlanStream('plan-1'));
    const es = MockEventSource.instances[0]!;

    act(() => {
      es.simulateEvent('plan_execution', {
        planId: 'plan-1',
        type: 'task_progress',
        timestamp: '2026-01-01T00:00:00Z',
      });
    });

    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it('should handle task output events', () => {
    const { result } = renderHook(() => usePlanStream('plan-1'));
    const es = MockEventSource.instances[0]!;

    act(() => {
      es.simulateEvent('task_output', {
        taskId: 'task-1',
        output: 'Hello ',
      });
    });

    expect(result.current.taskOutputs.get('task-1')).toBe('Hello ');

    act(() => {
      es.simulateEvent('task_output', {
        taskId: 'task-1',
        output: 'World',
      });
    });

    expect(result.current.taskOutputs.get('task-1')).toBe('Hello World');
  });

  it('should ignore task output events without taskId', () => {
    const { result } = renderHook(() => usePlanStream('plan-1'));
    const es = MockEventSource.instances[0]!;

    act(() => {
      es.simulateEvent('task_output', { output: 'orphan' });
    });

    expect(result.current.taskOutputs.size).toBe(0);
  });

  it('should handle invalid JSON in plan execution gracefully', () => {
    const { result } = renderHook(() => usePlanStream('plan-1'));
    const es = MockEventSource.instances[0]!;
    const handler = es.listeners['plan_execution']!;

    act(() => {
      handler({ data: 'invalid-json' } as MessageEvent);
    });

    expect(result.current.events).toHaveLength(0);
  });

  it('should handle invalid JSON in task output gracefully', () => {
    const { result } = renderHook(() => usePlanStream('plan-1'));
    const es = MockEventSource.instances[0]!;
    const handler = es.listeners['task_output']!;

    act(() => {
      handler({ data: 'not-json' } as MessageEvent);
    });

    expect(result.current.taskOutputs.size).toBe(0);
  });

  it('should reconnect on error after 3 seconds', () => {
    renderHook(() => usePlanStream('plan-1'));
    expect(MockEventSource.instances).toHaveLength(1);
    const es = MockEventSource.instances[0]!;

    act(() => {
      es.simulateError();
    });

    expect(es.closed).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(MockEventSource.instances).toHaveLength(2);
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => usePlanStream('plan-1'));
    const es = MockEventSource.instances[0]!;

    unmount();

    expect(es.closed).toBe(true);
  });

  it('should trim events to 200 max', () => {
    const { result } = renderHook(() => usePlanStream('plan-1'));
    const es = MockEventSource.instances[0]!;

    act(() => {
      for (let i = 0; i < 205; i++) {
        es.simulateEvent('plan_execution', {
          planId: 'plan-1',
          type: 'task_progress',
          taskId: `task-${i}`,
          timestamp: `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`,
        });
      }
    });

    expect(result.current.events.length).toBeLessThanOrEqual(200);
  });

  it('should handle EventSource constructor throwing', () => {
    (globalThis as Record<string, unknown>).EventSource = class {
      constructor() {
        throw new Error('EventSource not supported');
      }
    };

    renderHook(() => usePlanStream('plan-1'));

    // Should schedule a reconnect
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // No crash - graceful handling
  });

  it('should use default options when none provided', () => {
    const { result } = renderHook(() => usePlanStream('plan-1'));
    // Should connect (enabled defaults to true)
    expect(MockEventSource.instances).toHaveLength(1);
    expect(result.current.events).toEqual([]);
  });
});
