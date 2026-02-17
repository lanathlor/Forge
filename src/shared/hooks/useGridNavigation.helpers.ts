/**
 * Helper functions for grid navigation
 */

export type GridPosition = [number, number];

/**
 * Handle down arrow in grid
 */
export function handleGridDown(
  row: number,
  col: number,
  rows: number,
  loop: boolean,
  onFocusChange: (position: GridPosition) => void
): void {
  if (row < rows - 1) {
    onFocusChange([row + 1, col]);
  } else if (loop) {
    onFocusChange([0, col]);
  }
}

/**
 * Handle up arrow in grid
 */
export function handleGridUp(
  row: number,
  col: number,
  rows: number,
  loop: boolean,
  onFocusChange: (position: GridPosition) => void
): void {
  if (row > 0) {
    onFocusChange([row - 1, col]);
  } else if (loop) {
    onFocusChange([rows - 1, col]);
  }
}

/**
 * Handle right arrow in grid
 */
export function handleGridRight(
  row: number,
  col: number,
  columns: number,
  loop: boolean,
  onFocusChange: (position: GridPosition) => void
): void {
  if (col < columns - 1) {
    onFocusChange([row, col + 1]);
  } else if (loop) {
    onFocusChange([row, 0]);
  }
}

/**
 * Handle left arrow in grid
 */
export function handleGridLeft(
  row: number,
  col: number,
  columns: number,
  loop: boolean,
  onFocusChange: (position: GridPosition) => void
): void {
  if (col > 0) {
    onFocusChange([row, col - 1]);
  } else if (loop) {
    onFocusChange([row, columns - 1]);
  }
}
