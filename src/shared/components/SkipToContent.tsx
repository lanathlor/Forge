'use client';

import { cn } from '@/shared/lib/utils';

interface SkipToContentProps {
  /** ID of the main content element to skip to */
  contentId?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Skip-to-content link for keyboard navigation accessibility
 *
 * This link is visually hidden until focused via keyboard (Tab key),
 * allowing keyboard users to skip repetitive navigation and go directly
 * to the main content.
 *
 * @example
 * ```tsx
 * <SkipToContent contentId="main-content" />
 * <nav>...</nav>
 * <main id="main-content">...</main>
 * ```
 */
export function SkipToContent({
  contentId = 'main-content',
  className,
}: SkipToContentProps) {
  return (
    <a
      href={`#${contentId}`}
      className={cn(
        'skip-to-content',
        'sr-only focus:not-sr-only',
        'fixed top-4 left-4 z-[9999]',
        'px-4 py-2 rounded-md',
        'bg-primary text-primary-foreground',
        'font-medium text-sm',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'transition-all duration-200',
        className
      )}
    >
      Skip to main content
    </a>
  );
}
