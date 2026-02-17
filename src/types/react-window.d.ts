// Type declarations for react-window
declare module 'react-window' {
  import * as React from 'react';

  export interface ListChildComponentProps<T = unknown> {
    data: T;
    index: number;
    isScrolling?: boolean;
    style: React.CSSProperties;
  }

  export interface ListOnScrollProps {
    scrollDirection: 'forward' | 'backward';
    scrollOffset: number;
    scrollUpdateWasRequested: boolean;
  }

  export interface ListOnItemsRenderedProps {
    overscanStartIndex: number;
    overscanStopIndex: number;
    visibleStartIndex: number;
    visibleStopIndex: number;
  }

  export interface FixedSizeListProps<T = unknown> {
    children: React.ComponentType<ListChildComponentProps<T>>;
    className?: string;
    direction?: 'ltr' | 'rtl';
    height: number | string;
    initialScrollOffset?: number;
    innerElementType?: React.ElementType;
    innerRef?: React.Ref<HTMLDivElement>;
    itemCount: number;
    itemData?: T;
    itemKey?: (index: number, data: T) => string | number;
    itemSize: number;
    layout?: 'horizontal' | 'vertical';
    onItemsRendered?: (props: ListOnItemsRenderedProps) => void;
    onScroll?: (props: ListOnScrollProps) => void;
    outerElementType?: React.ElementType;
    outerRef?: React.Ref<HTMLDivElement>;
    overscanCount?: number;
    style?: React.CSSProperties;
    useIsScrolling?: boolean;
    width: number | string;
  }

  export class FixedSizeList<T = unknown> extends React.Component<
    FixedSizeListProps<T>
  > {
    scrollTo(scrollOffset: number): void;
    scrollToItem(
      index: number,
      align?: 'auto' | 'smart' | 'center' | 'end' | 'start'
    ): void;
  }

  export interface VariableSizeListProps<T = unknown> {
    children: React.ComponentType<ListChildComponentProps<T>>;
    className?: string;
    direction?: 'ltr' | 'rtl';
    estimatedItemSize?: number;
    height: number | string;
    initialScrollOffset?: number;
    innerElementType?: React.ElementType;
    innerRef?: React.Ref<HTMLDivElement>;
    itemCount: number;
    itemData?: T;
    itemKey?: (index: number, data: T) => string | number;
    itemSize: (index: number) => number;
    layout?: 'horizontal' | 'vertical';
    onItemsRendered?: (props: ListOnItemsRenderedProps) => void;
    onScroll?: (props: ListOnScrollProps) => void;
    outerElementType?: React.ElementType;
    outerRef?: React.Ref<HTMLDivElement>;
    overscanCount?: number;
    style?: React.CSSProperties;
    useIsScrolling?: boolean;
    width: number | string;
  }

  export class VariableSizeList<T = unknown> extends React.Component<
    VariableSizeListProps<T>
  > {
    resetAfterIndex(index: number, shouldForceUpdate?: boolean): void;
    scrollTo(scrollOffset: number): void;
    scrollToItem(
      index: number,
      align?: 'auto' | 'smart' | 'center' | 'end' | 'start'
    ): void;
  }

  export interface GridChildComponentProps<T = unknown> {
    columnIndex: number;
    data: T;
    isScrolling?: boolean;
    rowIndex: number;
    style: React.CSSProperties;
  }

  export interface GridOnScrollProps {
    horizontalScrollDirection: 'forward' | 'backward';
    scrollLeft: number;
    scrollTop: number;
    scrollUpdateWasRequested: boolean;
    verticalScrollDirection: 'forward' | 'backward';
  }

  export interface GridOnItemsRenderedProps {
    overscanColumnStartIndex: number;
    overscanColumnStopIndex: number;
    overscanRowStartIndex: number;
    overscanRowStopIndex: number;
    visibleColumnStartIndex: number;
    visibleColumnStopIndex: number;
    visibleRowStartIndex: number;
    visibleRowStopIndex: number;
  }

  export interface FixedSizeGridProps<T = unknown> {
    children: React.ComponentType<GridChildComponentProps<T>>;
    className?: string;
    columnCount: number;
    columnWidth: number;
    direction?: 'ltr' | 'rtl';
    height: number;
    initialScrollLeft?: number;
    initialScrollTop?: number;
    innerElementType?: React.ElementType;
    innerRef?: React.Ref<HTMLDivElement>;
    itemData?: T;
    itemKey?: (params: {
      columnIndex: number;
      data: T;
      rowIndex: number;
    }) => string | number;
    onItemsRendered?: (props: GridOnItemsRenderedProps) => void;
    onScroll?: (props: GridOnScrollProps) => void;
    outerElementType?: React.ElementType;
    outerRef?: React.Ref<HTMLDivElement>;
    overscanColumnCount?: number;
    overscanRowCount?: number;
    rowCount: number;
    rowHeight: number;
    style?: React.CSSProperties;
    useIsScrolling?: boolean;
    width: number;
  }

  export class FixedSizeGrid<T = unknown> extends React.Component<
    FixedSizeGridProps<T>
  > {
    scrollTo(params: { scrollLeft?: number; scrollTop?: number }): void;
    scrollToItem(params: {
      align?: 'auto' | 'smart' | 'center' | 'end' | 'start';
      columnIndex?: number;
      rowIndex?: number;
    }): void;
  }

  export interface VariableSizeGridProps<T = unknown> {
    children: React.ComponentType<GridChildComponentProps<T>>;
    className?: string;
    columnCount: number;
    columnWidth: (index: number) => number;
    direction?: 'ltr' | 'rtl';
    estimatedColumnWidth?: number;
    estimatedRowHeight?: number;
    height: number;
    initialScrollLeft?: number;
    initialScrollTop?: number;
    innerElementType?: React.ElementType;
    innerRef?: React.Ref<HTMLDivElement>;
    itemData?: T;
    itemKey?: (params: {
      columnIndex: number;
      data: T;
      rowIndex: number;
    }) => string | number;
    onItemsRendered?: (props: GridOnItemsRenderedProps) => void;
    onScroll?: (props: GridOnScrollProps) => void;
    outerElementType?: React.ElementType;
    outerRef?: React.Ref<HTMLDivElement>;
    overscanColumnCount?: number;
    overscanRowCount?: number;
    rowCount: number;
    rowHeight: (index: number) => number;
    style?: React.CSSProperties;
    useIsScrolling?: boolean;
    width: number;
  }

  export class VariableSizeGrid<T = unknown> extends React.Component<
    VariableSizeGridProps<T>
  > {
    resetAfterColumnIndex(index: number, shouldForceUpdate?: boolean): void;
    resetAfterIndices(params: {
      columnIndex?: number;
      rowIndex?: number;
      shouldForceUpdate?: boolean;
    }): void;
    resetAfterRowIndex(index: number, shouldForceUpdate?: boolean): void;
    scrollTo(params: { scrollLeft?: number; scrollTop?: number }): void;
    scrollToItem(params: {
      align?: 'auto' | 'smart' | 'center' | 'end' | 'start';
      columnIndex?: number;
      rowIndex?: number;
    }): void;
  }

  export function areEqual(
    prevProps: Readonly<ListChildComponentProps | GridChildComponentProps>,
    nextProps: Readonly<ListChildComponentProps | GridChildComponentProps>
  ): boolean;

  export function shouldComponentUpdate(
    this: {
      props: Readonly<ListChildComponentProps | GridChildComponentProps>;
    },
    nextProps: Readonly<ListChildComponentProps | GridChildComponentProps>,
    nextState: unknown
  ): boolean;
}
