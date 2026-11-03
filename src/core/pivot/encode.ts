import type { PivotDataRow } from "./types";

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

/** Lazy, memoized column encoding of `rows` (see `PivotRowEncoding`). */
export function createPivotRowEncoding(rows: readonly PivotDataRow[]): PivotRowEncoding {
  const codes = new Map<string, PivotFieldCodes>();
  const numbers = new Map<string, Float64Array>();
  const present = new Map<string, Uint8Array>();
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
  };
}
