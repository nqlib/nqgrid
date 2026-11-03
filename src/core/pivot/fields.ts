import { pivotColumnFields, withPivotColumnFields } from "./columns";
import { parsePivotDateFieldName, pivotDateFieldName, pivotDateGroupLabel, pivotDayOf, PIVOT_DATE_GROUPS, PIVOT_INVALID_DAY } from "./dates";
import { isPivotFilterActive } from "./filter";
import type {
  PivotAggregate,
  PivotBuiltInAggregate,
  PivotDataRow,
  PivotDateGroup,
  PivotDimension,
  PivotFieldArea,
  PivotFieldSpec,
  PivotFieldType,
  PivotFilter,
  PivotMeasure,
  PivotNumberFormat,
  PivotSpec,
} from "./types";

/**
 * Field catalogue, field-list state and pure layout moves (Excel's PivotTable field list).
 *
 * Every helper returns a new spec (or the same object when nothing changes) and never produces a
 * spec that `validatePivotSpec` rejects. Rules are documented in `docs/pivot-headless.md`
 * ("Field list & drag-and-drop").
 */

/** Where a field can sit: one of the four areas, or `unused` (only in the field list). */
export type PivotFieldLocation = PivotFieldArea | "unused";

/** Areas in Excel's field-list order (Filters, Columns, Rows, Values). */
export const PIVOT_FIELD_AREAS: readonly PivotFieldArea[] = ["filters", "columns", "rows", "values"];

/** Pseudo-field id of the "Σ Values" chip (position of the measures among the column fields). */
export const PIVOT_VALUES_FIELD = "\u0000values";

/**
 * Most column fields the move helpers put in Columns (the engine itself has no limit). A field
 * moved into a full Columns area displaces the innermost other column field (see the move rules).
 */
export const PIVOT_MAX_COLUMN_FIELDS = 4;

/**
 * Groups applied when a date field (one with `dateGroups`) is dropped from the field list into an
 * area: Year → Quarter in Columns, Year → Month in Rows, Year in Filters (only groups the field
 * offers and that are not placed yet). Override with `PivotFieldMoveOptions.dateGrouping`.
 */
export const PIVOT_DEFAULT_DATE_GROUPING: Readonly<Record<"rows" | "columns" | "filters", readonly PivotDateGroup[]>> = {
  columns: ["year", "quarter"],
  rows: ["year", "month"],
  filters: ["year"],
};

const ALL_AREAS: readonly PivotFieldArea[] = ["rows", "columns", "filters", "values"];
const NUMERIC_TYPES: ReadonlySet<PivotFieldType> = new Set(["measure", "number"]);

/** A resolved catalogue entry: every property filled in. */
export interface PivotFieldInfo {
  readonly field: string;
  readonly label: string;
  readonly type: PivotFieldType;
  readonly areas: readonly PivotFieldArea[];
  /** Aggregate for a measure created from this field. */
  readonly aggregate: PivotBuiltInAggregate;
  readonly format?: PivotNumberFormat;
  readonly description?: string;
  /** Date fields whose values parse as dates: the "Group by…" choices (see `PivotFieldSpec.dateGroups`). */
  readonly dateGroups?: readonly PivotDateGroup[];
  /** Derived date fields (`orderDate:year`): the date field they group. */
  readonly source?: string;
  readonly dateGroup?: PivotDateGroup;
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export interface InferPivotFieldsOptions {
  /** Records inspected, spread evenly over `rows` (default 500). Inference is O(sample × fields). */
  readonly sample?: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** `priorYear` → `Prior Year`, `unit_price` → `Unit Price`. */
export function humanizePivotField(field: string): string {
  const words = field
    .replace(/[_\-.]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/);
  return words.map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w)).join(" ") || field;
}

/**
 * Cheap, sample-based field catalogue: field order is first-seen order in the sample; types are
 * `measure` (numbers), `number` (integers with ≤ 12 distinct values, e.g. a year), `date`
 * (`Date` or ISO-8601 strings), `text` (strings with > 50 distinct values that are mostly unique)
 * and `dimension` (everything else). Numeric strings stay dimensions; declare serialized decimals
 * as `{ type: "measure" }` in `spec.fields`.
 */
export function inferPivotFields(rows: readonly PivotDataRow[], options: InferPivotFieldsOptions = {}): PivotFieldSpec[] {
  const sample = Math.max(1, Math.floor(options.sample ?? 500));
  const n = rows.length;
  const step = n <= sample ? 1 : n / sample;
  const stats = new Map<string, { values: number; numbers: number; integers: number; dates: number; distinct: Set<string> }>();
  for (let s = 0, i = 0; i < n && s < sample; s++, i = Math.floor(s * step)) {
    const row = rows[i]!;
    for (const field in row) {
      let st = stats.get(field);
      if (!st) stats.set(field, (st = { values: 0, numbers: 0, integers: 0, dates: 0, distinct: new Set() }));
      const v = row[field];
      if (v === null || v === undefined || v === "") continue;
      st.values++;
      if (typeof v === "number") {
        if (Number.isFinite(v)) {
          st.numbers++;
          if (Number.isInteger(v)) st.integers++;
        }
      } else if (v instanceof Date || (typeof v === "string" && ISO_DATE.test(v))) {
        st.dates++;
      }
      if (st.distinct.size <= 1000) st.distinct.add(v instanceof Date ? v.toISOString() : String(v));
    }
  }
  const out: PivotFieldSpec[] = [];
  for (const [field, st] of stats) {
    let type: PivotFieldType = "dimension";
    if (st.values > 0 && st.numbers === st.values) {
      type = st.integers === st.values && st.distinct.size <= 12 && st.values >= 2 * st.distinct.size ? "number" : "measure";
    } else if (st.values > 0 && st.dates === st.values) {
      type = "date";
    } else if (st.distinct.size > 50 && st.distinct.size > st.values / 2) {
      type = "text";
    }
    out.push({ field, label: humanizePivotField(field), type });
  }
  return out;
}

/**
 * Do the sampled values of `field` parse as dates (≥ 90 % of the non-empty ones, see `pivotDayOf`)?
 * Decides whether a declared `date` field without `dateGroups` offers "Group by…".
 */
export function pivotFieldHasDates(rows: readonly PivotDataRow[], field: string, sample = 200): boolean {
  const n = rows.length;
  const step = n <= sample ? 1 : n / sample;
  let values = 0;
  let dates = 0;
  for (let s = 0, i = 0; i < n && s < sample; s++, i = Math.floor(s * step)) {
    const v = rows[i]![field];
    if (v === null || v === undefined || v === "") continue;
    values++;
    if (pivotDayOf(v) !== PIVOT_INVALID_DAY) dates++;
  }
  return values > 0 && dates >= values * 0.9;
}

