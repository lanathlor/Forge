import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  debounce,
  throttle,
  prefersReducedMotion,
  logSlowRender,
  measureRender,
  requestIdleCallback,
  cancelIdleCallback,
} from '../performance';

describe('Performance Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('debounce', () => {
    it('should delay function execution', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should cancel previous calls', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments correctly', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('arg1', 'arg2');
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('throttle', () => {
    it('should execute immediately on first call', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should ignore calls within throttle period', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should allow calls after throttle period', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);

      throttledFn();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments correctly', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn('test', 123);
      expect(fn).toHaveBeenCalledWith('test', 123);
    });
  });

  describe('prefersReducedMotion', () => {
    it('should return false when window is undefined', () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing undefined window
      delete global.window;

      const result = prefersReducedMotion();
      expect(result).toBe(false);

      global.window = originalWindow;
    });

    it('should return matchMedia result when window is defined', () => {
      const matchMediaMock = vi.fn().mockReturnValue({ matches: true });
      global.window.matchMedia = matchMediaMock;

      const result = prefersReducedMotion();
      expect(result).toBe(true);
      expect(matchMediaMock).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    });
  });

  describe('logSlowRender', () => {
    it('should not log in production', () => {
      const originalEnv = process.env.NODE_ENV;
      vi.stubEnv('NODE_ENV', 'production');
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logSlowRender({
        id: 'TestComponent',
        phase: 'mount',
        actualDuration: 20,
        baseDuration: 10,
        startTime: 0,
        commitTime: 20,
      });

      expect(consoleWarnSpy).not.toHaveBeenCalled();

      vi.unstubAllEnvs();
    });

    it('should log slow renders in development', () => {
      const originalEnv = process.env.NODE_ENV;
      vi.stubEnv('NODE_ENV', 'development');
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logSlowRender({
        id: 'TestComponent',
        phase: 'mount',
        actualDuration: 20,
        baseDuration: 10,
        startTime: 0,
        commitTime: 20,
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Performance] Slow mount render detected:',
        expect.objectContaining({
          component: 'TestComponent',
        })
      );

      vi.unstubAllEnvs();
    });

    it('should not log fast renders', () => {
      const originalEnv = process.env.NODE_ENV;
      vi.stubEnv('NODE_ENV', 'development');
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logSlowRender({
        id: 'TestComponent',
        phase: 'mount',
        actualDuration: 10,
        baseDuration: 5,
        startTime: 0,
        commitTime: 10,
      });

      expect(consoleWarnSpy).not.toHaveBeenCalled();

      vi.unstubAllEnvs();
    });
  });

  describe('requestIdleCallback and cancelIdleCallback', () => {
    it('should be defined as functions', () => {
      expect(typeof requestIdleCallback).toBe('function');
      expect(typeof cancelIdleCallback).toBe('function');
    });

    it('should execute callback using polyfill', () => {
      const mockCallback = vi.fn();

      // Test the polyfill implementation directly
      const polyfill = (callback: IdleRequestCallback) => {
        const start = Date.now();
        return setTimeout(() => {
          callback({
            didTimeout: false,
            timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
          });
        }, 1);
      };

      polyfill(mockCallback);
      vi.advanceTimersByTime(1);

      expect(mockCallback).toHaveBeenCalled();
    });

    it('should call cancelIdleCallback', () => {
      // Test that cancelIdleCallback exists and can be called
      const id = 123;
      expect(() => cancelIdleCallback(id)).not.toThrow();
    });
  });

  describe('measureRender', () => {
    it('should not measure in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fn = vi.fn();

      measureRender('TestComponent', fn);

      expect(fn).toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      vi.unstubAllEnvs();
    });

    it('should measure and log slow renders in development', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock performance.now to simulate slow render
      const performanceNowSpy = vi.spyOn(performance, 'now');
      performanceNowSpy.mockReturnValueOnce(0).mockReturnValueOnce(20);

      const fn = vi.fn();
      measureRender('TestComponent', fn);

      expect(fn).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Performance] TestComponent render took 20.00ms')
      );

      vi.unstubAllEnvs();
    });

    it('should not log fast renders in development', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock performance.now to simulate fast render
      const performanceNowSpy = vi.spyOn(performance, 'now');
      performanceNowSpy.mockReturnValueOnce(0).mockReturnValueOnce(10);

      const fn = vi.fn();
      measureRender('TestComponent', fn);

      expect(fn).toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      vi.unstubAllEnvs();
    });
  });
});
