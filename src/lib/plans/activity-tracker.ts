import { taskEvents } from '@/lib/events/task-events';

/**
 * Configuration for activity-based timeout
 */
export interface ActivityTimeoutConfig {
  /** Inactivity threshold in seconds before considering a task as timed out */
  inactivityThresholdSeconds: number;
  /** Minimum runtime in seconds before timeout can trigger (prevents premature timeout) */
  minRuntimeSeconds: number;
}

/**
 * Default activity timeout configuration
 * - 2 minutes of inactivity triggers timeout
 * - Must run at least 30 seconds before timeout can trigger
 */
export const DEFAULT_ACTIVITY_CONFIG: ActivityTimeoutConfig = {
  inactivityThresholdSeconds: 120, // 2 minutes of no activity
  minRuntimeSeconds: 30, // Must run at least 30 seconds
};

/**
 * Activity sources that can update the last activity timestamp
 */
export type ActivitySource =
  | 'claude_output' // Claude is producing output
  | 'status_change' // Task status changed
  | 'qa_gate_running' // QA gate is executing
  | 'qa_gate_result' // QA gate produced result
  | 'diff_captured' // Diff was captured
  | 'claude_retry' // Claude retry was invoked
  | 'manual'; // Manual activity ping

interface TaskActivityState {
  taskId: string;
  sessionTaskId: string;
  startedAt: number;
  lastActivityAt: number;
  lastActivitySource: ActivitySource;
  isActive: boolean;
}

/**
 * ActivityTracker monitors task execution and determines if a task has become inactive.
 * Instead of a fixed timeout, it tracks various activity signals:
 * - Claude output streaming
 * - Status changes
 * - QA gate execution
 * - Diff capturing
 *
 * A task is only considered timed out if there's been no activity for the configured threshold.
 */
export class ActivityTracker {
  private config: ActivityTimeoutConfig;
  private trackedTasks: Map<string, TaskActivityState> = new Map();
  private eventListenerCleanups: Map<string, () => void> = new Map();

  constructor(config?: Partial<ActivityTimeoutConfig>) {
    this.config = { ...DEFAULT_ACTIVITY_CONFIG, ...config };
  }

  private createTaskHandlers(planTaskId: string, sessionTaskId: string) {
    const outputHandler = (data: { taskId: string; output?: string }) => {
      if (data.taskId === sessionTaskId && data.output) this.recordActivity(planTaskId, 'claude_output');
    };
    const updateHandler = (data: { taskId: string; status?: string }) => {
      if (data.taskId === sessionTaskId) this.recordActivity(planTaskId, 'status_change');
    };
    const qaHandler = (data: { taskId: string; gateName?: string; status?: string }) => {
      if (data.taskId === sessionTaskId) this.recordActivity(planTaskId, 'qa_gate_result');
    };
    return { outputHandler, updateHandler, qaHandler };
  }

  /**
   * Start tracking activity for a task
   */
  startTracking(planTaskId: string, sessionTaskId: string): void {
    const now = Date.now();

    this.trackedTasks.set(planTaskId, {
      taskId: planTaskId,
      sessionTaskId,
      startedAt: now,
      lastActivityAt: now,
      lastActivitySource: 'status_change',
      isActive: true,
    });

    const { outputHandler, updateHandler, qaHandler } = this.createTaskHandlers(planTaskId, sessionTaskId);

    taskEvents.on('task:output', outputHandler);
    taskEvents.on('task:update', updateHandler);
    taskEvents.on('qa:update', qaHandler);

    this.eventListenerCleanups.set(planTaskId, () => {
      taskEvents.off('task:output', outputHandler);
      taskEvents.off('task:update', updateHandler);
      taskEvents.off('qa:update', qaHandler);
    });

    console.log(`[ActivityTracker] Started tracking task ${planTaskId} (session task: ${sessionTaskId})`);
  }

