import { useEffect, useCallback, useRef } from 'react';

/**
 * Keyboard shortcut configuration
 */
export interface KeyboardShortcut {
  /** Unique identifier for the shortcut */
  id: string;
  /** Human-readable description */
  description: string;
  /** Key combination (e.g., 'Ctrl+K', 'Escape', 'ArrowDown') */
  key: string;
  /** Modifier keys */
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Callback when shortcut is triggered */
  handler: (event: KeyboardEvent) => void;
  /** Whether to prevent default behavior */
  preventDefault?: boolean;
  /** Only trigger when these elements are NOT focused */
  excludeInputs?: boolean;
  /** Category for grouping in cheatsheet */
  category?: string;
}

/**
 * Hook for managing keyboard shortcuts
 *
 * @example
 * ```tsx
 * const { registerShortcut } = useKeyboardShortcuts();
 *
 * registerShortcut({
 *   id: 'save',
 *   description: 'Save changes',
 *   key: 's',
 *   ctrl: true,
 *   handler: () => handleSave(),
 * });
 * ```
 */
// eslint-disable-next-line max-lines-per-function
export function useKeyboardShortcuts() {
  const shortcutsRef = useRef<Map<string, KeyboardShortcut>>(new Map());

  const registerShortcut = useCallback((shortcut: KeyboardShortcut) => {
    shortcutsRef.current.set(shortcut.id, shortcut);
  }, []);

  const unregisterShortcut = useCallback((id: string) => {
    shortcutsRef.current.delete(id);
  }, []);

  const getShortcuts = useCallback(() => {
    return Array.from(shortcutsRef.current.values());
  }, []);

  // eslint-disable-next-line complexity
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const tagName = target.tagName;
    const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable;

    for (const shortcut of shortcutsRef.current.values()) {
      if (isInput && shortcut.excludeInputs) continue;

      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      if (!keyMatch) continue;

      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      const ctrlMetaMatch = (shortcut.ctrl || shortcut.meta) ? ctrlOrMeta : !ctrlOrMeta;

      if (ctrlMetaMatch && shiftMatch && altMatch) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.handler(event);
        break;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    registerShortcut,
    unregisterShortcut,
    getShortcuts,
  };
}

/**
 * Hook for a single keyboard shortcut
 * Automatically registers and unregisters on mount/unmount
 */
export function useKeyboardShortcut(shortcut: KeyboardShortcut) {
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();

  useEffect(() => {
    registerShortcut(shortcut);
    return () => unregisterShortcut(shortcut.id);
  }, [shortcut.id, registerShortcut, unregisterShortcut]);
}

/**
 * Format key name for display
 */
function formatKeyName(key: string): string {
  const keyMap: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Escape: 'Esc',
    Enter: '↵',
  };
  return keyMap[key] || key.toUpperCase();
}

/**
 * Format a shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrl || shortcut.meta) parts.push('⌘');
  if (shortcut.shift) parts.push('⇧');
  if (shortcut.alt) parts.push('⌥');
  parts.push(formatKeyName(shortcut.key));

  return parts.join(' + ');
}
