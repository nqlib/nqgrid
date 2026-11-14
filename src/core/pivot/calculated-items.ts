import { compilePivotCalc, findPivotCalcCycles, parsePivotCalc, type PivotCalcError, type PivotCalcProgram } from "./calc";
import type { PivotCalculatedItem, PivotDimension, PivotMeasure, PivotNumberFormat, PivotSpec } from "./types";

/**
 * Calculated items (`PivotDimension.calculatedItems`): compiled once per spec for the view stage
 * (`pivotModelFromCube`), plus pure spec helpers for the field list. Items never touch records: their
 * values come from the aggregated cube, so they are not part of `pivotSpecDataKey` and adding or editing
 * one reuses the cached cube.
 */

/** One compiled calculated item of a row dimension. */
export interface PivotItemDef {
  readonly item: PivotCalculatedItem;
  /** Index in the dimension's `calculatedItems`. */
  readonly index: number;
  readonly key: string;
  /** Formula over `refs` (`NaN` = no value); evaluates to `NaN` when the formula does not parse. */
  readonly program: PivotCalcProgram;
  /** Referenced names, in first-use order (item keys shadow data keys of the same name). */
  readonly refs: readonly string[];
  /** Data keys the item reads, directly or through other items of the dimension. */
  readonly reads: ReadonlySet<string>;
}

/** Calculated items of one row level. */
export interface PivotItemLevel {
  readonly level: number;
  readonly defs: readonly PivotItemDef[];
  readonly byKey: ReadonlyMap<string, PivotItemDef>;
}

/** Everything `pivotModelFromCube` needs for the calculated items of a spec (`null`: the spec has none). */
export interface PivotItemPlan {
  /** Per row level (`null`: no items on that level). */
  readonly levels: readonly (PivotItemLevel | null)[];
  /** Some item has `includeInTotals: true`. */
  readonly includeInTotals: boolean;
  /** Calculated measures, compiled for item rows (and totals that include items): program over `refs`. */
  readonly calcs: ReadonlyMap<string, { readonly program: PivotCalcProgram; readonly refs: readonly PivotMeasure[] }>;
}

const NAN_PROGRAM: PivotCalcProgram = () => NaN;

/** Parse an item formula: same grammar and limits as calculated measures, any key as a reference. */
export function parsePivotItemFormula(formula: unknown) {
  return parsePivotCalc(formula, { allowReservedNames: true });
}

/** Compile the calculated items of `spec` (`null` when no row dimension has any). */
export function compilePivotItemPlan(spec: PivotSpec): PivotItemPlan | null {
  if (!spec.rows.some((d) => d.calculatedItems?.length)) return null;
  let includeInTotals = false;
  const levels = spec.rows.map((d, level): PivotItemLevel | null => {
    const list = d.calculatedItems;
    if (!list?.length) return null;
    const defs: PivotItemDef[] = [];
    const byKey = new Map<string, PivotItemDef>();
    const parsedRefs = new Map<string, readonly string[]>();
    list.forEach((item, index) => {
      if (byKey.has(item.key)) return; // duplicate keys are rejected by validatePivotSpec; the first wins
      const parsed = parsePivotItemFormula(item.formula);
      const refs = parsed.ok ? parsed.references : [];
      const program = parsed.ok ? compilePivotCalc(parsed.ast, (name) => refs.indexOf(name)) : NAN_PROGRAM;
      parsedRefs.set(item.key, refs);
      if (item.includeInTotals === true) includeInTotals = true;
      const def: PivotItemDef = { item, index, key: item.key, program, refs, reads: new Set() };
      defs.push(def);
      byKey.set(item.key, def);
    });
    // Data keys read through other items (cycles are rejected by validatePivotSpec; guarded anyway).
    for (const def of defs) {
      const reads = def.reads as Set<string>;
      const seen = new Set<string>([def.key]);
      const visit = (refs: readonly string[]) => {
        for (const ref of refs) {
          if (byKey.has(ref)) {
            if (seen.has(ref)) continue;
            seen.add(ref);
            visit(parsedRefs.get(ref) ?? []);
          } else {
            reads.add(ref);
          }
        }
      };
      visit(def.refs);
    }
    return { level, defs, byKey };
  });
  const byId = new Map(spec.measures.map((m) => [m.id, m] as const));
  const calcs = new Map<string, { program: PivotCalcProgram; refs: PivotMeasure[] }>();
  for (const m of spec.measures) {
    if (m.calculate === undefined) continue;
    const parsed = parsePivotCalc(m.calculate);
    if (!parsed.ok) {
      calcs.set(m.id, { program: NAN_PROGRAM, refs: [] });
      continue;
    }
    const names = parsed.references.filter((r) => byId.has(r));
    calcs.set(m.id, { program: compilePivotCalc(parsed.ast, (name) => names.indexOf(name)), refs: names.map((r) => byId.get(r)!) });
  }
  return { levels, includeInTotals, calcs };
}

