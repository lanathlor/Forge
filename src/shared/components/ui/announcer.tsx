'use client';

import { useEffect, useRef } from 'react';

/**
 * LiveAnnouncer - Component for screen reader announcements
 *
 * This component creates an aria-live region that announces content
 * changes to screen reader users without disrupting their flow.
 */

export interface LiveAnnouncerProps {
  /** The message to announce */
  message?: string;
  /** The politeness level of the announcement */
  politeness?: 'polite' | 'assertive' | 'off';
  /** Whether to clear the message after announcing */
  clearAfter?: number;
  /** Additional class names */
  className?: string;
}

export function LiveAnnouncer({
  message,
  politeness = 'polite',
  clearAfter,
  className,
}: LiveAnnouncerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (clearAfter && message && ref.current) {
      const timer = setTimeout(() => {
        if (ref.current) {
          ref.current.textContent = '';
        }
      }, clearAfter);
      return () => clearTimeout(timer);
    }
  }, [message, clearAfter]);

  return (
    <div
      ref={ref}
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className={className || 'sr-only'}
    >
      {message}
    </div>
  );
}

/**
 * Hook to programmatically announce messages to screen readers
 */
export function useAnnouncer() {
  const announcerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create announcer element if it doesn't exist
    if (!announcerRef.current) {
      const announcer = document.createElement('div');
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.className = 'sr-only';
      document.body.appendChild(announcer);
      announcerRef.current = announcer;
    }

    return () => {
      if (announcerRef.current) {
        document.body.removeChild(announcerRef.current);
        announcerRef.current = null;
      }
    };
  }, []);

  const announce = (
    message: string,
    politeness: 'polite' | 'assertive' = 'polite'
  ) => {
    if (announcerRef.current) {
      announcerRef.current.setAttribute('aria-live', politeness);
      announcerRef.current.textContent = message;
      // Clear after announcement
      setTimeout(() => {
        if (announcerRef.current) {
          announcerRef.current.textContent = '';
        }
      }, 1000);
    }
  };

  return { announce };
}

/**
 * AlertAnnouncer - Component for announcing critical alerts
 * Uses assertive aria-live to interrupt screen readers
 */
export interface AlertAnnouncerProps {
  /** The alert message to announce */
  message?: string;
  /** Additional class names */
  className?: string;
}

export function AlertAnnouncer({ message, className }: AlertAnnouncerProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={className || 'sr-only'}
    >
      {message}
    </div>
  );
}
