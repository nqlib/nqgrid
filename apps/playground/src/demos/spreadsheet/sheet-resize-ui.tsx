import { useCallback, useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@nqlib/nqui";
import {
  clampColumnWidth,
  clampRowHeight,
  DEFAULT_ANALYTICS_COL_WIDTH_PX,
  MAX_BODY_ROW_HEIGHT_PX,
  MIN_BODY_ROW_HEIGHT_PX,
} from "./sheet-resize-preferences";

const resizeHandleClass =
  "absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize touch-none select-none opacity-0 transition-opacity group-hover/col:opacity-100 before:absolute before:inset-y-1 before:right-0.5 before:w-px before:bg-border group-data-[resizing=true]/col:opacity-100 group-data-[resizing=true]/col:before:bg-primary";

/** Drag handle on the trailing edge of a column header. */
export function ColumnResizeHandle({
  enabled,
  label,
  getStartWidth,
  onWidthChange,
  className,
}: {
  enabled: boolean;
  label: string;
  getStartWidth: () => number;
  onWidthChange: (width: number) => void;
  className?: string;
}) {
  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLSpanElement>) => {
      if (!enabled) return;
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startWidth = getStartWidth();
      const target = event.currentTarget.closest("[data-resize-col]") as HTMLElement | null;
      target?.setAttribute("data-resizing", "true");

      const onMove = (moveEvent: PointerEvent) => {
        onWidthChange(clampColumnWidth(startWidth + moveEvent.clientX - startX));
      };
      const onUp = () => {
        target?.removeAttribute("data-resizing");
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [enabled, getStartWidth, onWidthChange],
  );

  if (!enabled) return null;

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label}`}
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      className={cn(resizeHandleClass, className)}
    />
  );
}

/** Drag handle on the bottom edge of a body row (Excel row border). */
export function RowBottomResizeHandle({
  enabled,
  rowLabel,
  startHeightPx,
  onHeightChange,
}: {
  enabled: boolean;
  rowLabel: string;
  startHeightPx: number;
  onHeightChange: (heightPx: number) => void;
}) {
  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      event.preventDefault();
      event.stopPropagation();
      const startY = event.clientY;
      const startHeight = startHeightPx;
      const rowEl = event.currentTarget.closest("tr");

      const onMove = (moveEvent: PointerEvent) => {
        onHeightChange(clampRowHeight(startHeight + moveEvent.clientY - startY));
      };
      const onUp = () => {
        rowEl?.removeAttribute("data-resizing-row");
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };
      rowEl?.setAttribute("data-resizing-row", "true");
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [enabled, onHeightChange, startHeightPx],
  );

  if (!enabled) return null;

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={`Resize ${rowLabel} row`}
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-0 left-0 z-10 h-1.5 w-full cursor-row-resize touch-none opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-primary/25 group-data-[resizing-row=true]/row:opacity-100 group-data-[resizing-row=true]/row:bg-primary/30"
    />
  );
}

/** Column widths for plain HTML tables (pivot / summary). */
export function useAnalyticsColumnWidths(
  columnIds: readonly string[],
  defaultWidth = DEFAULT_ANALYTICS_COL_WIDTH_PX,
) {
  const idsKey = columnIds.join("\0");
  const [widths, setWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    setWidths((prev) => {
      const next = { ...prev };
      for (const id of columnIds) {
        if (next[id] == null) next[id] = defaultWidth;
      }
      return next;
    });
  }, [columnIds, defaultWidth, idsKey]);

  const getWidth = useCallback(
    (id: string) => widths[id] ?? defaultWidth,
    [widths, defaultWidth],
  );

  const setWidth = useCallback((id: string, width: number) => {
    setWidths((prev) => ({ ...prev, [id]: clampColumnWidth(width) }));
  }, []);

  return { getWidth, setWidth };
}

export function bodyRowStyle(heightPx: number): CSSProperties {
  return { height: heightPx, minHeight: heightPx };
}

export { MAX_BODY_ROW_HEIGHT_PX, MIN_BODY_ROW_HEIGHT_PX };