/** One entry of `orderPivotItems`: a data child, or a calculated item. */
export type PivotItemSlot<T> = { readonly node: T; readonly item?: undefined } | { readonly node?: undefined; readonly item: PivotItemDef };

/**
 * Siblings in display order with the calculated items placed: `position: "start"` items, the data
 * children (each preceded by the items `before` it and followed by the items `after` it, recursively,
 * in spec order), then `end` items and items whose anchor is missing. `shown` picks the items that
 * appear under this parent; a hidden item is not an anchor either.
 */
export function orderPivotItems<T>(
  children: readonly T[],
  keyOf: (child: T) => string,
  defs: readonly PivotItemDef[],
  shown: (def: PivotItemDef) => boolean,
): PivotItemSlot<T>[] {
  const visible = defs.filter(shown);
  if (visible.length === 0) return children.map((node) => ({ node }));
  const shownKeys = new Set(visible.map((d) => d.key));
  const childKeys = new Set(children.map(keyOf));
  const before = new Map<string, PivotItemDef[]>();
  const after = new Map<string, PivotItemDef[]>();
  const start: PivotItemDef[] = [];
  const end: PivotItemDef[] = [];
  const push = (map: Map<string, PivotItemDef[]>, key: string, def: PivotItemDef) => {
    const list = map.get(key);
    if (list) list.push(def);
    else map.set(key, [def]);
  };
  for (const def of visible) {
    const { after: a, before: b, position } = def.item;
    const anchor = a ?? b;
    if (anchor !== undefined && anchor !== def.key && (shownKeys.has(anchor) || childKeys.has(anchor))) push(a !== undefined ? after : before, anchor, def);
    else if (anchor === undefined && position === "start") start.push(def);
    else end.push(def);
  }
  const out: PivotItemSlot<T>[] = [];
  const emitted = new Set<PivotItemDef>();
  const around = (key: string, emit: () => void) => {
    for (const d of before.get(key) ?? []) emitItem(d);
    emit();
    for (const d of after.get(key) ?? []) emitItem(d);
  };
  const emitItem = (def: PivotItemDef): void => {
    if (emitted.has(def)) return;
    emitted.add(def);
    around(def.key, () => out.push({ item: def }));
  };
  for (const d of start) emitItem(d);
  for (const node of children) around(keyOf(node), () => out.push({ node }));
  for (const d of end) emitItem(d);
  // Anchors that only lead to each other (a after b, b after a): spec order, at the end.
  for (const d of visible) emitItem(d);
  return out;
}

/** `Object.entries` of an optional record as a `Map` (keys such as `__proto__` stay plain keys). */
export function pivotKeyMap<V>(record: Readonly<Record<string, V>> | undefined): Map<string, V> | null {
  if (!record) return null;
  const entries = Object.entries(record);
  return entries.length ? new Map(entries) : null;
}

// ---------------------------------------------------------------------------
// Spec helpers (field list)
// ---------------------------------------------------------------------------

export interface PivotCalculatedItemInput {
  readonly key: string;
  readonly formula: string;
  readonly label?: string;
  readonly after?: string;
  readonly before?: string;
  readonly position?: "start" | "end";
  readonly format?: PivotNumberFormat;
  readonly includeInTotals?: boolean;
}

