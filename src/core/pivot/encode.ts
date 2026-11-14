import {
  pivotDateKeyId,
  pivotDateKeyOfPeriod,
  pivotDatePeriodId,
  pivotDayOf,
  PIVOT_INVALID_DAY,
  resolvePivotDateField,
  type PivotDateFieldDef,
} from "./dates";
import type { PivotDataRow, PivotSpec } from "./types";

/** Dictionary-encoded field: `keys[codes[i]]` is row `i`'s key (`null` / `undefined` → `""`). */
export interface PivotFieldCodes {
  readonly field: string;
  readonly codes: Int32Array;
  /** Distinct keys in first-seen order. */
  readonly keys: readonly string[];
  readonly index: ReadonlyMap<string, number>;
  /** Records per key (unfiltered). */
  readonly counts: Int32Array;
}

/** One example value for a diagnostic: input record index (0-based) and the value as text. */
export interface PivotValueSample {
  readonly row: number;
  readonly value: string;
}

/** Most samples kept per field and problem (diagnostics stay small whatever the input size). */
export const PIVOT_DIAGNOSTIC_SAMPLES = 5;

/**
 * Data-quality counts gathered while a field is encoded (no extra pass over the records). Each
 * part is present once the matching column was read: `numbers` by `numbers(field)`, `keys` by
 * `codes(field)`, `dates` by `days(field)`.
 */
export interface PivotFieldStats {
  /** Records without the field (`undefined`); equals the record count when no record has it. */
  readonly missing: number;
  /** Non-blank values that are not finite numbers or plain numeric strings (they aggregate as no value). */
  readonly numbers?: { readonly unparsed: number; readonly samples: readonly PivotValueSample[] };
  /** Records whose value has another JS type than the first non-blank value (e.g. `2024` and `"2024"`). */
  readonly keys?: { readonly mixed: number; readonly types: readonly string[]; readonly samples: readonly PivotValueSample[] };
  /** Non-blank values that do not parse as dates (they group as `(blank)`). */
  readonly dates?: { readonly invalid: number; readonly samples: readonly PivotValueSample[] };
}

/** Text of a sample value (`"1,234.50"`, `true`, `NaN`), at most 40 characters. */
const sampleText = (v: unknown): string => {
  const t = typeof v === "string" ? JSON.stringify(v) : v instanceof Date ? v.toISOString() : String(v);
  return t.length > 40 ? `${t.slice(0, 39)}…` : t;
};

/**
 * `0x10`, `0b11`, `0o7`: `Number()` reads radix literals, which no data export means as amounts.
 * `t` is trimmed and parses to a finite number already.
 */
export const isPivotRadixLiteral = (t: string): boolean => {
  if (t.length < 3 || t.charCodeAt(0) !== 48) return false;
  const c = t.charCodeAt(1) | 32;
  return c === 120 || c === 98 || c === 111;
};

/**
 * Column-oriented view of the input records, computed lazily and at most once per field:
 * key codes for dimension / filter / facet fields, `Float64Array` numbers (`NaN` = no value)
 * for measure fields. `buildPivotModel` scans records through this, so `String()` and
 * `toPivotNumber` run once per record per field instead of once per aggregation.
 *
 * Reuse one encoding across builds of the same `rows` (`createPivotModelBuilder` does) to skip
 * re-encoding when only filters, sorting or view state change. Treat `rows` as immutable.
 */
export interface PivotRowEncoding {
  readonly rows: readonly PivotDataRow[];
  readonly length: number;
  codes(field: string): PivotFieldCodes;
  numbers(field: string): Float64Array;
  /** `1` where the field is non-null, non-undefined and not `""` (for `count` with a field). */
  present(field: string): Uint8Array;
  /** Data-quality counts of `field` gathered so far (see `PivotFieldStats`); `undefined` before any column of it was read. */
  stats(field: string): PivotFieldStats | undefined;
  /**
   * Wall-clock day numbers of a date field (`PIVOT_INVALID_DAY` for missing / invalid values), parsed
   * once per (field, offset): see `pivotDayOf`.
   */
  days(field: string, timeZoneOffsetMinutes?: number): Int32Array;
  /**
   * Key codes of a derived date field (`orderDate:year`), computed once per (source, group, fiscal
   * year start, offset) from `days`: one period id per record, one key string per distinct period.
   */
  dateCodes(def: PivotDateFieldDef): PivotFieldCodes;
}

/** Key string of a record value: `null` / `undefined` → `""`, otherwise `String(v)`. */
export function pivotKeyOf(value: unknown): string {
  return value === null || value === undefined ? "" : typeof value === "string" ? value : String(value);
}

type MutableStats = { -readonly [K in keyof PivotFieldStats]: PivotFieldStats[K] };