/** Catalogue info of a derived date field (`orderDate:year` → `Year (Order Date)`). */
function derivedInfo(fields: readonly PivotFieldSpec[], field: string, fieldLabels?: Readonly<Record<string, string>>): PivotFieldInfo | null {
  const own = fields.find((f) => f.field === field);
  const parsed = own?.source && own.dateGroup ? { source: own.source, group: own.dateGroup } : own && own.type !== undefined && own.type !== "date" ? null : parsePivotDateFieldName(field);
  if (!parsed) return null;
  const src = fields.find((f) => f.field === parsed.source);
  const sourceLabel = fieldLabels?.[parsed.source] ?? src?.label ?? humanizePivotField(parsed.source);
  const type: PivotFieldType = "date";
  return {
    field,
    label: fieldLabels?.[field] ?? own?.label ?? `${pivotDateGroupLabel(parsed.group)} (${sourceLabel})`,
    type,
    areas: own?.areas ?? src?.areas?.filter((a) => a !== "values") ?? ["rows", "columns", "filters"],
    aggregate: own?.aggregate ?? "count",
    ...(own?.description ? { description: own.description } : {}),
    source: parsed.source,
    dateGroup: parsed.group,
  };
}

function defaultAreas(type: PivotFieldType): readonly PivotFieldArea[] {
  return type === "measure" ? ["values"] : ALL_AREAS;
}

function defaultAggregate(type: PivotFieldType): PivotBuiltInAggregate {
  return NUMERIC_TYPES.has(type) ? "sum" : "count";
}

/**
 * The catalogue the field list shows: `spec.fields` (else `inferPivotFields(rows)` when `rows` are
 * given), plus every field the spec references (dimensions, measure fields, filters) that the
 * catalogue lacks. Labels: `fieldLabels` › `fields[].label` › dimension / filter label › the label of a
 * `sum` measure on the field › `humanizePivotField`.
 */
export function resolvePivotFields(
  spec: PivotSpec,
  rows?: readonly PivotDataRow[],
  options: InferPivotFieldsOptions = {},
): PivotFieldInfo[] {
  // Derived date entries (`source` + `dateGroup`) add to the catalogue; they do not replace inference.
  const declared = spec.fields?.filter((f) => !(f.source && f.dateGroup)) ?? [];
  const derived = spec.fields?.filter((f) => f.source && f.dateGroup) ?? [];
  const inferred = !declared.length && rows ? inferPivotFields(rows, options) : null;
  const base: PivotFieldSpec[] = [...(declared.length || !inferred ? declared : inferred), ...derived];
  const known = new Set(base.map((f) => f.field));
  const add = (field: string | undefined, type: PivotFieldType) => {
    if (field && !known.has(field)) {
      known.add(field);
      base.push({ field, type });
    }
  };
  for (const d of spec.rows) add(d.field, "dimension");
  for (const d of pivotColumnFields(spec)) add(d.field, "dimension");
  for (const f of spec.filters ?? []) add(f.field, "dimension");
  for (const m of spec.measures) {
    const agg = m.aggregate ?? "sum";
    add(m.field, agg === "count" || agg === "first" || agg === "last" ? "dimension" : "measure");
  }

  const specLabel = (field: string): string | undefined => {
    const dim = spec.rows.find((d) => d.field === field) ?? pivotColumnFields(spec).find((d) => d.field === field);
    if (dim?.label) return dim.label;
    const filter = spec.filters?.find((f) => f.field === field && f.label);
    if (filter?.label) return filter.label;
    return spec.measures.find((m) => m.field === field && (m.aggregate ?? "sum") === "sum" && m.label)?.label;
  };
  const catalogue = spec.fields ? [...spec.fields, ...(inferred ?? [])] : base;
  // Derived date fields are listed right after their source field (Excel's Years / Quarters under the date).
  const declaredField = (field: string) => spec.fields?.some((x) => x.field === field && !(x.source && x.dateGroup)) ?? false;
  const sourceOf = (f: PivotFieldSpec) => f.source ?? (f.type === "date" || !declaredField(f.field) ? parsePivotDateFieldName(f.field)?.source : undefined);
  const derivedBySource = new Map<string, PivotFieldSpec[]>();
  for (const f of base) {
    const src = sourceOf(f);
    if (src && src !== f.field && base.some((x) => x.field === src)) {
      if (!derivedBySource.has(src)) derivedBySource.set(src, []);
      derivedBySource.get(src)!.push(f);
    }
  }
  if (derivedBySource.size) {
    const moved = new Set([...derivedBySource.values()].flat());
    const ordered: PivotFieldSpec[] = [];
    for (const f of base) {
      if (moved.has(f)) continue;
      ordered.push(f, ...(derivedBySource.get(f.field) ?? []));
    }
    base.splice(0, base.length, ...ordered);
  }
  return base.map((f): PivotFieldInfo => {
    const isNew = f.type === "dimension" && !spec.fields?.some((x) => x.field === f.field) && !inferred?.some((x) => x.field === f.field);
    const derivedField = (f.source && f.dateGroup) || isNew ? derivedInfo(catalogue, f.field, spec.fieldLabels) : null;
    if (derivedField) {
      const label = spec.fieldLabels?.[f.field] ?? f.label ?? specLabel(f.field) ?? derivedField.label;
      return { ...derivedField, label };
    }
    const type = f.type ?? "dimension";
    const groups = type !== "date" ? undefined : f.dateGroups ?? (rows && pivotFieldHasDates(rows, f.field) ? PIVOT_DATE_GROUPS : undefined);
    return {
      field: f.field,
      label: spec.fieldLabels?.[f.field] ?? f.label ?? specLabel(f.field) ?? humanizePivotField(f.field),
      type,
      areas: f.areas ?? defaultAreas(type),
      aggregate: f.aggregate ?? defaultAggregate(type),
      ...(f.format ? { format: f.format } : {}),
      ...(f.description ? { description: f.description } : {}),
      ...(groups?.length ? { dateGroups: groups } : {}),
    };
  });
}

function fieldInfo(fields: readonly PivotFieldSpec[], field: string): PivotFieldInfo {
  const f = fields.find((x) => x.field === field);
  if (!f || (f.source && f.dateGroup) || (f.type === "date" && parsePivotDateFieldName(field))) {
    const derived = derivedInfo(fields, field);
    if (derived) return f?.label ? { ...derived, label: f.label } : derived;
  }
  const type = f?.type ?? "dimension";
  return {
    field,
    label: f?.label ?? humanizePivotField(field),
    type,
    areas: f?.areas ?? defaultAreas(type),
    aggregate: f?.aggregate ?? defaultAggregate(type),
    ...(f?.format ? { format: f.format } : {}),
    ...(f?.dateGroups?.length ? { dateGroups: f.dateGroups } : {}),
  };
}

// ---------------------------------------------------------------------------
// Field-list state
// ---------------------------------------------------------------------------

/** One chip in an area. Pass `field` / `area` to `movePivotField`. */
export interface PivotFieldListItem {
  /** Unique React key (`rows:line`, `values:actual`, …). */
  readonly key: string;
  readonly area: PivotFieldArea;
  /** Move id: record field; the measure id in Values; `PIVOT_VALUES_FIELD` for Σ Values. */
  readonly field: string;
  readonly label: string;
  /** Record field (Values: the measure's source field; absent for calculated measures and Σ Values). */
  readonly sourceField?: string;
  readonly type?: PivotFieldType;
  /** Values: the measure's aggregate. */
  readonly aggregate?: PivotAggregate;
  /** Values: a measure without a source field (ratio, custom, `count` of rows). */
  readonly calculated?: boolean;
  /** The Σ Values chip in Columns. */
  readonly isValues?: boolean;
  /**
   * Date fields that can be grouped: the source date field (`orderDate` for `orderDate` itself and
   * for `orderDate:year`). Pass it to `setPivotDateGrouping`.
   */
  readonly dateSource?: string;
  /** Derived date field: its group. */
  readonly dateGroup?: PivotDateGroup;
  /** An active report / label filter on the field. */
  readonly filtered?: boolean;
  /** Row dimension sorted by label or value. */
  readonly sorted?: boolean;
  /** Row dimension with Top / Bottom N. */
  readonly topN?: boolean;
}

