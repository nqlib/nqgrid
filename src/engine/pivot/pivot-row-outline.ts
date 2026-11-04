import type { PivotRow } from "./pivot";

/** Must match the separator used in `computePivot` row/column keys. */
export const PIVOT_KEY_SEP = "␟";

/** Stable id for a row-group at `level` (0 = outermost row dimension). */
export function pivotGroupKey(path: readonly string[], level: number): string {
  return path.slice(0, level + 1).join(PIVOT_KEY_SEP);
}

/** Every expandable row-group key in a pivot result (outer → inner). */
export function collectPivotExpandableGroupKeys(
  rows: readonly PivotRow[],
  rowFieldCount: number,
): readonly string[] {
  if (rowFieldCount <= 1) return [];
  const keys = new Set<string>();
  for (const row of rows) {
    if (row.kind === "grandTotal") continue;
    const maxLevel = Math.min(row.path.length - 1, rowFieldCount - 2);
    for (let level = 0; level <= maxLevel; level++) {
      keys.add(pivotGroupKey(row.path, level));
    }
  }
  return [...keys].sort();
}

/**
 * Whether a pivot row should render given outline expansion state.
 * `expanded` contains group keys that are open; missing keys are collapsed.
 */
export function isPivotRowVisible(
  row: PivotRow,
  expanded: ReadonlySet<string>,
  rowFieldCount: number,
): boolean {
  if (row.kind === "grandTotal") return true;
  if (rowFieldCount <= 1) return true;

  const path = row.path;
  const maxLevel = Math.min(path.length - 1, rowFieldCount - 2);

  for (let level = maxLevel; level >= 0; level--) {
    const groupKey = pivotGroupKey(path, level);
    if (!expanded.has(groupKey)) {
      return (
        row.kind === "subtotal" &&
        row.path.length === level + 1 &&
        pivotGroupKey(row.path, level) === groupKey
      );
    }
  }

  return true;
}

/** First visible row for a group value at `level` — hosts the expand/collapse control. */
export function isPivotGroupHeaderRow(
  row: PivotRow,
  prev: PivotRow | undefined,
  level: number,
): boolean {
  if (row.kind === "grandTotal") return false;

  if (row.kind === "subtotal" && row.path.length === level + 1) {
    if (prev === undefined) return true;
    if (prev.kind === "grandTotal") return true;
    for (let i = 0; i < level; i++) {
      if (row.path[i] !== prev.path[i]) return true;
    }
    return false;
  }

  if (level >= row.path.length) return false;
  if (prev === undefined) return true;
  if (prev.kind === "grandTotal") return true;

  for (let i = 0; i < level; i++) {
    if (row.path[i] !== prev.path[i]) return true;
  }
  return row.path[level] !== prev.path[level];
}

/** Filter pivot rows for the current outline expansion. */
export function filterVisiblePivotRows(
  rows: readonly PivotRow[],
  expanded: ReadonlySet<string>,
  rowFieldCount: number,
): PivotRow[] {
  return rows.filter((row) => isPivotRowVisible(row, expanded, rowFieldCount));
}
