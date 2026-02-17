import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useBreakpoint,
  useIsBreakpoint,
  useIsBelowBreakpoint,
  useIsBetweenBreakpoints,
  useCurrentBreakpoint,
  BREAKPOINTS,
} from '../useBreakpoint';

describe('useBreakpoint', () => {
  let resizeHandler: ((this: Window, ev: UIEvent) => void) | null = null;

  beforeEach(() => {
    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920,
    });

    // Capture resize event listener
    vi.spyOn(window, 'addEventListener').mockImplementation(
      (event, handler) => {
        if (event === 'resize') {
          resizeHandler = handler as (this: Window, ev: UIEvent) => void;
        }
      }
    );

    vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resizeHandler = null;
  });

  it('should return desktop for large screens (>= 1280px)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1920 });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('desktop');
  });

  it('should return tablet for medium screens (768px - 1279px)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024 });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('tablet');
  });

  it('should return mobile for small screens (< 768px)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 500 });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('mobile');
  });

  it('should update on window resize', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1920 });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('desktop');

    // Simulate resize to mobile
    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 500 });
      if (resizeHandler) {
        resizeHandler.call(window, new UIEvent('resize'));
      }
    });

    expect(result.current).toBe('mobile');
  });

  it('should cleanup resize listener on unmount', () => {
    const { unmount } = renderHook(() => useBreakpoint());
    unmount();
    expect(window.removeEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    );
  });

  it('should handle boundary at 768px (tablet)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 768 });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('tablet');
  });

  it('should handle boundary at 1280px (desktop)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1280 });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('desktop');
  });
});

describe('BREAKPOINTS constant', () => {
  it('should have correct breakpoint values', () => {
    expect(BREAKPOINTS.sm).toBe(640);
    expect(BREAKPOINTS.md).toBe(768);
    expect(BREAKPOINTS.lg).toBe(1024);
    expect(BREAKPOINTS.xl).toBe(1280);
    expect(BREAKPOINTS['2xl']).toBe(1536);
  });
});

describe('useIsBreakpoint', () => {
  beforeEach(() => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true when viewport is at or above the breakpoint', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query === '(min-width: 768px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useIsBreakpoint('md'));
    expect(result.current).toBe(true);
  });

  it('should return false when viewport is below the breakpoint', () => {
    const { result } = renderHook(() => useIsBreakpoint('lg'));
    expect(result.current).toBe(false);
  });

  it('should use correct media query for each breakpoint', () => {
    const matchMediaSpy = vi.spyOn(window, 'matchMedia');

    renderHook(() => useIsBreakpoint('sm'));
    expect(matchMediaSpy).toHaveBeenCalledWith('(min-width: 640px)');

    renderHook(() => useIsBreakpoint('md'));
    expect(matchMediaSpy).toHaveBeenCalledWith('(min-width: 768px)');

    renderHook(() => useIsBreakpoint('lg'));
    expect(matchMediaSpy).toHaveBeenCalledWith('(min-width: 1024px)');

    renderHook(() => useIsBreakpoint('xl'));
    expect(matchMediaSpy).toHaveBeenCalledWith('(min-width: 1280px)');

    renderHook(() => useIsBreakpoint('2xl'));
    expect(matchMediaSpy).toHaveBeenCalledWith('(min-width: 1536px)');
  });
});

describe('useIsBelowBreakpoint', () => {
  beforeEach(() => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true when viewport is below the breakpoint', () => {
    const { result } = renderHook(() => useIsBelowBreakpoint('md'));
    expect(result.current).toBe(true);
  });

  it('should use correct max-width query', () => {
    const matchMediaSpy = vi.spyOn(window, 'matchMedia');

    renderHook(() => useIsBelowBreakpoint('md'));
    expect(matchMediaSpy).toHaveBeenCalledWith('(max-width: 767px)');

    renderHook(() => useIsBelowBreakpoint('lg'));
    expect(matchMediaSpy).toHaveBeenCalledWith('(max-width: 1023px)');
  });
});

describe('useIsBetweenBreakpoints', () => {
  beforeEach(() => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query === '(min-width: 768px) and (max-width: 1023px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true when viewport is between breakpoints', () => {
    const { result } = renderHook(() => useIsBetweenBreakpoints('md', 'lg'));
    expect(result.current).toBe(true);
  });

  it('should use correct combined query', () => {
    const matchMediaSpy = vi.spyOn(window, 'matchMedia');

    renderHook(() => useIsBetweenBreakpoints('md', 'lg'));
    expect(matchMediaSpy).toHaveBeenCalledWith(
      '(min-width: 768px) and (max-width: 1023px)'
    );
  });
});

describe('useCurrentBreakpoint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return null when below sm breakpoint', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useCurrentBreakpoint());
    expect(result.current).toBeNull();
  });

  it('should return sm when only sm matches', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query === '(min-width: 640px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useCurrentBreakpoint());
    expect(result.current).toBe('sm');
  });

  it('should return largest matching breakpoint', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches:
        query === '(min-width: 640px)' ||
        query === '(min-width: 768px)' ||
        query === '(min-width: 1024px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useCurrentBreakpoint());
    expect(result.current).toBe('lg');
  });

  it('should return 2xl when all breakpoints match', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(() => ({
      matches: true,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useCurrentBreakpoint());
    expect(result.current).toBe('2xl');
  });
});