export type PivotCalculatedItemError = PivotCalcError | { readonly code: "keyTaken" | "cycle" | "notRowField" | "emptyKey"; readonly message: string; readonly position: number };

export interface PivotCalculatedItemPlan {
  readonly spec: PivotSpec;
  readonly changed: boolean;
  readonly error?: PivotCalculatedItemError;
}

/**
 * Check a calculated item for row field `field` (new, or replacing the item `replaceKey`): the field is a
 * row field, the key is non-empty and not taken by another item, the formula parses and forms no reference
 * cycle among the field's items. `null` when valid (use it for inline validation in a formula input). Keys
 * of the data are not known here: unknown references only show up as `model.diagnostics`.
 */
export function checkPivotCalculatedItem(spec: PivotSpec, field: string, input: Pick<PivotCalculatedItemInput, "key" | "formula">, replaceKey?: string): PivotCalculatedItemError | null {
  const dim = spec.rows.find((d) => d.field === field);
  if (!dim) return { code: "notRowField", message: `"${field}" is not a row field`, position: 0 };
  const parsed = parsePivotItemFormula(input.formula);
  if (!parsed.ok) return parsed.error;
  if (input.key.length === 0) return { code: "emptyKey", message: "the item needs a name", position: 0 };
  const others = (dim.calculatedItems ?? []).filter((it) => it.key !== replaceKey);
  if (others.some((it) => it.key === input.key)) return { code: "keyTaken", message: `a calculated item "${input.key}" exists`, position: 0 };
  const refs = new Map<string, readonly string[]>();
  for (const it of others) {
    const p = parsePivotItemFormula(it.formula);
    if (p.ok) refs.set(it.key, p.references);
  }
  refs.set(input.key, parsed.references);
  const cycle = findPivotCalcCycles(refs).find((c) => c.includes(input.key));
  return cycle ? { code: "cycle", message: `reference cycle ${cycle.join(" → ")}`, position: 0 } : null;
}

const updateRow = (spec: PivotSpec, field: string, update: (d: PivotDimension) => PivotDimension): PivotSpec => ({
  ...spec,
  rows: spec.rows.map((d) => (d.field === field ? update(d) : d)),
});

/**
 * Add a calculated item to row field `field`, or replace the item `replaceKey` (renaming it also renames
 * references and anchors in the field's other items). Refused with `error` like
 * `checkPivotCalculatedItem`.
 */
export function planPivotCalculatedItem(spec: PivotSpec, field: string, input: PivotCalculatedItemInput, replaceKey?: string): PivotCalculatedItemPlan {
  const error = checkPivotCalculatedItem(spec, field, input, replaceKey);
  if (error) return { spec, changed: false, error };
  const anchor = input.after !== undefined ? { after: input.after } : input.before !== undefined ? { before: input.before } : input.position === "start" ? { position: "start" as const } : {};
  const item: PivotCalculatedItem = {
    key: input.key,
    formula: input.formula,
    ...(input.label !== undefined && input.label !== input.key ? { label: input.label } : {}),
    ...anchor,
    ...(input.format !== undefined ? { format: input.format } : {}),
    ...(input.includeInTotals ? { includeInTotals: true } : {}),
  };
  const next = updateRow(spec, field, (d) => {
    const list = d.calculatedItems ?? [];
    const at = replaceKey === undefined ? -1 : list.findIndex((it) => it.key === replaceKey);
    let items = at < 0 ? [...list, item] : list.map((it, i) => (i === at ? item : it));
    if (at >= 0 && replaceKey !== input.key) items = items.map((it) => (it === item ? it : renameItemKey(it, replaceKey!, input.key)));
    return { ...d, calculatedItems: items };
  });
  return JSON.stringify(next) === JSON.stringify(spec) ? { spec, changed: false } : { spec: next, changed: true };
}

