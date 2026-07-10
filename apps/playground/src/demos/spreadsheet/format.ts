/**
 * Shared formatting + A1-notation helpers for the Spreadsheet page.
 * Pure functions — no React, no engine imports.
 */

const currencyFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const numberFormat = new Intl.NumberFormat("en-US");

/** "$25,476" — whole-dollar currency for revenue/cost/margin/unit price. */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return currencyFormat.format(value);
}

/** "1,234" — plain integer count. */
export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  return numberFormat.format(value);
}

/** "28.7%" — one decimal place. */
export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

/** 0 → "A", 25 → "Z", 26 → "AA" — spreadsheet column letters. */
export function columnLetter(index: number): string {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

/** A1 reference from zero-based row + column: (0, 0) → "A1". */
export function cellReference(rowIndex: number, colIndex: number): string {
  return `${columnLetter(colIndex)}${rowIndex + 1}`;
}

// --- Per-cell formatting model -------------------------------------------

/** Number-display override applied on top of a column's default formatter. */
export type CellNumberFormat = "currency" | "percent" | "thousands" | "plain";

/** Display-only formatting for a single cell. Values are never mutated. */
export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Horizontal alignment. */
  align?: "left" | "center" | "right";
  /** Vertical alignment within the (possibly taller) row. */
  valign?: "top" | "middle" | "bottom";
  numberFormat?: CellNumberFormat;
}

/** Boolean text-style flags that share toggle semantics. */
export type TextStyleKey = "bold" | "italic" | "underline";

/** Drop off/cleared fields so format entries stay minimal (and prunable). */
function normalizeFormat(f: CellFormat): CellFormat {
  const out: CellFormat = {};
  if (f.bold) out.bold = true;
  if (f.italic) out.italic = true;
  if (f.underline) out.underline = true;
  if (f.align != null) out.align = f.align;
  if (f.valign != null) out.valign = f.valign;
  if (f.numberFormat != null) out.numberFormat = f.numberFormat;
  return out;
}

/** Empty format = no entry; used to short-circuit lookups/merges. */
function isEmptyFormat(f: CellFormat): boolean {
  return (
    !f.bold &&
    !f.italic &&
    !f.underline &&
    f.align == null &&
    f.valign == null &&
    f.numberFormat == null
  );
}

/**
 * Pure toggle/merge for a set of cells. Given the current format map, the keys
 * of the cells in the selection, and a patch:
 *  - text-style flags (bold/italic/underline) toggle as a group: if EVERY cell
 *    already has the flag on, turn it off for all; otherwise turn it on for all;
 *  - `align` / `numberFormat` set the value on every cell, unless ALL cells
 *    already equal it — then clear it (click-active-again resets to default).
 * Returns a NEW map; empty entries are pruned so lookups stay sparse.
 */
export function toggleFormatForCells(
  formats: Record<string, CellFormat>,
  cellKeys: readonly string[],
  patch: Partial<CellFormat>,
): Record<string, CellFormat> {
  if (cellKeys.length === 0) return formats;
  const next: Record<string, CellFormat> = { ...formats };

  // Resolve each field to the value we will WRITE on every selected cell.
  const writes: Partial<CellFormat> = {};

  for (const key of ["bold", "italic", "underline"] as const) {
    if (patch[key] === undefined) continue;
    const allOn = cellKeys.every((k) => formats[k]?.[key] === true);
    writes[key] = !allOn;
  }

  if (patch.align !== undefined) {
    const allEqual = cellKeys.every((k) => formats[k]?.align === patch.align);
    writes.align = allEqual ? undefined : patch.align;
  }

  if (patch.valign !== undefined) {
    const allEqual = cellKeys.every((k) => formats[k]?.valign === patch.valign);
    writes.valign = allEqual ? undefined : patch.valign;
  }

  if (patch.numberFormat !== undefined) {
    const allEqual = cellKeys.every((k) => formats[k]?.numberFormat === patch.numberFormat);
    writes.numberFormat = allEqual ? undefined : patch.numberFormat;
  }

  for (const k of cellKeys) {
    const merged = normalizeFormat({ ...(formats[k] ?? {}), ...writes });
    if (isEmptyFormat(merged)) delete next[k];
    else next[k] = merged;
  }
  return next;
}

/**
 * Display string for a numeric value under an optional per-cell numberFormat.
 * When no override is set, falls back to the column's already-formatted default.
 */
export function formatCellDisplay(
  value: number | null | undefined,
  numberFormat: CellNumberFormat | undefined,
  columnDefault: string,
): string {
  if (numberFormat == null) return columnDefault;
  if (value == null) return "—";
  switch (numberFormat) {
    case "currency":
      return formatCurrency(value);
    case "percent":
      return formatPercent(value);
    case "thousands":
      return formatNumber(value);
    case "plain":
      return String(value);
  }
}

/** Tailwind class fragment for a cell format's text style (bold/italic/underline). */
export function textStyleClass(format: CellFormat): string | undefined {
  const cls = [
    format.bold && "font-semibold",
    format.italic && "italic",
    format.underline && "underline",
  ].filter(Boolean) as string[];
  return cls.length > 0 ? cls.join(" ") : undefined;
}
