import { z } from 'zod';

/**
 * Stuck detection reason types
 */
export type StuckReason =
  | 'no_output'
  | 'waiting_input'
  | 'repeated_failures'
  | 'qa_gate_blocked'
  | 'timeout'
  | 'unknown';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Schema for stuck detection configuration
 */
export const StuckDetectionConfigSchema = z.object({
  /** Enable stuck detection globally */
  enabled: z.boolean().default(true),

  /** Threshold in seconds before marking as stuck due to no output */
  noOutputThresholdSeconds: z.number().min(10).max(600).default(30),

  /** Threshold in seconds for waiting input before alerting */
  waitingInputThresholdSeconds: z.number().min(10).max(600).default(60),

  /** Number of consecutive failures before marking as stuck */
  repeatedFailureCount: z.number().min(1).max(10).default(3),

  /** Enable toast notifications for stuck events */
  enableToastNotifications: z.boolean().default(true),

  /** Enable sound alerts for critical stuck events */
  enableSoundAlerts: z.boolean().default(false),

  /** Sensitivity level: lower = more sensitive */
  sensitivityLevel: z.enum(['low', 'medium', 'high']).default('medium'),

  /** Repos to exclude from stuck detection */
  excludedRepoIds: z.array(z.string()).default([]),
});

export type StuckDetectionConfig = z.infer<typeof StuckDetectionConfigSchema>;

/**
 * Default stuck detection configuration
 */
export const DEFAULT_STUCK_CONFIG: StuckDetectionConfig = {
  enabled: true,
  noOutputThresholdSeconds: 30,
  waitingInputThresholdSeconds: 60,
  repeatedFailureCount: 3,
  enableToastNotifications: true,
  enableSoundAlerts: false,
  sensitivityLevel: 'medium',
  excludedRepoIds: [],
};

/**
 * Sensitivity multipliers for thresholds
 */
export const SENSITIVITY_MULTIPLIERS: Record<StuckDetectionConfig['sensitivityLevel'], number> = {
  high: 0.5,   // More sensitive - shorter thresholds
  medium: 1.0, // Default thresholds
  low: 2.0,    // Less sensitive - longer thresholds
};

/**
 * A single stuck alert for a repository
 */
export interface StuckAlert {
  /** Unique alert ID */
  id: string;

  /** Repository ID */
  repositoryId: string;

  /** Repository name for display */
  repositoryName: string;

  /** Session ID if applicable */
  sessionId: string | null;

  /** Current task ID if applicable */
  taskId: string | null;

  /** Reason for stuck state */
  reason: StuckReason;

  /** Human-readable description of the issue */
  description: string;

  /** Alert severity */
  severity: AlertSeverity;

  /** Timestamp when stuck state was first detected */
  detectedAt: string;

  /** Duration in seconds since stuck was detected */
  stuckDurationSeconds: number;

  /** Last output timestamp if available */
  lastOutputAt: string | null;

  /** Number of consecutive failures (for repeated_failures reason) */
  failureCount?: number;

  /** QA gate name (for qa_gate_blocked reason) */
  blockedGateName?: string;

  /** Whether alert has been acknowledged by user */
  acknowledged: boolean;

  /** Suggested action to resolve */
  suggestedAction: string;
}

/**
 * Aggregated stuck status for the entire dashboard
 */
export interface StuckStatus {
  /** Total number of stuck repos */
  totalStuckCount: number;

  /** Number of repos waiting for input */
  waitingInputCount: number;

  /** Number of repos with repeated failures */
  failedCount: number;

  /** Number of repos blocked by QA gates */
  qaBlockedCount: number;

  /** List of all active alerts */
  alerts: StuckAlert[];

  /** Highest severity among all alerts */
  highestSeverity: AlertSeverity | null;

  /** Timestamp of last update */
  lastUpdated: string;
}

/**
 * SSE event types for stuck detection
 */
export type StuckEventType =
  | 'stuck_detected'
  | 'stuck_resolved'
  | 'stuck_escalated'
  | 'stuck_bulk_update';

/**
 * SSE event payload for stuck detection
 */
export interface StuckEvent {
  type: StuckEventType;
  alert?: StuckAlert;
  alerts?: StuckAlert[];
  status?: StuckStatus;
  timestamp: string;
}

/**
 * Internal tracking state for a single repository
 */
export interface RepoStuckTracker {
  repositoryId: string;
  repositoryName: string;
  sessionId: string | null;
  taskId: string | null;

  /** Last time we received any output */
  lastOutputTimestamp: number;

  /** Current consecutive failure count */
  consecutiveFailures: number;

  /** Whether currently in stuck state */
  isStuck: boolean;

  /** Current stuck reason if any */
  stuckReason: StuckReason | null;

  /** When stuck state was first detected */
  stuckSince: number | null;

  /** Current task status */
  currentStatus: string | null;

  /** Previous task statuses for pattern detection */
  statusHistory: { status: string; timestamp: number }[];

  /** Blocked QA gate name if any */
  blockedQAGate: string | null;
}

/**
 * Map reason to severity
 */
export function getAlertSeverity(reason: StuckReason, durationSeconds: number): AlertSeverity {
  // Escalate based on duration
  if (durationSeconds > 300) return 'critical'; // > 5 minutes
  if (durationSeconds > 120) return 'high';     // > 2 minutes

  // Base severity by reason
  switch (reason) {
    case 'repeated_failures':
      return 'high';
    case 'qa_gate_blocked':
      return 'medium';
    case 'waiting_input':
      return 'medium';
    case 'no_output':
      return durationSeconds > 60 ? 'high' : 'medium';
    case 'timeout':
      return 'high';
    default:
      return 'low';
  }
}

/**
 * Get suggested action for a stuck reason
 */
export function getSuggestedAction(reason: StuckReason): string {
  switch (reason) {
    case 'no_output':
      return 'Check if Claude is waiting for input or encountered an issue';
    case 'waiting_input':
      return 'Review and approve the pending request';
    case 'repeated_failures':
      return 'Investigate the error logs and fix the underlying issue';
    case 'qa_gate_blocked':
      return 'Review QA gate failures and fix code quality issues';
    case 'timeout':
      return 'Consider breaking the task into smaller steps';
    default:
      return 'Check the session for any issues';
  }
}

/**
 * Format duration for display
 */
export function formatStuckDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}
