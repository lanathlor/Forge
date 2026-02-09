import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockAbandonInactiveSessions = vi.hoisted(() => vi.fn());

vi.mock('../manager', () => ({
  abandonInactiveSessions: mockAbandonInactiveSessions,
}));

describe('sessions/cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('runSessionCleanup', () => {
    it('should run cleanup and return abandoned count', async () => {
      mockAbandonInactiveSessions.mockResolvedValueOnce(3);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { runSessionCleanup } = await import('../cleanup');
      const result = await runSessionCleanup();

      expect(result).toBe(3);
      expect(mockAbandonInactiveSessions).toHaveBeenCalledWith(24 * 60 * 60 * 1000);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[SessionCleanup] Abandoned 3 inactive session(s)'
      );
      consoleSpy.mockRestore();
    });

    it('should log when no sessions to abandon', async () => {
      mockAbandonInactiveSessions.mockResolvedValueOnce(0);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { runSessionCleanup } = await import('../cleanup');
      const result = await runSessionCleanup();

      expect(result).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[SessionCleanup] No inactive sessions to abandon'
      );
      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully and return 0', async () => {
      mockAbandonInactiveSessions.mockRejectedValueOnce(new Error('DB error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { runSessionCleanup } = await import('../cleanup');
      const result = await runSessionCleanup();

      expect(result).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[SessionCleanup] Error during cleanup:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('startSessionCleanupJob', () => {
    it('should start cleanup job and run immediately', async () => {
      mockAbandonInactiveSessions.mockResolvedValue(0);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { startSessionCleanupJob, stopSessionCleanupJob } = await import('../cleanup');
      startSessionCleanupJob();

      // Should have run immediately
      expect(mockAbandonInactiveSessions).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[SessionCleanup] Starting cleanup job (runs every hour)'
      );

      // Cleanup
      stopSessionCleanupJob();
      consoleSpy.mockRestore();
    });

    it('should not start multiple cleanup jobs', async () => {
      mockAbandonInactiveSessions.mockResolvedValue(0);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { startSessionCleanupJob, stopSessionCleanupJob } = await import('../cleanup');
      startSessionCleanupJob();
      startSessionCleanupJob(); // Try to start again

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SessionCleanup] Cleanup job already running'
      );

      stopSessionCleanupJob();
      consoleSpy.mockRestore();
    });

    it('should run periodically', async () => {
      mockAbandonInactiveSessions.mockResolvedValue(0);
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const { startSessionCleanupJob, stopSessionCleanupJob } = await import('../cleanup');
      startSessionCleanupJob();

      // Initial call
      expect(mockAbandonInactiveSessions).toHaveBeenCalledTimes(1);

      // Advance time by 1 hour
      vi.advanceTimersByTime(60 * 60 * 1000);

      // Should have been called again
      expect(mockAbandonInactiveSessions).toHaveBeenCalledTimes(2);

      stopSessionCleanupJob();
    });
  });

  describe('stopSessionCleanupJob', () => {
    it('should stop running cleanup job', async () => {
      mockAbandonInactiveSessions.mockResolvedValue(0);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { startSessionCleanupJob, stopSessionCleanupJob } = await import('../cleanup');
      startSessionCleanupJob();
      stopSessionCleanupJob();

      expect(consoleSpy).toHaveBeenCalledWith('[SessionCleanup] Cleanup job stopped');
      consoleSpy.mockRestore();
    });

    it('should do nothing if job not running', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { stopSessionCleanupJob } = await import('../cleanup');
      stopSessionCleanupJob();

      // Should not log anything about stopping
      expect(consoleSpy).not.toHaveBeenCalledWith('[SessionCleanup] Cleanup job stopped');
      consoleSpy.mockRestore();
    });
  });

  describe('isCleanupJobRunning', () => {
    it('should return false when job not started', async () => {
      const { isCleanupJobRunning } = await import('../cleanup');
      expect(isCleanupJobRunning()).toBe(false);
    });

    it('should return true when job is running', async () => {
      mockAbandonInactiveSessions.mockResolvedValue(0);
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const { startSessionCleanupJob, stopSessionCleanupJob, isCleanupJobRunning } =
        await import('../cleanup');
      startSessionCleanupJob();

      expect(isCleanupJobRunning()).toBe(true);

      stopSessionCleanupJob();
      expect(isCleanupJobRunning()).toBe(false);
    });
  });
});
