import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  expandSelectionToRange,
  getSelectionBounds,
  isCellInAnySelection,
  isCellSelection,
  isColumnSelection,
  isRowSelection,
  isSelectionEqual,
  useGridKeyboard,
  type SelectionRange,
} from "@nqlib/nqgrid";

/** Options for a select action: shift = extend, ctrl/cmd = additive. */
export interface SelectOpts {
  extend?: boolean;
  additive?: boolean;
}

/** Accept the legacy boolean (= extend) or the richer opts object. */
function normalizeOpts(opts?: boolean | SelectOpts): SelectOpts {
  if (typeof opts === "boolean") return { extend: opts };
  return opts ?? {};
}

/** A1-style band label for a row/column primary range, e.g. "2:2" or "C:C". */
function rowBandRef(startRow: number, endRow: number): string {
  return `${startRow + 1}:${endRow + 1}`;
}
function columnBandRef(startCol: number, endCol: number, columnLetter: (i: number) => string): string {
  return `${columnLetter(startCol)}:${columnLetter(endCol)}`;
}

export function useSheetCellSelection({
  rowCount,
  columnCount,
  getCellRef,
  getCellValue,
  getCellNumeric,
  columnLetter,
  onActiveCellChange,
  onActiveCellIndexChange,
  onSelectionNumbersChange,
}: {
  rowCount: number;
  columnCount: number;
  getCellRef: (row: number, col: number) => string;
  getCellValue: (row: number, col: number) => string;
  getCellNumeric?: (row: number, col: number) => number | null;
  /** Letter for a column index (for row/column band labels). Defaults to A.. */
  columnLetter?: (index: number) => string;
  onActiveCellChange?: (ref: string, value: string) => void;
  onActiveCellIndexChange?: (cell: { row: number; col: number } | null) => void;
  onSelectionNumbersChange?: (numbers: number[]) => void;
}) {
  // Multi-range model: the LAST entry is the active/primary range.
  const [ranges, setRanges] = useState<SelectionRange[]>([
    { type: "cell", start: { row: 0, col: 0 }, end: { row: 0, col: 0 } },
  ]);
  // Anchor for the primary range's grow-from-anchor (shift) behavior. Holds a
  // cell for cell ranges, and a row/col index (in row/col, respectively) for
  // band ranges.
  const anchorRef = useRef<{ row: number; col: number } | null>({ row: 0, col: 0 });

  const primary = ranges.length > 0 ? ranges[ranges.length - 1]! : null;
  const selection = primary;

  const letterOf = useMemo(
    () => columnLetter ?? ((i: number) => String.fromCharCode(65 + (i % 26))),
    [columnLetter],
  );

  /** Set the primary range; `selection`/`setSelection` back-compat shims. */
  const setSelection = useCallback((next: SelectionRange | null) => {
    setRanges((prev) => {
      if (next == null) return prev.length > 1 ? prev.slice(0, -1) : [];
      if (prev.length === 0) return [next];
      const copy = prev.slice();
      copy[copy.length - 1] = next;
      return copy;
    });
  }, []);

  // Arrow-key navigation drives the primary range (single contiguous range,
  // collapsing any multi-range into the moved one).
  const { onKeyDown } = useGridKeyboard({
    selection: primary && isCellSelection(primary) ? primary : null,
    onSelectionChange: (next) => {
      if (next && isCellSelection(next)) {
        // Keyboard nav keeps the anchor at the (possibly shift-grown) start.
        anchorRef.current = { ...next.start };
      }
      setRanges(next ? [next] : []);
    },
    rowCount,
    columnCount,
  });

  const clampCell = useCallback(
    (row: number, col: number) => ({
      row: Math.max(0, Math.min(rowCount - 1, row)),
      col: Math.max(0, Math.min(columnCount - 1, col)),
    }),
    [columnCount, rowCount],
  );

  const selectCell = useCallback(
    (row: number, col: number, opts?: boolean | SelectOpts) => {
      const { extend, additive } = normalizeOpts(opts);
      const clamped = clampCell(row, col);
      if (extend && anchorRef.current) {
        const next = expandSelectionToRange(anchorRef.current, clamped, "cell");
        setSelection(next);
      } else if (additive) {
        anchorRef.current = clamped;
        setRanges((prev) => [...prev, { type: "cell", start: clamped, end: clamped }]);
      } else {
        anchorRef.current = clamped;
        setRanges([{ type: "cell", start: clamped, end: clamped }]);
      }
    },
    [clampCell, setSelection],
  );

  const selectRow = useCallback(
    (row: number, opts?: boolean | SelectOpts) => {
      const { extend, additive } = normalizeOpts(opts);
      const clampedRow = Math.max(0, Math.min(rowCount - 1, row));
      if (extend && anchorRef.current) {
        const anchorRow = anchorRef.current.row;
        setSelection({
          type: "row",
          startRow: Math.min(anchorRow, clampedRow),
          endRow: Math.max(anchorRow, clampedRow),
        });
      } else {
        anchorRef.current = { row: clampedRow, col: 0 };
        const next: SelectionRange = { type: "row", startRow: clampedRow, endRow: clampedRow };
        setRanges((prev) => (additive ? [...prev, next] : [next]));
      }
    },
    [rowCount, setSelection],
  );

  const selectColumn = useCallback(
    (col: number, opts?: boolean | SelectOpts) => {
      const { extend, additive } = normalizeOpts(opts);
      const clampedCol = Math.max(0, Math.min(columnCount - 1, col));
      if (extend && anchorRef.current) {
        const anchorCol = anchorRef.current.col;
        setSelection({
          type: "column",
          startCol: Math.min(anchorCol, clampedCol),
          endCol: Math.max(anchorCol, clampedCol),
        });
      } else {
        anchorRef.current = { row: 0, col: clampedCol };
        const next: SelectionRange = { type: "column", startCol: clampedCol, endCol: clampedCol };
        setRanges((prev) => (additive ? [...prev, next] : [next]));
      }
    },
    [columnCount, setSelection],
  );

  const selectAll = useCallback(() => {
    if (rowCount <= 0 || columnCount <= 0) return;
    const start = { row: 0, col: 0 };
    const end = { row: rowCount - 1, col: columnCount - 1 };
    anchorRef.current = start;
    setRanges([{ type: "cell", start, end }]);
  }, [columnCount, rowCount]);

  // --- click-drag paint ---
  const beginDrag = useCallback(
    (row: number, col: number) => {
      const clamped = clampCell(row, col);
      anchorRef.current = clamped;
      setRanges([{ type: "cell", start: clamped, end: clamped }]);
    },
    [clampCell],
  );

  const dragTo = useCallback(
    (row: number, col: number) => {
      if (!anchorRef.current) return;
      const clamped = clampCell(row, col);
      const next = expandSelectionToRange(anchorRef.current, clamped, "cell");
      // Skip the state update (and the full-grid re-render it triggers) when the
      // pointer is still inside the same range — onMouseEnter fires per cell.
      setRanges((prev) => {
        const current = prev.length > 0 ? prev[prev.length - 1]! : null;
        if (isSelectionEqual(current, next)) return prev;
        if (prev.length === 0) return [next];
        const copy = prev.slice();
        copy[copy.length - 1] = next;
        return copy;
      });
    },
    [clampCell],
  );

  const isSelected = useCallback(
    (row: number, col: number) => isCellInAnySelection(row, col, ranges),
    [ranges],
  );

  // --- Active cell + formula-bar ref/value (driven by the PRIMARY range) ---
  useEffect(() => {
    if (!primary) {
      onActiveCellChange?.("", "");
      onActiveCellIndexChange?.(null);
      return;
    }
    if (isCellSelection(primary)) {
      const b = getSelectionBounds(primary);
      onActiveCellChange?.(getCellRef(b.endRow, b.endCol), getCellValue(b.endRow, b.endCol));
      onActiveCellIndexChange?.({ row: b.endRow, col: b.endCol });
      return;
    }
    if (isRowSelection(primary)) {
      const startRow = Math.min(primary.startRow, primary.endRow);
      const endRow = Math.max(primary.startRow, primary.endRow);
      onActiveCellChange?.(rowBandRef(startRow, endRow), "");
      onActiveCellIndexChange?.({ row: startRow, col: 0 });
      return;
    }
    if (isColumnSelection(primary)) {
      const startCol = Math.min(primary.startCol, primary.endCol);
      const endCol = Math.max(primary.startCol, primary.endCol);
      onActiveCellChange?.(columnBandRef(startCol, endCol, letterOf), "");
      onActiveCellIndexChange?.({ row: 0, col: startCol });
    }
  }, [primary, getCellRef, getCellValue, letterOf, onActiveCellChange, onActiveCellIndexChange]);

  // --- Status-bar numbers: aggregate numeric cells across ALL ranges. Row/col
  // bounds are MAX_SAFE_INTEGER, so clamp to the real grid extent. Cells are
  // de-duplicated so overlapping ranges don't double-count. ---
  useEffect(() => {
    if (!getCellNumeric || !onSelectionNumbersChange) return;
    if (ranges.length === 0) {
      onSelectionNumbersChange([]);
      return;
    }
    const numbers: number[] = [];
    const seen = new Set<number>();
    for (const sel of ranges) {
      const b = getSelectionBounds(sel);
      const startRow = Math.max(0, b.startRow);
      const endRow = Math.min(rowCount - 1, b.endRow);
      const startCol = Math.max(0, b.startCol);
      const endCol = Math.min(columnCount - 1, b.endCol);
      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          const key = row * columnCount + col;
          if (seen.has(key)) continue;
          seen.add(key);
          const value = getCellNumeric(row, col);
          if (value != null && Number.isFinite(value)) numbers.push(value);
        }
      }
    }
    onSelectionNumbersChange(numbers);
  }, [ranges, rowCount, columnCount, getCellNumeric, onSelectionNumbersChange]);

  return {
    ranges,
    selection,
    setSelection,
    onKeyDown,
    selectCell,
    selectRow,
    selectColumn,
    selectAll,
    beginDrag,
    dragTo,
    isSelected,
  };
}
