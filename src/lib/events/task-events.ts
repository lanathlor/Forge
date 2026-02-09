import { EventEmitter } from 'events';

// Global event emitter for server-sent events
export const taskEvents = new EventEmitter();

// Increase max listeners to avoid memory leak warnings
taskEvents.setMaxListeners(100);