  /**
   * Stop tracking a task and cleanup event listeners
   */
  stopTracking(planTaskId: string): void {
    const cleanup = this.eventListenerCleanups.get(planTaskId);
    if (cleanup) {
      cleanup();
      this.eventListenerCleanups.delete(planTaskId);
    }

    const state = this.trackedTasks.get(planTaskId);
    if (state) {
      state.isActive = false;
    }
    this.trackedTasks.delete(planTaskId);

    console.log(`[ActivityTracker] Stopped tracking task ${planTaskId}`);
  }

  /**
   * Record activity for a task
   */
  recordActivity(planTaskId: string, source: ActivitySource): void {
    const state = this.trackedTasks.get(planTaskId);
    if (state) {
      state.lastActivityAt = Date.now();
      state.lastActivitySource = source;
      // Only log non-output activities to reduce noise
      if (source !== 'claude_output') {
        console.log(
          `[ActivityTracker] Activity recorded for ${planTaskId}: ${source}`
        );
      }
    }
  }

  /**
   * Check if a task has timed out due to inactivity
   * Returns null if task is still active, or an error message if timed out
   */
  checkTimeout(planTaskId: string): string | null {
    const state = this.trackedTasks.get(planTaskId);
    if (!state) {
      return null; // Not tracking this task
    }

    const now = Date.now();
    const runtimeSeconds = (now - state.startedAt) / 1000;
    const inactivitySeconds = (now - state.lastActivityAt) / 1000;

    // Don't timeout if we haven't reached minimum runtime
    if (runtimeSeconds < this.config.minRuntimeSeconds) {
      return null;
    }

    // Check if inactive for too long
    if (inactivitySeconds >= this.config.inactivityThresholdSeconds) {
      const totalMinutes = Math.floor(runtimeSeconds / 60);
      const inactiveMinutes = Math.floor(inactivitySeconds / 60);
      const inactiveSeconds = Math.floor(inactivitySeconds % 60);

      return (
        `Task timed out due to inactivity. ` +
        `No activity for ${inactiveMinutes}m ${inactiveSeconds}s ` +
        `(last activity: ${state.lastActivitySource}). ` +
        `Total runtime: ${totalMinutes} minutes.`
      );
    }

    return null;
  }

  /**
   * Get time until potential timeout (for logging/debugging)
   */
  getTimeUntilTimeout(planTaskId: string): number | null {
    const state = this.trackedTasks.get(planTaskId);
    if (!state) {
      return null;
    }

    const now = Date.now();
    const runtimeSeconds = (now - state.startedAt) / 1000;
    const inactivitySeconds = (now - state.lastActivityAt) / 1000;

    // If we haven't reached minimum runtime, return time until min runtime + inactivity threshold
    if (runtimeSeconds < this.config.minRuntimeSeconds) {
      const timeToMinRuntime = this.config.minRuntimeSeconds - runtimeSeconds;
      return timeToMinRuntime + this.config.inactivityThresholdSeconds;
    }

    // Return remaining time before inactivity timeout
    return Math.max(
      0,
      this.config.inactivityThresholdSeconds - inactivitySeconds
    );
  }

  /**
   * Get activity state for a task (for debugging/monitoring)
   */
  getState(planTaskId: string): TaskActivityState | null {
    return this.trackedTasks.get(planTaskId) || null;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ActivityTimeoutConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[ActivityTracker] Configuration updated:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): ActivityTimeoutConfig {
    return { ...this.config };
  }
}

// Singleton instance
let activityTrackerInstance: ActivityTracker | null = null;

export function getActivityTracker(
  config?: Partial<ActivityTimeoutConfig>
): ActivityTracker {
  if (!activityTrackerInstance) {
    activityTrackerInstance = new ActivityTracker(config);
    console.log('[ActivityTracker] Created singleton instance');
  } else if (config) {
    activityTrackerInstance.updateConfig(config);
  }
  return activityTrackerInstance;
}
