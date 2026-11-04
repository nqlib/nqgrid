import type { ColumnType, Interval } from "../contract";
import { typeError } from "../contract";

/** date `format` config keys. */
export interface DateFormatSpec {
  readonly preset?: "dateShort" | "dateMedium" | "datetimeShort" | "timeShort";
  readonly locale?: string;
  readonly timeZone?: string;
}

export const PRESETS: Record<string, Intl.DateTimeFormatOptions> = {
  dateShort: { dateStyle: "short" },
  dateMedium: { dateStyle: "medium" },
  datetimeShort: { dateStyle: "short", timeStyle: "short" },
  timeShort: { timeStyle: "short" },
};

export function coerceDate(raw: unknown): Date | undefined {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? undefined : raw;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  if (typeof raw === "string" && raw.length > 0) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

/**
 * date — a single instant. Implements `toInterval` (a zero-width span) so a date
 * column can feed a time-axis view; a number column leaves toInterval undefined and
 * the gantt engine simply ignores it.
 */
export const dateType: ColumnType<unknown, Date> = {
  name: "date",
  parse(raw) {
    const d = coerceDate(raw);
    return d ?? typeError("not a date", raw);
  },
  format(parsed, schema) {
    const f = (schema.format ?? {}) as DateFormatSpec;
    const opts = PRESETS[f.preset ?? "dateShort"] ?? PRESETS.dateShort;
    try {
      return new Intl.DateTimeFormat(f.locale, { ...opts, timeZone: f.timeZone }).format(parsed);
    } catch {
      return parsed.toISOString();
    }
  },
  style() {
    return {};
  },
  compareKey(parsed) {
    return parsed.getTime();
  },
  editor() {
    return { control: "date" };
  },
  toInterval(parsed): Interval {
    // Distinct instances: a consumer that widens a zero-width day by mutating
    // `end` (e.g. setHours(23,59,59)) must not also corrupt `start`.
    return { start: new Date(parsed.getTime()), end: new Date(parsed.getTime()) };
  },
};
