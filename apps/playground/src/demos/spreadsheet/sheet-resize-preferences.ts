import { NEUTRAL_TABLE_ROW_HEIGHT_PX } from "../../lib/playground-neutral-table";

export const SHEET_RESIZE_STORAGE_KEY = "nqgrid-spreadsheet-resize";

export interface SheetResizePreferences {
  columnResize: boolean;
  rowResize: boolean;
  bodyRowHeightPx: number;
}

export const DEFAULT_SHEET_RESIZE: SheetResizePreferences = {
  columnResize: true,
  rowResize: false,
  bodyRowHeightPx: NEUTRAL_TABLE_ROW_HEIGHT_PX,
};

export const MIN_BODY_ROW_HEIGHT_PX = 20;
export const MAX_BODY_ROW_HEIGHT_PX = 72;
export const DEFAULT_ANALYTICS_COL_WIDTH_PX = 112;

export function readSheetResizePreferences(
  fallback: SheetResizePreferences = DEFAULT_SHEET_RESIZE,
): SheetResizePreferences {
  try {
    const raw = localStorage.getItem(SHEET_RESIZE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<SheetResizePreferences>;
    return {
      columnResize: parsed.columnResize ?? fallback.columnResize,
      rowResize: parsed.rowResize ?? fallback.rowResize,
      bodyRowHeightPx: clampRowHeight(parsed.bodyRowHeightPx ?? fallback.bodyRowHeightPx),
    };
  } catch {
    return fallback;
  }
}

export function clampRowHeight(px: number): number {
  return Math.min(MAX_BODY_ROW_HEIGHT_PX, Math.max(MIN_BODY_ROW_HEIGHT_PX, Math.round(px)));
}

export function clampColumnWidth(px: number, min = 48, max = 480): number {
  return Math.min(max, Math.max(min, Math.round(px)));
}
