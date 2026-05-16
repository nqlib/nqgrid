import { effectiveNumberStyle } from "./normalize-rich-schema";
import type {
  FormulaPresentation,
  RichDateFormatOptions,
  RichNumberFormatOptions,
  RichPercentFormatOptions,
  RichPerson,
  RichStatusMapEntry,
} from "./rich-schema";

/** Map unified or legacy percent options for Intl / battery helpers. */
export function percentOptsFromNumberOrLegacy(
  opts?: RichNumberFormatOptions | RichPercentFormatOptions,
): RichPercentFormatOptions | undefined {
  if (!opts) return undefined;
  if ("display" in opts && !("style" in opts)) {
    return opts as RichPercentFormatOptions;
  }
  const n = opts as RichNumberFormatOptions;
  return {
    locale: n.locale,
    valueScale: n.valueScale,
    display: n.percentDisplay,
    suffix: n.suffix,
    minimumFractionDigits: n.minimumFractionDigits,
    maximumFractionDigits: n.maximumFractionDigits,
    roundWhole: n.roundWhole,
  };
}

export function getByPath(obj: unknown, path: string): unknown {
  if (obj == null || path.length === 0) return undefined;
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function coerceNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim().length > 0) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  if (typeof v === "bigint") return Number(v);
  return undefined;
}

export function coerceDate(v: unknown): Date | undefined {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  if (typeof v === "string" && v.length > 0) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

export function normalizePercentToHundred(
  raw: unknown,
  opts?: RichNumberFormatOptions | RichPercentFormatOptions,
): number | undefined {
  const p = percentOptsFromNumberOrLegacy(opts);
  const n = coerceNumber(raw);
  if (n == null) return undefined;
  const scale = p?.valueScale ?? "hundred";
  const v = scale === "ratio" ? n * 100 : n;
  if (!Number.isFinite(v)) return undefined;
  return Math.min(100, Math.max(0, v));
}

export function formatNumberValue(value: unknown, opts?: RichNumberFormatOptions, empty = ""): string {
  const style = effectiveNumberStyle(opts);
  if (style === "currency") {
    return formatCurrencyValue(
      value,
      opts?.currency ?? "USD",
      opts?.locale,
      opts?.minimumFractionDigits,
      opts?.maximumFractionDigits,
      empty,
    );
  }
  if (style === "percent") {
    return formatPercentPlain(value, percentOptsFromNumberOrLegacy(opts), empty).text;
  }

  const n = coerceNumber(value);
  if (n == null) return empty;
  const locale = opts?.locale;
  try {
    const fmt = new Intl.NumberFormat(locale, {
      notation: opts?.notation,
      ...(opts?.notation === "compact" && opts.compactDisplay
        ? { compactDisplay: opts.compactDisplay }
        : {}),
      minimumFractionDigits: opts?.minimumFractionDigits,
      maximumFractionDigits: opts?.maximumFractionDigits,
      ...(opts?.roundingMode != null ? { roundingMode: opts.roundingMode } : {}),
    } as Intl.NumberFormatOptions);
    const core = fmt.format(n);
    return `${opts?.prefix ?? ""}${core}${opts?.suffix ?? ""}`;
  } catch {
    const core = String(n);
    return `${opts?.prefix ?? ""}${core}${opts?.suffix ?? ""}`;
  }
}

export function formatCurrencyValue(
  value: unknown,
  currency: string,
  locale?: string,
  min?: number,
  max?: number,
  empty = "",
): string {
  const n = coerceNumber(value);
  if (n == null) return empty;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    }).format(n);
  } catch {
    return `${currency} ${n}`;
  }
}

export function formatPercentPlain(
  value: unknown,
  opts?: RichNumberFormatOptions | RichPercentFormatOptions,
  empty = "",
): { text: string; hundred: number | undefined } {
  const legacy = percentOptsFromNumberOrLegacy(opts);
  const hundred = normalizePercentToHundred(value, opts);
  if (hundred == null) return { text: empty, hundred: undefined };
  const locale = legacy?.locale;
  const suffix = legacy?.suffix ?? "%";
  if (legacy?.roundWhole) {
    return { text: `${Math.round(hundred)}${suffix}`, hundred };
  }
  try {
    const fmt = new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: legacy?.minimumFractionDigits,
      maximumFractionDigits: legacy?.maximumFractionDigits,
    });
    const ratio = (legacy?.valueScale ?? "hundred") === "hundred" ? hundred / 100 : coerceNumber(value) ?? 0;
    return { text: fmt.format(ratio), hundred };
  } catch {
    return { text: `${hundred.toFixed(0)}${suffix}`, hundred };
  }
}

function resolveDateIntlOptions(fmt: RichDateFormatOptions): {
  options: Intl.DateTimeFormatOptions;
  locale?: string;
  timeZone?: string;
} {
  if ("intl" in fmt && fmt.intl) {
    return { options: fmt.intl, locale: fmt.locale, timeZone: fmt.timeZone };
  }
  const preset = ("preset" in fmt ? fmt.preset : undefined) ?? "dateShort";
  const locale = "locale" in fmt ? fmt.locale : undefined;
  const timeZone = "timeZone" in fmt ? fmt.timeZone : undefined;
  const map: Record<string, Intl.DateTimeFormatOptions> = {
    dateShort: { dateStyle: "short" },
    dateMedium: { dateStyle: "medium" },
    datetimeShort: { dateStyle: "short", timeStyle: "short" },
    timeShort: { timeStyle: "short" },
  };
  return { options: map[preset] ?? map.dateShort, locale, timeZone };
}

