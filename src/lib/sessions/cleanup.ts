import { abandonInactiveSessions } from './manager';

const INACTIVITY_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let cleanupIntervalId: NodeJS.Timeout | null = null;

/**
 * Run the session cleanup job to abandon inactive sessions.
 * Returns the number of sessions abandoned.
 */
export async function runSessionCleanup(): Promise<number> {
  console.log('[SessionCleanup] Running cleanup job...');

  try {
    const abandonedCount = await abandonInactiveSessions(
      INACTIVITY_THRESHOLD_MS
    );

    if (abandonedCount > 0) {
      console.log(
        `[SessionCleanup] Abandoned ${abandonedCount} inactive session(s)`
      );
    } else {
      console.log('[SessionCleanup] No inactive sessions to abandon');
    }

    return abandonedCount;
  } catch (error) {
    console.error('[SessionCleanup] Error during cleanup:', error);
    return 0;
  }
}

/**
 * Start the periodic session cleanup job.
 * The job runs every hour to check for inactive sessions.
 */
export function startSessionCleanupJob(): void {
  if (cleanupIntervalId) {
    console.log('[SessionCleanup] Cleanup job already running');
    return;
  }

  console.log('[SessionCleanup] Starting cleanup job (runs every hour)');

  // Run immediately on start
  runSessionCleanup();

  // Then run periodically
  cleanupIntervalId = setInterval(runSessionCleanup, CLEANUP_INTERVAL_MS);
}

/**
 * Stop the periodic session cleanup job.
 */
export function stopSessionCleanupJob(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    console.log('[SessionCleanup] Cleanup job stopped');
  }
}

/**
 * Check if the cleanup job is currently running.
 */
export function isCleanupJobRunning(): boolean {
  return cleanupIntervalId !== null;
}
