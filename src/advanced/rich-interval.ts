import { normalizeRichSchemaColumnDef } from "./normalize-rich-schema";
import type { RichSchemaColumnDef } from "./rich-schema";
import { coerceDate, getByPath, parseTimelineRaw } from "./rich-value-format";

/** A half-open time interval. `start === end` denotes a milestone. */
export interface RichInterval {
  readonly start: Date;
  readonly end: Date;
}

/**
 * The `toInterval` seam (see the ColumnType contract). Maps a column's raw cell value
 * to a `{ start, end }` interval, or `null` when the column is not time-typed.
 *
 * Only `date` (zero-width ⇒ milestone) and `timeline` columns produce an interval;
 * every other kind returns `null`, which is how a time-axis engine knows to ignore it.
 * The table engine never calls this — it is the single thing a gantt/calendar needs.
 */
export function richToInterval<TData extends object>(
  def: RichSchemaColumnDef<TData>,
  raw: unknown,
): RichInterval | null {
  const normalized = normalizeRichSchemaColumnDef(def);
  switch (normalized.kind) {
    case "timeline":
      return parseTimelineRaw(raw) ?? null;
    case "date": {
      const d = coerceDate(raw);
      return d ? { start: d, end: d } : null;
    }
    default:
      return null;
  }
}

/** True when a column type can drive a time axis (implements the interval seam). */
export function isTimelineCapable<TData extends object>(def: RichSchemaColumnDef<TData>): boolean {
  const kind = normalizeRichSchemaColumnDef(def).kind;
  return kind === "timeline" || kind === "date";
}

/**
 * Find the column that should drive the time axis: the first `timeline` column,
 * else the first `date` column. Returns `undefined` when the schema has neither.
 */
export function findTimelineColumn<TData extends object>(
  defs: readonly RichSchemaColumnDef<TData>[],
): RichSchemaColumnDef<TData> | undefined {
  return (
    defs.find((d) => normalizeRichSchemaColumnDef(d).kind === "timeline") ??
    defs.find((d) => normalizeRichSchemaColumnDef(d).kind === "date")
  );
}

/** Read a column's raw scalar from a row, honoring `accessorKey` / `accessorPath` / `compute`. */
export function readRichAccessor<TData extends object>(def: RichSchemaColumnDef<TData>, row: TData): unknown {
  if (def.kind === "formula") return def.compute(row);
  if ("accessorPath" in def && def.accessorPath) return getByPath(row, def.accessorPath);
  if ("accessorKey" in def && def.accessorKey) return (row as Record<string, unknown>)[def.accessorKey as string];
  return undefined;
}
