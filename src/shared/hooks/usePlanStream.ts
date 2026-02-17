'use client';

import { useEffect, useState } from 'react';
import type { PlanExecutionEvent } from '@/lib/events/task-events';
import { useGetPlanQuery } from '@/features/plans/store/plansApi';
import {
  useSSESubscription,
  useSSEConnected,
} from '@/shared/contexts/SSEContext';

interface UsePlanStreamOptions {
  enabled?: boolean;
}

interface UsePlanStreamReturn {
  events: PlanExecutionEvent[];
  connected: boolean;
  latestEvent: PlanExecutionEvent | null;
  taskOutputs: Map<string, string>;
}

const SIGNIFICANT_EVENTS = new Set([
  'plan_completed',
  'plan_failed',
  'plan_paused',
  'phase_completed',
  'phase_failed',
  'task_completed',
  'task_failed',
  'task_started',
]);

function usePlanExecutionSubscription(
  planId: string | null,
  enabled: boolean,
  setLatestEvent: React.Dispatch<
    React.SetStateAction<PlanExecutionEvent | null>
  >,
  setEvents: React.Dispatch<React.SetStateAction<PlanExecutionEvent[]>>,
  refetch: () => void
) {
  useSSESubscription<PlanExecutionEvent>(
    'unified',
    'plan_execution',
    (event) => {
      if (!enabled || !planId) return;
      const planEvent = event.data as PlanExecutionEvent;
      if (!planEvent || planEvent.planId !== planId) return;
      setLatestEvent(planEvent);
      setEvents((prev) => {
        const updated = [...prev, planEvent];
        return updated.length > 200 ? updated.slice(-200) : updated;
      });
      if (SIGNIFICANT_EVENTS.has(planEvent.type)) refetch();
    },
    [planId, enabled, refetch]
  );
}

function useTaskOutputSubscription(
  planId: string | null,
  enabled: boolean,
  setTaskOutputs: React.Dispatch<React.SetStateAction<Map<string, string>>>
) {
  useSSESubscription<{ taskId?: string; output?: string }>(
    'unified',
    'task_output',
    (event) => {
      if (!enabled || !planId) return;
      const data = event.data;
      if (!data?.taskId) return;
      setTaskOutputs((prev) => {
        const updated = new Map(prev);
        updated.set(
          data.taskId!,
          (updated.get(data.taskId!) || '') + (data.output || '')
        );
        return updated;
      });
    },
    [planId, enabled]
  );
}

/**
 * Hook for streaming plan execution events.
 *
 * Uses the GlobalSSEManager unified connection (already established by SSEProvider)
 * instead of opening a separate EventSource. Subscribes to `plan_execution` and
 * `task_output` events, filtering by planId.
 */
export function usePlanStream(
  planId: string | null,
  options?: UsePlanStreamOptions
): UsePlanStreamReturn {
  const { enabled = true } = options || {};
  const [events, setEvents] = useState<PlanExecutionEvent[]>([]);
  const [latestEvent, setLatestEvent] = useState<PlanExecutionEvent | null>(
    null
  );
  const [taskOutputs, setTaskOutputs] = useState<Map<string, string>>(
    new Map()
  );
  const isConnected = useSSEConnected();
  const { refetch } = useGetPlanQuery(planId!, { skip: !planId });

  usePlanExecutionSubscription(
    planId,
    enabled,
    setLatestEvent,
    setEvents,
    refetch
  );
  useTaskOutputSubscription(planId, enabled, setTaskOutputs);

  useEffect(() => {
    setEvents([]);
    setLatestEvent(null);
    setTaskOutputs(new Map());
  }, [planId]);

  return { events, connected: isConnected, latestEvent, taskOutputs };
}
