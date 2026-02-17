/**
 * Helper functions for focus trap
 */

export function getFocusableSelectors(): string[] {
  return [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];
}

export function queryFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(
    getFocusableSelectors().join(',')
  );

  return Array.from(elements).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
  );
}

export function focusInitialElement(
  container: HTMLElement,
  initialFocusElement?: HTMLElement | null
): void {
  if (initialFocusElement) {
    initialFocusElement.focus();
  } else {
    const focusableElements = queryFocusableElements(container);
    if (focusableElements.length > 0) {
      focusableElements[0]?.focus();
    }
  }
}

export function handleTabKey(
  event: KeyboardEvent,
  container: HTMLElement,
  focusableElements: HTMLElement[]
): void {
  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement as HTMLElement;

  if (event.shiftKey) {
    // Shift + Tab (backwards)
    if (activeElement === firstElement || !container.contains(activeElement)) {
      event.preventDefault();
      lastElement?.focus();
    }
  } else {
    // Tab (forwards)
    if (activeElement === lastElement || !container.contains(activeElement)) {
      event.preventDefault();
      firstElement?.focus();
    }
  }
}
