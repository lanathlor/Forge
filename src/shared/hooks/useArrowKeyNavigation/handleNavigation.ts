/**
 * Handle arrow key navigation for list navigation
 */

type ListNavigationOptions = {
  enabled: boolean;
  itemCount: number;
  focusedIndex: number;
  onFocusChange: (index: number) => void;
  onSelect?: (index: number) => void;
  loop: boolean;
  orientation: 'vertical' | 'horizontal';
};

function getNextIndex(current: number, max: number, loop: boolean): number {
  if (current < max - 1) return current + 1;
  return loop ? 0 : current;
}

function getPrevIndex(current: number, max: number, loop: boolean): number {
  if (current > 0) return current - 1;
  return loop ? max - 1 : current;
}

function handleNavKey(key: string, options: ListNavigationOptions): boolean {
  const { itemCount, focusedIndex, onFocusChange, loop, orientation } = options;
  const isVertical = orientation === 'vertical';
  const nextKey = isVertical ? 'ArrowDown' : 'ArrowRight';
  const prevKey = isVertical ? 'ArrowUp' : 'ArrowLeft';

  if (key === nextKey) {
    onFocusChange(getNextIndex(focusedIndex, itemCount, loop));
    return true;
  }
  if (key === prevKey) {
    onFocusChange(getPrevIndex(focusedIndex, itemCount, loop));
    return true;
  }
  if (key === 'Home') {
    onFocusChange(0);
    return true;
  }
  if (key === 'End') {
    onFocusChange(itemCount - 1);
    return true;
  }
  return false;
}

export function handleListNavigation(event: KeyboardEvent, options: ListNavigationOptions) {
  const { enabled, itemCount, focusedIndex, onSelect } = options;

  if (!enabled || itemCount === 0) return;

  if (handleNavKey(event.key, options)) {
    event.preventDefault();
    return;
  }

  if (event.key === 'Enter' && onSelect && focusedIndex >= 0 && focusedIndex < itemCount) {
    event.preventDefault();
    onSelect(focusedIndex);
  }
}

/**
 * Handle arrow key navigation for grid navigation
 */

type GridNavigationOptions = {
  enabled: boolean;
  rows: number;
  columns: number;
  focusedPosition: [number, number];
  onFocusChange: (position: [number, number]) => void;
  onSelect?: (position: [number, number]) => void;
  loop: boolean;
};

// eslint-disable-next-line complexity
function handleGridNavKey(key: string, options: GridNavigationOptions): boolean {
  const { rows, columns, focusedPosition, onFocusChange, loop } = options;
  const [row, col] = focusedPosition;

  if (key === 'ArrowDown') {
    const newRow = row < rows - 1 ? row + 1 : loop ? 0 : row;
    onFocusChange([newRow, col]);
    return true;
  }
  if (key === 'ArrowUp') {
    const newRow = row > 0 ? row - 1 : loop ? rows - 1 : row;
    onFocusChange([newRow, col]);
    return true;
  }
  if (key === 'ArrowRight') {
    const newCol = col < columns - 1 ? col + 1 : loop ? 0 : col;
    onFocusChange([row, newCol]);
    return true;
  }
  if (key === 'ArrowLeft') {
    const newCol = col > 0 ? col - 1 : loop ? columns - 1 : col;
    onFocusChange([row, newCol]);
    return true;
  }
  if (key === 'Home') {
    onFocusChange([row, 0]);
    return true;
  }
  if (key === 'End') {
    onFocusChange([row, columns - 1]);
    return true;
  }
  return false;
}

export function handleGridNavigationKeys(event: KeyboardEvent, options: GridNavigationOptions) {
  const { enabled, rows, columns, focusedPosition, onSelect } = options;

  if (!enabled || rows === 0 || columns === 0) return;

  if (handleGridNavKey(event.key, options)) {
    event.preventDefault();
    return;
  }

  if (event.key === 'Enter' && onSelect) {
    event.preventDefault();
    onSelect(focusedPosition);
  }
}
