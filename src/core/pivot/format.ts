import type { PivotNumberFormat } from "./types";

const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = {
  USD: "$",
  CAD: "CA$",
  AUD: "A$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "CN¥",
  KRW: "₩",
  INR: "₹",
  VND: "₫",
  SGD: "S$",
  CHF: "CHF ",
  SEK: "SEK ",
  NOK: "NOK ",
  DKK: "DKK ",
};

const DEFAULT_COMPACT_UNITS = ["k", "M", "B", "T"] as const;

export const DEFAULT_PIVOT_PERCENT_FORMAT: PivotNumberFormat = { style: "percent" };

export const DEFAULT_PIVOT_DELTA_FORMAT: PivotNumberFormat = {
  style: "percent",
  decimals: 1,
  signDisplay: "exceptZero",
};

export function pivotCurrencySymbol(fmt: PivotNumberFormat): string {
  if (fmt.currencySymbol !== undefined) return fmt.currencySymbol;
  if (!fmt.currency) return "$";
  const code = fmt.currency.toUpperCase();
  return CURRENCY_SYMBOLS[code] ?? `${code} `;
}

/** Coerce finite numbers and numeric strings; everything else is `null`. */
export function toPivotNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Round half away from zero (stable across runtimes, unlike `toFixed`). */
export function roundHalfAway(value: number, decimals: number): number {
  const f = 10 ** decimals;
  const scaled = Math.abs(value) * f;
  // Nudge by a relative epsilon so 1.005 rounds to 1.01.
  const rounded = Math.round(scaled + scaled * Number.EPSILON) / f;
  return value < 0 ? -rounded : rounded;
}

function integerDigits(abs: number): number {
  return abs >= 1 ? Math.floor(Math.log10(abs)) + 1 : 1;
}

function groupInteger(intPart: string, sep: string): string {
  if (sep === "" || intPart.length <= 3) return intPart;
  let out = "";
  for (let i = 0; i < intPart.length; i++) {
    if (i > 0 && (intPart.length - i) % 3 === 0) out += sep;
    out += intPart[i];
  }
  return out;
}

function digitsToString(abs: number, decimals: number, trim: boolean, fmt: PivotNumberFormat): string {
  let s = abs.toFixed(decimals);
  if (trim && s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  const [intPart, frac] = s.split(".");
  const grouped = groupInteger(intPart!, fmt.groupSeparator ?? ",");
  return frac ? `${grouped}${fmt.decimalSeparator ?? "."}${frac}` : grouped;
}

/**
 * Deterministic number → string (no `Intl`). Examples:
 * `{ style: "currency", currency: "USD", compact: true }` → `$302k`, `$4.76M`;
 * `{ style: "percent", decimals: 1, signDisplay: "exceptZero" }` → `+5.5%`.
 */
export function formatPivotNumber(value: unknown, fmt: PivotNumberFormat = {}): string {
  const n = toPivotNumber(value);
  if (n === null) return fmt.empty ?? "";

  const style = fmt.style ?? "decimal";
  const v = style === "percent" ? n * 100 : n;
  let abs = Math.abs(v);
  let unit = "";

  let decimals: number;
  let trim: boolean;
  if (fmt.compact && style !== "percent") {
    const units = fmt.compactUnits ?? DEFAULT_COMPACT_UNITS;
    const sig = fmt.significantDigits ?? 3;
    let tier = abs >= 1e12 ? 4 : abs >= 1e9 ? 3 : abs >= 1e6 ? 2 : abs >= 1e3 ? 1 : 0;
    const scale = (t: number) => abs / 1000 ** t;
    const decFor = (x: number) => fmt.decimals ?? Math.max(0, sig - integerDigits(x));
    let scaled = scale(tier);
    let rounded = roundHalfAway(scaled, decFor(scaled));
    // 999.96k → 1000k: bump to the next unit.
    if (rounded >= 1000 && tier < 4) {
      tier += 1;
      scaled = scale(tier);
      rounded = roundHalfAway(scaled, decFor(scaled));
    }
    decimals = decFor(scaled);
    trim = fmt.decimals === undefined;
    abs = rounded;
    unit = tier > 0 ? units[tier - 1]! : "";
  } else {
    decimals = fmt.decimals ?? (style === "decimal" ? 2 : 0);
    trim = fmt.decimals === undefined && style === "decimal";
    abs = Math.abs(roundHalfAway(v, decimals));
  }

  const isZero = abs === 0;
  const negative = v < 0 && !isZero;
  const body =
    (fmt.prefix ?? "") +
    (style === "currency" ? pivotCurrencySymbol(fmt) : "") +
    digitsToString(abs, decimals, trim, fmt) +
    unit +
    (style === "percent" ? "%" : "") +
    (fmt.suffix ?? "");

  const signDisplay = fmt.signDisplay ?? "auto";
  if (negative && signDisplay !== "never") {
    return fmt.negative === "parentheses" ? `(${body})` : `-${body}`;
  }
  if (!negative && (signDisplay === "always" || (signDisplay === "exceptZero" && !isZero))) {
    return `+${body}`;
  }
  return body;
}

function excelLiteral(s: string): string {
  return s === "" ? "" : `"${s.replace(/"/g, "")}"`;
}

/**
 * Best-effort Excel `numFmt` for a pivot format, so XLSX exports keep numbers numeric.
 * Compact formats use Excel's thousands-scaling commas and only abbreviate positive values.
 */
export function toExcelNumFmt(fmt: PivotNumberFormat = {}): string {
  const style = fmt.style ?? "decimal";
  const decimals = fmt.decimals ?? (style === "decimal" ? 2 : 0);
  const digits = (d: number) => (d > 0 ? `#,##0.${"0".repeat(d)}` : "#,##0");
  const pre = excelLiteral((fmt.prefix ?? "") + (style === "currency" ? pivotCurrencySymbol(fmt) : ""));
  const post = (style === "percent" ? "%" : "") + excelLiteral(fmt.suffix ?? "");

  if (fmt.compact && style !== "percent") {
    const units = fmt.compactUnits ?? DEFAULT_COMPACT_UNITS;
    const d = fmt.decimals ?? 1;
    return [
      `[>=1000000]${pre}${digits(d)},,${excelLiteral(units[1])}${post}`,
      `[>=1000]${pre}${digits(fmt.decimals ?? 0)},${excelLiteral(units[0])}${post}`,
      `${pre}${digits(fmt.decimals ?? 0)}${post}`,
    ].join(";");
  }

  const base = `${pre}${digits(decimals)}${post}`;
  const neg = fmt.negative === "parentheses" ? `(${base})` : `-${base}`;
  switch (fmt.signDisplay ?? "auto") {
    case "always":
      return `+${base};${neg};+${base}`;
    case "exceptZero":
      return `+${base};${neg};${base}`;
    case "never":
      return `${base};${base}`;
    default:
      return fmt.negative === "parentheses" ? `${base};${neg}` : base;
  }
}
