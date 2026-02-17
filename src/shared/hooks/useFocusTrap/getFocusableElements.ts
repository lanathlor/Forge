/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];

  const elements = container.querySelectorAll<HTMLElement>(
    focusableSelectors.join(',')
  );

  return Array.from(elements).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
  );
}

/**
 * Handle Tab key press for focus trap
 */
export function handleTabKey(
  event: KeyboardEvent,
  container: HTMLElement,
  getFocusable: () => HTMLElement[]
): void {
  if (event.key !== 'Tab') return;

  const focusableElements = getFocusable();
  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement as HTMLElement;

  // Shift + Tab (backwards)
  if (event.shiftKey) {
    if (activeElement === firstElement || !container.contains(activeElement)) {
      event.preventDefault();
      lastElement?.focus();
    }
  }
  // Tab (forwards)
  else {
    if (activeElement === lastElement || !container.contains(activeElement)) {
      event.preventDefault();
      firstElement?.focus();
    }
  }
}
