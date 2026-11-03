import type { PivotBodyRow, PivotRowSpan } from "./types";

/**
 * Spans for one row-dimension `level`: each group/leaf at that level covers itself plus its
 * visible descendants. The grand-total row never belongs to a span.
 *
 * Render the span as one cell (or a sticky overlay) at `rowIndex` covering `span` rows.
 */
export function computePivotRowSpans(rows: readonly PivotBodyRow[], level: number): PivotRowSpan[] {
  const spans: PivotRowSpan[] = [];
  let current: { rowIndex: number; span: number; path: readonly string[] } | null = null;

  const samePrefix = (a: readonly string[], b: readonly string[]) => {
    for (let i = 0; i <= level; i++) if (a[i] !== b[i]) return false;
    return true;
  };

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]!;
    const inLevel = row.kind !== "grandTotal" && row.path.length > level;
    if (inLevel && current && samePrefix(current.path, row.path)) {
      current.span += 1;
      continue;
    }
    if (current) spans.push(current);
    current = inLevel ? { rowIndex, span: 1, path: row.path.slice(0, level + 1) } : null;
  }
  if (current) spans.push(current);
  return spans;
}
