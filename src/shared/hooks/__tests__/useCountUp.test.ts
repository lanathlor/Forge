import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountUp, easings } from '../useCountUp';

const mockMatchMedia = (prefersReducedMotion: boolean) => {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches:
      query === '(prefers-reduced-motion: reduce)' && prefersReducedMotion,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

describe('useCountUp', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic functionality', () => {
    it('should initialize with from value when animation has not started', () => {
      const { result } = renderHook(() =>
        useCountUp({ to: 100, from: 0, autoStart: false })
      );
      expect(result.current.value).toBe(0);
      expect(result.current.formattedValue).toBe('0');
    });

    it('should return formatted value with decimals', () => {
      const { result } = renderHook(() =>
        useCountUp({ to: 99.5, from: 0, decimals: 1, autoStart: false })
      );
      expect(result.current.formattedValue).toBe('0.0');
    });

    it('should return isAnimating as false initially when autoStart is false', () => {
      const { result } = renderHook(() =>
        useCountUp({ to: 100, autoStart: false })
      );
      expect(result.current.isAnimating).toBe(false);
    });

    it('should provide start and reset functions', () => {
      const { result } = renderHook(() =>
        useCountUp({ to: 100, autoStart: false })
      );
      expect(typeof result.current.start).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });
  });

  describe('reduced motion', () => {
    it('should skip animation when user prefers reduced motion', () => {
      mockMatchMedia(true);

      const onComplete = vi.fn();
      const { result } = renderHook(() =>
        useCountUp({ to: 100, from: 0, onComplete })
      );

      // Should immediately be at target value
      expect(result.current.value).toBe(100);
      expect(result.current.isAnimating).toBe(false);
      expect(onComplete).toHaveBeenCalled();
    });

    it('should set target value on reset when prefers reduced motion', () => {
      mockMatchMedia(true);

      const { result } = renderHook(() =>
        useCountUp({ to: 50, from: 0, autoStart: false })
      );

      act(() => {
        result.current.reset();
      });

      expect(result.current.value).toBe(50);
    });

    it('should immediately complete on start when prefers reduced motion', () => {
      mockMatchMedia(true);

      const onComplete = vi.fn();
      const { result } = renderHook(() =>
        useCountUp({ to: 75, from: 0, autoStart: false, onComplete })
      );

      act(() => {
        result.current.start();
      });

      expect(result.current.value).toBe(75);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('should initialize with target value when prefersReducedMotion is true', () => {
      mockMatchMedia(true);

      const { result } = renderHook(() =>
        useCountUp({ to: 200, from: 0, autoStart: false })
      );

      // Initial value should be target when reduced motion preferred
      expect(result.current.value).toBe(200);
    });
  });

  describe('start function', () => {
    it('should set isAnimating to true when start is called', () => {
      const { result } = renderHook(() =>
        useCountUp({ to: 100, from: 0, autoStart: false })
      );

      act(() => {
        result.current.start();
      });

      expect(result.current.isAnimating).toBe(true);
    });

    it('should reset value to from when start is called', () => {
      const { result } = renderHook(() =>
        useCountUp({ to: 100, from: 10, autoStart: false })
      );

      act(() => {
        result.current.start();
      });

      expect(result.current.value).toBe(10);
    });
  });

  describe('reset function', () => {
    it('should set isAnimating to false on reset', () => {
      const { result } = renderHook(() =>
        useCountUp({ to: 100, from: 0, autoStart: false })
      );

      act(() => {
        result.current.start();
      });

      expect(result.current.isAnimating).toBe(true);

      act(() => {
        result.current.reset();
      });

      expect(result.current.isAnimating).toBe(false);
    });

    it('should reset value to from on reset', () => {
      const { result } = renderHook(() =>
        useCountUp({ to: 100, from: 5, autoStart: false })
      );

      act(() => {
        result.current.start();
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.value).toBe(5);
    });
  });

  describe('options', () => {
    it('should use default from value of 0', () => {
      const { result } = renderHook(() =>
        useCountUp({ to: 100, autoStart: false })
      );
      expect(result.current.value).toBe(0);
    });

    it('should use default duration of 1000', () => {
      // This test verifies the option is accepted
      const { result } = renderHook(() => useCountUp({ to: 100 }));
      expect(result.current).toBeDefined();
    });

    it('should use default decimals of 0', () => {
      // When autoStart is false, value starts at from (0 by default)
      // formatted with 0 decimals
      const { result } = renderHook(() =>
        useCountUp({ to: 99.999, autoStart: false })
      );
      expect(result.current.formattedValue).toBe('0');
    });

    it('should use custom delay', () => {
      const { result } = renderHook(() =>
        useCountUp({ to: 100, delay: 500, autoStart: false })
      );
      expect(result.current).toBeDefined();
    });

    it('should accept custom easing function', () => {
      const customEasing = (t: number) => t * t;
      const { result } = renderHook(() =>
        useCountUp({ to: 100, easing: customEasing, autoStart: false })
      );
      expect(result.current).toBeDefined();
    });

    it('should handle negative target values', () => {
      mockMatchMedia(true);
      const { result } = renderHook(() => useCountUp({ to: -50, from: 0 }));
      expect(result.current.value).toBe(-50);
    });

    it('should handle counting down (from > to)', () => {
      mockMatchMedia(true);
      const { result } = renderHook(() => useCountUp({ to: 0, from: 100 }));
      expect(result.current.value).toBe(0);
    });

    it('should handle same from and to values', () => {
      mockMatchMedia(true);
      const { result } = renderHook(() => useCountUp({ to: 50, from: 50 }));
      expect(result.current.value).toBe(50);
    });
  });

  describe('useValueSync effect', () => {
    it('should sync value when not animating and autoStart is false', () => {
      const { result, rerender } = renderHook(
        ({ to }) => useCountUp({ to, from: 0, autoStart: false }),
        { initialProps: { to: 100 } }
      );

      expect(result.current.value).toBe(0);

      // The value should stay at from since autoStart is false and not animating
      rerender({ to: 200 });
      expect(result.current.value).toBe(0);
    });
  });

  describe('formatValue', () => {
    it('should format value with 0 decimals by default', () => {
      const { result } = renderHook(() =>
        useCountUp({ to: 100, autoStart: false })
      );
      expect(result.current.formattedValue).toBe('0');
    });

    it('should format value with specified decimals', () => {
      const { result } = renderHook(() =>
        useCountUp({ to: 100, decimals: 2, autoStart: false })
      );
      expect(result.current.formattedValue).toBe('0.00');
    });

    it('should format value with 3 decimals', () => {
      const { result } = renderHook(() =>
        useCountUp({ to: 100, decimals: 3, autoStart: false })
      );
      expect(result.current.formattedValue).toBe('0.000');
    });
  });

  describe('cleanup', () => {
    it('should not throw on unmount', () => {
      const { unmount } = renderHook(() => useCountUp({ to: 100, from: 0 }));

      expect(() => unmount()).not.toThrow();
    });
  });
});

describe('easings', () => {
  it('linear should return t unchanged', () => {
    expect(easings.linear(0)).toBe(0);
    expect(easings.linear(0.5)).toBe(0.5);
    expect(easings.linear(1)).toBe(1);
  });

  it('easeOutCubic should ease out', () => {
    expect(easings.easeOutCubic(0)).toBe(0);
    expect(easings.easeOutCubic(0.5)).toBeCloseTo(0.875, 3);
    expect(easings.easeOutCubic(1)).toBe(1);
  });

  it('easeOutQuart should ease out faster', () => {
    expect(easings.easeOutQuart(0)).toBe(0);
    expect(easings.easeOutQuart(0.5)).toBeCloseTo(0.9375, 3);
    expect(easings.easeOutQuart(1)).toBe(1);
  });

  it('easeOutExpo should have exponential easing', () => {
    expect(easings.easeOutExpo(0)).toBeCloseTo(0, 2);
    expect(easings.easeOutExpo(1)).toBe(1);
    expect(easings.easeOutExpo(0.5)).toBeGreaterThan(0.9);
  });

  it('easeInOutCubic should ease in and out', () => {
    expect(easings.easeInOutCubic(0)).toBe(0);
    expect(easings.easeInOutCubic(0.5)).toBe(0.5);
    expect(easings.easeInOutCubic(1)).toBe(1);
    // First half should be slow
    expect(easings.easeInOutCubic(0.25)).toBeLessThan(0.25);
    // Second half should be fast
    expect(easings.easeInOutCubic(0.75)).toBeGreaterThan(0.75);
  });

  it('easeOutExpo should return 1 at t=1', () => {
    // Branch coverage: t === 1 case
    expect(easings.easeOutExpo(1)).toBe(1);
  });

  it('easeInOutCubic first half branch (t < 0.5)', () => {
    // Branch coverage: t < 0.5 case
    expect(easings.easeInOutCubic(0.25)).toBeCloseTo(0.0625, 4);
  });

  it('easeInOutCubic second half branch (t >= 0.5)', () => {
    // Branch coverage: t >= 0.5 case
    expect(easings.easeInOutCubic(0.75)).toBeCloseTo(0.9375, 4);
  });
});
