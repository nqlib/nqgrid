import type { CellStyle, CellTypeError, ColumnSchema, ColumnType, Interval } from "./contract";
import { isTypeError } from "./contract";

/** The full render result for one cell — what a view binds to. */
export interface RenderedCell<TParsed = unknown> {
  /** parsed value, or undefined when raw failed to parse. */
  readonly parsed?: TParsed;
  readonly display: string;
  readonly style: CellStyle;
  readonly error?: CellTypeError;
}

/**
 * raw → parse → format + style. The single pipeline every view runs per cell.
 * A parse error renders as an empty muted cell and never throws.
 */
export function renderCell(
  raw: unknown,
  type: ColumnType<unknown, unknown>,
  schema: ColumnSchema,
): RenderedCell {
  const parsed = type.parse(raw, schema);
  if (isTypeError(parsed)) {
    return { display: "", style: { muted: true }, error: parsed };
  }
  return {
    parsed,
    display: type.format(parsed, schema),
    style: type.style(parsed, schema),
  };
}

/**
 * Sort comparator over RAW values — parses both sides and compares on
 * `compareKey`, never on display text. Unparseable values sort last.
 */
export function compareCells(
  rawA: unknown,
  rawB: unknown,
  type: ColumnType<unknown, unknown>,
  schema: ColumnSchema,
): number {
  const a = type.parse(rawA, schema);
  const b = type.parse(rawB, schema);
  const aErr = isTypeError(a);
  const bErr = isTypeError(b);
  if (aErr && bErr) return 0;
  if (aErr) return 1;
  if (bErr) return -1;
  const ka = type.compareKey(a, schema);
  const kb = type.compareKey(b, schema);
  if (typeof ka === "number" && typeof kb === "number") return ka - kb;
  return String(ka).localeCompare(String(kb));
}

/** The grouping/board placement key for a raw value (its compareKey, or null on error). */
export function groupKey(
  raw: unknown,
  type: ColumnType<unknown, unknown>,
  schema: ColumnSchema,
): number | string | null {
  const parsed = type.parse(raw, schema);
  if (isTypeError(parsed)) return null;
  return type.compareKey(parsed, schema);
}

/** Maps a raw value to a time interval, or null when the type isn't time-based. */
export function cellInterval(
  raw: unknown,
  type: ColumnType<unknown, unknown>,
  schema: ColumnSchema,
): Interval | null {
  if (!type.toInterval) return null;
  const parsed = type.parse(raw, schema);
  if (isTypeError(parsed)) return null;
  return type.toInterval(parsed, schema);
}
