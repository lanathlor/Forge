import type { KeyboardShortcut } from '../useKeyboardShortcuts';

function checkModifiers(
  event: KeyboardEvent,
  shortcut: KeyboardShortcut
): boolean {
  const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
  const altMatch = shortcut.alt ? event.altKey : !event.altKey;
  const ctrlOrMeta = event.ctrlKey || event.metaKey;

  const ctrlMetaMatch =
    shortcut.ctrl || shortcut.meta ? ctrlOrMeta : !ctrlOrMeta;

  return ctrlMetaMatch && shiftMatch && altMatch;
}

/**
 * Check if keyboard event matches a shortcut
 */
export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: KeyboardShortcut
): boolean {
  const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
  if (!keyMatch) return false;
  return checkModifiers(event, shortcut);
}

/**
 * Check if target element should be excluded from shortcuts
 */
export function shouldExcludeTarget(
  target: HTMLElement,
  excludeInputs: boolean
): boolean {
  if (!excludeInputs) return false;

  const tagName = target.tagName;
  return (
    tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable
  );
}
