'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import type { PlanExecutionEvent } from '@/lib/events/task-events';
import { useGetPlanQuery } from '@/features/plans/store/plansApi';

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
  'plan_completed', 'plan_failed', 'plan_paused', 'phase_completed',
  'phase_failed', 'task_completed', 'task_failed', 'task_started',
]);

function createPlanExecutionHandler(
  planId: string,
  setLatestEvent: React.Dispatch<React.SetStateAction<PlanExecutionEvent | null>>,
  setEvents: React.Dispatch<React.SetStateAction<PlanExecutionEvent[]>>,
  refetch: () => void,
) {
  return (e: MessageEvent) => {
    try {
      const event: PlanExecutionEvent = JSON.parse(e.data);
      if (event.planId !== planId) return;
      setLatestEvent(event);
      setEvents((prev) => {
        const updated = [...prev, event];
        return updated.length > 200 ? updated.slice(-200) : updated;
      });
      if (SIGNIFICANT_EVENTS.has(event.type)) refetch();
    } catch { /* ignore parse errors */ }
  };
}

function createTaskOutputHandler(
  setTaskOutputs: React.Dispatch<React.SetStateAction<Map<string, string>>>,
) {
  return (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data);
      if (!data.taskId) return;
      setTaskOutputs((prev) => {
        const updated = new Map(prev);
        updated.set(data.taskId, (updated.get(data.taskId) || '') + (data.output || ''));
        return updated;
      });
    } catch { /* ignore */ }
  };
}

export function usePlanStream(
  planId: string | null,
  options?: UsePlanStreamOptions
): UsePlanStreamReturn {
  const { enabled = true } = options || {};
  const [events, setEvents] = useState<PlanExecutionEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [latestEvent, setLatestEvent] = useState<PlanExecutionEvent | null>(null);
  const [taskOutputs, setTaskOutputs] = useState<Map<string, string>>(new Map());

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { refetch } = useGetPlanQuery(planId!, { skip: !planId });

  const cleanup = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!planId || !enabled) return;

    const connect = () => {
      cleanup();
      try {
        const es = new EventSource('/api/sse');
        eventSourceRef.current = es;
        es.addEventListener('connected', () => setConnected(true));
        es.addEventListener('plan_execution', createPlanExecutionHandler(planId, setLatestEvent, setEvents, refetch));
        es.addEventListener('task_output', createTaskOutputHandler(setTaskOutputs));
        es.onerror = () => { setConnected(false); es.close(); reconnectTimeoutRef.current = setTimeout(connect, 3000); };
      } catch {
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };

    connect();
    return cleanup;
  }, [planId, enabled, cleanup, refetch]);

  return { events, connected, latestEvent, taskOutputs };
}
