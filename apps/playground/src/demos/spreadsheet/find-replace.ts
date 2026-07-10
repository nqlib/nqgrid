/**
 * Pure find & replace logic for the Spreadsheet page. Operates over the page's
 * `data` (OrderRow[]) and `ORDER_COLUMNS` — no React, no DOM — so it stays
 * unit-testable. Cells are compared against their stored value coerced to a
 * string; numeric columns are coerced back to Number on write (non-finite
 * results are skipped).
 */

import type { OrderRow } from "./mock-data";

/** A column descriptor as used by the spreadsheet (subset of ORDER_COLUMNS). */
export interface FindReplaceColumn {
  readonly key: keyof OrderRow;
  readonly numeric: boolean;
}

/** Options shared by find and replace. */
export interface FindReplaceOptions {
  /** When true, comparison is case-sensitive. */
  readonly matchCase: boolean;
  /** When true, the query must equal the whole cell value (not a substring). */
  readonly wholeCell: boolean;
}

/** A single matched cell, addressed by row id + column key. */
export interface CellMatch {
  readonly rowId: string;
  readonly key: keyof OrderRow;
}

/** Normalize a value for comparison given the case-sensitivity option. */
function forCompare(value: string, matchCase: boolean): string {
  return matchCase ? value : value.toLowerCase();
}

/** True when `cell` matches `query` under the given options. */
function cellMatches(
  cellValue: string,
  query: string,
  { matchCase, wholeCell }: FindReplaceOptions,
): boolean {
  const haystack = forCompare(cellValue, matchCase);
  const needle = forCompare(query, matchCase);
  return wholeCell ? haystack === needle : haystack.includes(needle);
}

/**
 * Find every cell across `columns` whose stored value matches `query`.
 * Empty `query` returns no matches.
 */
export function findMatches(
  data: readonly OrderRow[],
  columns: readonly FindReplaceColumn[],
  query: string,
  opts: FindReplaceOptions,
): CellMatch[] {
  if (query === "") return [];
  const matches: CellMatch[] = [];
  for (const row of data) {
    for (const col of columns) {
      const cellValue = String(row[col.key] ?? "");
      if (cellMatches(cellValue, query, opts)) {
        matches.push({ rowId: row.id, key: col.key });
      }
    }
  }
  return matches;
}

/** Replace all case-(in)sensitive occurrences of `needle` in `haystack`. */
function replaceAllOccurrences(
  haystack: string,
  needle: string,
  replacement: string,
  matchCase: boolean,
): string {
  if (needle === "") return haystack;
  if (matchCase) return haystack.split(needle).join(replacement);
  // Case-insensitive substring replace without regex escaping headaches.
  let out = "";
  let i = 0;
  const lowerHay = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  while (i < haystack.length) {
    const at = lowerHay.indexOf(lowerNeedle, i);
    if (at === -1) {
      out += haystack.slice(i);
      break;
    }
    out += haystack.slice(i, at) + replacement;
    i = at + needle.length;
  }
  return out;
}

/** Coerce a replaced value for a column, or null if a numeric write is invalid. */
function coerceCellValue(
  col: FindReplaceColumn,
  current: unknown,
  replacedValue: string,
): string | number | null {
  if (col.numeric) {
    const coerced = Number(replacedValue);
    if (!Number.isFinite(coerced)) return null; // skip non-finite numeric writes
    return coerced === (current as number) ? null : coerced;
  }
  return replacedValue === String(current ?? "") ? null : replacedValue;
}

/** Result of {@link applyReplaceAll}. */
export interface ReplaceAllResult {
  /** A new data array with replacements applied (rows are copied on change). */
  readonly next: OrderRow[];
  /** Number of cells whose value actually changed. */
  readonly replaced: number;
}

/**
 * Replace `query` with `replacement` in every matching cell. For substring
 * mode the matched run is replaced inside the value; for whole-cell mode the
 * entire value is swapped. Numeric columns coerce the result with Number — if
 * that isn't finite, the cell is skipped. Empty `query` is a no-op.
 *
 * Returns a fresh array (and freshly-copied rows where a cell changed) so the
 * caller can route it through an undoable commit.
 */
export function applyReplaceAll(
  data: readonly OrderRow[],
  columns: readonly FindReplaceColumn[],
  query: string,
  replacement: string,
  opts: FindReplaceOptions,
): ReplaceAllResult {
  if (query === "") return { next: data.slice(), replaced: 0 };

  let replaced = 0;
  const next = data.map((row) => {
    let nextRow: OrderRow | null = null;
    for (const col of columns) {
      const cellValue = String(row[col.key] ?? "");
      if (!cellMatches(cellValue, query, opts)) continue;

      const replacedValue = opts.wholeCell
        ? replacement
        : replaceAllOccurrences(cellValue, query, replacement, opts.matchCase);

      const write = coerceCellValue(col, row[col.key], replacedValue);
      if (write === null) continue;
      nextRow ??= { ...row };
      (nextRow as unknown as Record<string, unknown>)[col.key as string] = write;
      replaced += 1;
    }
    return nextRow ?? row;
  });

  return { next, replaced };
}

/**
 * Replace only the FIRST matching cell (scanning rows then columns in order).
 * Same coercion rules as {@link applyReplaceAll}. Empty query is a no-op.
 * `replaced` is 0 or 1. Cells that match but produce an invalid/unchanged write
 * are skipped, and scanning continues to the next match.
 */
export function applyReplaceFirst(
  data: readonly OrderRow[],
  columns: readonly FindReplaceColumn[],
  query: string,
  replacement: string,
  opts: FindReplaceOptions,
): ReplaceAllResult {
  if (query === "") return { next: data.slice(), replaced: 0 };

  const next = data.slice();
  for (let r = 0; r < next.length; r++) {
    const row = next[r]!;
    for (const col of columns) {
      const cellValue = String(row[col.key] ?? "");
      if (!cellMatches(cellValue, query, opts)) continue;

      const replacedValue = opts.wholeCell
        ? replacement
        : replaceAllOccurrences(cellValue, query, replacement, opts.matchCase);

      const write = coerceCellValue(col, row[col.key], replacedValue);
      if (write === null) continue;
      const nextRow: Record<string, unknown> = { ...row };
      nextRow[col.key as string] = write;
      next[r] = nextRow as unknown as OrderRow;
      return { next, replaced: 1 };
    }
  }
  return { next, replaced: 0 };
}