function encodeField(rows: readonly PivotDataRow[], field: string, stats: MutableStats): PivotFieldCodes {
  const n = rows.length;
  const codes = new Int32Array(n);
  const index = new Map<string, number>();
  const keys: string[] = [];
  const counts: number[] = [];
  // Leaf-grain data is usually sorted, so consecutive records often share a value.
  let last: unknown = undefined;
  let lastCode = -1;
  // Diagnostics: flags of the last distinct value, summed on every record (two additions).
  let missing = 0;
  let lastMissing = 0;
  let mixed = 0;
  let lastMixed = 0;
  let firstType: string | undefined;
  const types: string[] = [];
  const samples: PivotValueSample[] = [];
  for (let i = 0; i < n; i++) {
    const v = rows[i]![field];
    let c: number;
    if (lastCode >= 0 && v === last) {
      c = lastCode;
    } else {
      lastMissing = v === undefined ? 1 : 0;
      lastMixed = 0;
      if (v !== undefined && v !== null && v !== "") {
        const t = typeof v;
        if (firstType === undefined) {
          firstType = t;
          types.push(t);
        } else if (t !== firstType) {
          lastMixed = 1;
          if (!types.includes(t)) types.push(t);
          if (samples.length < PIVOT_DIAGNOSTIC_SAMPLES) samples.push({ row: i, value: sampleText(v) });
        }
      }
      const k = v === null || v === undefined ? "" : typeof v === "string" ? v : String(v);
      const hit = index.get(k);
      if (hit === undefined) {
        c = keys.length;
        index.set(k, c);
        keys.push(k);
        counts.push(0);
      } else {
        c = hit;
      }
      last = v;
      lastCode = c;
    }
    codes[i] = c;
    counts[c]!++;
    missing += lastMissing;
    mixed += lastMixed;
  }
  stats.missing = missing;
  stats.keys = { mixed, types, samples };
  return { field, codes, keys, index, counts: Int32Array.from(counts) };
}

function numberColumn(rows: readonly PivotDataRow[], field: string, stats: MutableStats): Float64Array {
  const n = rows.length;
  const out = new Float64Array(n);
  let missing = 0;
  let unparsed = 0;
  const samples: PivotValueSample[] = [];
  const bad = (i: number, v: unknown) => {
    unparsed++;
    if (samples.length < PIVOT_DIAGNOSTIC_SAMPLES) samples.push({ row: i, value: sampleText(v) });
    out[i] = NaN;
  };
  for (let i = 0; i < n; i++) {
    const v = rows[i]![field];
    if (typeof v === "number") {
      if (v - v === 0) out[i] = v; // finite
      else bad(i, v);
    } else if (typeof v === "string") {
      const t = v.trim();
      if (t === "") {
        out[i] = NaN;
        continue;
      }
      const x = Number(t);
      if (x - x === 0 && !isPivotRadixLiteral(t)) out[i] = x;
      else bad(i, v);
    } else if (v === undefined) {
      missing++;
      out[i] = NaN;
    } else if (v === null) {
      out[i] = NaN;
    } else {
      bad(i, v);
    }
  }
  stats.missing = missing;
  stats.numbers = { unparsed, samples };
  return out;
}

function presentColumn(rows: readonly PivotDataRow[], field: string, stats: MutableStats): Uint8Array {
  const n = rows.length;
  const out = new Uint8Array(n);
  let missing = 0;
  for (let i = 0; i < n; i++) {
    const v = rows[i]![field];
    out[i] = v !== null && v !== undefined && v !== "" ? 1 : 0;
    if (v === undefined) missing++;
  }
  stats.missing = missing;
  return out;
}

function dayColumn(rows: readonly PivotDataRow[], field: string, offset: number, stats: MutableStats): Int32Array {
  const n = rows.length;
  const out = new Int32Array(n);
  // Leaf-grain data is often sorted by date: consecutive equal values skip parsing.
  let last: unknown = undefined;
  let lastDay = PIVOT_INVALID_DAY;
  let missing = 0;
  let lastMissing = 0;
  let invalid = 0;
  let lastInvalid = 0;
  const samples: PivotValueSample[] = [];
  for (let i = 0; i < n; i++) {
    const v = rows[i]![field];
    if (i > 0 && v === last && typeof v !== "object") {
      out[i] = lastDay;
      invalid += lastInvalid;
      missing += lastMissing;
      continue;
    }
    lastDay = pivotDayOf(v, offset);
    last = v;
    out[i] = lastDay;
    lastInvalid = 0;
    lastMissing = v === undefined ? 1 : 0;
    missing += lastMissing;
    if (lastDay === PIVOT_INVALID_DAY && v !== undefined && v !== null && v !== "") {
      lastInvalid = 1;
      invalid++;
      if (samples.length < PIVOT_DIAGNOSTIC_SAMPLES) samples.push({ row: i, value: sampleText(v) });
    }
  }
  stats.missing = missing;
  stats.dates = { invalid, samples };
  return out;
}

