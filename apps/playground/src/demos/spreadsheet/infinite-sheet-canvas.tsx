import type { CSSProperties, ReactNode } from "react";
import { cn } from "@nqlib/nqui";
import { NEUTRAL_TABLE_ROW_HEIGHT_PX } from "../../lib/playground-neutral-table";

/** Fit data only (work-management style) vs Excel/Sheets-style scrollable grid canvas. */
export type SheetCanvasMode = "compact" | "infinite";

export const SHEET_CANVAS_STORAGE_KEY = "nqgrid-spreadsheet-canvas-mode";

const DEFAULT_MIN_COLUMNS = 26;
const DEFAULT_MIN_ROWS = 80;
const DEFAULT_CELL_WIDTH_PX = 96;

export function readSheetCanvasMode(fallback: SheetCanvasMode = "infinite"): SheetCanvasMode {
  try {
    const raw = localStorage.getItem(SHEET_CANVAS_STORAGE_KEY);
    return raw === "compact" || raw === "infinite" ? raw : fallback;
  } catch {
    return fallback;
  }
}

function sheetGridBackgroundStyle(cellWidth: number, cellHeight: number): CSSProperties {
  return {
    backgroundImage: [
      "linear-gradient(to right, color-mix(in oklch, var(--border) 70%, transparent) 1px, transparent 1px)",
      "linear-gradient(to bottom, color-mix(in oklch, var(--border) 70%, transparent) 1px, transparent 1px)",
    ].join(", "),
    backgroundSize: `${cellWidth}px ${cellHeight}px`,
  };
}

/**
 * Wraps a data table for analytics sheets.
 * - `infinite`: scrollable grid canvas with empty cells; data block gets a strong outer frame.
 * - `compact`: table only — fixed footprint for dense app UIs.
 */
export function InfiniteSheetCanvas({
  mode,
  children,
  className,
  minColumns = DEFAULT_MIN_COLUMNS,
  minRows = DEFAULT_MIN_ROWS,
  cellWidth = DEFAULT_CELL_WIDTH_PX,
  cellHeight = NEUTRAL_TABLE_ROW_HEIGHT_PX,
}: {
  mode: SheetCanvasMode;
  children: ReactNode;
  className?: string;
  minColumns?: number;
  minRows?: number;
  cellWidth?: number;
  cellHeight?: number;
}) {
  if (mode === "compact") {
    return (
      <div
        className={cn(
          "inline-block max-w-full overflow-hidden rounded-sm border border-border bg-background shadow-sm",
          className,
        )}
      >
        {children}
      </div>
    );
  }

  const canvasMinWidth = minColumns * cellWidth;
  const canvasMinHeight = minRows * cellHeight;

  return (
    <div
      className={cn("relative min-h-full min-w-full bg-muted/20", className)}
      style={{
        minWidth: canvasMinWidth,
        minHeight: canvasMinHeight,
        ...sheetGridBackgroundStyle(cellWidth, cellHeight),
      }}
    >
      <div className="inline-block border-2 border-border bg-background shadow-md ring-1 ring-border/60">
        {children}
      </div>
    </div>
  );
}
