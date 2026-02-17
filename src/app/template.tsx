'use client';

import type { ReactNode } from 'react';

interface TemplateProps {
  children: ReactNode;
}

/**
 * Route transition template using CSS animations
 * Automatically wraps all pages for smooth transitions
 */
export default function Template({ children }: TemplateProps) {
  return (
    <div className="h-full animate-slide-up-fade">
      {children}
    </div>
  );
}
