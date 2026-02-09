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
