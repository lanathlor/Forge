import { useEffect, useRef, useCallback } from 'react';
import {
  focusInitialElement,
  handleTabKey,
} from './useFocusTrap.helpers';

/**
 * Hook to trap focus within a container (useful for modals, dialogs, dropdowns)
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  isActive: boolean,
  options: {
    /** Whether to focus the first element when trap activates */
    initialFocus?: boolean;
    /** Whether to restore focus to the previously focused element when trap deactivates */
    restoreFocus?: boolean;
    /** Element to focus when trap activates (overrides initialFocus) */
    initialFocusElement?: HTMLElement | null;
  } = {}
) {
  const containerRef = useRef<T>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const { initialFocus = true, restoreFocus = true, initialFocusElement } = options;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    handleTabKey(event, containerRef.current);
  }, []);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Save the currently focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus the initial element
    focusInitialElement(containerRef.current, initialFocusElement, initialFocus);

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus to the previously active element
      if (restoreFocus && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isActive, initialFocus, restoreFocus, initialFocusElement, handleKeyDown]);

  return containerRef;
}

/**
 * Hook to manage focus restoration when a component unmounts
 */
export function useFocusRestore() {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;

    return () => {
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, []);
}
