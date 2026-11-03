import { findPivotCalcCycles, parsePivotCalc, type PivotCalcError } from "./calc";
import { pivotColumnFields } from "./columns";
import { pivotValueIds } from "./fields";
import type { PivotDimension, PivotMeasure, PivotNumberFormat, PivotShowAs, PivotShowAsBase, PivotSpec } from "./types";
import { PIVOT_SHOW_AS_WITH_BASE } from "./validate";

/**
 * Pure spec helpers for step 4 of Excel parity: calculated measures, "show values as" with a base
 * field / item, subtotal positions. Like the move helpers they return a new spec, or the same
 * object when nothing changes or the request is refused, and never produce an invalid spec.
 */

export interface PivotCalculatedMeasureInput {
  /** Measure id; default: from `label` (`Margin %` → `margin`), unique. An existing calculated measure's id updates it. */
  readonly id?: string;
  readonly label?: string;
  /** The expression (see `parsePivotCalc`), e.g. `actual / plan - 1`. */
  readonly calculate: string;
  readonly format?: PivotNumberFormat;
  /** Position in Values for a new measure (default: the end). */
  readonly index?: number;
  /** Show a new measure in Values (default true). */
  readonly addToValues?: boolean;
}

export interface PivotCalculatedMeasurePlan {
  readonly spec: PivotSpec;
  readonly changed: boolean;
  readonly measureId?: string;
  /** Why it was refused: the expression error (with `code` / `position`), or another problem. */
  readonly error?: PivotCalcError | { readonly code: "idTaken" | "cycle"; readonly message: string; readonly position: number };
}

function omit<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
  const out = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}

/** `Margin %` → `margin`, `Plan vs Actual` → `plan_vs_actual` (empty → `calc`). */
function slug(label: string): string {
  const s = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s && /^[a-z_]/.test(s) ? s : s ? `m_${s}` : "calc";
}

function uniqueId(measures: readonly PivotMeasure[], base: string): string {
  const ids = new Set(measures.map((m) => m.id));
  if (!ids.has(base)) return base;
  for (let i = 2; ; i++) if (!ids.has(`${base}_${i}`)) return `${base}_${i}`;
}

/**
 * Check an expression for the calculated measure `id` (new or existing) in `spec`: grammar, known
 * references and cycles (also a reference to itself). `null` when valid — use it for inline
 * validation in a formula input.
 */
export function checkPivotCalculatedMeasure(spec: PivotSpec, calculate: string, id?: string): PivotCalculatedMeasurePlan["error"] | null {
  // The measure itself is a known name, so a self-reference reports a cycle rather than an unknown measure.
  const ids = id === undefined ? spec.measures.map((m) => m.id) : [...spec.measures.map((m) => m.id), id];
  const parsed = parsePivotCalc(calculate, { references: ids });
  if (!parsed.ok) return parsed.error;
  if (id === undefined) return null;
  const refs = new Map<string, readonly string[]>();
  for (const m of spec.measures) {
    if (m.id === id || m.calculate === undefined) continue;
    const p = parsePivotCalc(m.calculate);
    if (p.ok) refs.set(m.id, p.references);
  }
  refs.set(id, parsed.references);
  const cycle = findPivotCalcCycles(refs).find((c) => c.includes(id));
  return cycle ? { code: "cycle", message: `reference cycle ${cycle.join(" → ")}`, position: 0 } : null;
}

/**
 * Add a calculated measure (shown in Values by default) or update an existing one (expression,
 * label, format). Refused with `error` when the expression is invalid, references an unknown
 * measure or itself (cycle), or `id` belongs to a measure that is not calculated.
 */
export function planPivotCalculatedMeasure(spec: PivotSpec, input: PivotCalculatedMeasureInput): PivotCalculatedMeasurePlan {
  const existing = input.id !== undefined ? spec.measures.find((m) => m.id === input.id) : undefined;
  if (existing && existing.calculate === undefined) {
    return { spec, changed: false, error: { code: "idTaken", message: `measure "${existing.id}" exists and is not calculated`, position: 0 } };
  }
  const id = existing ? existing.id : (input.id ?? uniqueId(spec.measures, slug(input.label ?? "calc")));
  const error = checkPivotCalculatedMeasure(spec, input.calculate, id);
  if (error) return { spec, changed: false, error };
  if (existing) {
    const next: PivotMeasure = {
      ...existing,
      calculate: input.calculate,
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.format !== undefined ? { format: input.format } : {}),
    };
    if (JSON.stringify(next) === JSON.stringify(existing)) return { spec, changed: false, measureId: id };
    return { spec: { ...spec, measures: spec.measures.map((m) => (m === existing ? next : m)) }, changed: true, measureId: id };
  }
  const measure: PivotMeasure = {
    id,
    ...(input.label !== undefined ? { label: input.label } : {}),
    calculate: input.calculate,
    ...(input.format !== undefined ? { format: input.format } : {}),
  };
  const measures = [...spec.measures, measure];
  let next: PivotSpec = { ...spec, measures };
  if (input.addToValues ?? true) {
    const values = pivotValueIds(spec);
    const at = input.index === undefined ? values.length : Math.max(0, Math.min(values.length, Math.floor(input.index)));
    values.splice(at, 0, id);
    next = { ...next, values };
  } else if (spec.values === undefined) {
    // Keep the old implicit "every measure" list explicit so the new measure stays hidden.
    next = { ...next, values: spec.measures.map((m) => m.id) };
  }
  return { spec: next, changed: true, measureId: id };
}

