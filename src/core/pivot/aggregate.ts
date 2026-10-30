import { toPivotNumber } from "./format";
import type { PivotAggregate, PivotDataRow } from "./types";

/** Custom aggregator registered by name (`{ type: "custom", name }`). Return `null` for "no value". */
export type PivotAggregatorFn = (
  values: readonly number[],
  rows: readonly PivotDataRow[],
) => number | null;

export type PivotAggregatorRegistry = Readonly<Record<string, PivotAggregatorFn>>;

function numbersOf(rows: readonly PivotDataRow[], field: string): number[] {
  const out: number[] = [];
  for (const r of rows) {
    const n = toPivotNumber(r[field]);
    if (n !== null) out.push(n);
  }
  return out;
}

function sum(values: readonly number[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

/**
 * Aggregate `rows` for one measure. Empty input (no rows, or no numeric values) yields `null`,
 * except `count`, which yields `0` for an empty non-null bucket.
 */
export function aggregatePivotRows(
  rows: readonly PivotDataRow[],
  aggregate: PivotAggregate | undefined,
  field: string | undefined,
  registry: PivotAggregatorRegistry = {},
): number | null {
  const agg = aggregate ?? "sum";

  if (typeof agg === "string") {
    if (agg === "count") {
      if (!field) return rows.length;
      let c = 0;
      for (const r of rows) if (r[field] !== null && r[field] !== undefined && r[field] !== "") c++;
      return c;
    }
    const values = field ? numbersOf(rows, field) : [];
    if (values.length === 0) return null;
    switch (agg) {
      case "sum":
        return sum(values);
      case "avg":
        return sum(values) / values.length;
      case "min":
        return values.reduce((a, b) => (b < a ? b : a));
      case "max":
        return values.reduce((a, b) => (b > a ? b : a));
      case "first":
        return values[0]!;
      case "last":
        return values[values.length - 1]!;
    }
  }

  switch (agg.type) {
    case "weightedAvg": {
      if (!field) return null;
      let num = 0;
      let den = 0;
      for (const r of rows) {
        const v = toPivotNumber(r[field]);
        const w = toPivotNumber(r[agg.weightField]);
        if (v === null || w === null) continue;
        num += v * w;
        den += w;
      }
      return den === 0 ? null : num / den;
    }
    case "ratio": {
      const num = numbersOf(rows, agg.numeratorField);
      const den = numbersOf(rows, agg.denominatorField);
      if (num.length === 0 || den.length === 0) return null;
      const d = sum(den);
      return d === 0 ? null : sum(num) / d + (agg.offset ?? 0);
    }
    case "custom": {
      const fn = registry[agg.name];
      if (!fn) throw new Error(`nqgrid pivot: unknown custom aggregator "${agg.name}"`);
      return fn(field ? numbersOf(rows, field) : [], rows);
    }
  }
}
