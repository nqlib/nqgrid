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
