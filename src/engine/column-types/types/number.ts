import type { ColumnType } from "../contract";
import { typeError } from "../contract";

/** number `format` config keys (all optional). */
export interface NumberFormatSpec {
  readonly style?: "decimal" | "currency" | "percent";
  readonly currency?: string;
  readonly locale?: string;
  readonly minimumFractionDigits?: number;
  readonly maximumFractionDigits?: number;
  readonly prefix?: string;
  readonly suffix?: string;
  /** percent: source scale — `ratio` = 0..1, `hundred` = 0..100 (default hundred). */
  readonly valueScale?: "ratio" | "hundred";
}

function coerce(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "bigint") return Number(raw);
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** number — currency/percent are FORMAT config, not separate types (per the contract). */
export const numberType: ColumnType<unknown, number> = {
  name: "number",
  parse(raw) {
    if (raw == null || raw === "") return typeError("empty", raw);
    const n = coerce(raw);
    return n == null ? typeError("not a number", raw) : n;
  },
  format(parsed, schema) {
    const f = (schema.format ?? {}) as NumberFormatSpec;
    const style = f.style ?? "decimal";
    // prefix/suffix are general NumberFormatSpec fields — apply them uniformly
    // across every style, not just the decimal path.
    const wrap = (core: string) => `${f.prefix ?? ""}${core}${f.suffix ?? ""}`;
    try {
      if (style === "currency") {
        return wrap(
          new Intl.NumberFormat(f.locale, {
            style: "currency",
            currency: f.currency ?? "USD",
            minimumFractionDigits: f.minimumFractionDigits,
            maximumFractionDigits: f.maximumFractionDigits,
          }).format(parsed),
        );
      }
      if (style === "percent") {
        const ratio = (f.valueScale ?? "hundred") === "ratio" ? parsed : parsed / 100;
        return wrap(
          new Intl.NumberFormat(f.locale, {
            style: "percent",
            minimumFractionDigits: f.minimumFractionDigits,
            maximumFractionDigits: f.maximumFractionDigits,
          }).format(ratio),
        );
      }
      return wrap(
        new Intl.NumberFormat(f.locale, {
          minimumFractionDigits: f.minimumFractionDigits,
          maximumFractionDigits: f.maximumFractionDigits,
        }).format(parsed),
      );
    } catch {
      return wrap(String(parsed));
    }
  },
  style(parsed, schema) {
    const f = (schema.format ?? {}) as NumberFormatSpec;
    if (f.style === "percent") {
      const ratio = (f.valueScale ?? "hundred") === "ratio" ? parsed : parsed / 100;
      return { align: "right", bar: Math.min(1, Math.max(0, ratio)) };
    }
    return { align: "right" };
  },
  compareKey(parsed) {
    return parsed;
  },
  editor() {
    return { control: "number" };
  },
};
