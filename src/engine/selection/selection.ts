// ====== Types ======

export interface CellPosition {
  row: number;
  col: number;
}

export interface CellSelectionRange {
  type: 'cell';
  start: CellPosition;
  end: CellPosition;
}

export interface RowSelectionRange {
  type: 'row';
  startRow: number;
  endRow: number;
}

export interface ColumnSelectionRange {
  type: 'column';
  startCol: number;
  endCol: number;
}

export type SelectionRange = CellSelectionRange | RowSelectionRange | ColumnSelectionRange;

export interface SelectionBounds {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

// ====== Predicates ======

export function isCellSelection(sel: SelectionRange): sel is CellSelectionRange {
  return sel.type === 'cell';
}

export function isRowSelection(sel: SelectionRange): sel is RowSelectionRange {
  return sel.type === 'row';
}

export function isColumnSelection(sel: SelectionRange): sel is ColumnSelectionRange {
  return sel.type === 'column';
}

// ====== Utilities ======

export function isSelectionEqual(a: SelectionRange | null, b: SelectionRange | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.type !== b.type) return false;
  if (isCellSelection(a) && isCellSelection(b)) {
    return (
      a.start.row === b.start.row && a.start.col === b.start.col &&
      a.end.row === b.end.row && a.end.col === b.end.col
    );
  }
  if (isRowSelection(a) && isRowSelection(b)) {
    return a.startRow === b.startRow && a.endRow === b.endRow;
  }
  if (isColumnSelection(a) && isColumnSelection(b)) {
    return a.startCol === b.startCol && a.endCol === b.endCol;
  }
  return false;
}

export function getSelectionBounds(sel: SelectionRange): SelectionBounds {
  switch (sel.type) {
    case 'cell':
      return {
        startRow: Math.min(sel.start.row, sel.end.row),
        endRow: Math.max(sel.start.row, sel.end.row),
        startCol: Math.min(sel.start.col, sel.end.col),
        endCol: Math.max(sel.start.col, sel.end.col),
      };
    case 'row':
      return {
        startRow: Math.min(sel.startRow, sel.endRow),
        endRow: Math.max(sel.startRow, sel.endRow),
        startCol: 0,
        endCol: Number.MAX_SAFE_INTEGER,
      };
    case 'column':
      return {
        startRow: 0,
        endRow: Number.MAX_SAFE_INTEGER,
        startCol: Math.min(sel.startCol, sel.endCol),
        endCol: Math.max(sel.startCol, sel.endCol),
      };
  }
}

export function expandSelectionToRange(
  start: CellPosition,
  end: CellPosition,
  type: SelectionRange['type'] = 'cell',
): SelectionRange {
  switch (type) {
    case 'row':
      return { type: 'row', startRow: Math.min(start.row, end.row), endRow: Math.max(start.row, end.row) };
    case 'column':
      return { type: 'column', startCol: Math.min(start.col, end.col), endCol: Math.max(start.col, end.col) };
    default:
      return { type: 'cell', start, end };
  }
}

export function isCellInSelection(row: number, col: number, sel: SelectionRange): boolean {
  const b = getSelectionBounds(sel);
  return row >= b.startRow && row <= b.endRow && col >= b.startCol && col <= b.endCol;
}

/**
 * Membership across a set of ranges (non-contiguous / multi-range selection,
 * e.g. Ctrl/Cmd+click). The engine's range primitive stays single-range; the
 * consumer holds the list and composes it with this helper.
 */
export function isCellInAnySelection(
  row: number,
  col: number,
  ranges: readonly SelectionRange[],
): boolean {
  for (const sel of ranges) {
    if (isCellInSelection(row, col, sel)) return true;
  }
  return false;
}

// ====== Animation helpers ======

export interface AnimatedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionAnimation {
  from: AnimatedRect | null;
  to: AnimatedRect | null;
  startTime: number;
  duration: number;
}

export function createSelectionAnimation(
  from: AnimatedRect | null,
  to: AnimatedRect | null,
  duration = 150,
): SelectionAnimation {
  return { from, to, startTime: Date.now(), duration };
}

export function getAnimationProgress(anim: SelectionAnimation): number {
  return (Date.now() - anim.startTime) / anim.duration;
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function interpolateRect(
  from: AnimatedRect | null,
  to: AnimatedRect | null,
  rawProgress: number,
): AnimatedRect | null {
  if (!from && !to) return null;
  if (!from) return to;
  if (!to) return from;
  const t = easeOut(Math.max(0, Math.min(1, rawProgress)));
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    width: from.width + (to.width - from.width) * t,
    height: from.height + (to.height - from.height) * t,
  };
}
