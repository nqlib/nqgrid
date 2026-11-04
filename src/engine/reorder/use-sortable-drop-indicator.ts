import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

import {
  findSortableDropScrollRoot,
  getSortableDragGhostStyles,
  getSortableDropIndicatorStyle,
  resolveSortableDropTarget,
  sortableDropDndKitProps,
  type SortableDragGhostStyles,
  type SortableDropDragInput,
  type SortableDropOrientation,
  type SortableDropTarget,
} from "./sortable-drop-indicator";

const EMPTY_GHOSTS: SortableDragGhostStyles = { source: null, landing: null };

export type UseSortableDropIndicatorOptions = {
  orientation: SortableDropOrientation;
  containerRef: RefObject<HTMLElement | null>;
  /** Override scroll-root discovery (defaults to {@link findSortableDropScrollRoot}). */
  getScrollRoot?: (container: HTMLElement) => HTMLElement | null;
};

export type UseSortableDropIndicatorResult = {
  activeId: string | null;
  dropTarget: SortableDropTarget | null;
  indicatorStyle: CSSProperties | null;
  ghostStyles: SortableDragGhostStyles;
  isDragging: boolean;
  /** Spread onto `@nqlib/nqui/sortable` `Sortable`. */
  dndKitProps: ReturnType<typeof sortableDropDndKitProps>;
};

/** Track cursor-aligned drop targets and expose geometry for a single reorder axis. */
export function useSortableDropIndicator({
  orientation,
  containerRef,
  getScrollRoot = findSortableDropScrollRoot,
}: UseSortableDropIndicatorOptions): UseSortableDropIndicatorResult {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<SortableDropTarget | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties | null>(null);
  const [ghostStyles, setGhostStyles] = useState<SortableDragGhostStyles>(EMPTY_GHOSTS);
  const [isDragging, setIsDragging] = useState(false);
  const activeIdRef = useRef<string | null>(null);
  const dropTargetRef = useRef<SortableDropTarget | null>(null);

  const clear = useCallback(() => {
    activeIdRef.current = null;
    dropTargetRef.current = null;
    setActiveId(null);
    setDropTarget(null);
    setGhostStyles(EMPTY_GHOSTS);
    setIsDragging(false);
  }, []);

  const onDragStart = useCallback((id: string) => {
    activeIdRef.current = id;
    setActiveId(id);
    setIsDragging(true);
  }, []);

  const onDragMove = useCallback(
    (input: SortableDropDragInput | null) => {
      if (!input) {
        dropTargetRef.current = null;
        setDropTarget(null);
        return;
      }
      const next = resolveSortableDropTarget(input, orientation);
      dropTargetRef.current = next;
      setDropTarget(next);
    },
    [orientation],
  );

  const onDragEnd = useCallback(() => {
    clear();
  }, [clear]);

  const onDragCancel = useCallback(() => {
    clear();
  }, [clear]);

  const dndKitProps = sortableDropDndKitProps({
    onDragStart,
    onDragMove,
    onDragEnd,
    onDragCancel,
  });

  useLayoutEffect(() => {
    const container = containerRef.current;
    const liveActiveId = activeIdRef.current;
    if (!container || !liveActiveId || !isDragging) {
      setIndicatorStyle(null);
      setGhostStyles(EMPTY_GHOSTS);
      return;
    }

    const update = () => {
      const id = activeIdRef.current;
      const target = dropTargetRef.current;
      const node = containerRef.current;
      if (!node || !id) {
        setIndicatorStyle(null);
        setGhostStyles(EMPTY_GHOSTS);
        return;
      }
      setIndicatorStyle(target ? getSortableDropIndicatorStyle(node, target, orientation) : null);
      setGhostStyles(getSortableDragGhostStyles(node, id, target, orientation));
    };

    update();
    const scrollRoot = getScrollRoot(container);
    scrollRoot?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });

    return () => {
      scrollRoot?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [activeId, containerRef, dropTarget, getScrollRoot, isDragging, orientation]);

  return {
    activeId,
    dropTarget,
    indicatorStyle,
    ghostStyles,
    isDragging,
    dndKitProps,
  };
}

export type UseSortableTableDropIndicatorsResult = {
  containerRef: RefObject<HTMLDivElement | null>;
  columnSortableProps: ReturnType<typeof sortableDropDndKitProps>;
  rowSortableProps: ReturnType<typeof sortableDropDndKitProps>;
  columnIndicatorStyle: CSSProperties | null;
  rowIndicatorStyle: CSSProperties | null;
  columnGhostStyles: SortableDragGhostStyles;
  rowGhostStyles: SortableDragGhostStyles;
  columnActiveId: string | null;
  rowActiveId: string | null;
  isColumnDragging: boolean;
  isRowDragging: boolean;
  isDragging: boolean;
};

/** Column + row reorder on one table — shared container, two independent drop lines. */
export function useSortableTableDropIndicators(): UseSortableTableDropIndicatorsResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const column = useSortableDropIndicator({ orientation: "horizontal", containerRef });
  const row = useSortableDropIndicator({ orientation: "vertical", containerRef });

  return {
    containerRef,
    columnSortableProps: column.dndKitProps,
    rowSortableProps: row.dndKitProps,
    columnIndicatorStyle: column.indicatorStyle,
    rowIndicatorStyle: row.indicatorStyle,
    columnGhostStyles: column.ghostStyles,
    rowGhostStyles: row.ghostStyles,
    columnActiveId: column.activeId,
    rowActiveId: row.activeId,
    isColumnDragging: column.isDragging,
    isRowDragging: row.isDragging,
    isDragging: column.isDragging || row.isDragging,
  };
}

export type UseSortableRowDropIndicatorResult = {
  containerRef: RefObject<HTMLDivElement | null>;
  sortableProps: ReturnType<typeof sortableDropDndKitProps>;
  indicatorStyle: CSSProperties | null;
  ghostStyles: SortableDragGhostStyles;
  isDragging: boolean;
};

/** Row-only reorder inside a table shell. */
export function useSortableRowDropIndicator(): UseSortableRowDropIndicatorResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const row = useSortableDropIndicator({ orientation: "vertical", containerRef });

  return {
    containerRef,
    sortableProps: row.dndKitProps,
    indicatorStyle: row.indicatorStyle,
    ghostStyles: row.ghostStyles,
    isDragging: row.isDragging,
  };
}
