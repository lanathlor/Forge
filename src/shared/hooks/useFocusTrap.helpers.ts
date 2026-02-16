/**
 * Helper functions for focus trap
 */

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
 * Focus the initial element in the container
 */
export function focusInitialElement(
  container: HTMLElement,
  initialFocusElement: HTMLElement | null | undefined,
  initialFocus: boolean
): void {
  if (initialFocusElement) {
    initialFocusElement.focus();
  } else if (initialFocus) {
    const focusableElements = getFocusableElements(container);
    if (focusableElements.length > 0) {
      focusableElements[0]?.focus();
    }
  }
}

/**
 * Check if focus should wrap to last element
 */
function shouldWrapToLast(
  activeElement: HTMLElement,
  firstElement: HTMLElement | undefined,
  container: HTMLElement
): boolean {
  return activeElement === firstElement || !container.contains(activeElement);
}

/**
 * Check if focus should wrap to first element
 */
function shouldWrapToFirst(
  activeElement: HTMLElement,
  lastElement: HTMLElement | undefined,
  container: HTMLElement
): boolean {
  return activeElement === lastElement || !container.contains(activeElement);
}

/**
 * Handle Tab key for focus trap
 */
export function handleTabKey(
  event: KeyboardEvent,
  container: HTMLElement | null
): void {
  if (event.key !== 'Tab' || !container) return;

  const focusableElements = getFocusableElements(container);
  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement as HTMLElement;

  // Shift + Tab (backwards)
  if (event.shiftKey && shouldWrapToLast(activeElement, firstElement, container)) {
    event.preventDefault();
    lastElement?.focus();
  }
  // Tab (forwards)
  else if (!event.shiftKey && shouldWrapToFirst(activeElement, lastElement, container)) {
    event.preventDefault();
    firstElement?.focus();
  }
}