/** One entry of the field list's checklist. */
export interface PivotFieldListField extends PivotFieldInfo {
  /** Areas the field is used in (Values counts once even for several measures). */
  readonly usedIn: readonly PivotFieldArea[];
  readonly checked: boolean;
}

/** A measure without a source field (ratio, custom, count of rows), listed for the Values checklist. */
export interface PivotFieldListMeasure {
  readonly id: string;
  readonly label: string;
  readonly inValues: boolean;
}

export interface PivotFieldListState {
  readonly fields: readonly PivotFieldListField[];
  readonly calculated: readonly PivotFieldListMeasure[];
  readonly filters: readonly PivotFieldListItem[];
  readonly columns: readonly PivotFieldListItem[];
  readonly rows: readonly PivotFieldListItem[];
  readonly values: readonly PivotFieldListItem[];
  /** Catalogue fields used in no area. */
  readonly unused: readonly PivotFieldListField[];
}

/** Measure ids shown as values (`spec.values`, default every measure). */
export function pivotValueIds(spec: PivotSpec): string[] {
  return spec.values ? [...spec.values] : spec.measures.map((m) => m.id);
}

/** Fields in the Filters area: filtered fields (incl. placeholders `{ field }`) that are not row / column fields, in filter order. */
export function pivotFilterAreaFields(spec: PivotSpec): string[] {
  const dims = new Set([...spec.rows.map((d) => d.field), ...pivotColumnFields(spec).map((d) => d.field)]);
  const out: string[] = [];
  for (const f of spec.filters ?? []) if (!dims.has(f.field) && !out.includes(f.field)) out.push(f.field);
  return out;
}

/** Index of Σ Values among the column fields (default: after them). */
function valuesIndexOf(spec: PivotSpec, columnCount: number): number {
  return Math.max(0, Math.min(columnCount, spec.valuesIndex ?? columnCount));
}

/** Does the Columns area show the Σ Values chip (more than one value measure)? */
export function pivotShowsValuesField(spec: PivotSpec): boolean {
  return pivotValueIds(spec).length > 1;
}

/**
 * Which fields sit in Filters, Columns, Rows and Values (in order), which are unused, and the
 * checklist state. `fields` is the catalogue (`resolvePivotFields(spec, rows)`; default: the spec's
 * own catalogue plus referenced fields).
 */
export function pivotFieldListState(spec: PivotSpec, fields: readonly PivotFieldSpec[] = resolvePivotFields(spec)): PivotFieldListState {
  const catalogue = resolvePivotFields({ ...spec, fields });
  const info = (field: string) => catalogue.find((f) => f.field === field) ?? fieldInfo([], field);
  const filtered = new Set((spec.filters ?? []).filter(isPivotFilterActive).map((f) => f.field));
  const dateOf = (field: string): Pick<PivotFieldListItem, "dateSource" | "dateGroup"> => {
    const i = info(field);
    if (i.source && i.dateGroup) return info(i.source).dateGroups?.length ? { dateSource: i.source, dateGroup: i.dateGroup } : {};
    return i.dateGroups?.length ? { dateSource: field } : {};
  };
  const dimItem = (area: PivotFieldArea, d: PivotDimension): PivotFieldListItem => ({
    key: `${area}:${d.field}`,
    area,
    field: d.field,
    sourceField: d.field,
    label: d.label ?? info(d.field).label,
    type: info(d.field).type,
    ...(filtered.has(d.field) ? { filtered: true } : {}),
    ...(area === "rows" && (d.sortBy || d.sort === "asc" || d.sort === "desc") ? { sorted: true } : {}),
    ...(area === "rows" && d.topN ? { topN: true } : {}),
    ...dateOf(d.field),
  });

  const rows = spec.rows.map((d) => dimItem("rows", d));
  const columnDims = pivotColumnFields(spec);
  const columns = columnDims.map((d) => dimItem("columns", d));
  if (pivotShowsValuesField(spec)) {
    columns.splice(valuesIndexOf(spec, columnDims.length), 0, {
      key: "columns:Σ",
      area: "columns",
      field: PIVOT_VALUES_FIELD,
      label: "Σ Values",
      isValues: true,
    });
  }
  const filters = pivotFilterAreaFields(spec).map((field): PivotFieldListItem => {
    const label = spec.filters?.find((f) => f.field === field && f.label)?.label ?? info(field).label;
    return {
      key: `filters:${field}`,
      area: "filters",
      field,
      sourceField: field,
      label,
      type: info(field).type,
      ...(filtered.has(field) ? { filtered: true } : {}),
      ...dateOf(field),
    };
  });
  const valueIds = pivotValueIds(spec);
  const values = valueIds.flatMap((id): PivotFieldListItem[] => {
    const m = spec.measures.find((x) => x.id === id);
    if (!m) return [];
    return [
      {
        key: `values:${id}`,
        area: "values",
        field: id,
        label: m.label ?? id,
        ...(m.field ? { sourceField: m.field, type: info(m.field).type } : { calculated: true }),
        aggregate: m.aggregate ?? "sum",
      },
    ];
  });

  const used = new Map<string, PivotFieldArea[]>();
  const mark = (field: string | undefined, area: PivotFieldArea) => {
    if (!field) return;
    const list = used.get(field) ?? [];
    if (!list.includes(area)) list.push(area);
    used.set(field, list);
  };
  for (const r of rows) mark(r.sourceField, "rows");
  for (const c of columns) mark(c.sourceField, "columns");
  for (const f of filters) mark(f.sourceField, "filters");
  for (const v of values) mark(v.sourceField, "values");
  const list = catalogue.map((f): PivotFieldListField => {
    const usedIn = used.get(f.field) ?? [];
    return { ...f, usedIn, checked: usedIn.length > 0 };
  });
  const calculated = spec.measures
    .filter((m) => !m.field)
    .map((m) => ({ id: m.id, label: m.label ?? m.id, inValues: valueIds.includes(m.id) }));
  return { fields: list, calculated, filters, columns, rows, values, unused: list.filter((f) => !f.checked) };
}

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

export interface PivotFieldMove {
  /**
   * What to move: a record field; the measure id when `from` is `values`; `PIVOT_VALUES_FIELD` for
   * the Σ Values chip (Columns only); a calculated measure's id when adding it to Values from `unused`.
   */
  readonly field: string;
  readonly from: PivotFieldLocation;
  readonly to: PivotFieldLocation;
  /**
   * Insertion point in `to` as the field list currently shows it (`0` = before the first chip;
   * default: the end). Within one area this is the drop-indicator position, so dragging a chip
   * down past its neighbour is `index = its position + 2`. `reorderPivotField` takes final positions.
   */
  readonly index?: number;
  /** Aggregate of a measure created in Values (default: the catalogue's, else `sum` / `count`). */
  readonly aggregate?: PivotBuiltInAggregate;
}

