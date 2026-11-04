import type { ColumnType, Interval } from "../contract";
import { typeError } from "../contract";
import { coerceDate, PRESETS, type DateFormatSpec } from "./date";

export interface DateRangeParsed {
  readonly start: Date;
  readonly end: Date;
}

/** Accepts `{start,end}`, `[start,end]`, or `{from,to}` raw shapes. */
function coerceRange(raw: unknown): DateRangeParsed | undefined {
  if (raw == null) return undefined;
  let startRaw: unknown;
  let endRaw: unknown;
  if (Array.isArray(raw)) {
    [startRaw, endRaw] = raw;
  } else if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    startRaw = o.start ?? o.from;
    endRaw = o.end ?? o.to;
  } else {
    return undefined;
  }
  const start = coerceDate(startRaw);
  const end = coerceDate(endRaw);
  if (!start || !end) return undefined;
  return start.getTime() <= end.getTime() ? { start, end } : { start: end, end: start };
}

/**
 * dateRange — a span with distinct start/end. This is the richest `toInterval`
 * source: the gantt engine draws a bar from start to end; the grid renders it as a
 * formatted "start – end" string; sort/group order by start.
 */
export const dateRangeType: ColumnType<unknown, DateRangeParsed> = {
  name: "dateRange",
  parse(raw) {
    const r = coerceRange(raw);
    return r ?? typeError("not a date range", raw);
  },
  format(parsed, schema) {
    const f = (schema.format ?? {}) as DateFormatSpec;
    const opts = PRESETS[f.preset ?? "dateShort"] ?? PRESETS.dateShort;
    const fmt = (d: Date) => {
      try {
        return new Intl.DateTimeFormat(f.locale, { ...opts, timeZone: f.timeZone }).format(d);
      } catch {
        return d.toISOString().slice(0, 10);
      }
    };
    return `${fmt(parsed.start)} – ${fmt(parsed.end)}`;
  },
  style() {
    return {};
  },
  compareKey(parsed) {
    return parsed.start.getTime();
  },
  editor() {
    return { control: "date" };
  },
  toInterval(parsed): Interval {
    return { start: parsed.start, end: parsed.end };
  },
};
