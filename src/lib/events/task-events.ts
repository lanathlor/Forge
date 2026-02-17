import { EventEmitter } from 'events';

// Force true singleton using global to survive hot-reloads
const globalForEvents = global as typeof globalThis & {
  taskEvents?: EventEmitter;
};

// Global event emitter for server-sent events
export const taskEvents = globalForEvents.taskEvents ?? new EventEmitter();

if (!globalForEvents.taskEvents) {
  globalForEvents.taskEvents = taskEvents;
  // Increase max listeners to avoid memory leak warnings
  taskEvents.setMaxListeners(100);
  console.log('[taskEvents] Created new singleton EventEmitter');
} else {
  console.log('[taskEvents] Reusing existing singleton EventEmitter');
}

// Plan execution event types
export interface PlanExecutionEvent {
  planId: string;
  type:
    | 'plan_started'
    | 'plan_completed'
    | 'plan_failed'
    | 'plan_paused'
    | 'phase_started'
    | 'phase_completed'
    | 'phase_failed'
    | 'task_started'
    | 'task_completed'
    | 'task_failed'
    | 'task_progress';
  phaseId?: string;
  taskId?: string;
  sessionTaskId?: string;
  status?: string;
  error?: string;
  timestamp: string;
}

export function emitPlanEvent(event: PlanExecutionEvent) {
  taskEvents.emit('plan:execution', event);
}
