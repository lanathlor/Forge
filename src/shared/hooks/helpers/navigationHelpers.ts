/**
 * Helper functions for keyboard navigation
 */

interface NavigationKeys {
  nextKey: string;
  prevKey: string;
}

export function getNavigationKeys(
  orientation: 'vertical' | 'horizontal'
): NavigationKeys {
  const isVertical = orientation === 'vertical';
  return {
    nextKey: isVertical ? 'ArrowDown' : 'ArrowRight',
    prevKey: isVertical ? 'ArrowUp' : 'ArrowLeft',
  };
}

export function getNextIndex(
  currentIndex: number,
  itemCount: number,
  loop: boolean
): number {
  if (currentIndex < itemCount - 1) {
    return currentIndex + 1;
  }
  return loop ? 0 : currentIndex;
}

export function getPrevIndex(
  currentIndex: number,
  itemCount: number,
  loop: boolean
): number {
  if (currentIndex > 0) {
    return currentIndex - 1;
  }
  return loop ? itemCount - 1 : currentIndex;
}
