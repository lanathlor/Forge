import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '../useMediaQuery';

function createMockMediaQueryList(
  matches: boolean,
  query: string
): MediaQueryList {
  return {
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  };
}

describe('useMediaQuery', () => {
  let listeners: Map<string, EventListener>;

  beforeEach(() => {
    listeners = new Map();
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
      const mql = createMockMediaQueryList(false, query);
      mql.addEventListener = vi.fn((event: string, callback: EventListener) => {
        if (event === 'change') {
          listeners.set(query, callback);
        }
      }) as MediaQueryList['addEventListener'];
      mql.removeEventListener = vi.fn((event: string) => {
        if (event === 'change') {
          listeners.delete(query);
        }
      }) as MediaQueryList['removeEventListener'];
      return mql;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    listeners.clear();
  });

  it('should return false by default when query does not match', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
  });

  it('should return true when query matches', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) =>
      createMockMediaQueryList(true, query)
    );

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('should update when media query changes', () => {
    let currentMatches = false;
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
      const mql: MediaQueryList = {
        get matches() {
          return currentMatches;
        },
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event: string, callback: EventListener) => {
          if (event === 'change') {
            listeners.set(query, callback);
          }
        }) as MediaQueryList['addEventListener'],
        removeEventListener: vi.fn() as MediaQueryList['removeEventListener'],
        dispatchEvent: vi.fn(() => false),
      };
      return mql;
    });

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);

    // Simulate a media query change
    act(() => {
      currentMatches = true;
      const listener = listeners.get('(min-width: 768px)');
      if (listener) {
        listener({ matches: true } as unknown as Event);
      }
    });

    expect(result.current).toBe(true);
  });

  it('should cleanup listener on unmount', () => {
    const removeEventListener =
      vi.fn() as MediaQueryList['removeEventListener'];
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      ...createMockMediaQueryList(false, query),
      removeEventListener,
    }));

    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    unmount();

    expect(removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    );
  });

  it('should handle different media queries', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) =>
      createMockMediaQueryList(query === '(prefers-color-scheme: dark)', query)
    );

    const { result: widthResult } = renderHook(() =>
      useMediaQuery('(min-width: 768px)')
    );
    const { result: colorSchemeResult } = renderHook(() =>
      useMediaQuery('(prefers-color-scheme: dark)')
    );

    expect(widthResult.current).toBe(false);
    expect(colorSchemeResult.current).toBe(true);
  });

  it('should update when query prop changes', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) =>
      createMockMediaQueryList(query.includes('1024'), query)
    );

    const { result, rerender } = renderHook(
      ({ query }) => useMediaQuery(query),
      {
        initialProps: { query: '(min-width: 768px)' },
      }
    );

    expect(result.current).toBe(false);

    rerender({ query: '(min-width: 1024px)' });
    expect(result.current).toBe(true);
  });
});