export interface PivotFieldMoveOptions {
  /** Catalogue for labels, types, allowed areas and default aggregates (default: `resolvePivotFields(spec)`). */
  readonly fields?: readonly PivotFieldSpec[];
  /**
   * Groups applied when a date field with `dateGroups` is dropped from the field list into Rows,
   * Columns or Filters (default `PIVOT_DEFAULT_DATE_GROUPING`); `false` places the raw field.
   */
  readonly dateGrouping?: Partial<Record<"rows" | "columns" | "filters", readonly PivotDateGroup[]>> | false;
}

export type PivotFieldMoveRefusal =
  | "notFound"
  | "notAllowed"
  | "rowsRequired"
  | "valuesRequired"
  | "noSourceField"
  | "unchanged";

/** Result of `planPivotFieldMove`: the new spec plus what happened (for announcements). */
export interface PivotFieldMovePlan {
  readonly spec: PivotSpec;
  readonly changed: boolean;
  readonly reason?: PivotFieldMoveRefusal;
  /** A column field pushed out by `PIVOT_MAX_COLUMN_FIELDS`, and where it went. */
  readonly displaced?: { readonly field: string; readonly to: PivotFieldLocation };
  /** Date fields placed instead of the raw date field (`orderDate:year`, `orderDate:quarter`). */
  readonly grouped?: readonly string[];
  /** Measure id created or reused when the move added to Values. */
  readonly measureId?: string;
}

type ColumnEntry = { readonly kind: "dim"; readonly dim: PivotDimension } | { readonly kind: "values" };

function omitKeys<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
  const out = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}

/** A dimension on its way into Columns (no `sortBy` / `topN`) or Rows (no `subtotal`). */
const stripColumnOnly = (d: PivotDimension): PivotDimension => omitKeys(d, "sortBy", "topN");
const stripRowOnly = (d: PivotDimension): PivotDimension => omitKeys(d, "subtotal");
const clamp = (i: number | undefined, max: number) => (i === undefined ? max : Math.max(0, Math.min(max, Math.floor(i))));

/** Working copy of the layout parts a move touches. */
interface Layout {
  rows: PivotDimension[];
  columns: ColumnEntry[];
  values: string[];
  measures: PivotMeasure[];
  filters: PivotFilter[];
}

function layoutOf(spec: PivotSpec): Layout {
  const dims = pivotColumnFields(spec);
  const columns: ColumnEntry[] = dims.map((dim) => ({ kind: "dim", dim }));
  if (pivotShowsValuesField(spec)) columns.splice(valuesIndexOf(spec, dims.length), 0, { kind: "values" });
  return { rows: [...spec.rows], columns, values: pivotValueIds(spec), measures: [...spec.measures], filters: [...(spec.filters ?? [])] };
}

const AGG_LABEL: Readonly<Record<PivotBuiltInAggregate, string>> = {
  sum: "Sum",
  avg: "Average",
  min: "Min",
  max: "Max",
  count: "Count",
  first: "First",
  last: "Last",
};

/** Default measure label: the field label for `sum`, else `Average of Units`, `Count of Region`, … */
export function pivotMeasureLabel(fieldLabel: string, aggregate: PivotBuiltInAggregate): string {
  return aggregate === "sum" ? fieldLabel : `${AGG_LABEL[aggregate]} of ${fieldLabel}`;
}

function uniqueMeasureId(measures: readonly PivotMeasure[], base: string): string {
  const ids = new Set(measures.map((m) => m.id));
  if (!ids.has(base)) return base;
  for (let i = 2; ; i++) if (!ids.has(`${base}_${i}`)) return `${base}_${i}`;
}

/**
 * Measure id for `field` in Values: an existing calculated measure with that id, an existing
 * measure on the field with the same aggregate that is not shown yet, or a new measure.
 */
function ensureMeasure(
  layout: Layout,
  field: string,
  fields: readonly PivotFieldSpec[],
  aggregate: PivotBuiltInAggregate | undefined,
): string | null {
  const calc = layout.measures.find((m) => m.id === field && !m.field);
  if (calc) return layout.values.includes(calc.id) ? null : calc.id;
  const info = fieldInfo(fields, field);
  const agg = aggregate ?? info.aggregate;
  const reuse = layout.measures.find((m) => m.field === field && (m.aggregate ?? "sum") === agg && !layout.values.includes(m.id));
  if (reuse) return reuse.id;
  const id = uniqueMeasureId(layout.measures, agg === "sum" ? field : `${field}_${agg}`);
  const measure: PivotMeasure = {
    id,
    field,
    label: pivotMeasureLabel(info.label, agg),
    ...(agg !== "sum" ? { aggregate: agg } : {}),
    ...(info.format && agg !== "count" ? { format: info.format } : {}),
  };
  layout.measures.push(measure);
  return id;
}

/** Index of the area chip `field` in `area`, or -1. */
function indexIn(spec: PivotSpec, layout: Layout, area: PivotFieldArea, field: string): number {
  switch (area) {
    case "rows":
      return layout.rows.findIndex((d) => d.field === field);
    case "columns":
      return layout.columns.findIndex((c) => (field === PIVOT_VALUES_FIELD ? c.kind === "values" : c.kind === "dim" && c.dim.field === field));
    case "values":
      return layout.values.indexOf(field);
    case "filters":
      return pivotFilterAreaFields(spec).indexOf(field);
  }
}

/** Filter entries of `field` moved so the field is the `index`-th Filters-area field. */
function placeFilterField(filters: PivotFilter[], areaFields: readonly string[], field: string, index: number, fallback: PivotFilter): PivotFilter[] {
  const own = filters.filter((f) => f.field === field);
  const rest = filters.filter((f) => f.field !== field);
  const entries = own.length ? own : [fallback];
  const others = areaFields.filter((f) => f !== field);
  const before = others[index];
  const at = before === undefined ? rest.length : rest.findIndex((f) => f.field === before);
  rest.splice(at < 0 ? rest.length : at, 0, ...entries);
  return rest;
}

/**
 * Plan one move without applying it: the resulting spec plus what happened. Refusals return the
 * original spec with `changed: false` and a `reason`:
 *
 * - `notFound` — `field` is not in `from`;
 * - `notAllowed` — the catalogue's `areas` exclude `to`, or Σ Values leaves Columns;
 * - `rowsRequired` / `valuesRequired` — the last row field / value measure would leave;
 * - `noSourceField` — a calculated measure cannot become a dimension or filter;
 * - `unchanged` — the move is a no-op.
 */
