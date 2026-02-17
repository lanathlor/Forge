import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the plans API
vi.mock('@/features/plans/store/plansApi', () => ({
  useGetPlanQuery: vi.fn().mockReturnValue({ refetch: vi.fn() }),
}));

// Keep SSESubscription callbacks per event type (last-write-wins per test render)
const mockCallbacks: Map<
  string,
  (event: { data: unknown; timestamp: string }) => void
> = new Map();
let mockConnected = true;
let mockStatus = 'connected';

vi.mock('@/shared/contexts/SSEContext', () => ({
  useSSEConnected: () => mockConnected,
  useSSEStatus: () => mockStatus,
  useSSESubscription: (
    _connectionId: string,
    eventType: string,
    callback: (event: { data: unknown; timestamp: string }) => void
  ) => {
    // Store the latest callback for each event type
    mockCallbacks.set(eventType, callback);
  },
}));

import { usePlanStream } from '../usePlanStream';
import { useGetPlanQuery } from '@/features/plans/store/plansApi';

function simulateSSEEvent(eventType: string, data: unknown) {
  const handler = mockCallbacks.get(eventType);
  if (handler) handler({ data, timestamp: new Date().toISOString() });
}

describe('usePlanStream', () => {
  const mockRefetch = vi.fn();

  beforeEach(() => {
    mockCallbacks.clear();
    mockConnected = true;
    mockStatus = 'connected';
    mockRefetch.mockReset();
    vi.mocked(useGetPlanQuery).mockReturnValue({
      refetch: mockRefetch,
    } as ReturnType<typeof useGetPlanQuery>);
  });

  it('should return default state when planId is null', () => {
    const { result } = renderHook(() => usePlanStream(null));
    expect(result.current.events).toEqual([]);
    expect(result.current.latestEvent).toBeNull();
    expect(result.current.taskOutputs).toEqual(new Map());
  });

  it('should reflect SSE connection status', () => {
    mockConnected = true;
    const { result } = renderHook(() => usePlanStream('plan-1'));
    expect(result.current.connected).toBe(true);
  });

  it('should return connected=false when SSE is disconnected', () => {
    mockConnected = false;
    const { result } = renderHook(() => usePlanStream('plan-1'));
    expect(result.current.connected).toBe(false);
  });

  it('should not connect when enabled is false', () => {
    const { result } = renderHook(() =>
      usePlanStream('plan-1', { enabled: false })
    );
    act(() => {
      simulateSSEEvent('plan_execution', {
        planId: 'plan-1',
        type: 'task_started',
        timestamp: '2026-01-01T00:00:00Z',
      });
    });
    expect(result.current.events).toHaveLength(0);
  });

  it('should process plan execution events matching planId', () => {
    const { result } = renderHook(() => usePlanStream('plan-1'));

    const event = {
      planId: 'plan-1',
      type: 'task_started',
      taskId: 'task-1',
      timestamp: '2026-01-01T00:00:00Z',
    };

    act(() => {
      simulateSSEEvent('plan_execution', event);
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.latestEvent).toEqual(event);
  });

  it('should ignore plan execution events for different planId', () => {
    const { result } = renderHook(() => usePlanStream('plan-1'));

    act(() => {
      simulateSSEEvent('plan_execution', {
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

    act(() => {
      simulateSSEEvent('plan_execution', {
        planId: 'plan-1',
        type: 'task_completed',
        timestamp: '2026-01-01T00:00:00Z',
      });
    });

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('should not refetch on non-significant events', () => {
    renderHook(() => usePlanStream('plan-1'));

    act(() => {
      simulateSSEEvent('plan_execution', {
        planId: 'plan-1',
        type: 'task_progress',
        timestamp: '2026-01-01T00:00:00Z',
      });
    });

    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it('should handle task output events', () => {
    const { result } = renderHook(() => usePlanStream('plan-1'));

    act(() => {
      simulateSSEEvent('task_output', { taskId: 'task-1', output: 'Hello ' });
    });

    expect(result.current.taskOutputs.get('task-1')).toBe('Hello ');

    act(() => {
      simulateSSEEvent('task_output', { taskId: 'task-1', output: 'World' });
    });

    expect(result.current.taskOutputs.get('task-1')).toBe('Hello World');
  });

  it('should ignore task output events without taskId', () => {
    const { result } = renderHook(() => usePlanStream('plan-1'));

    act(() => {
      simulateSSEEvent('task_output', { output: 'orphan' });
    });

    expect(result.current.taskOutputs.size).toBe(0);
  });

  it('should trim events to 200 max', () => {
    const { result } = renderHook(() => usePlanStream('plan-1'));

    act(() => {
      for (let i = 0; i < 205; i++) {
        simulateSSEEvent('plan_execution', {
          planId: 'plan-1',
          type: 'task_progress',
          taskId: `task-${i}`,
          timestamp: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}Z`,
        });
      }
    });

    expect(result.current.events.length).toBeLessThanOrEqual(200);
  });

  it('should reset events when planId changes', () => {
    const { result, rerender } = renderHook(
      ({ planId }: { planId: string | null }) => usePlanStream(planId),
      { initialProps: { planId: 'plan-1' } }
    );

    act(() => {
      simulateSSEEvent('plan_execution', {
        planId: 'plan-1',
        type: 'task_started',
        timestamp: '2026-01-01T00:00:00Z',
      });
    });

    expect(result.current.events).toHaveLength(1);

    rerender({ planId: 'plan-2' });

    expect(result.current.events).toHaveLength(0);
    expect(result.current.latestEvent).toBeNull();
    expect(result.current.taskOutputs).toEqual(new Map());
  });

  it('should use default options when none provided', () => {
    const { result } = renderHook(() => usePlanStream('plan-1'));
    expect(result.current.events).toEqual([]);
  });
});