/** `planPivotCalculatedItem(...).spec`. */
export function setPivotCalculatedItem(spec: PivotSpec, field: string, input: PivotCalculatedItemInput, replaceKey?: string): PivotSpec {
  return planPivotCalculatedItem(spec, field, input, replaceKey).spec;
}

/** Bracketed reference text for an item key (`[Cost of sales]`). */
export function pivotItemReference(key: string): string {
  return `[${key}]`;
}

function renameItemKey(item: PivotCalculatedItem, from: string, to: string): PivotCalculatedItem {
  let out = item;
  const parsed = parsePivotItemFormula(item.formula);
  if (parsed.ok && parsed.references.includes(from)) {
    // Rewrite bracketed and bare references; other text (numbers, functions, other keys) is kept.
    const bare = /^[A-Za-z_][A-Za-z0-9_]*$/.test(from);
    let formula = item.formula.split(`[${from}]`).join(pivotItemReference(to));
    if (bare) formula = formula.replace(new RegExp(`(^|[^A-Za-z0-9_\\[])${from}(?![A-Za-z0-9_\\]])`, "g"), `$1${pivotItemReference(to)}`);
    out = { ...out, formula };
  }
  if (out.after === from) out = { ...out, after: to };
  if (out.before === from) out = { ...out, before: to };
  return out;
}

/** Keys of the items of `field` whose formula or anchor reads `key`. */
export function pivotItemReferencers(spec: PivotSpec, field: string, key: string): string[] {
  const dim = spec.rows.find((d) => d.field === field);
  return (dim?.calculatedItems ?? [])
    .filter((it) => {
      if (it.key === key) return false;
      const p = parsePivotItemFormula(it.formula);
      return (p.ok && p.references.includes(key)) || it.after === key || it.before === key;
    })
    .map((it) => it.key);
}

/** Remove the calculated item `key` of row field `field`; refused (same spec) while another item's formula reads it. */
export function removePivotCalculatedItem(spec: PivotSpec, field: string, key: string): PivotSpec {
  const dim = spec.rows.find((d) => d.field === field);
  const list = dim?.calculatedItems;
  if (!list?.some((it) => it.key === key)) return spec;
  const formulaUsers = list.filter((it) => {
    if (it.key === key) return false;
    const p = parsePivotItemFormula(it.formula);
    return p.ok && p.references.includes(key);
  });
  if (formulaUsers.length) return spec;
  return updateRow(spec, field, (d) => {
    const items = list
      .filter((it) => it.key !== key)
      .map((it) => {
        // Items anchored to the removed one take its place.
        if (it.after !== key && it.before !== key) return it;
        const removed = list.find((x) => x.key === key)!;
        const { after: _a, before: _b, position: _p, ...rest } = it;
        return { ...rest, ...(removed.after !== undefined ? { after: removed.after } : removed.before !== undefined ? { before: removed.before } : removed.position ? { position: removed.position } : {}) };
      });
    if (items.length) return { ...d, calculatedItems: items };
    const { calculatedItems: _c, ...rest } = d;
    return rest;
  });
}

/** Set (or with `null` clear) the subtotal label of group `key` of row / column field `field` (`subtotalLabels`). */
export function setPivotSubtotalLabel(spec: PivotSpec, field: string, key: string, label: string | null): PivotSpec {
  const apply = (d: PivotDimension): PivotDimension => {
    if (d.field !== field) return d;
    const map = new Map(Object.entries(d.subtotalLabels ?? {}));
    if (label === null) map.delete(key);
    else map.set(key, label);
    if (map.size === 0) {
      const { subtotalLabels: _s, ...rest } = d;
      return rest;
    }
    return { ...d, subtotalLabels: Object.fromEntries(map) };
  };
  const rows = spec.rows.map(apply);
  const next: PivotSpec = Array.isArray(spec.columns)
    ? { ...spec, rows, columns: (spec.columns as readonly PivotDimension[]).map(apply) }
    : spec.columns
      ? { ...spec, rows, columns: apply(spec.columns as PivotDimension) }
      : { ...spec, rows };
  return JSON.stringify(next) === JSON.stringify(spec) ? spec : next;
}
