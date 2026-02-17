/**
 * Helper functions for arrow key navigation
 */

export interface NavigationMove {
  nextKey: string;
  prevKey: string;
}

/**
 * Get navigation keys based on orientation
 */
export function getNavigationKeys(
  orientation: 'vertical' | 'horizontal'
): NavigationMove {
  const isVertical = orientation === 'vertical';
  return {
    nextKey: isVertical ? 'ArrowDown' : 'ArrowRight',
    prevKey: isVertical ? 'ArrowUp' : 'ArrowLeft',
  };
}

/**
 * Handle next navigation (down/right)
 */
export function handleNext(
  focusedIndex: number,
  itemCount: number,
  loop: boolean,
  onFocusChange: (index: number) => void
): void {
  if (focusedIndex < itemCount - 1) {
    onFocusChange(focusedIndex + 1);
  } else if (loop) {
    onFocusChange(0);
  }
}

/**
 * Handle previous navigation (up/left)
 */
export function handlePrev(
  focusedIndex: number,
  itemCount: number,
  loop: boolean,
  onFocusChange: (index: number) => void
): void {
  if (focusedIndex > 0) {
    onFocusChange(focusedIndex - 1);
  } else if (loop) {
    onFocusChange(itemCount - 1);
  }
}

/**
 * Handle Enter key to select item
 */
export function handleSelect(
  focusedIndex: number,
  itemCount: number,
  onSelect?: (index: number) => void
): void {
  if (onSelect && focusedIndex >= 0 && focusedIndex < itemCount) {
    onSelect(focusedIndex);
  }
}

/**
 * Handle next navigation (down/right) - alias for compatibility
 */
export function handleNextNavigation(
  focusedIndex: number,
  itemCount: number,
  loop: boolean,
  onFocusChange: (index: number) => void
): void {
  handleNext(focusedIndex, itemCount, loop, onFocusChange);
}

/**
 * Handle previous navigation (up/left) - alias for compatibility
 */
export function handlePrevNavigation(
  focusedIndex: number,
  itemCount: number,
  loop: boolean,
  onFocusChange: (index: number) => void
): void {
  handlePrev(focusedIndex, itemCount, loop, onFocusChange);
}

/**
 * Handle grid down navigation
 */
export function handleGridDownNavigation(
  row: number,
  col: number,
  rows: number,
  loop: boolean,
  onFocusChange: (position: [number, number]) => void
): void {
  if (row < rows - 1) {
    onFocusChange([row + 1, col]);
  } else if (loop) {
    onFocusChange([0, col]);
  }
}

/**
 * Handle grid up navigation
 */
export function handleGridUpNavigation(
  row: number,
  col: number,
  rows: number,
  loop: boolean,
  onFocusChange: (position: [number, number]) => void
): void {
  if (row > 0) {
    onFocusChange([row - 1, col]);
  } else if (loop) {
    onFocusChange([rows - 1, col]);
  }
}

/**
 * Handle grid right navigation
 */
export function handleGridRightNavigation(
  row: number,
  col: number,
  columns: number,
  loop: boolean,
  onFocusChange: (position: [number, number]) => void
): void {
  if (col < columns - 1) {
    onFocusChange([row, col + 1]);
  } else if (loop) {
    onFocusChange([row, 0]);
  }
}

/**
 * Handle grid left navigation
 */
export function handleGridLeftNavigation(
  row: number,
  col: number,
  columns: number,
  loop: boolean,
  onFocusChange: (position: [number, number]) => void
): void {
  if (col > 0) {
    onFocusChange([row, col - 1]);
  } else if (loop) {
    onFocusChange([row, columns - 1]);
  }
}
