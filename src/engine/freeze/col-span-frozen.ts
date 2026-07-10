/**
 * When colspan > 1, disallow spanning from a frozen column into a non-frozen column
 * (or the reverse). Same idea as nqdg `colSpanUtils`.
 */
export function colSpanCrossesFrozenBoundary(
  columnFrozen: boolean,
  columnIndex: number,
  colSpan: number,
  lastFrozenColumnIndex: number,
): boolean {
  if (colSpan <= 1) return false;
  const lastIdx = columnIndex + colSpan - 1;
  if (columnFrozen && lastIdx > lastFrozenColumnIndex) return true;
  if (!columnFrozen && columnIndex <= lastFrozenColumnIndex) return true;
  return false;
}

export interface SpanFreezeBoundaryInput {
  columnFrozen: boolean;
  columnIndex: number;
  colSpan: number;
  lastFrozenColumnIndex: number;
  rowFrozen: boolean;
  rowIndex: number;
  rowSpan: number;
  lastFrozenRowIndex: number;
}

/**
 * Returns true when a merged cell crosses column and/or row freeze boundaries.
 */
export function spanCrossesFreezeBoundary(input: SpanFreezeBoundaryInput): boolean {
  const {
    columnFrozen,
    columnIndex,
    colSpan,
    lastFrozenColumnIndex,
    rowFrozen,
    rowIndex,
    rowSpan,
    lastFrozenRowIndex,
  } = input;

  if (
    colSpanCrossesFrozenBoundary(
      columnFrozen,
      columnIndex,
      colSpan,
      lastFrozenColumnIndex,
    )
  ) {
    return true;
  }

  if (rowSpan <= 1) return false;
  const lastRowIdx = rowIndex + rowSpan - 1;
  if (rowFrozen && lastRowIdx > lastFrozenRowIndex) return true;
  if (!rowFrozen && rowIndex <= lastFrozenRowIndex) return true;
  return false;
}