/** `planPivotCalculatedMeasure(...).spec`. */
export function setPivotCalculatedMeasure(spec: PivotSpec, input: PivotCalculatedMeasureInput): PivotSpec {
  return planPivotCalculatedMeasure(spec, input).spec;
}

/**
 * Delete a measure from the spec (Values, KPIs, heat / header-chart / sort / Top-N references).
 * Refused when it is the last value, or when a calculated measure references it.
 */
export function removePivotMeasure(spec: PivotSpec, measureId: string): PivotSpec {
  if (!spec.measures.some((m) => m.id === measureId)) return spec;
  for (const m of spec.measures) {
    if (m.id === measureId || m.calculate === undefined) continue;
    const p = parsePivotCalc(m.calculate);
    if (p.ok && p.references.includes(measureId)) return spec;
  }
  const values = pivotValueIds(spec).filter((id) => id !== measureId);
  if (values.length === 0) return spec;
  const measures = spec.measures.filter((m) => m.id !== measureId);
  const first = values[0]!;
  const strip = (d: PivotDimension): PivotDimension => {
    let out = d;
    if (d.sortBy?.measure === measureId) out = omit(out, "sortBy");
    if (d.topN?.measure === measureId) out = omit(out, "topN");
    return out;
  };
  let next: PivotSpec = { ...spec, measures, rows: spec.rows.map(strip) };
  const implicit = spec.values === undefined;
  next = implicit ? next : { ...next, values };
  if (spec.kpis) next = { ...next, kpis: spec.kpis.filter((k) => k.measure !== measureId && k.compareTo !== measureId) };
  if (spec.heat?.measure === measureId) next = { ...next, heat: { ...spec.heat, measure: first } };
  if (spec.headerCharts?.measure === measureId) next = { ...next, headerCharts: { ...spec.headerCharts, measure: first } };
  return next;
}

/**
 * Excel's "Show values as" for one measure. `base` is required by the difference / running-total /
 * rank kinds (a row or column field; refused otherwise) and dropped for the others. `scope`:
 * `all` (default) sets `showAs` and clears `groupShowAs`; `leaf` sets `showAs` only; `group` sets
 * `groupShowAs` only.
 */
export function setPivotMeasureShowAs(
  spec: PivotSpec,
  measureId: string,
  showAs: PivotShowAs,
  base?: PivotShowAsBase | null,
  options: { readonly scope?: "all" | "leaf" | "group" } = {},
): PivotSpec {
  const m = spec.measures.find((x) => x.id === measureId);
  if (!m) return spec;
  const needsBase = PIVOT_SHOW_AS_WITH_BASE.has(showAs);
  const fields = new Set([...spec.rows.map((d) => d.field), ...pivotColumnFields(spec).map((d) => d.field)]);
  if (needsBase && (!base || !fields.has(base.field))) return spec;
  const scope = options.scope ?? "all";
  let next: PivotMeasure = omit(m, "showAs", "groupShowAs", "showAsBase");
  const leaf = scope === "group" ? m.showAs : showAs;
  const group = scope === "all" ? undefined : scope === "leaf" ? m.groupShowAs : showAs;
  if (leaf !== undefined && leaf !== "value") next = { ...next, showAs: leaf };
  if (group !== undefined && group !== (next.showAs ?? "value")) next = { ...next, groupShowAs: group };
  const keepsBase = PIVOT_SHOW_AS_WITH_BASE.has(next.showAs ?? "") || PIVOT_SHOW_AS_WITH_BASE.has(next.groupShowAs ?? "");
  if (keepsBase) {
    const b = needsBase ? base! : m.showAsBase;
    if (b) next = { ...next, showAsBase: b };
    else return spec;
  }
  if (JSON.stringify(next) === JSON.stringify(m)) return spec;
  return { ...spec, measures: spec.measures.map((x) => (x === m ? next : x)) };
}

/**
 * Subtotal position of a row or column field's groups (Excel's "Show subtotals at top / bottom /
 * do not show"; for columns the subtotal column's position). The default of the area (`start` for
 * rows, `end` for columns) removes the key.
 */
export function setPivotSubtotal(spec: PivotSpec, field: string, position: "start" | "end" | "none"): PivotSpec {
  const update = (d: PivotDimension, fallback: "start" | "end"): PivotDimension => {
    if (d.field !== field) return d;
    if ((d.subtotal ?? fallback) === position) return d;
    return position === fallback ? omit(d, "subtotal") : { ...d, subtotal: position };
  };
  const rows = spec.rows.map((d) => update(d, "start"));
  if (rows.some((d, i) => d !== spec.rows[i])) return { ...spec, rows };
  const columns = pivotColumnFields(spec);
  const next = columns.map((d) => update(d, "end"));
  if (!next.some((d, i) => d !== columns[i])) return spec;
  return { ...spec, columns: Array.isArray(spec.columns) ? next : next[0]! };
}