export function planPivotFieldMove(spec: PivotSpec, move: PivotFieldMove, options: PivotFieldMoveOptions = {}): PivotFieldMovePlan {
  const refuse = (reason: PivotFieldMoveRefusal): PivotFieldMovePlan => ({ spec, changed: false, reason });
  const fields = options.fields ?? resolvePivotFields(spec);
  const layout = layoutOf(spec);
  let { from } = move;
  const { to } = move;
  const field = move.field;

  // ---- Σ Values: only its position within Columns ----
  if (field === PIVOT_VALUES_FIELD) {
    if (from !== "columns" || to !== "columns") return refuse("notAllowed");
    const at = indexIn(spec, layout, "columns", field);
    if (at < 0) return refuse("notFound");
    const target = clamp(move.index, layout.columns.length);
    const [entry] = layout.columns.splice(at, 1);
    layout.columns.splice(target > at ? target - 1 : target, 0, entry!);
    return finish(spec, layout);
  }

  // ---- Source field and its record field ----
  let sourceField = field;
  if (from === "values") {
    if (!layout.values.includes(field)) return refuse("notFound");
    const m = layout.measures.find((x) => x.id === field);
    sourceField = m?.field ?? "";
    if (to !== "values" && to !== "unused" && !sourceField) return refuse("noSourceField");
  } else if (from !== "unused" && indexIn(spec, layout, from, field) < 0) {
    return refuse("notFound");
  }
  const calculatedId = from === "unused" && layout.measures.some((m) => m.id === field && !m.field) && !fields.some((f) => f.field === field);
  if (calculatedId && to !== "values") return refuse("noSourceField");
  const isCalculated = calculatedId && to === "values";
  if (!isCalculated && to !== "unused" && to !== from && !fieldInfo(fields, sourceField).areas.includes(to)) return refuse("notAllowed");

  // A value chip dragged to Rows / Columns / Filters while its field already sits in one of them:
  // drop the value, then move that placement.
  if (from === "values" && to !== "values" && to !== "unused") {
    const placed = (["rows", "columns", "filters"] as const).find((a) => indexIn(spec, layout, a, sourceField) >= 0);
    if (placed) {
      const removed = planPivotFieldMove(spec, { field, from: "values", to: "unused" }, { fields });
      if (!removed.changed) return removed;
      if (placed === to) return removed;
      const moved = planPivotFieldMove(removed.spec, { field: sourceField, from: placed, to, index: move.index }, { fields });
      return moved.changed ? moved : removed;
    }
  }

  // From the field list into rows / columns / filters: a field sits in at most one of them.
  if (from === "unused" && to !== "values" && to !== "unused") {
    const current = (["rows", "columns", "filters"] as const).find((a) => indexIn(spec, layout, a, field) >= 0);
    if (current) from = current;
    // A date field dropped from the field list gets its default grouping (Excel's auto-grouping).
    else if (options.dateGrouping !== false && !isCalculated) {
      const groups = defaultDateGroups(spec, fields, field, to, options.dateGrouping);
      if (groups.length) return planDateGroupDrop(spec, groups, to, move.index, { ...options, fields });
    }
  }

  const fromIndex = from === "unused" ? -1 : indexIn(spec, layout, from, from === "values" ? field : sourceField);
  const same = from === to;
  const rawTarget = move.index;
  /** Insertion index in `to` after removing the source (same-area moves shift by one). */
  const target = (length: number) => {
    const t = clamp(rawTarget, length + (same ? 1 : 0));
    return same && fromIndex >= 0 && t > fromIndex ? t - 1 : t;
  };
  let displaced: PivotFieldMovePlan["displaced"];
  let measureId: string | undefined;
  const filterAreaBefore = pivotFilterAreaFields(spec);

  // ---- Remove from the source ----
  let carried: PivotDimension | null = null;
  let dropFilters = false;
  switch (from) {
    case "rows":
      carried = layout.rows.splice(fromIndex, 1)[0]!;
      break;
    case "columns": {
      const entry = layout.columns.splice(fromIndex, 1)[0]!;
      if (entry.kind === "dim") carried = entry.dim;
      break;
    }
    case "values":
      if (to !== "values") layout.values.splice(fromIndex, 1);
      break;
    case "filters":
      break;
    case "unused":
      break;
  }
  const label = carried?.label ?? spec.filters?.find((f) => f.field === sourceField && f.label)?.label ?? fieldInfo(fields, sourceField).label;
  const newDim = (): PivotDimension => carried ?? { field: sourceField, label };

  // ---- Insert into the target ----
  switch (to) {
    case "rows": {
      if (same && from === "rows") {
        layout.rows.splice(target(layout.rows.length), 0, carried!);
      } else {
        layout.rows.splice(target(layout.rows.length), 0, stripRowOnly(newDim()));
        if (from === "filters") layout.filters = layout.filters.filter((f) => f.field !== sourceField || isPivotFilterActive(f));
        if (from === "values") layout.filters = layout.filters.filter((f) => f.field !== sourceField || isPivotFilterActive(f));
      }
      break;
    }
    case "columns": {
      const dim = stripColumnOnly(newDim());
      const at = target(layout.columns.length);
      layout.columns.splice(at, 0, { kind: "dim", dim });
      if (from === "filters") layout.filters = layout.filters.filter((f) => f.field !== sourceField || isPivotFilterActive(f));
      // Columns full: the newcomer stays, the innermost other column field swaps into the source area.
      const dims = layout.columns.filter((c): c is Extract<ColumnEntry, { kind: "dim" }> => c.kind === "dim");
      if (dims.length > PIVOT_MAX_COLUMN_FIELDS) {
        const out = [...dims].reverse().find((c) => c.dim !== dim)!;
        layout.columns = layout.columns.filter((c) => c !== out);
        const dest: PivotFieldLocation = from === "rows" || from === "filters" ? from : "unused";
        displaced = { field: out.dim.field, to: dest };
        if (dest === "rows") {
          layout.rows.splice(Math.min(fromIndex, layout.rows.length), 0, stripRowOnly(out.dim));
        } else if (dest === "filters") {
          const areaFields = filterAreaBefore.filter((f) => f !== sourceField);
          const placeholder: PivotFilter = { field: out.dim.field, ...(out.dim.label ? { label: out.dim.label } : {}) };
          layout.filters = placeFilterField(layout.filters, areaFields, out.dim.field, Math.max(0, fromIndex), placeholder);
        } else {
          layout.filters = layout.filters.filter((f) => f.field !== out.dim.field);
        }
      }
      break;
    }
    case "filters": {
      // A dimension moving here keeps its filters (now report filters), otherwise gets a placeholder.
      const areaFields = filterAreaBefore.filter((f) => f !== sourceField);
      const t = same ? target(areaFields.length) : clamp(rawTarget, areaFields.length);
      const placeholder: PivotFilter = { field: sourceField, ...(label !== sourceField ? { label } : {}) };
      layout.filters = placeFilterField(layout.filters, areaFields, sourceField, t, placeholder);
      break;
    }
    case "values": {
      if (from === "values") {
        const [id] = layout.values.splice(fromIndex, 1);
        layout.values.splice(target(layout.values.length), 0, id!);
      } else {
        const id = ensureMeasure(layout, isCalculated ? field : sourceField, fields, move.aggregate);
        if (id === null) return refuse("unchanged");
        measureId = id;
        layout.values.splice(clamp(rawTarget, layout.values.length), 0, id);
        if (from === "rows" || from === "columns" || from === "filters") dropFilters = true;
      }
      break;
    }
    case "unused":
      if (from === "rows" || from === "columns" || from === "filters") dropFilters = true;
      break;
  }
  if (dropFilters) layout.filters = layout.filters.filter((f) => f.field !== sourceField);

  const plan = finish(spec, layout);
  if (!plan.changed) return plan;
  return { ...plan, ...(displaced ? { displaced } : {}), ...(measureId ? { measureId } : {}) };
}

/** Apply the layout, then the invariants: non-empty rows / values, expanded paths, measure references. */
function finish(spec: PivotSpec, layout: Layout): PivotFieldMovePlan {
  if (layout.rows.length === 0) return { spec, changed: false, reason: "rowsRequired" };
  if (layout.values.length === 0) return { spec, changed: false, reason: "valuesRequired" };
  const next = applyLayout(spec, layout);
  if (JSON.stringify(next) === JSON.stringify(spec)) return { spec, changed: false, reason: "unchanged" };
  return { spec: next, changed: true };
}

