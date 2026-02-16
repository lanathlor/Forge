import { useEffect, useCallback, type RefObject } from 'react';
import {
  handleNextNavigation,
  handlePrevNavigation,
  handleGridDownNavigation,
  handleGridUpNavigation,
  handleGridRightNavigation,
  handleGridLeftNavigation,
} from './useArrowKeyNavigation.helpers';

export interface UseArrowKeyNavigationOptions {
  /** Current focused index */
  focusedIndex: number;
  /** Callback when focused index changes */
  onFocusChange: (index: number) => void;
  /** Callback when Enter is pressed on an item */
  onSelect?: (index: number) => void;
  /** Total number of items */
  itemCount: number;
  /** Whether to loop around when reaching the end */
  loop?: boolean;
  /** Whether navigation is enabled */
  enabled?: boolean;
  /** Container ref to scope the navigation */
  containerRef?: RefObject<HTMLElement>;
  /** Selector for items within the container */
  itemSelector?: string;
  /** Orientation of the list */
  orientation?: 'vertical' | 'horizontal';
}

/**
 * Hook for arrow key navigation in lists
 */
// eslint-disable-next-line max-lines-per-function
export function useArrowKeyNavigation({
  focusedIndex,
  onFocusChange,
  onSelect,
  itemCount,
  loop = true,
  enabled = true,
  containerRef,
  itemSelector = '[data-list-item]',
  orientation = 'vertical',
}: UseArrowKeyNavigationOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => { // eslint-disable-line complexity -- Navigation logic requires checking multiple keys
      if (!enabled || itemCount === 0) return;

      const isVertical = orientation === 'vertical';
      const nextKey = isVertical ? 'ArrowDown' : 'ArrowRight';
      const prevKey = isVertical ? 'ArrowUp' : 'ArrowLeft';

      if (event.key === nextKey) {
        event.preventDefault();
        handleNextNavigation(focusedIndex, itemCount, loop, onFocusChange);
      } else if (event.key === prevKey) {
        event.preventDefault();
        handlePrevNavigation(focusedIndex, itemCount, loop, onFocusChange);
      } else if (event.key === 'Home') {
        event.preventDefault();
        onFocusChange(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        onFocusChange(itemCount - 1);
      } else if (event.key === 'Enter' && onSelect && focusedIndex >= 0 && focusedIndex < itemCount) {
        event.preventDefault();
        onSelect(focusedIndex);
      }
    },
    [enabled, itemCount, focusedIndex, onFocusChange, onSelect, loop, orientation]
  );

  useEffect(() => {
    const container = containerRef?.current || document;
    container.addEventListener('keydown', handleKeyDown as EventListener);
    return () => container.removeEventListener('keydown', handleKeyDown as EventListener);
  }, [handleKeyDown, containerRef]);

  // Auto-scroll focused item into view
  useEffect(() => {
    if (!containerRef?.current || focusedIndex < 0) return;

    const items = containerRef.current.querySelectorAll(itemSelector);
    const focusedItem = items[focusedIndex] as HTMLElement;

    if (focusedItem) {
      focusedItem.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [focusedIndex, containerRef, itemSelector]);
}

/**
 * Hook for managing grid-based keyboard navigation (2D arrow key navigation)
 */
export interface UseGridNavigationOptions {
  /** Current focused position [row, col] */
  focusedPosition: [number, number];
  /** Callback when focused position changes */
  onFocusChange: (position: [number, number]) => void;
  /** Callback when Enter is pressed */
  onSelect?: (position: [number, number]) => void;
  /** Number of rows */
  rows: number;
  /** Number of columns */
  columns: number;
  /** Whether to loop around when reaching edges */
  loop?: boolean;
  /** Whether navigation is enabled */
  enabled?: boolean;
}

export function useGridNavigation({
  focusedPosition,
  onFocusChange,
  onSelect,
  rows,
  columns,
  loop = false,
  enabled = true,
}: UseGridNavigationOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => { // eslint-disable-line complexity -- Grid navigation logic requires checking multiple keys
      if (!enabled || rows === 0 || columns === 0) return;

      const [row, col] = focusedPosition;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        handleGridDownNavigation(row, col, rows, loop, onFocusChange);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        handleGridUpNavigation(row, col, rows, loop, onFocusChange);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleGridRightNavigation(row, col, columns, loop, onFocusChange);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handleGridLeftNavigation(row, col, columns, loop, onFocusChange);
      } else if (event.key === 'Home') {
        event.preventDefault();
        onFocusChange([row, 0]);
      } else if (event.key === 'End') {
        event.preventDefault();
        onFocusChange([row, columns - 1]);
      } else if (event.key === 'Enter' && onSelect) {
        event.preventDefault();
        onSelect(focusedPosition);
      }
    },
    [enabled, rows, columns, focusedPosition, onFocusChange, onSelect, loop]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
