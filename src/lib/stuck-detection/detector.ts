import { EventEmitter } from 'events';
import {
  type StuckAlert,
  type StuckStatus,
  type StuckReason,
  type RepoStuckTracker,
  type StuckDetectionConfig,
  type StuckEvent,
  DEFAULT_STUCK_CONFIG,
  SENSITIVITY_MULTIPLIERS,
  getAlertSeverity,
  getSuggestedAction,
} from './types';

// Force true singleton using global to survive hot-reloads
const globalForStuckDetection = global as typeof globalThis & {
  stuckDetector?: StuckDetector;
  stuckEvents?: EventEmitter;
};

/**
 * Event emitter for stuck detection events
 */
export const stuckEvents =
  globalForStuckDetection.stuckEvents ?? new EventEmitter();

if (!globalForStuckDetection.stuckEvents) {
  globalForStuckDetection.stuckEvents = stuckEvents;
  stuckEvents.setMaxListeners(100);
  console.log('[stuckEvents] Created new singleton EventEmitter');
}

/**
 * Generate unique alert ID
 */
function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Status categories for detection
 */
const THINKING_STATUSES = ['running', 'pre_flight', 'qa_running'];
const WAITING_STATUSES = ['waiting_approval', 'waiting_input'];
const FAILED_STATUSES = ['failed', 'qa_failed', 'error'];
const TERMINAL_STATUSES = ['completed', 'rejected', 'cancelled'];

/**
 * Parameters for updateRepoState
 */
interface RepoStateUpdate {
  repositoryId: string;
  repositoryName: string;
  sessionId: string | null;
  taskId: string | null;
  status: string | null;
  hasOutput?: boolean;
  blockedQAGate?: string | null;
}

/**
 * Core stuck detection engine
 * Tracks repository states and emits events when stuck conditions are detected
 */
export class StuckDetector {
  private config: StuckDetectionConfig;
  private trackers: Map<string, RepoStuckTracker> = new Map();
  private alerts: Map<string, StuckAlert> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 1000; // Check every second for responsive updates

  constructor(config?: Partial<StuckDetectionConfig>) {
    this.config = { ...DEFAULT_STUCK_CONFIG, ...config };
  }

  /**
   * Get effective threshold with sensitivity applied
   */
  private getEffectiveThreshold(baseThreshold: number): number {
    const multiplier = SENSITIVITY_MULTIPLIERS[this.config.sensitivityLevel];
    return Math.round(baseThreshold * multiplier);
  }