function applyLayout(spec: PivotSpec, layout: Layout): PivotSpec {
  const oldValues = pivotValueIds(spec);
  const removed = new Set(oldValues.filter((id) => !layout.values.includes(id)));
  const first = layout.values[0]!;

  // Measure references: value-based sort / Top N on a measure that left Values are dropped (like
  // Excel); heat and header charts follow the first remaining value.
  const rows = layout.rows.map((d) => {
    let out = d;
    if (d.sortBy && removed.has(d.sortBy.measure)) out = omitKeys(out, "sortBy");
    if (d.topN && removed.has(d.topN.measure)) out = omitKeys(out, "topN");
    return out;
  });
  const heat = spec.heat && spec.heat.measure !== undefined && removed.has(spec.heat.measure) ? { ...spec.heat, measure: first } : spec.heat;
  const headerCharts =
    spec.headerCharts && spec.headerCharts.measure !== undefined && removed.has(spec.headerCharts.measure)
      ? { ...spec.headerCharts, measure: first }
      : spec.headerCharts;

  // Measures that left Values and nothing else references are deleted.
  const referenced = new Set(layout.values);
  for (const k of spec.kpis ?? []) {
    referenced.add(k.measure);
    if (k.compareTo) referenced.add(k.compareTo);
  }
  for (const d of rows) {
    if (d.sortBy) referenced.add(d.sortBy.measure);
    if (d.topN) referenced.add(d.topN.measure);
  }
  if (heat?.measure) referenced.add(heat.measure);
  if (headerCharts?.measure) referenced.add(headerCharts.measure);
  const measures = layout.measures.filter((m) => !removed.has(m.id) || referenced.has(m.id));

  // Columns: the list (with Σ Values) back to `columns` (one object for one field) + `valuesIndex`.
  const columnDims = layout.columns.flatMap((c) => (c.kind === "dim" ? [c.dim] : []));
  const sigma = layout.columns.findIndex((c) => c.kind === "values");
  const valuesIndex = sigma < 0 || layout.values.length < 2 || columnDims.length === 0 ? undefined : layout.columns.slice(0, sigma).filter((c) => c.kind === "dim").length;

  let next: PivotSpec = { ...spec, rows, measures };
  next = withPivotColumnFields(next, columnDims);
  next = valuesIndex !== undefined && valuesIndex !== columnDims.length ? { ...next, valuesIndex } : omitKeys(next, "valuesIndex");
  // `values` stays implicit while it still equals "every measure, in order".
  const implicit = spec.values === undefined && layout.values.length === measures.length && layout.values.every((id, i) => measures[i]!.id === id);
  next = implicit ? next : { ...next, values: layout.values };
  next = layout.filters.length ? { ...next, filters: layout.filters } : omitKeys(next, "filters");
  if (heat !== spec.heat) next = { ...next, heat };
  if (headerCharts !== spec.headerCharts) next = { ...next, headerCharts };
  return withCleanColumnsExpanded(spec, withCleanExpanded(spec, next));
}

/**
 * `withCleanExpanded` for column groups (`columnsExpanded`): a path survives while the column
 * levels it spans keep their fields and order and it still names a group level.
 */
export function withCleanColumnsExpanded(prev: PivotSpec, next: PivotSpec): PivotSpec {
  const expanded = next.columnsExpanded;
  if (!Array.isArray(expanded)) return next;
  const a = pivotColumnFields(prev);
  const b = pivotColumnFields(next);
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix]!.field === b[prefix]!.field) prefix++;
  const maxLen = Math.min(prefix, b.length - 1);
  const kept = (expanded as readonly (readonly string[])[]).filter((p) => p.length > 0 && p.length <= maxLen);
  if (kept.length === expanded.length) return next;
  if (kept.length) return { ...next, columnsExpanded: kept };
  return b.length > 1 ? { ...next, columnsExpanded: "all" } : omitKeys(next, "columnsExpanded");
}

/**
 * Drop `expanded` paths that no longer fit the row fields: a path survives when the levels it
 * spans keep their fields and order and it still names a group level. When every path is dropped
 * this way, `expanded` returns to `"all"` (a new layout opens expanded, like Excel).
 */
export function withCleanExpanded(prev: PivotSpec, next: PivotSpec): PivotSpec {
  const expanded = next.expanded;
  if (!Array.isArray(expanded)) return next;
  let prefix = 0;
  while (prefix < prev.rows.length && prefix < next.rows.length && prev.rows[prefix]!.field === next.rows[prefix]!.field) prefix++;
  const maxLen = Math.min(prefix, next.rows.length - 1);
  const kept = (expanded as readonly (readonly string[])[]).filter((p) => p.length > 0 && p.length <= maxLen);
  if (kept.length === expanded.length) return next;
  return { ...next, expanded: kept.length ? kept : "all" };
}

/** `planPivotFieldMove(...).spec`: move a field between Rows, Columns, Values, Filters and the field list. */
export function movePivotField(spec: PivotSpec, move: PivotFieldMove, options: PivotFieldMoveOptions = {}): PivotSpec {
  return planPivotFieldMove(spec, move, options).spec;
}

/** Can `move` be applied? (`planPivotFieldMove` without keeping the spec.) */
export function canMovePivotField(spec: PivotSpec, move: PivotFieldMove, options: PivotFieldMoveOptions = {}): boolean {
  return planPivotFieldMove(spec, move, options).changed;
}

/** Move a chip to final position `index` within its area (`0` = first). */
export function reorderPivotField(
  spec: PivotSpec,
  reorder: { readonly area: PivotFieldArea; readonly field: string; readonly index: number },
  options: PivotFieldMoveOptions = {},
): PivotSpec {
  const layout = layoutOf(spec);
  const at = indexIn(spec, layout, reorder.area, reorder.field);
  if (at < 0) return spec;
  const index = reorder.index > at ? reorder.index + 1 : reorder.index;
  return movePivotField(spec, { field: reorder.field, from: reorder.area, to: reorder.area, index }, options);
}

/** Remove a field from an area (Values: the measure id). Refused for the last row field / value. */
export function removePivotField(
  spec: PivotSpec,
  remove: { readonly field: string; readonly from: PivotFieldArea },
  options: PivotFieldMoveOptions = {},
): PivotSpec {
  return movePivotField(spec, { ...remove, to: "unused" }, options);
}

/**
 * Add `field` to Values at `index` (default: the end), reusing an identical hidden measure or
 * creating one with the catalogue's aggregate / format (`sum` for numbers, `count` otherwise).
 */
export function addPivotMeasure(
  spec: PivotSpec,
  add: { readonly field: string; readonly aggregate?: PivotBuiltInAggregate; readonly index?: number },
  options: PivotFieldMoveOptions = {},
): PivotSpec {
  return movePivotField(spec, { field: add.field, from: "unused", to: "values", index: add.index, aggregate: add.aggregate }, options);
}

/**
 * Change a measure's aggregate (Excel's "Summarize values by"). Auto labels (`Units`,
 * `Average of Units`) follow; custom labels stay. Switching to or from `count` drops the measure's
 * format (counts are plain integers), restoring the catalogue format when leaving `count`.
 * Measures without a source field only accept `count`.
 */
