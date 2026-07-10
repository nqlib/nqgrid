import { useEffect, useMemo, type CSSProperties, type ReactNode } from "react";
import { KeyboardSensor, PointerSensor, pointerWithin, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { cn } from "@nqlib/nqui";
import {
  SORTABLE_DROP_TARGET_ATTR,
  sortableDropTargetProps,
  useSortableRowDropIndicator,
  useSortableTableDropIndicators,
  type SortableDragGhostStyles,
} from "@nqlib/nqgrid";

export {
  SORTABLE_DROP_TARGET_ATTR,
  sortableDropTargetProps,
  useSortableRowDropIndicator,
  useSortableTableDropIndicators,
};

/**
 * Portal dnd-kit's hidden a11y live-region out of the table.
 *
 * `Sortable` (dnd-kit `DndContext`) wraps the `<thead>`/`<tbody>`, so its inline
 * screen-reader live-region `<div>` would render as a direct child of `<table>`
 * — invalid DOM that React warns about in dev. Routing it to `document.body`
 * keeps the announcements working without polluting the table markup.
 */
function useSortableAccessibilityProps() {
  return useMemo(
    () =>
      typeof document === "undefined"
        ? undefined
        : ({ accessibility: { container: document.body } } as const),
    [],
  );
}

/** Keep dragged table items in place — overlay + ghosts carry the affordance. */
export const sortableTableDragSuppressClass =
  "[&_[data-slot=sortable-item]]:!transform-none [&_[data-slot=sortable-item]]:!transition-none";

/** While a column drag is active, nested header controls must not steal pointer events. */
export const sortableColumnDragShieldClass =
  "[&_thead_button]:pointer-events-none [&_thead_[role=separator]]:pointer-events-none";

const COLUMN_DRAG_BODY_ATTR = "data-nqgrid-column-dragging";

function useColumnDragBodyShield(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    document.body.setAttribute(COLUMN_DRAG_BODY_ATTR, "");
    return () => document.body.removeAttribute(COLUMN_DRAG_BODY_ATTR);
  }, [enabled]);
}

function useColumnSortableSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

function SortableDragGhostLayer({
  ghosts,
  axis,
}: {
  ghosts: SortableDragGhostStyles;
  axis: "column" | "row";
}) {
  if (!ghosts.source) return null;
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute rounded-sm border border-dashed border-muted-foreground/45 bg-muted/25",
        axis === "column" ? "border-x-2" : "border-y-2",
      )}
      style={ghosts.source}
    />
  );
}

function SortableDropLine({
  style,
  axis,
}: {
  style: CSSProperties | null;
  axis: "column" | "row";
}) {
  if (!style) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-[60] rounded-full bg-primary shadow-[0_0_0_1px] shadow-primary/40"
      style={style}
    />
  );
}

/** Source ghost + insert-line indicators for column and row reorder. */
export function SortableTableDropChrome({
  columnIndicatorStyle,
  rowIndicatorStyle,
  columnGhostStyles,
  rowGhostStyles,
}: {
  columnIndicatorStyle: CSSProperties | null;
  rowIndicatorStyle: CSSProperties | null;
  columnGhostStyles: SortableDragGhostStyles;
  rowGhostStyles: SortableDragGhostStyles;
}) {
  return (
    <>
      <SortableDragGhostLayer ghosts={columnGhostStyles} axis="column" />
      <SortableDragGhostLayer ghosts={rowGhostStyles} axis="row" />
      <SortableDropLine style={columnIndicatorStyle} axis="column" />
      <SortableDropLine style={rowIndicatorStyle} axis="row" />
    </>
  );
}

/** Row-only drop chrome (flights, projects). */
export function SortableRowDropChrome({
  indicatorStyle,
  ghostStyles,
}: {
  indicatorStyle: CSSProperties | null;
  ghostStyles: SortableDragGhostStyles;
}) {
  return (
    <>
      <SortableDragGhostLayer ghosts={ghostStyles} axis="row" />
      <SortableDropLine style={indicatorStyle} axis="row" />
    </>
  );
}

/** Table shell helper — engine geometry + playground drag chrome. */
export function usePlaygroundSortableTableDropIndicators() {
  const drop = useSortableTableDropIndicators();
  const a11y = useSortableAccessibilityProps();
  const columnSensors = useColumnSortableSensors();
  useColumnDragBodyShield(drop.isColumnDragging);
  const containerClassName = cn(
    "relative min-w-0",
    drop.isDragging && sortableTableDragSuppressClass,
    drop.isColumnDragging && sortableColumnDragShieldClass,
  );
  const indicators: ReactNode = (
    <SortableTableDropChrome
      columnIndicatorStyle={drop.columnIndicatorStyle}
      rowIndicatorStyle={drop.rowIndicatorStyle}
      columnGhostStyles={drop.columnGhostStyles}
      rowGhostStyles={drop.rowGhostStyles}
    />
  );
  return {
    ...drop,
    columnSortableProps: {
      ...drop.columnSortableProps,
      ...a11y,
      sensors: columnSensors,
      collisionDetection: pointerWithin,
    },
    rowSortableProps: { ...drop.rowSortableProps, ...a11y },
    containerClassName,
    indicators,
  };
}

/** Row-only shell helper. */
export function usePlaygroundSortableRowDropIndicator() {
  const drop = useSortableRowDropIndicator();
  const a11y = useSortableAccessibilityProps();
  const containerClassName = cn(
    "relative min-w-0",
    drop.isDragging && sortableTableDragSuppressClass,
  );
  const indicator = (
    <SortableRowDropChrome
      indicatorStyle={drop.indicatorStyle}
      ghostStyles={drop.ghostStyles}
    />
  );
  return {
    ...drop,
    sortableProps: { ...drop.sortableProps, ...a11y },
    containerClassName,
    indicator,
  };
}
