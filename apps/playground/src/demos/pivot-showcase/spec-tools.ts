import { validatePivotSpec, type PivotDataRow, type PivotSpec } from "@nqlib/nqgrid/core";

/** Result of the Validate panel: JSON parse error, schema / referential errors, or a valid spec. */
export type SpecTextCheck =
  | { readonly kind: "empty" }
  | { readonly kind: "parse"; readonly message: string }
  | { readonly kind: "invalid"; readonly errors: readonly string[] }
  | { readonly kind: "ok"; readonly spec: PivotSpec };

export function formatSpec(spec: unknown): string {
  return JSON.stringify(spec, null, 2);
}

/** Parse the textarea and run `validatePivotSpec` (strict: unknown keys and half-ignored options fail). */
export function checkSpecText(text: string): SpecTextCheck {
  if (!text.trim()) return { kind: "empty" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { kind: "parse", message: (error as Error).message };
  }
  const result = validatePivotSpec(parsed);
  return result.ok ? { kind: "ok", spec: result.spec } : { kind: "invalid", errors: result.errors };
}

/**
 * A spec that a lenient validator would have accepted and half-ignored: an unknown root key, an
 * unknown measure option, and `keepEmpty` on a row dimension (only columns keep empty keys).
 */
export function badSpecFrom(spec: PivotSpec): Record<string, unknown> {
  const [first, ...rest] = spec.rows;
  const [measure, ...measures] = spec.measures;
  return {
    ...spec,
    colour: "teal",
    rows: first ? [{ ...first, keepEmpty: true }, ...rest] : spec.rows,
    measures: measure ? [{ ...measure, thousands: true }, ...measures] : spec.measures,
  };
}

/** Values a CSV or an accounting export would hand you; the engine reports them instead of guessing. */
export const BAD_VALUES = ["1,234.50", "(500)", "12 EUR"] as const;

/** Field "Inject bad values" writes into: the first plain `sum`-like measure in `values`. */
export function badValueFieldOf(spec: PivotSpec): string | undefined {
  const ids = spec.values ?? spec.measures.map((m) => m.id);
  for (const id of ids) {
    const m = spec.measures.find((x) => x.id === id);
    if (!m || !m.field || m.calculate) continue;
    const agg = m.aggregate;
    if (agg === "count" || agg === "distinctCount" || (agg !== undefined && typeof agg !== "string")) continue;
    return m.field;
  }
  return undefined;
}

/** A copy of `rows` whose first records carry `values` (default `BAD_VALUES`) in `field` (the input is not mutated). */
export function injectBadValues(rows: readonly PivotDataRow[], field: string, values: readonly string[] = BAD_VALUES): PivotDataRow[] {
  const next = rows.slice();
  values.forEach((value, i) => {
    if (i < next.length) next[i] = { ...next[i]!, [field]: value };
  });
  return next;
}

/** Top-level spec keys whose value differs from the scenario's starting spec (view state included). */
export function changedSpecKeys(initial: PivotSpec, current: PivotSpec): string[] {
  const keys = new Set([...Object.keys(initial), ...Object.keys(current)]);
  const a = initial as unknown as Record<string, unknown>;
  const b = current as unknown as Record<string, unknown>;
  return [...keys].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort();
}
