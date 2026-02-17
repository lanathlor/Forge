'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';

interface PerformanceProfilerProps {
  id: string;
  children: ReactNode;
  enabled?: boolean;
}

/**
 * Simple performance profiler component that can measure render times
 * In development, it logs performance metrics to console
 */
export function PerformanceProfiler({
  id,
  children,
  enabled = process.env.NODE_ENV === 'development',
}: PerformanceProfilerProps) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const startTime = performance.now();
    const markName = `${id}-start`;

    performance.mark(markName);

    return () => {
      try {
        const endTime = performance.now();
        const duration = endTime - startTime;

        if (duration > 100) {
          // Only log if render took more than 100ms
          console.log(`[PerformanceProfiler] ${id}: ${duration.toFixed(2)}ms`);
        }
      } catch (_error) {
        // Ignore errors - performance measurement is optional
      }
    };
  }, [id, enabled]);

  // In production or when disabled, just render children without any overhead
  return <>{children}</>;
}