  /**
   * Start the stuck detection monitoring loop
   */
  start(): void {
    if (this.checkInterval) return;

    console.log('[StuckDetector] Starting monitoring loop');
    this.checkInterval = setInterval(() => {
      this.checkAllTrackers();
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the stuck detection monitoring loop
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[StuckDetector] Stopped monitoring loop');
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<StuckDetectionConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[StuckDetector] Configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): StuckDetectionConfig {
    return { ...this.config };
  }

  /**
   * Create a new tracker with default values
   */
  private createTracker(
    update: RepoStateUpdate,
    now: number
  ): RepoStuckTracker {
    return {
      repositoryId: update.repositoryId,
      repositoryName: update.repositoryName,
      sessionId: update.sessionId,
      taskId: update.taskId,
      lastOutputTimestamp: now,
      consecutiveFailures: 0,
      isStuck: false,
      stuckReason: null,
      stuckSince: null,
      currentStatus: null,
      statusHistory: [],
      blockedQAGate: null,
    };
  }

  /**
   * Handle status transition for a tracker
   */
  private handleStatusTransition(
    tracker: RepoStuckTracker,
    status: string | null,
    now: number
  ): void {
    tracker.statusHistory.push({ status: status || 'idle', timestamp: now });
    if (tracker.statusHistory.length > 10) tracker.statusHistory.shift();

    if (status && FAILED_STATUSES.includes(status)) {
      tracker.consecutiveFailures++;
    } else if (status && !FAILED_STATUSES.includes(status)) {
      tracker.consecutiveFailures = 0;
    }

    if (status && TERMINAL_STATUSES.includes(status) && tracker.isStuck) {
      this.resolveStuck(tracker.repositoryId);
    }

    tracker.currentStatus = status;
  }

  /**
   * Update or create a repository tracker with new state
   */
  updateRepoState(update: RepoStateUpdate): void {
    if (
      !this.config.enabled ||
      this.config.excludedRepoIds.includes(update.repositoryId)
    )
      return;

    const now = Date.now();
    let tracker = this.trackers.get(update.repositoryId);

    if (!tracker) {
      tracker = this.createTracker(update, now);
      this.trackers.set(update.repositoryId, tracker);
    }

    tracker.repositoryName = update.repositoryName;
    tracker.sessionId = update.sessionId;
    tracker.taskId = update.taskId;
    tracker.blockedQAGate = update.blockedQAGate ?? null;

    if (update.hasOutput) tracker.lastOutputTimestamp = now;
    if (update.status !== tracker.currentStatus)
      this.handleStatusTransition(tracker, update.status, now);
  }

  /**
   * Record output received from a repository
   */
  recordOutput(repositoryId: string): void {
    const tracker = this.trackers.get(repositoryId);
    if (tracker) {
      tracker.lastOutputTimestamp = Date.now();
      // If we were stuck due to no output, check if we should resolve
      if (tracker.isStuck && tracker.stuckReason === 'no_output') {
        this.resolveStuck(repositoryId);
      }
    }
  }

  /**
   * Process a single tracker for stuck condition
   */
  private processTracker(
    repoId: string,
    tracker: RepoStuckTracker,
    now: number
  ): void {
    const wasStuck = tracker.isStuck;
    const previousReason = tracker.stuckReason;
    const stuckReason = this.detectStuckCondition(tracker, now);

    if (stuckReason && !wasStuck) this.markAsStuck(tracker, stuckReason, now);
    else if (stuckReason && wasStuck && stuckReason !== previousReason) {
      this.resolveStuck(repoId);
      this.markAsStuck(tracker, stuckReason, now);
    } else if (!stuckReason && wasStuck) this.resolveStuck(repoId);
    else if (stuckReason && wasStuck) this.updateStuckDuration(tracker, now);
  }

  /**
   * Check all trackers for stuck conditions
   */
  private checkAllTrackers(): void {
    if (!this.config.enabled) return;
    const now = Date.now();
    for (const [repoId, tracker] of this.trackers)
      this.processTracker(repoId, tracker, now);
  }

  /**
   * Check if time since last output exceeds threshold
   */
  private isOutputStale(
    tracker: RepoStuckTracker,
    now: number,
    thresholdSeconds: number
  ): boolean {
    const threshold = this.getEffectiveThreshold(thresholdSeconds) * 1000;
    return now - tracker.lastOutputTimestamp > threshold;
  }

  /**
   * Check for status-based stuck conditions
   */
  private detectStatusBasedCondition(
    tracker: RepoStuckTracker,
    now: number
  ): StuckReason | null {
    const status = tracker.currentStatus;
    if (!status) return null;
    if (
      WAITING_STATUSES.includes(status) &&
      this.isOutputStale(tracker, now, this.config.waitingInputThresholdSeconds)
    )
      return 'waiting_input';
    if (
      THINKING_STATUSES.includes(status) &&
      this.isOutputStale(tracker, now, this.config.noOutputThresholdSeconds)
    )
      return 'no_output';
    return null;
  }

  /**
   * Detect if a tracker is in a stuck condition
   */
  private detectStuckCondition(
    tracker: RepoStuckTracker,
    now: number
  ): StuckReason | null {
    if (!tracker.sessionId) return null;
    if (tracker.consecutiveFailures >= this.config.repeatedFailureCount)
      return 'repeated_failures';
    if (tracker.blockedQAGate || tracker.currentStatus === 'qa_failed')
      return 'qa_gate_blocked';
    return this.detectStatusBasedCondition(tracker, now);
  }

  private buildStuckAlert(tracker: RepoStuckTracker, reason: StuckReason, now: number): StuckAlert {
    const durationSeconds = 0;
    return {
      id: generateAlertId(),
      repositoryId: tracker.repositoryId,
      repositoryName: tracker.repositoryName,
      sessionId: tracker.sessionId,
      taskId: tracker.taskId,
      reason,
      description: this.getReasonDescription(reason, tracker),
      severity: getAlertSeverity(reason, durationSeconds),
      detectedAt: new Date(now).toISOString(),
      stuckDurationSeconds: durationSeconds,
      lastOutputAt: new Date(tracker.lastOutputTimestamp).toISOString(),
      failureCount: reason === 'repeated_failures' ? tracker.consecutiveFailures : undefined,
      blockedGateName: reason === 'qa_gate_blocked' ? (tracker.blockedQAGate ?? undefined) : undefined,
      acknowledged: false,
      suggestedAction: getSuggestedAction(reason),
    };
  }

  /**
   * Mark a tracker as stuck and emit alert
   */
  private markAsStuck(tracker: RepoStuckTracker, reason: StuckReason, now: number): void {
    tracker.isStuck = true;
    tracker.stuckReason = reason;
    tracker.stuckSince = now;

    const alert = this.buildStuckAlert(tracker, reason, now);
    this.alerts.set(tracker.repositoryId, alert);

    const event: StuckEvent = { type: 'stuck_detected', alert, timestamp: new Date().toISOString() };
    stuckEvents.emit('stuck:detected', event);
    stuckEvents.emit('stuck:update', this.getStatus());
    console.log(`[StuckDetector] Stuck detected: ${tracker.repositoryName} - ${reason}`);
  }

  /**
   * Resolve stuck state for a repository
   */
  private resolveStuck(repositoryId: string): void {
    const tracker = this.trackers.get(repositoryId);
    const alert = this.alerts.get(repositoryId);

    if (tracker) {
      tracker.isStuck = false;
      tracker.stuckReason = null;
      tracker.stuckSince = null;
    }

    if (alert) {
      this.alerts.delete(repositoryId);

      const event: StuckEvent = {
        type: 'stuck_resolved',
        alert,
        timestamp: new Date().toISOString(),
      };
      stuckEvents.emit('stuck:resolved', event);
      stuckEvents.emit('stuck:update', this.getStatus());

      console.log(`[StuckDetector] Stuck resolved: ${alert.repositoryName}`);
    }
  }

  /**
   * Update stuck duration and check for severity escalation
   */
  private updateStuckDuration(tracker: RepoStuckTracker, now: number): void {
    if (!tracker.stuckSince || !tracker.stuckReason) return;

    const alert = this.alerts.get(tracker.repositoryId);
    if (!alert) return;

    const durationSeconds = Math.floor((now - tracker.stuckSince) / 1000);
    const previousSeverity = alert.severity;
    const newSeverity = getAlertSeverity(tracker.stuckReason, durationSeconds);

    alert.stuckDurationSeconds = durationSeconds;

    // Check for escalation
    if (newSeverity !== previousSeverity) {
      alert.severity = newSeverity;

      const event: StuckEvent = {
        type: 'stuck_escalated',
        alert,
        timestamp: new Date().toISOString(),
      };
      stuckEvents.emit('stuck:escalated', event);
      stuckEvents.emit('stuck:update', this.getStatus());

      console.log(
        `[StuckDetector] Stuck escalated: ${tracker.repositoryName} - ${previousSeverity} -> ${newSeverity}`
      );
    }
  }

  /**
   * Get human-readable description for stuck reason
   */
  private getReasonDescription(
    reason: StuckReason,
    tracker: RepoStuckTracker
  ): string {
    switch (reason) {
      case 'no_output':
        return 'No output received for an extended period';
      case 'waiting_input':
        return 'Waiting for your input or approval';
      case 'repeated_failures':
        return `Failed ${tracker.consecutiveFailures} times consecutively`;
      case 'qa_gate_blocked':
        return tracker.blockedQAGate
          ? `Blocked by QA gate: ${tracker.blockedQAGate}`
          : 'Blocked by QA gate check';
      case 'timeout':
        return 'Task execution timed out';
      default:
        return 'Encountered an unknown issue';
    }
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(repositoryId: string): boolean {
    const alert = this.alerts.get(repositoryId);
    if (alert) {
      alert.acknowledged = true;
      stuckEvents.emit('stuck:update', this.getStatus());
      return true;
    }
    return false;
  }

  /**
   * Get current stuck status summary
   */
  getStatus(): StuckStatus {
    const alerts = Array.from(this.alerts.values());

    let highestSeverity: StuckStatus['highestSeverity'] = null;
    const severityOrder = ['low', 'medium', 'high', 'critical'] as const;

    for (const alert of alerts) {
      if (
        !highestSeverity ||
        severityOrder.indexOf(alert.severity) >
          severityOrder.indexOf(highestSeverity)
      ) {
        highestSeverity = alert.severity;
      }
    }

    return {
      totalStuckCount: alerts.length,
      waitingInputCount: alerts.filter((a) => a.reason === 'waiting_input')
        .length,
      failedCount: alerts.filter((a) => a.reason === 'repeated_failures')
        .length,
      qaBlockedCount: alerts.filter((a) => a.reason === 'qa_gate_blocked')
        .length,
      alerts,
      highestSeverity,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get alerts for a specific repository
   */
  getAlertForRepo(repositoryId: string): StuckAlert | null {
    return this.alerts.get(repositoryId) || null;
  }

  /**
   * Clear all trackers (for testing/reset)
   */
  reset(): void {
    this.trackers.clear();
    this.alerts.clear();
    stuckEvents.emit('stuck:update', this.getStatus());
  }
}

/**
 * Get or create the singleton stuck detector instance
 */
export function getStuckDetector(
  config?: Partial<StuckDetectionConfig>
): StuckDetector {
  if (!globalForStuckDetection.stuckDetector) {
    globalForStuckDetection.stuckDetector = new StuckDetector(config);
    globalForStuckDetection.stuckDetector.start();
    console.log('[StuckDetector] Created and started singleton instance');
  } else if (config) {
    globalForStuckDetection.stuckDetector.updateConfig(config);
  }
  return globalForStuckDetection.stuckDetector;
}
