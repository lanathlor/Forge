import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useResponsiveValue, useResponsiveValueWithFallback } from '../useResponsiveValue';
import { BREAKPOINTS } from '../useBreakpoint';

function mockMatchMedia(width: number) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    // Parse the min-width value from the query
    const match = query.match(/min-width:\s*(\d+)px/);
    const minWidth = match ? parseInt(match[1] ?? '0', 10) : 0;

    return {
      matches: width >= minWidth,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    };
  });
}

describe('useResponsiveValue', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return base value on small screens', () => {
    mockMatchMedia(400); // Below sm (640px)

    const { result } = renderHook(() =>
      useResponsiveValue({ base: 'small', md: 'medium', lg: 'large' })
    );

    expect(result.current).toBe('small');
  });

  it('should return sm value on small screens when base is not provided', () => {
    mockMatchMedia(650); // Above sm (640px), below md (768px)

    const { result } = renderHook(() => useResponsiveValue({ sm: 'small', lg: 'large' }));

    expect(result.current).toBe('small');
  });

  it('should return md value on medium screens', () => {
    mockMatchMedia(800); // Above md (768px), below lg (1024px)

    const { result } = renderHook(() =>
      useResponsiveValue({ base: 'small', md: 'medium', lg: 'large' })
    );

    expect(result.current).toBe('medium');
  });

  it('should return lg value on large screens', () => {
    mockMatchMedia(1100); // Above lg (1024px), below xl (1280px)

    const { result } = renderHook(() =>
      useResponsiveValue({ base: 'small', md: 'medium', lg: 'large' })
    );

    expect(result.current).toBe('large');
  });

  it('should return xl value on extra large screens', () => {
    mockMatchMedia(1400); // Above xl (1280px), below 2xl (1536px)

    const { result } = renderHook(() =>
      useResponsiveValue({ base: 'small', md: 'medium', xl: 'extra-large' })
    );

    expect(result.current).toBe('extra-large');
  });

  it('should return 2xl value on extra extra large screens', () => {
    mockMatchMedia(1600); // Above 2xl (1536px)

    const { result } = renderHook(() =>
      useResponsiveValue({ base: 'small', '2xl': 'huge' })
    );

    expect(result.current).toBe('huge');
  });

  it('should cascade down when value is not defined for current breakpoint', () => {
    mockMatchMedia(1100); // lg breakpoint

    const { result } = renderHook(() =>
      useResponsiveValue({ base: 'small', md: 'medium' }) // No lg value defined
    );

    // Should cascade down to md value
    expect(result.current).toBe('medium');
  });

  it('should cascade all the way down to base when no intermediate values', () => {
    mockMatchMedia(1600); // 2xl breakpoint

    const { result } = renderHook(() =>
      useResponsiveValue({ base: 'only-base' }) // Only base defined
    );

    expect(result.current).toBe('only-base');
  });

  it('should return fallback when no values match', () => {
    mockMatchMedia(400); // Below sm

    const { result } = renderHook(() =>
      useResponsiveValue({ md: 'medium', lg: 'large' }, 'fallback') // No base or sm
    );

    expect(result.current).toBe('fallback');
  });

  it('should return undefined when no values match and no fallback', () => {
    mockMatchMedia(400); // Below sm

    const { result } = renderHook(() =>
      useResponsiveValue({ md: 'medium', lg: 'large' }) // No base, sm, or fallback
    );

    expect(result.current).toBeUndefined();
  });

  it('should work with numeric values', () => {
    mockMatchMedia(1100); // lg breakpoint

    const { result } = renderHook(() =>
      useResponsiveValue({ base: 1, sm: 2, lg: 4, xl: 6 })
    );

    expect(result.current).toBe(4);
  });

  it('should work with object values', () => {
    mockMatchMedia(800); // md breakpoint

    const { result } = renderHook(() =>
      useResponsiveValue({
        base: { padding: 8 },
        md: { padding: 16 },
        lg: { padding: 24 },
      })
    );

    expect(result.current).toEqual({ padding: 16 });
  });

  it('should work with boolean values', () => {
    mockMatchMedia(1100); // lg breakpoint

    const { result } = renderHook(() =>
      useResponsiveValue({ base: false, lg: true })
    );

    expect(result.current).toBe(true);
  });

  it('should handle layout mode example from documentation', () => {
    // Test compact on mobile
    mockMatchMedia(400);
    const { result: mobileResult } = renderHook(() =>
      useResponsiveValue({ base: 'compact', md: 'comfortable', lg: 'expanded' }, 'compact')
    );
    expect(mobileResult.current).toBe('compact');

    // Test comfortable on tablet
    mockMatchMedia(800);
    const { result: tabletResult } = renderHook(() =>
      useResponsiveValue({ base: 'compact', md: 'comfortable', lg: 'expanded' }, 'compact')
    );
    expect(tabletResult.current).toBe('comfortable');

    // Test expanded on desktop
    mockMatchMedia(1100);
    const { result: desktopResult } = renderHook(() =>
      useResponsiveValue({ base: 'compact', md: 'comfortable', lg: 'expanded' }, 'compact')
    );
    expect(desktopResult.current).toBe('expanded');
  });

  it('should handle column count example from documentation', () => {
    // Mobile: 1 column
    mockMatchMedia(400);
    const { result: mobileResult } = renderHook(() =>
      useResponsiveValue({ base: 1, sm: 2, lg: 3, xl: 4 }, 1)
    );
    expect(mobileResult.current).toBe(1);

    // Small: 2 columns
    mockMatchMedia(650);
    const { result: smallResult } = renderHook(() =>
      useResponsiveValue({ base: 1, sm: 2, lg: 3, xl: 4 }, 1)
    );
    expect(smallResult.current).toBe(2);

    // Large: 3 columns
    mockMatchMedia(1100);
    const { result: largeResult } = renderHook(() =>
      useResponsiveValue({ base: 1, sm: 2, lg: 3, xl: 4 }, 1)
    );
    expect(largeResult.current).toBe(3);

    // Extra large: 4 columns
    mockMatchMedia(1400);
    const { result: xlResult } = renderHook(() =>
      useResponsiveValue({ base: 1, sm: 2, lg: 3, xl: 4 }, 1)
    );
    expect(xlResult.current).toBe(4);
  });
});

describe('useResponsiveValueWithFallback', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should always return a non-undefined value', () => {
    mockMatchMedia(400); // Below sm

    const { result } = renderHook(() =>
      useResponsiveValueWithFallback({ md: 'medium' }, 'fallback')
    );

    expect(result.current).toBe('fallback');
    expect(result.current).not.toBeUndefined();
  });

  it('should return responsive value when available', () => {
    mockMatchMedia(800);

    const { result } = renderHook(() =>
      useResponsiveValueWithFallback({ md: 'medium' }, 'fallback')
    );

    expect(result.current).toBe('medium');
  });

  it('should return fallback when base is undefined but matched', () => {
    mockMatchMedia(400); // Below sm, no matching value

    const { result } = renderHook(() =>
      useResponsiveValueWithFallback({ lg: 'large' }, 'default')
    );

    expect(result.current).toBe('default');
  });
});

describe('Breakpoint values alignment', () => {
  it('should use the same breakpoint values as BREAKPOINTS constant', () => {
    // Verify our mock uses the correct values
    expect(BREAKPOINTS.sm).toBe(640);
    expect(BREAKPOINTS.md).toBe(768);
    expect(BREAKPOINTS.lg).toBe(1024);
    expect(BREAKPOINTS.xl).toBe(1280);
    expect(BREAKPOINTS['2xl']).toBe(1536);
  });
});
