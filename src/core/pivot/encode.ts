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

function encodeField(rows: readonly PivotDataRow[], field: string): PivotFieldCodes {
  const n = rows.length;
  const codes = new Int32Array(n);
  const index = new Map<string, number>();
  const keys: string[] = [];
  const counts: number[] = [];
  // Leaf-grain data is usually sorted, so consecutive records often share a value.
  let last: unknown = undefined;
  let lastCode = -1;
  for (let i = 0; i < n; i++) {
    const v = rows[i]![field];
    let c: number;
    if (lastCode >= 0 && v === last) {
      c = lastCode;
    } else {
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
  }
  return { field, codes, keys, index, counts: Int32Array.from(counts) };
}

function numberColumn(rows: readonly PivotDataRow[], field: string): Float64Array {
  const n = rows.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = rows[i]![field];
    if (typeof v === "number") {
      out[i] = Number.isFinite(v) ? v : NaN;
    } else if (typeof v === "string" && v.trim() !== "") {
      const x = Number(v);
      out[i] = Number.isFinite(x) ? x : NaN;
    } else {
      out[i] = NaN;
    }
  }
  return out;
}

function presentColumn(rows: readonly PivotDataRow[], field: string): Uint8Array {
  const n = rows.length;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const v = rows[i]![field];
    out[i] = v !== null && v !== undefined && v !== "" ? 1 : 0;
  }
  return out;
}

function dayColumn(rows: readonly PivotDataRow[], field: string, offset: number): Int32Array {
  const n = rows.length;
  const out = new Int32Array(n);
  // Leaf-grain data is often sorted by date: consecutive equal values skip parsing.
  let last: unknown = undefined;
  let lastDay = PIVOT_INVALID_DAY;
  for (let i = 0; i < n; i++) {
    const v = rows[i]![field];
    if (i > 0 && v === last && typeof v !== "object") {
      out[i] = lastDay;
      continue;
    }
    lastDay = pivotDayOf(v, offset);
    last = v;
    out[i] = lastDay;
  }
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
  const daysOf = (field: string, offset = 0): Int32Array => {
    const key = `${field}\u0000${offset}`;
    let hit = days.get(key);
    if (!hit) days.set(key, (hit = dayColumn(rows, field, offset)));
    return hit;
  };
  return {
    rows,
    length: rows.length,
    codes(field) {
      let hit = codes.get(field);
      if (!hit) codes.set(field, (hit = encodeField(rows, field)));
      return hit;
    },
    numbers(field) {
      let hit = numbers.get(field);
      if (!hit) numbers.set(field, (hit = numberColumn(rows, field)));
      return hit;
    },
    present(field) {
      let hit = present.get(field);
      if (!hit) present.set(field, (hit = presentColumn(rows, field)));
      return hit;
    },
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
