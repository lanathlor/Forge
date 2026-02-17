/**
 * Helper functions for keyboard shortcuts
 */

import type { KeyboardShortcut } from './useKeyboardShortcuts';

/**
 * Check if the current target is an input element
 */
export function isInputElement(target: HTMLElement): boolean {
  const tagName = target.tagName;
  return (
    tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable
  );
}

/**
 * Check if modifiers match the shortcut requirements
 */
export function checkModifiers(
  event: KeyboardEvent,
  shortcut: KeyboardShortcut
): boolean {
  const ctrlOrMeta = event.ctrlKey || event.metaKey;
  const hasCtrlMeta = shortcut.ctrl || shortcut.meta;

  const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
  const altMatch = shortcut.alt ? event.altKey : !event.altKey;

  if (hasCtrlMeta) {
    return ctrlOrMeta && shiftMatch && altMatch;
  }

  return !ctrlOrMeta && shiftMatch && altMatch;
}

/**
 * Try to execute a shortcut if it matches the event
 */
export function tryExecuteShortcut(
  event: KeyboardEvent,
  shortcut: KeyboardShortcut
): boolean {
  const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
  if (!keyMatch) return false;

  const modifierMatch = checkModifiers(event, shortcut);
  if (!modifierMatch) return false;

  if (shortcut.preventDefault !== false) {
    event.preventDefault();
  }
  shortcut.handler(event);
  return true;
}
