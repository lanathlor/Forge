import { useEffect, useRef, useCallback } from 'react';
import { focusInitialElement, handleTabKey } from './useFocusTrap.helpers';

interface FocusTrapOptions {
  /** Whether to focus the first element when trap activates */
  initialFocus?: boolean;
  /** Whether to restore focus to the previously focused element when trap deactivates */
  restoreFocus?: boolean;
  /** Element to focus when trap activates (overrides initialFocus) */
  initialFocusElement?: HTMLElement | null;
}

function useFocusTrapEffect(
  isActive: boolean,
  container: HTMLElement | null,
  previousEl: React.MutableRefObject<HTMLElement | null>,
  options: Required<FocusTrapOptions>,
  handleKeyDown: (e: KeyboardEvent) => void
) {
  const { initialFocus, restoreFocus, initialFocusElement } = options;
  useEffect(() => {
    if (!isActive || !container) return;
    previousEl.current = document.activeElement as HTMLElement;
    focusInitialElement(container, initialFocusElement, initialFocus);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (restoreFocus && previousEl.current) previousEl.current.focus();
    };
  }, [isActive, initialFocus, restoreFocus, initialFocusElement, handleKeyDown, container, previousEl]);
}

/**
 * Hook to trap focus within a container (useful for modals, dialogs, dropdowns)
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  isActive: boolean,
  options: FocusTrapOptions = {}
) {
  const containerRef = useRef<T>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const { initialFocus = true, restoreFocus = true, initialFocusElement } = options;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    handleTabKey(event, containerRef.current);
  }, []);

  useFocusTrapEffect(
    isActive, containerRef.current, previousActiveElement,
    { initialFocus, restoreFocus, initialFocusElement: initialFocusElement ?? null },
    handleKeyDown
  );

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