export function setPivotMeasureAggregate(
  spec: PivotSpec,
  measureId: string,
  aggregate: PivotBuiltInAggregate,
  options: PivotFieldMoveOptions = {},
): PivotSpec {
  const m = spec.measures.find((x) => x.id === measureId);
  if (!m || (m.aggregate ?? "sum") === aggregate) return spec;
  if (!m.field && aggregate !== "count") return spec;
  const prev = m.aggregate ?? "sum";
  const fields = options.fields ?? resolvePivotFields(spec);
  let next: PivotMeasure = aggregate === "sum" ? omitKeys(m, "aggregate") : { ...m, aggregate };
  if (m.field && typeof prev === "string") {
    const info = fieldInfo(fields, m.field);
    if (m.label === undefined || m.label === pivotMeasureLabel(info.label, prev)) next = { ...next, label: pivotMeasureLabel(info.label, aggregate) };
    if (aggregate === "count") next = omitKeys(next, "format");
    else if (prev === "count" && info.format) next = { ...next, format: info.format };
  } else if (aggregate === "count") {
    next = omitKeys(next, "format");
  }
  return { ...spec, measures: spec.measures.map((x) => (x === m ? next : x)) };
}

/** Move Σ Values to `index` among the column fields (`0` = measures outermost). */
export function setPivotValuesPosition(spec: PivotSpec, index: number): PivotSpec {
  const layout = layoutOf(spec);
  const at = layout.columns.findIndex((c) => c.kind === "values");
  if (at < 0) return spec;
  const columnCount = layout.columns.length - 1;
  const target = Math.max(0, Math.min(columnCount, Math.floor(index)));
  return movePivotField(spec, { field: PIVOT_VALUES_FIELD, from: "columns", to: "columns", index: target > at ? target + 1 : target });
}

/**
 * Transpose (Excel's "switch row / column"): row fields become column fields and vice versa
 * (`Department › Line × Month` → `Month × Department › Line`), with expanded paths and column-group
 * paths trading places. At most `PIVOT_MAX_COLUMN_FIELDS` row fields (the innermost) move; outer
 * ones stay in Rows, in front of the former column fields. Dimensions lose `sortBy` / `topN` on the
 * way into Columns and `subtotal` on the way into Rows. Refused (same spec) when Rows would end up empty.
 */
export function swapPivotRowsColumns(spec: PivotSpec): PivotSpec {
  const columns = pivotColumnFields(spec);
  const intoColumns = spec.rows.slice(Math.max(0, spec.rows.length - PIVOT_MAX_COLUMN_FIELDS));
  const stay = spec.rows.slice(0, spec.rows.length - intoColumns.length);
  const rows = [...stay, ...columns.map(stripRowOnly)];
  if (rows.length === 0) return spec;
  const layout = layoutOf(spec);
  layout.rows = rows;
  layout.columns = intoColumns.map((d) => ({ kind: "dim" as const, dim: stripColumnOnly(d) }));
  if (pivotShowsValuesField(spec)) layout.columns.push({ kind: "values" });
  if (layout.rows.length === 0 || layout.values.length === 0) return spec;
  let next = applyLayout(spec, layout);
  if (stay.length === 0) {
    // Whole hierarchies swap, so their expanded paths do too.
    next = omitKeys(next, "expanded", "columnsExpanded");
    if (spec.columnsExpanded !== undefined && rows.length > 1) next = { ...next, expanded: spec.columnsExpanded };
    if (spec.expanded !== undefined && intoColumns.length > 1) next = { ...next, columnsExpanded: spec.expanded };
  }
  return JSON.stringify(next) === JSON.stringify(spec) ? spec : next;
}

// ---------------------------------------------------------------------------
// Date grouping
// ---------------------------------------------------------------------------

/** Name of `source`'s derived field for `group`: a catalogue entry with that source + group, else `source:group`. */
export function pivotDateGroupField(fields: readonly PivotFieldSpec[], source: string, group: PivotDateGroup): string {
  return fields.find((f) => f.source === source && f.dateGroup === group)?.field ?? pivotDateFieldName(source, group);
}

/** Default groups (as field names) for a date field dropped from the field list into `to`, or `[]`. */
function defaultDateGroups(
  spec: PivotSpec,
  fields: readonly PivotFieldSpec[],
  field: string,
  to: "rows" | "columns" | "filters",
  override: PivotFieldMoveOptions["dateGrouping"],
): string[] {
  const info = fieldInfo(fields, field);
  if (!info.dateGroups?.length || info.source) return [];
  const wanted = (override ? override[to] : undefined) ?? PIVOT_DEFAULT_DATE_GROUPING[to];
  const placed = new Set([...spec.rows.map((d) => d.field), ...pivotColumnFields(spec).map((d) => d.field), ...pivotFilterAreaFields(spec)]);
  return wanted.filter((g) => info.dateGroups!.includes(g)).map((g) => pivotDateGroupField(fields, field, g)).filter((f) => !placed.has(f));
}

/** Drop the derived fields `names` into `to` one after another (the auto-grouped date drop). */
function planDateGroupDrop(
  spec: PivotSpec,
  names: readonly string[],
  to: "rows" | "columns" | "filters",
  index: number | undefined,
  options: PivotFieldMoveOptions,
): PivotFieldMovePlan {
  let current = spec;
  let at = index;
  let displaced: PivotFieldMovePlan["displaced"];
  const grouped: string[] = [];
  let refusal: PivotFieldMovePlan | null = null;
  for (const name of names) {
    const plan = planPivotFieldMove(current, { field: name, from: "unused", to, index: at }, { ...options, dateGrouping: false });
    if (!plan.changed) {
      refusal ??= plan;
      continue;
    }
    current = plan.spec;
    displaced ??= plan.displaced;
    grouped.push(name);
    at = indexIn(current, layoutOf(current), to, name) + 1;
  }
  if (!grouped.length) return refusal ? { ...refusal, spec } : { spec, changed: false, reason: "unchanged" };
  return { spec: current, changed: true, grouped, ...(displaced ? { displaced } : {}) };
}

/** Where a date field is grouped: the area holding it or its derived fields, and the groups there. */
export interface PivotDateGrouping {
  readonly area: "rows" | "columns" | "filters" | null;
  /** Groups in that area, in area order (`[]` when the raw field sits there, or nowhere). */
  readonly groups: readonly PivotDateGroup[];
  /** The raw date field itself sits in `area`. */
  readonly raw: boolean;
}

/**
 * Current grouping of the date field `source` (see `setPivotDateGrouping`): in `options.area`, else
 * in the first of Rows, Columns, Filters that holds it.
 */
export function pivotDateGroupingOf(
  spec: PivotSpec,
  source: string,
  options: PivotFieldMoveOptions & { readonly area?: "rows" | "columns" | "filters" } = {},
): PivotDateGrouping {
  const fields = options.fields ?? resolvePivotFields(spec);
  const groupOf = (f: string): PivotDateGroup | null => {
    const info = f === source ? null : fieldInfo(fields, f);
    return info?.source === source ? info.dateGroup! : null;
  };
  const areas: ["rows" | "columns" | "filters", string[]][] = [
    ["rows", spec.rows.map((d) => d.field)],
    ["columns", pivotColumnFields(spec).map((d) => d.field)],
    ["filters", pivotFilterAreaFields(spec)],
  ];
  for (const [area, list] of areas) {
    if (options.area && area !== options.area) continue;
    const raw = list.includes(source);
    const groups = list.flatMap((f) => {
      const g = groupOf(f);
      return g ? [g] : [];
    });
    if (raw || groups.length) return { area, groups, raw };
  }
  return { area: options.area ?? null, groups: [], raw: false };
}

