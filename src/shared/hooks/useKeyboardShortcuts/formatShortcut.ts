import type { KeyboardShortcut } from '../useKeyboardShortcuts';

/**
 * Format a key name for display
 */
function formatKeyName(key: string): string {
  if (key === 'ArrowUp') return '↑';
  if (key === 'ArrowDown') return '↓';
  if (key === 'ArrowLeft') return '←';
  if (key === 'ArrowRight') return '→';
  if (key === 'Escape') return 'Esc';
  if (key === 'Enter') return '↵';
  return key.toUpperCase();
}

/**
 * Format a shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrl || shortcut.meta) {
    parts.push('⌘');
  }
  if (shortcut.shift) {
    parts.push('⇧');
  }
  if (shortcut.alt) {
    parts.push('⌥');
  }

  parts.push(formatKeyName(shortcut.key));

  return parts.join(' + ');
}
