'use client';

import { useState } from 'react';
import { Keyboard } from 'lucide-react';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { useKeyboardShortcuts } from '@/shared/hooks';
import { cn } from '@/shared/lib/utils';

interface KeyboardShortcutsFABProps {
  /** Position of the FAB */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Additional class names */
  className?: string;
}

/**
 * Floating Action Button to open keyboard shortcuts modal
 *
 * Shows a floating button in the corner of the screen that opens
 * the keyboard shortcuts cheatsheet when clicked.
 */
export function KeyboardShortcutsFAB({
  position = 'bottom-right',
  className,
}: KeyboardShortcutsFABProps) {
  const [showModal, setShowModal] = useState(false);
  const { getShortcuts } = useKeyboardShortcuts();

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={cn(
          'fixed z-50',
          'group',
          'flex items-center gap-2',
          'px-4 py-3 rounded-full',
          'bg-primary text-primary-foreground',
          'shadow-lg hover:shadow-xl',
          'transition-all duration-200',
          'hover:scale-105 active:scale-95',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          positionClasses[position],
          className
        )}
        aria-label="Show keyboard shortcuts"
        title="Keyboard shortcuts (Shift + ?)"
      >
        <Keyboard className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm font-medium hidden sm:inline group-hover:inline">
          Shortcuts
        </span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary-foreground/20 text-xs font-mono">
          ?
        </kbd>
      </button>

      <KeyboardShortcutsModal
        open={showModal}
        onOpenChange={setShowModal}
        shortcuts={getShortcuts()}
      />
    </>
  );
}