/**
 * Excel's "Group by…" for a date field: replace `source` and its derived fields in `options.area`
 * (default: the first of Rows, Columns, Filters that holds them, else Rows) with
 * the derived fields of `groups`, in `PIVOT_DATE_GROUPS` order (coarse to fine), at the same position.
 * Groups placed in another area move here; fields that leave the layout lose their filters; Columns
 * keep at most `PIVOT_MAX_COLUMN_FIELDS` fields (the finest groups are dropped). `groups: []`
 * ungroups, putting the raw date field back. Returns the same spec when nothing changes.
 */
export function setPivotDateGrouping(
  spec: PivotSpec,
  source: string,
  groups: readonly PivotDateGroup[],
  options: PivotFieldMoveOptions & { readonly area?: "rows" | "columns" | "filters" } = {},
): PivotSpec {
  const fields = options.fields ?? resolvePivotFields(spec);
  const ordered = PIVOT_DATE_GROUPS.filter((g) => groups.includes(g));
  const names = ordered.map((g) => pivotDateGroupField(fields, source, g));
  const family = (f: string) => f === source || fieldInfo(fields, f).source === source;
  const area = options.area ?? pivotDateGroupingOf(spec, source, { fields }).area ?? "rows";
  const wanted = names.length ? names : fieldInfo(fields, source).areas.includes(area) ? [source] : [];
  const layout = layoutOf(spec);
  const isDim = (c: ColumnEntry): c is Extract<ColumnEntry, { kind: "dim" }> => c.kind === "dim";
  const keepDim = (d: PivotDimension) => !family(d.field) && !wanted.includes(d.field);
  const labelOf = (f: string) => fieldInfo(fields, f).label;
  const existing = new Map<string, PivotDimension>();
  for (const d of [...layout.rows, ...layout.columns.filter(isDim).map((c) => c.dim)]) existing.set(d.field, d);
  const dimFor = (f: string): PivotDimension => existing.get(f) ?? { field: f, label: labelOf(f) };
  const filterAreaBefore = pivotFilterAreaFields(spec);

  if (area === "rows") {
    const at = layout.rows.findIndex((d) => family(d.field));
    const before = at < 0 ? layout.rows.length : layout.rows.slice(0, at).filter(keepDim).length;
    layout.rows = layout.rows.filter(keepDim);
    layout.rows.splice(before, 0, ...wanted.map((f) => stripRowOnly(dimFor(f))));
    layout.columns = layout.columns.filter((c) => !isDim(c) || keepDim(c.dim));
  } else if (area === "columns") {
    const at = layout.columns.findIndex((c) => isDim(c) && family(c.dim.field));
    const before = at < 0 ? layout.columns.length : layout.columns.slice(0, at).filter((c) => !isDim(c) || keepDim(c.dim)).length;
    layout.columns = layout.columns.filter((c) => !isDim(c) || keepDim(c.dim));
    const room = Math.max(0, PIVOT_MAX_COLUMN_FIELDS - layout.columns.filter(isDim).length);
    layout.columns.splice(before, 0, ...wanted.slice(0, room).map((f) => ({ kind: "dim" as const, dim: stripColumnOnly(dimFor(f)) })));
    layout.rows = layout.rows.filter(keepDim);
  } else {
    const at = filterAreaBefore.findIndex(family);
    const others = filterAreaBefore.filter((f) => !family(f) && !wanted.includes(f));
    const position = at < 0 ? others.length : filterAreaBefore.slice(0, at).filter((f) => !family(f) && !wanted.includes(f)).length;
    layout.filters = layout.filters.filter((f) => !(family(f.field) && filterAreaBefore.includes(f.field) && !wanted.includes(f.field)));
    let areaFields = others;
    wanted.forEach((f, i) => {
      layout.filters = placeFilterField(layout.filters, areaFields, f, position + i, { field: f, label: labelOf(f) });
      areaFields = [...areaFields.slice(0, position + i), f, ...areaFields.slice(position + i)];
    });
    layout.rows = layout.rows.filter(keepDim);
    layout.columns = layout.columns.filter((c) => !isDim(c) || keepDim(c.dim));
  }
  // Family fields that left Rows / Columns (and did not move to Filters) lose their filters, like a removal.
  const placed = new Set([...layout.rows.map((d) => d.field), ...layout.columns.filter(isDim).map((c) => c.dim.field)]);
  const removed = new Set(
    [...spec.rows, ...pivotColumnFields(spec)].map((d) => d.field).filter((f) => family(f) && !placed.has(f) && !(area === "filters" && wanted.includes(f))),
  );
  layout.filters = layout.filters.filter((f) => !removed.has(f.field));
  return finish(spec, layout).spec;
}

/**
 * Checkbox in the field list: `checked` adds the field to its default area (Values for numeric
 * types, otherwise Rows; else the first allowed area); unchecking removes it from every area
 * (refused parts are skipped, e.g. the last row field stays).
 */
export function togglePivotField(spec: PivotSpec, field: string, checked: boolean, options: PivotFieldMoveOptions = {}): PivotSpec {
  const fields = options.fields ?? resolvePivotFields(spec);
  const state = pivotFieldListState(spec, fields);
  if (checked) {
    const calc = state.calculated.find((m) => m.id === field);
    if (calc) return calc.inValues ? spec : movePivotField(spec, { field, from: "unused", to: "values" }, { fields });
    const entry = state.fields.find((f) => f.field === field);
    if (entry?.checked) return spec;
    const info = entry ?? fieldInfo(fields, field);
    const preferred: PivotFieldArea = NUMERIC_TYPES.has(info.type) ? "values" : "rows";
    const area = info.areas.includes(preferred) ? preferred : info.areas[0];
    return area ? movePivotField(spec, { field, from: "unused", to: area }, { fields }) : spec;
  }
  const calc = state.calculated.find((m) => m.id === field);
  if (calc) return movePivotField(spec, { field, from: "values", to: "unused" }, { fields });
  let next = spec;
  for (const v of state.values) if (v.sourceField === field) next = movePivotField(next, { field: v.field, from: "values", to: "unused" }, { fields });
  for (const area of ["rows", "columns", "filters"] as const) {
    if (state[area].some((i) => i.field === field)) next = movePivotField(next, { field, from: area, to: "unused" }, { fields });
  }
  return next;
}

/** Keep `field` in the Filters area after its filter was cleared (adds a `{ field }` placeholder). */
export function ensurePivotFilterField(spec: PivotSpec, field: string, label?: string): PivotSpec {
  if (spec.filters?.some((f) => f.field === field)) return spec;
  if (spec.rows.some((d) => d.field === field) || pivotColumnFields(spec).some((d) => d.field === field)) return spec;
  return { ...spec, filters: [...(spec.filters ?? []), { field, ...(label && label !== field ? { label } : {}) }] };
}