/** Period ids per record, then dense (or `Map`-backed) id → code assignment in first-seen order. */
function dateCodesColumn(days: Int32Array, def: PivotDateFieldDef): PivotFieldCodes {
  const n = days.length;
  const group = def.group;
  const start = def.fiscalYearStartMonth;
  const ids = new Float64Array(n);
  let min = Infinity;
  let max = -Infinity;
  let lastDay = PIVOT_INVALID_DAY;
  let lastId = NaN;
  for (let i = 0; i < n; i++) {
    const day = days[i]!;
    if (day === PIVOT_INVALID_DAY) {
      ids[i] = NaN;
      continue;
    }
    if (day !== lastDay) {
      lastDay = day;
      lastId = pivotDatePeriodId(day, group, start);
      if (lastId < min) min = lastId;
      if (lastId > max) max = lastId;
    }
    ids[i] = lastId;
  }
  const codes = new Int32Array(n);
  const keys: string[] = [];
  const index = new Map<string, number>();
  const counts: number[] = [];
  const codeOfKey = (key: string): number => {
    let c = index.get(key);
    if (c === undefined) {
      c = keys.length;
      index.set(key, c);
      keys.push(key);
      counts.push(0);
    }
    return c;
  };
  const span = max - min;
  const dense = span >= 0 && span <= 1 << 20 ? new Int32Array(span + 1).fill(-1) : null;
  const sparse = dense ? null : new Map<number, number>();
  let blank = -1;
  for (let i = 0; i < n; i++) {
    const id = ids[i]!;
    let c: number;
    if (id !== id) {
      c = blank < 0 ? (blank = codeOfKey("")) : blank;
    } else if (dense) {
      c = dense[id - min]!;
      if (c < 0) dense[id - min] = c = codeOfKey(pivotDateKeyOfPeriod(id, group));
    } else {
      const hit = sparse!.get(id);
      if (hit === undefined) sparse!.set(id, (c = codeOfKey(pivotDateKeyOfPeriod(id, group))));
      else c = hit;
    }
    codes[i] = c;
    counts[c]!++;
  }
  return { field: def.field, codes, keys, index, counts: Int32Array.from(counts) };
}

/** Lazy, memoized column encoding of `rows` (see `PivotRowEncoding`). */
export function createPivotRowEncoding(rows: readonly PivotDataRow[]): PivotRowEncoding {
  const codes = new Map<string, PivotFieldCodes>();
  const numbers = new Map<string, Float64Array>();
  const present = new Map<string, Uint8Array>();
  const days = new Map<string, Int32Array>();
  const dates = new Map<string, PivotFieldCodes>();
  const stats = new Map<string, MutableStats>();
  const statsOf = (field: string): MutableStats => {
    let hit = stats.get(field);
    if (!hit) stats.set(field, (hit = { missing: 0 }));
    return hit;
  };
  const daysOf = (field: string, offset = 0): Int32Array => {
    const key = `${field}\u0000${offset}`;
    let hit = days.get(key);
    if (!hit) days.set(key, (hit = dayColumn(rows, field, offset, statsOf(field))));
    return hit;
  };
  return {
    rows,
    length: rows.length,
    codes(field) {
      let hit = codes.get(field);
      if (!hit) codes.set(field, (hit = encodeField(rows, field, statsOf(field))));
      return hit;
    },
    numbers(field) {
      let hit = numbers.get(field);
      if (!hit) numbers.set(field, (hit = numberColumn(rows, field, statsOf(field))));
      return hit;
    },
    present(field) {
      let hit = present.get(field);
      if (!hit) present.set(field, (hit = presentColumn(rows, field, statsOf(field))));
      return hit;
    },
    stats: (field) => stats.get(field),
    days: daysOf,
    dateCodes(def) {
      const key = pivotDateKeyId(def);
      let hit = dates.get(key);
      if (!hit) dates.set(key, (hit = dateCodesColumn(daysOf(def.source, def.timeZoneOffsetMinutes), def)));
      return hit.field === def.field ? hit : { ...hit, field: def.field };
    },
  };
}

/**
 * `encoding` as seen by `spec`: `codes(field)` resolves derived date fields (`orderDate:year`, or
 * catalogue entries with `source` + `dateGroup`) to `dateCodes`; everything else passes through.
 * The cube, filters and facets read records through this, so date fields work everywhere a key
 * field does.
 */
export function pivotSpecEncoding(encoding: PivotRowEncoding, spec: Pick<PivotSpec, "fields">): PivotRowEncoding {
  const defs = new Map<string, PivotDateFieldDef | null>();
  const defOf = (field: string): PivotDateFieldDef | null => {
    let def = defs.get(field);
    if (def === undefined) defs.set(field, (def = resolvePivotDateField(spec, field)));
    return def;
  };
  const present = new Map<string, Uint8Array>();
  return {
    ...encoding,
    codes: (field) => {
      const def = defOf(field);
      return def ? encoding.dateCodes(def) : encoding.codes(field);
    },
    present: (field) => {
      const def = defOf(field);
      if (!def) return encoding.present(field);
      let hit = present.get(field);
      if (!hit) {
        const c = encoding.dateCodes(def);
        const blank = c.index.get("") ?? -1;
        hit = new Uint8Array(c.codes.length);
        for (let i = 0; i < hit.length; i++) hit[i] = c.codes[i] === blank ? 0 : 1;
        present.set(field, hit);
      }
      return hit;
    },
  };
}