export function mergeRichDateFormatLocale(
  fmt: RichDateFormatOptions | undefined,
  defaultLocale?: string,
): RichDateFormatOptions | undefined {
  if (!fmt && !defaultLocale) return fmt;
  if (!fmt) return { preset: "dateShort", locale: defaultLocale };
  const loc = "locale" in fmt && fmt.locale != null && fmt.locale !== "" ? fmt.locale : defaultLocale;
  return { ...fmt, locale: loc };
}

export function formatDateValue(value: unknown, fmt?: RichDateFormatOptions, empty = ""): string {
  const d = coerceDate(value);
  if (!d) return empty;
  const spec = fmt ?? { preset: "dateShort" };
  const { options, locale, timeZone } = resolveDateIntlOptions(spec);
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(d);
  } catch {
    return d.toISOString();
  }
}

export function resolveStatusEntry(
  raw: unknown,
  map: Readonly<Record<string, RichStatusMapEntry>>,
  fallback?: RichStatusMapEntry,
): RichStatusMapEntry {
  const key = raw == null ? "" : String(raw);
  const hit = map[key];
  if (hit) return hit;
  return fallback ?? { label: key || "—", variant: "outline" };
}

export function normalizePeopleList(raw: unknown): readonly RichPerson[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is RichPerson => x != null && typeof x === "object" && "name" in x && typeof (x as RichPerson).name === "string") as readonly RichPerson[];
  }
  if (typeof raw === "object" && raw !== null && "name" in raw && typeof (raw as RichPerson).name === "string") {
    return [raw as RichPerson];
  }
  return [];
}

/** Stable option / combobox key: `id` when present, otherwise `name`. */
export function richPersonOptionKey(person: RichPerson): string {
  if (person.id != null && String(person.id).length > 0) return String(person.id);
  return person.name;
}

export function resolveRichPeopleByOptionKeys(options: readonly RichPerson[], keys: readonly string[]): RichPerson[] {
  const lookup = new Map(options.map((p) => [richPersonOptionKey(p), p]));
  const out: RichPerson[] = [];
  for (const k of keys) {
    const h = lookup.get(k);
    if (h) out.push(h);
  }
  return out;
}

/**
 * Maps each selected person to the matching roster entry so combobox keys stay stable (`id` vs `name`).
 * Matches by {@link richPersonOptionKey} first, then by exact `name`.
 */
export function reconcileRichPeopleWithRoster(
  selected: readonly RichPerson[],
  roster: readonly RichPerson[],
): RichPerson[] {
  const byKey = new Map(roster.map((p) => [richPersonOptionKey(p), p]));
  const byName = new Map(roster.map((p) => [p.name, p]));
  return selected.map((p) => byKey.get(richPersonOptionKey(p)) ?? byName.get(p.name) ?? p);
}

export function avatarSrc(p: RichPerson): string | undefined {
  return p.avatarUrl ?? p.image;
}

export function initials(name: string, max = 2): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, max)
    .toUpperCase();
}

export function formatFormulaValue(raw: unknown, presentation: FormulaPresentation, emptyFallback: string): string {
  switch (presentation.type) {
    case "text": {
      if (raw == null) return presentation.empty ?? emptyFallback;
      let s = String(raw);
      if (presentation.maxLength != null) s = s.slice(0, presentation.maxLength);
      return s;
    }
    case "number":
      return formatNumberValue(raw, presentation.format, presentation.empty ?? emptyFallback);
    case "currency":
      return formatNumberValue(
        raw,
        {
          style: "currency",
          currency: presentation.currency,
          locale: presentation.locale,
          minimumFractionDigits: presentation.minimumFractionDigits,
          maximumFractionDigits: presentation.maximumFractionDigits,
        },
        presentation.empty ?? emptyFallback,
      );
    case "percent": {
      const f = presentation.format;
      return formatNumberValue(
        raw,
        {
          style: "percent",
          locale: f?.locale,
          valueScale: f?.valueScale,
          percentDisplay: f?.display,
          suffix: f?.suffix,
          minimumFractionDigits: f?.minimumFractionDigits,
          maximumFractionDigits: f?.maximumFractionDigits,
          roundWhole: f?.roundWhole,
        },
        presentation.empty ?? emptyFallback,
      );
    }
    case "date":
      return formatDateValue(raw, presentation.format, presentation.empty ?? emptyFallback);
    case "status":
    case "tag": {
      const e = resolveStatusEntry(raw, presentation.map, presentation.fallback);
      return e.label;
    }
    case "people": {
      const list = normalizePeopleList(raw);
      if (list.length === 0) return presentation.empty ?? emptyFallback;
      return list
        .slice(0, presentation.max ?? 6)
        .map((p) => p.name)
        .join(", ");
    }
    default:
      return raw == null ? emptyFallback : String(raw);
  }
}
