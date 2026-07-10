import { useCallback, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { CellPosition, SelectionRange } from './selection';
import { expandSelectionToRange } from './selection';

export interface GridKeyboardCallbacks {
  selection: SelectionRange | null;
  onSelectionChange: (sel: SelectionRange | null) => void;
  /** Called when keyboard nav wants the grid to scroll a cell into view. */
  onScrollToCell?: (row: number, col: number, align: 'nearest' | 'center') => void;
  rowCount: number;
  columnCount: number;
  /** Rows per Page Up/Down. Default 10. */
  pageSize?: number;
  /** When false, only basic arrows work (no Shift/Ctrl modifiers, no Page/Home/End/Tab/Enter/Escape). Default true. */
  extended?: boolean;
  /**
   * Selection granularity. `row` routes Space and Ctrl/Cmd+A to row selection
   * callbacks instead of cell ranges. Default `cell`.
   */
  selectionMode?: 'cell' | 'row';
  /** Space toggles selection of the focused row (required for keyboard row selection). */
  onToggleRowSelection?: (rowIndex: number) => void;
  /** Ctrl/Cmd+A selects all rows when `selectionMode` is `row`. */
  onSelectAllRows?: () => void;
}

export function useGridKeyboard(opts: GridKeyboardCallbacks) {
  const anchorRef = useRef<CellPosition | null>(null);
  const focusRef = useRef<CellPosition | null>(null);

  const {
    selection,
    onSelectionChange,
    onScrollToCell,
    rowCount,
    columnCount,
    pageSize = 10,
    extended = true,
    selectionMode = 'cell',
    onToggleRowSelection,
    onSelectAllRows,
  } = opts;

  const clamp = useCallback(
    (row: number, col: number): CellPosition => ({
      row: Math.max(0, Math.min(rowCount - 1, row)),
      col: Math.max(0, Math.min(columnCount - 1, col)),
    }),
    [rowCount, columnCount],
  );

  const commitCell = useCallback(
    (cell: CellPosition, shiftKey: boolean, align: 'nearest' | 'center' = 'nearest') => {
      const clamped = clamp(cell.row, cell.col);

      if (shiftKey && extended) {
        if (!anchorRef.current) anchorRef.current = focusRef.current ?? clamped;
        onSelectionChange(expandSelectionToRange(anchorRef.current, clamped, 'cell'));
      } else {
        anchorRef.current = null;
        onSelectionChange({ type: 'cell', start: clamped, end: clamped });
      }

      focusRef.current = clamped;
      onScrollToCell?.(clamped.row, clamped.col, align);
    },
    [clamp, extended, onSelectionChange, onScrollToCell],
  );

  const currentCell = useCallback((): CellPosition => {
    if (focusRef.current) return focusRef.current;
    if (selection?.type === 'cell') return selection.start;
    if (selection?.type === 'row') return { row: selection.startRow, col: 0 };
    if (selection?.type === 'column') return { row: 0, col: selection.startCol };
    return { row: 0, col: 0 };
  }, [selection]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const { key, shiftKey, ctrlKey, metaKey } = e;
      const mod = ctrlKey || metaKey;
      const cur = currentCell();

      switch (key) {
        case 'ArrowUp': {
          e.preventDefault();
          const row = mod && extended ? 0 : cur.row - 1;
          commitCell({ row, col: cur.col }, shiftKey);
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const row = mod && extended ? rowCount - 1 : cur.row + 1;
          commitCell({ row, col: cur.col }, shiftKey);
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const col = mod && extended ? 0 : cur.col - 1;
          commitCell({ row: cur.row, col }, shiftKey);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const col = mod && extended ? columnCount - 1 : cur.col + 1;
          commitCell({ row: cur.row, col }, shiftKey);
          break;
        }
        case 'PageUp': {
          if (!extended) break;
          e.preventDefault();
          commitCell({ row: Math.max(0, cur.row - pageSize), col: cur.col }, shiftKey, 'center');
          break;
        }
        case 'PageDown': {
          if (!extended) break;
          e.preventDefault();
          commitCell({ row: Math.min(rowCount - 1, cur.row + pageSize), col: cur.col }, shiftKey, 'center');
          break;
        }
        case 'Home': {
          if (!extended) break;
          e.preventDefault();
          commitCell(mod ? { row: 0, col: 0 } : { row: cur.row, col: 0 }, shiftKey, mod ? 'center' : 'nearest');
          break;
        }
        case 'End': {
          if (!extended) break;
          e.preventDefault();
          commitCell(
            mod ? { row: rowCount - 1, col: columnCount - 1 } : { row: cur.row, col: columnCount - 1 },
            shiftKey,
            mod ? 'center' : 'nearest',
          );
          break;
        }
        case 'Tab': {
          if (!extended) break;
          e.preventDefault();
          anchorRef.current = null;
          if (shiftKey) {
            // Shift+Tab: previous cell, wrap to prev row
            let col = cur.col - 1;
            let row = cur.row;
            if (col < 0 && row > 0) { col = columnCount - 1; row--; }
            commitCell(clamp(row, col), false);
          } else {
            let col = cur.col + 1;
            let row = cur.row;
            if (col >= columnCount && row < rowCount - 1) { col = 0; row++; }
            commitCell(clamp(row, col), false);
          }
          break;
        }
        case 'Enter': {
          if (!extended) break;
          e.preventDefault();
          anchorRef.current = null;
          commitCell({ row: shiftKey ? cur.row - 1 : cur.row + 1, col: cur.col }, false);
          break;
        }
        case 'Escape': {
          if (!extended) break;
          e.preventDefault();
          anchorRef.current = null;
          focusRef.current = null;
          onSelectionChange(null);
          break;
        }
        case ' ':
        case 'Spacebar': {
          // Space toggles row selection in row mode; left to the host otherwise.
          if (selectionMode !== 'row' || !onToggleRowSelection) return;
          e.preventDefault();
          onToggleRowSelection(cur.row);
          break;
        }
        case 'a':
        case 'A': {
          if (!extended || !mod) break;
          e.preventDefault();
          if (selectionMode === 'row' && onSelectAllRows) {
            onSelectAllRows();
            break;
          }
          anchorRef.current = { row: 0, col: 0 };
          focusRef.current = { row: rowCount - 1, col: columnCount - 1 };
          onSelectionChange({
            type: 'cell',
            start: { row: 0, col: 0 },
            end: { row: rowCount - 1, col: columnCount - 1 },
          });
          break;
        }
        default:
          return;
      }
    },
    [
      clamp,
      columnCount,
      commitCell,
      currentCell,
      extended,
      onSelectionChange,
      pageSize,
      rowCount,
      selectionMode,
      onToggleRowSelection,
      onSelectAllRows,
    ],
  );

  return { onKeyDown };
}
