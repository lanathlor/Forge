/**
 * Helper functions for grid navigation
 */

type Position = [number, number];

export function moveDown(
  [row, col]: Position,
  rows: number,
  loop: boolean
): Position {
  if (row < rows - 1) {
    return [row + 1, col];
  }
  return loop ? [0, col] : [row, col];
}

export function moveUp(
  [row, col]: Position,
  rows: number,
  loop: boolean
): Position {
  if (row > 0) {
    return [row - 1, col];
  }
  return loop ? [rows - 1, col] : [row, col];
}

export function moveRight(
  [row, col]: Position,
  columns: number,
  loop: boolean
): Position {
  if (col < columns - 1) {
    return [row, col + 1];
  }
  return loop ? [row, 0] : [row, col];
}

export function moveLeft(
  [row, col]: Position,
  columns: number,
  loop: boolean
): Position {
  if (col > 0) {
    return [row, col - 1];
  }
  return loop ? [row, columns - 1] : [row, col];
}

export function moveToRowStart([row]: Position): Position {
  return [row, 0];
}

export function moveToRowEnd([row]: Position, columns: number): Position {
  return [row, columns - 1];
}
