import { findPivotCalcCycles, parsePivotCalc } from "./calc";
import { PIVOT_SPEC_VERSION, type PivotSpec } from "./types";

const isPathList = (v: unknown): boolean =>
  v === "all" || v === "none" || (Array.isArray(v) && v.every((p) => Array.isArray(p) && p.every((k) => typeof k === "string")));

export type PivotSpecValidation =
  | { readonly ok: true; readonly spec: PivotSpec }
  | { readonly ok: false; readonly errors: readonly string[] };

const BUILT_IN_AGGREGATES = new Set(["sum", "avg", "min", "max", "count", "first", "last", "distinctCount"]);
/** `showAs` kinds that need `showAsBase`. */
export const PIVOT_SHOW_AS_WITH_BASE: ReadonlySet<string> = new Set([
  "percentOf",
  "differenceFrom",
  "percentDifferenceFrom",
  "runningTotal",
  "percentRunningTotal",
  "rankAscending",
  "rankDescending",
]);
const SHOW_AS = new Set([
  "value",
  "percentOfColumnTotal",
  "percentOfParentRow",
  "percentOfParentColumn",
  "percentOfRowTotal",
  "percentOfGrandTotal",
  ...PIVOT_SHOW_AS_WITH_BASE,
]);
const DATE_GROUPS = new Set(["year", "quarter", "month", "week", "day", "yearMonth", "yearQuarter"]);
const SUBTOTALS = new Set(["end", "start", "none"]);
const HEAT_SCOPES = new Set(["all", "column", "row", "group"]);
const MATCH_OPS = new Set(["contains", "notContains", "beginsWith", "endsWith", "equals", "notEquals"]);
const FIELD_TYPES = new Set(["dimension", "measure", "date", "number", "text"]);
const FIELD_AREAS = new Set(["rows", "columns", "values", "filters"]);
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((k) => typeof k === "string");

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isInteger = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

const keySet = (keys: string) => new Set(keys.split(" "));
/** Keys the JSON Schema allows per object (`additionalProperties: false`), kept in sync with `pivot-spec.schema.json`. */
const SPEC_KEYS = keySet(
  "version id title subtitle units rows columns measures values totals expanded columnsExpanded heat headerCharts kpis kpiLevels layout filters facets fields fieldLabels valuesIndex",
);
const DIMENSION_KEYS = keySet("field label order sort keepEmpty blankLabel attributes sortBy topN subtotal subtotalLabel subtotalLabels calculatedItems itemFormats");
const CALCULATED_ITEM_KEYS = keySet("key formula label after before position format includeInTotals");
const SORT_BY_KEYS = keySet("measure direction columnKey");
const TOP_N_KEYS = keySet("measure count direction columnKey other otherLabel");
const MEASURE_KEYS = keySet("id field calculate label aggregate signField filter format percentFormat showAs groupShowAs showAsBase");
const SHOW_AS_BASE_KEYS = keySet("field item position scope");
const AGGREGATE_KEYS: Readonly<Record<string, ReadonlySet<string>>> = {
  weightedAvg: keySet("type weightField"),
  ratio: keySet("type numeratorField denominatorField offset"),
  custom: keySet("type name"),
  closingBalance: keySet("type timeField"),
  openingBalance: keySet("type timeField"),
  averageOverTime: keySet("type timeField"),
};
/** Semi-additive aggregate types (`{ type, timeField }`). */
export const PIVOT_TIME_AGGREGATES: ReadonlySet<string> = new Set(["closingBalance", "openingBalance", "averageOverTime"]);
const FORMAT_KEYS = keySet(
  "style currency currencySymbol decimals compact significantDigits compactUnits signDisplay negative prefix suffix groupSeparator decimalSeparator empty scale",
);
const TOTALS_KEYS = keySet("grandTotal grandTotalPosition grandTotalLabel rowTotal rowTotalLabel subtotalLabel");
const HEAT_KEYS = keySet("measure scope levels applyTo domain");
const HEADER_CHART_KEYS = keySet("measure type breakdown");
const KPI_KEYS = keySet("id label measure compareTo format deltaFormat");
const FILTER_KEYS = keySet("field include exclude match label");
const MATCH_KEYS = keySet("op value caseSensitive");
const FACET_KEYS = keySet("field label");
const FIELD_KEYS = keySet(
  "field label type areas aggregate format description source dateGroup fiscalYearStartMonth timeZoneOffsetMinutes monthNames dateGroups",
);
/** `format.scale` values: Excel can only scale by powers of 1000 (`#,##0,` / `#,##0,,` / `#,##0,,,`). */
export const PIVOT_FORMAT_SCALES: readonly number[] = [1000, 1_000_000, 1_000_000_000];

/** Python `repr()` of a string, so unknown-key messages match the Python validator byte for byte. */
function pyRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  const body = s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
  return quote + (quote === "'" ? body.replace(/'/g, "\\'") : body) + quote;
}

/**
 * `path: unknown key(s) ('a', 'b' were unexpected)` — the message the Python validator derives from
 * the JSON Schema's `additionalProperties: false` (keys sorted).
 */
export function pivotUnknownKeysMessage(where: string, keys: readonly string[]): string {
  const sorted = [...keys].sort();
  return `${where || "(root)"}: unknown key(s) (${sorted.map(pyRepr).join(", ")} ${sorted.length === 1 ? "was" : "were"} unexpected)`;
}

const quoted = (values: Iterable<string>) => [...values].map((v) => JSON.stringify(v)).join(" | ");

/**
 * Structural + referential validation for specs arriving over the wire (e.g. from Python).
 * The JSON Schema in `contract/pivot/v1` covers structure; this also checks that measure ids
 * referenced by `values`, `heat`, `headerCharts`, `kpis`, `sortBy` and `topN` exist, that
 * `sortBy` / `topN` sit on row dimensions, that a field is not used twice across rows and columns,
 * that calculated measures parse (`parsePivotCalc`), reference existing measures and form no
 * cycle, that `showAsBase` names a row / column field, that filters / facets are well-formed, and
 * that the field catalogue (`fields`, `fieldLabels`, date grouping) and `valuesIndex` are well-formed.
 */
export function validatePivotSpec(input: unknown): PivotSpecValidation {
  const errors: string[] = [];
  if (!isObject(input)) return { ok: false, errors: ["spec must be an object"] };

  if (input.version !== PIVOT_SPEC_VERSION) {
    errors.push(`version must be ${PIVOT_SPEC_VERSION} (got ${JSON.stringify(input.version)})`);
  }
  const unknown = (obj: Record<string, unknown>, allowed: ReadonlySet<string>, where: string) => {
    const extra = Object.keys(obj).filter((k) => !allowed.has(k));
    if (extra.length) errors.push(pivotUnknownKeysMessage(where, extra));
  };
  const optString = (v: unknown, where: string) => {
    if (v !== undefined && typeof v !== "string") errors.push(`${where} must be a string`);
  };
  const optBoolean = (v: unknown, where: string) => {
    if (v !== undefined && typeof v !== "boolean") errors.push(`${where} must be a boolean`);
  };
  const optEnum = (v: unknown, allowed: readonly string[], where: string) => {
    if (v !== undefined && !allowed.includes(v as string)) errors.push(`${where} must be ${quoted(allowed)}`);
  };
  const optInteger = (v: unknown, min: number, max: number, where: string) => {
    if (v !== undefined && !(isInteger(v) && v >= min && v <= max)) {
      errors.push(max === Infinity ? `${where} must be an integer ≥ ${min}` : `${where} must be an integer between ${min} and ${max}`);
    }
  };
  /** `PivotNumberFormat` (`format`, `percentFormat`, KPI and catalogue formats). */
  const checkFormat = (f: unknown, where: string) => {
    if (f === undefined) return;
    if (!isObject(f)) {
      errors.push(`${where} must be an object`);
      return;
    }
    unknown(f, FORMAT_KEYS, where);
    optEnum(f.style, ["decimal", "currency", "percent"], `${where}.style`);
    if (f.currency !== undefined && !(typeof f.currency === "string" && f.currency.length === 3)) errors.push(`${where}.currency must be a 3-letter ISO 4217 code`);
    for (const key of ["currencySymbol", "prefix", "suffix", "groupSeparator", "decimalSeparator", "empty"] as const) optString(f[key], `${where}.${key}`);
    optInteger(f.decimals, 0, 20, `${where}.decimals`);
    optInteger(f.significantDigits, 1, 21, `${where}.significantDigits`);
    optBoolean(f.compact, `${where}.compact`);
    if (f.compactUnits !== undefined && !(isStringArray(f.compactUnits) && f.compactUnits.length === 4)) errors.push(`${where}.compactUnits must be an array of 4 strings`);
    optEnum(f.signDisplay, ["auto", "always", "exceptZero", "never"], `${where}.signDisplay`);
    optEnum(f.negative, ["minus", "parentheses"], `${where}.negative`);
    if (f.scale !== undefined) {
      if (!PIVOT_FORMAT_SCALES.includes(f.scale as number)) errors.push(`${where}.scale must be 1000, 1000000 or 1000000000`);
      else if (f.compact === true) errors.push(`${where}: scale cannot be combined with compact (pick one)`);
      else if (f.style === "percent") errors.push(`${where}: scale does not apply to percent style`);
    }
  };

  /** A report filter or a measure filter (`PivotFilter`). */
  const checkFilter = (f: unknown, where: string) => {
    if (!isObject(f) || !isNonEmptyString(f.field)) {
      errors.push(`${where}.field must be a non-empty string`);
      return;
    }
    unknown(f, FILTER_KEYS, where);
    optString(f.label, `${where}.label`);
    for (const key of ["include", "exclude"] as const) {
      if (f[key] !== undefined && !isStringArray(f[key])) errors.push(`${where}.${key} must be an array of strings`);
    }
    if (f.match !== undefined) {
      if (!isObject(f.match) || !MATCH_OPS.has(f.match.op as string)) {
        errors.push(`${where}.match.op must be one of ${[...MATCH_OPS].join(" | ")}`);
      } else {
        unknown(f.match, MATCH_KEYS, `${where}.match`);
        if (typeof f.match.value !== "string") errors.push(`${where}.match.value must be a string`);
        optBoolean(f.match.caseSensitive, `${where}.match.caseSensitive`);
      }
    }
  };

  unknown(input, SPEC_KEYS, "");
  for (const key of ["id", "title", "subtitle", "units"] as const) optString(input[key], key);
  optEnum(input.layout, ["tabular", "compact"], "layout");
  if (input.totals !== undefined) {
    if (!isObject(input.totals)) errors.push("totals must be an object");
    else {
      const t = input.totals;
      unknown(t, TOTALS_KEYS, "totals");
      optBoolean(t.grandTotal, "totals.grandTotal");
      optBoolean(t.rowTotal, "totals.rowTotal");
      optEnum(t.grandTotalPosition, ["top", "bottom"], "totals.grandTotalPosition");
      for (const key of ["grandTotalLabel", "rowTotalLabel", "subtotalLabel"] as const) optString(t[key], `totals.${key}`);
    }
  }
  if (input.kpiLevels !== undefined && !(Array.isArray(input.kpiLevels) && input.kpiLevels.every((l) => isInteger(l) && l >= 0))) {
    errors.push("kpiLevels must be an array of integers ≥ 0");
  }

  /** Measure references inside dimensions, checked once measures are known. */
  const dimensionRefs: [unknown, string][] = [];
  const checkDimension = (d: unknown, where: string, isRow: boolean) => {
    if (!isObject(d) || !isNonEmptyString(d.field)) {
      errors.push(`${where}.field must be a non-empty string`);
      return;
    }
    unknown(d, DIMENSION_KEYS, where);
    optString(d.label, `${where}.label`);
    optString(d.blankLabel, `${where}.blankLabel`);
    if (d.keepEmpty !== undefined) {
      if (typeof d.keepEmpty !== "boolean") errors.push(`${where}.keepEmpty must be a boolean`);
      else if (isRow) errors.push(`${where}.keepEmpty is only supported on column dimensions`);
    }
    if (d.attributes !== undefined && !(Array.isArray(d.attributes) && d.attributes.every(isNonEmptyString))) {
      errors.push(`${where}.attributes must be an array of non-empty strings`);
    }
    if (d.sortBy !== undefined) {
      if (!isRow) errors.push(`${where}.sortBy is only supported on row dimensions`);
      else if (!isObject(d.sortBy)) errors.push(`${where}.sortBy must be an object`);
      else {
        unknown(d.sortBy, SORT_BY_KEYS, `${where}.sortBy`);
        dimensionRefs.push([d.sortBy.measure ?? null, `${where}.sortBy.measure`]);
        if (d.sortBy.direction !== undefined && !["asc", "desc"].includes(d.sortBy.direction as string)) {
          errors.push(`${where}.sortBy.direction must be "asc" | "desc"`);
        }
        if (d.sortBy.columnKey !== undefined && typeof d.sortBy.columnKey !== "string") errors.push(`${where}.sortBy.columnKey must be a string`);
      }
    }
    if (d.topN !== undefined) {
      if (!isRow) errors.push(`${where}.topN is only supported on row dimensions`);
      else if (!isObject(d.topN)) errors.push(`${where}.topN must be an object`);
      else {
        const t = d.topN;
        unknown(t, TOP_N_KEYS, `${where}.topN`);
        optString(t.otherLabel, `${where}.topN.otherLabel`);
        dimensionRefs.push([t.measure ?? null, `${where}.topN.measure`]);
        if (!(Number.isInteger(t.count) && (t.count as number) >= 1)) errors.push(`${where}.topN.count must be an integer ≥ 1`);
        if (t.direction !== undefined && !["top", "bottom"].includes(t.direction as string)) {
          errors.push(`${where}.topN.direction must be "top" | "bottom"`);
        }
        if (t.columnKey !== undefined && typeof t.columnKey !== "string") errors.push(`${where}.topN.columnKey must be a string`);
        if (t.other !== undefined && typeof t.other !== "boolean") errors.push(`${where}.topN.other must be a boolean`);
      }
    }
    if (d.order !== undefined && !(Array.isArray(d.order) && d.order.every((k) => typeof k === "string"))) {
      errors.push(`${where}.order must be an array of strings`);
    }
    if (d.sort !== undefined && !["asc", "desc", "none"].includes(d.sort as string)) {
      errors.push(`${where}.sort must be "asc" | "desc" | "none"`);
    }
    if (d.subtotal !== undefined && !SUBTOTALS.has(d.subtotal as string)) errors.push(`${where}.subtotal must be "end" | "start" | "none"`);
    if (d.subtotalLabel !== undefined && typeof d.subtotalLabel !== "string") errors.push(`${where}.subtotalLabel must be a string`);
    if (d.subtotalLabels !== undefined && !(isObject(d.subtotalLabels) && Object.values(d.subtotalLabels).every((v) => typeof v === "string"))) {
      errors.push(`${where}.subtotalLabels must be an object of strings`);
    }
    if (d.itemFormats !== undefined) {
      if (!isRow) errors.push(`${where}.itemFormats is only supported on row dimensions`);
      else if (!isObject(d.itemFormats)) errors.push(`${where}.itemFormats must be an object of number formats`);
      else for (const [key, f] of Object.entries(d.itemFormats)) checkFormat(f, `${where}.itemFormats.${key}`);
    }
    if (d.calculatedItems !== undefined) {
      if (!isRow) errors.push(`${where}.calculatedItems is only supported on row dimensions`);
      else if (!Array.isArray(d.calculatedItems)) errors.push(`${where}.calculatedItems must be an array`);
      else checkCalculatedItems(d.calculatedItems, where);
    }
  };
  /** Calculated items of a row dimension: shape, unique keys, one placement, formula grammar, cycles among items. */
  const checkCalculatedItems = (list: readonly unknown[], dimWhere: string) => {
    const keys = new Set<string>();
    const refs = new Map<string, readonly string[]>();
    const whereOf = new Map<string, string>();
    list.forEach((it, j) => {
      const where = `${dimWhere}.calculatedItems[${j}]`;
      if (!isObject(it) || !isNonEmptyString(it.key)) {
        errors.push(`${where}.key must be a non-empty string`);
        return;
      }
      unknown(it, CALCULATED_ITEM_KEYS, where);
      const key = it.key;
      if (keys.has(key)) errors.push(`${where}.key "${key}" is duplicated`);
      keys.add(key);
      optString(it.label, `${where}.label`);
      optString(it.after, `${where}.after`);
      optString(it.before, `${where}.before`);
      optEnum(it.position, ["start", "end"], `${where}.position`);
      optBoolean(it.includeInTotals, `${where}.includeInTotals`);
      checkFormat(it.format, `${where}.format`);
      if ([it.after, it.before, it.position].filter((v) => v !== undefined).length > 1) errors.push(pivotItemPlacementMessage(where));
      if (it.after === key || it.before === key) errors.push(`${where}: cannot be placed after or before itself`);
      if (typeof it.formula !== "string") {
        errors.push(`${where}.formula must be a string`);
        return;
      }
      const parsed = parsePivotCalc(it.formula, { allowReservedNames: true });
      if (!parsed.ok) {
        errors.push(`${where}.formula: ${parsed.error.message} (at ${parsed.error.position})`);
        return;
      }
      if (!refs.has(key)) {
        refs.set(key, parsed.references);
        whereOf.set(key, where);
      }
    });
    for (const cycle of findPivotCalcCycles(refs)) errors.push(`${whereOf.get(cycle[0]) ?? dimWhere}.formula: reference cycle ${cycle.join(" → ")}`);
  };

  const dimensionFields: [string, string][] = [];
  const collect = (d: unknown, where: string) => {
    if (isObject(d) && isNonEmptyString(d.field)) dimensionFields.push([d.field, where]);
  };
  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    errors.push("rows must be a non-empty array of dimensions");
  } else {
    input.rows.forEach((d, i) => {
      checkDimension(d, `rows[${i}]`, true);
      collect(d, `rows[${i}]`);
    });
  }
  if (input.columns !== undefined) {
    if (Array.isArray(input.columns)) {
      if (input.columns.length === 0) errors.push("columns must be a dimension or a non-empty array of dimensions");
      input.columns.forEach((d, i) => {
        checkDimension(d, `columns[${i}]`, false);
        collect(d, `columns[${i}]`);
      });
    } else {
      checkDimension(input.columns, "columns", false);
      collect(input.columns, "columns");
    }
  }
  const firstUse = new Map<string, string>();
  for (const [field, where] of dimensionFields) {
    const prev = firstUse.get(field);
    if (prev !== undefined) errors.push(`${where}.field "${field}" is already used by ${prev}`);
    else firstUse.set(field, where);
  }

  const measureIds = new Set<string>();
  /** Calculated measures, checked once every measure id is known. */
  const calcs: { readonly id: string; readonly where: string; readonly expr: unknown }[] = [];
  /** `showAsBase` fields, checked against the row / column fields. */
  const showAsBases: { readonly where: string; readonly base: unknown; readonly needed: boolean; readonly kinds: readonly unknown[] }[] = [];
  /** `showAs` (leaf kind) other than `value`, per measure id: calculated measures cannot reference these. */
  const showAsOf = new Map<string, string>();
  if (!Array.isArray(input.measures) || input.measures.length === 0) {
    errors.push("measures must be a non-empty array");
  } else {
    input.measures.forEach((m, i) => {
      const where = `measures[${i}]`;
      if (!isObject(m) || !isNonEmptyString(m.id)) {
        errors.push(`${where}.id must be a non-empty string`);
        return;
      }
      if (measureIds.has(m.id)) errors.push(`${where}.id "${m.id}" is duplicated`);
      measureIds.add(m.id);
      unknown(m, MEASURE_KEYS, where);
      optString(m.label, `${where}.label`);
      if (m.field !== undefined && !isNonEmptyString(m.field)) errors.push(`${where}.field must be a non-empty string`);
      checkFormat(m.format, `${where}.format`);
      checkFormat(m.percentFormat, `${where}.percentFormat`);
      if (typeof m.showAs === "string" && m.showAs !== "value") showAsOf.set(m.id, m.showAs);

      for (const key of ["showAs", "groupShowAs"] as const) {
        if (m[key] !== undefined && !SHOW_AS.has(m[key] as string)) {
          errors.push(`${where}.${key} ${JSON.stringify(m[key])} is not supported`);
        }
      }
      const needsBase = PIVOT_SHOW_AS_WITH_BASE.has(m.showAs as string) || PIVOT_SHOW_AS_WITH_BASE.has(m.groupShowAs as string);
      if (m.showAsBase !== undefined || needsBase) showAsBases.push({ where, base: m.showAsBase, needed: needsBase, kinds: [m.showAs, m.groupShowAs] });

      if (m.signField !== undefined && !isNonEmptyString(m.signField)) errors.push(`${where}.signField must be a non-empty string`);
      if (m.filter !== undefined) {
        if (Array.isArray(m.filter)) m.filter.forEach((f, j) => checkFilter(f, `${where}.filter[${j}]`));
        else if (isObject(m.filter)) checkFilter(m.filter, `${where}.filter`);
        else errors.push(`${where}.filter must be a filter object or an array of filters`);
      }
      if (m.calculate !== undefined) {
        if (m.field !== undefined || m.aggregate !== undefined) errors.push(`${where}: calculate cannot be combined with field or aggregate`);
        if (m.signField !== undefined) errors.push(`${where}: signField cannot be combined with calculate (sign the measures it references)`);
        if (m.filter !== undefined) errors.push(pivotCalcFilterMessage(where));
        calcs.push({ id: m.id, where, expr: m.calculate });
        return;
      }

      const agg = m.aggregate ?? "sum";
      let needsField = true;
      if (typeof agg === "string") {
        if (!BUILT_IN_AGGREGATES.has(agg)) errors.push(`${where}.aggregate "${agg}" is not supported`);
        needsField = agg !== "count";
      } else if (isObject(agg)) {
        const aggKeys = typeof agg.type === "string" ? AGGREGATE_KEYS[agg.type] : undefined;
        if (aggKeys) unknown(agg, aggKeys, `${where}.aggregate`);
        if (agg.type === "weightedAvg") {
          if (!isNonEmptyString(agg.weightField)) errors.push(`${where}.aggregate.weightField is required`);
        } else if (agg.type === "ratio") {
          needsField = false;
          if (!isNonEmptyString(agg.numeratorField) || !isNonEmptyString(agg.denominatorField)) {
            errors.push(`${where}.aggregate ratio needs numeratorField and denominatorField`);
          }
          if (agg.offset !== undefined && typeof agg.offset !== "number") errors.push(`${where}.aggregate.offset must be a number`);
        } else if (agg.type === "custom") {
          needsField = false;
          if (!isNonEmptyString(agg.name)) errors.push(`${where}.aggregate.name is required`);
        } else if (PIVOT_TIME_AGGREGATES.has(agg.type as string)) {
          if (!isNonEmptyString(agg.timeField)) errors.push(`${where}.aggregate.timeField is required`);
        } else {
          errors.push(`${where}.aggregate.type ${JSON.stringify(agg.type)} is not supported`);
        }
      } else {
        errors.push(`${where}.aggregate must be a string or object`);
      }
      if (needsField && !isNonEmptyString(m.field)) errors.push(`${where}.field is required`);
      if (m.signField !== undefined && (agg === "count" || agg === "distinctCount" || (isObject(agg) && agg.type === "custom"))) {
        const name = typeof agg === "string" ? agg : "custom";
        errors.push(`${where}.signField is not supported with aggregate ${JSON.stringify(name)} (it signs values; counts have none)`);
      }
    });
  }

  // Calculated measures: grammar, references (other measure ids), cycles.
  const calcRefs = new Map<string, readonly string[]>();
  for (const c of calcs) {
    const parsed = parsePivotCalc(c.expr, { references: measureIds });
    if (!parsed.ok) {
      errors.push(`${c.where}.calculate: ${parsed.error.message} (at ${parsed.error.position})`);
      continue;
    }
    calcRefs.set(c.id, parsed.references);
    for (const ref of parsed.references) {
      const kind = showAsOf.get(ref);
      if (kind) errors.push(pivotCalcShowAsMessage(c.where, ref, kind));
    }
  }
  for (const cycle of findPivotCalcCycles(calcRefs)) {
    const where = calcs.find((c) => c.id === cycle[0])?.where ?? "measures";
    errors.push(`${where}.calculate: reference cycle ${cycle.join(" → ")}`);
  }

  // showAsBase: required by % Of and the difference / running-total / rank kinds, names a row or
  // column field; % Of needs an item; scope "all" needs an item and a row field.
  const layoutFields = new Set(dimensionFields.map(([field]) => field));
  const rowFields = new Set(dimensionFields.filter(([, where]) => where.startsWith("rows[")).map(([field]) => field));
  for (const { where, base, needed, kinds } of showAsBases) {
    if (base === undefined) {
      if (needed) errors.push(`${where}.showAsBase is required by its showAs / groupShowAs`);
      continue;
    }
    if (!isObject(base) || !isNonEmptyString(base.field)) {
      errors.push(`${where}.showAsBase.field must be a non-empty string`);
      continue;
    }
    unknown(base, SHOW_AS_BASE_KEYS, `${where}.showAsBase`);
    if (!needed) {
      errors.push(pivotUnusedShowAsBaseMessage(where, kinds));
      continue;
    }
    if (!layoutFields.has(base.field)) errors.push(`${where}.showAsBase.field "${base.field}" is not a row or column field`);
    if (base.item !== undefined && typeof base.item !== "string") errors.push(`${where}.showAsBase.item must be a string`);
    if (base.position !== undefined && base.position !== "previous" && base.position !== "next") {
      errors.push(`${where}.showAsBase.position must be "previous" | "next"`);
    }
    if (kinds.includes("percentOf") && base.item === undefined) errors.push(`${where}.showAsBase.item is required by percentOf`);
    if (base.scope !== undefined) {
      if (base.scope !== "parent" && base.scope !== "all") errors.push(`${where}.showAsBase.scope must be "parent" | "all"`);
      else if (base.scope === "all") {
        if (base.item === undefined) errors.push(`${where}.showAsBase.scope "all" needs showAsBase.item`);
        if (layoutFields.has(base.field) && !rowFields.has(base.field)) errors.push(`${where}.showAsBase.scope "all" needs a row field (got column field "${base.field}")`);
        if (kinds.some((k) => k !== undefined && k !== "value" && k !== "percentOf" && k !== "differenceFrom" && k !== "percentDifferenceFrom" && PIVOT_SHOW_AS_WITH_BASE.has(k as string))) {
          errors.push(`${where}.showAsBase.scope "all" applies to percentOf / differenceFrom / percentDifferenceFrom only`);
        }
      }
    }
  }

  const checkRef = (id: unknown, where: string) => {
    if (id !== undefined && !(typeof id === "string" && measureIds.has(id))) {
      errors.push(`${where} references unknown measure ${JSON.stringify(id)}`);
    }
  };

  for (const [id, where] of dimensionRefs) {
    if (id === null) errors.push(`${where} is required`);
    else checkRef(id, where);
  }

  if (input.values !== undefined) {
    if (!Array.isArray(input.values) || input.values.length === 0) {
      errors.push("values must be a non-empty array of measure ids");
    } else {
      input.values.forEach((id, i) => {
        if (id === undefined) errors.push(`values[${i}] is missing`);
        else checkRef(id, `values[${i}]`);
      });
    }
  }

  if (input.expanded !== undefined && !isPathList(input.expanded)) {
    errors.push('expanded must be "all", "none", or an array of string key paths');
  }
  if (input.columnsExpanded !== undefined && !isPathList(input.columnsExpanded)) {
    errors.push('columnsExpanded must be "all", "none", or an array of string key paths');
  }

  if (input.heat !== undefined && input.heat !== null && !isObject(input.heat)) errors.push("heat must be an object or null");
  if (isObject(input.heat)) {
    unknown(input.heat, HEAT_KEYS, "heat");
    optEnum(input.heat.applyTo, ["leaf", "group", "all"], "heat.applyTo");
    const domain = input.heat.domain;
    if (domain !== undefined && !(Array.isArray(domain) && domain.length === 2 && domain.every((v) => typeof v === "number"))) {
      errors.push("heat.domain must be [min, max] numbers");
    }
    checkRef(input.heat.measure, "heat.measure");
    if (input.heat.scope !== undefined && !HEAT_SCOPES.has(input.heat.scope as string)) {
      errors.push(`heat.scope ${JSON.stringify(input.heat.scope)} is not supported`);
    }
    const levels = input.heat.levels;
    if (levels !== undefined && !(Number.isInteger(levels) && (levels as number) >= 2 && (levels as number) <= 32)) {
      errors.push("heat.levels must be an integer between 2 and 32");
    }
  }
  if (input.headerCharts !== undefined && input.headerCharts !== null && !isObject(input.headerCharts)) errors.push("headerCharts must be an object or null");
  if (isObject(input.headerCharts)) {
    unknown(input.headerCharts, HEADER_CHART_KEYS, "headerCharts");
    optEnum(input.headerCharts.type, ["bar", "line"], "headerCharts.type");
    optBoolean(input.headerCharts.breakdown, "headerCharts.breakdown");
    checkRef(input.headerCharts.measure, "headerCharts.measure");
  }

  if (input.kpis !== undefined) {
    if (!Array.isArray(input.kpis)) {
      errors.push("kpis must be an array");
    } else {
      input.kpis.forEach((k, i) => {
        if (!isObject(k) || !isNonEmptyString(k.id)) {
          errors.push(`kpis[${i}].id must be a non-empty string`);
          return;
        }
        unknown(k, KPI_KEYS, `kpis[${i}]`);
        optString(k.label, `kpis[${i}].label`);
        checkFormat(k.format, `kpis[${i}].format`);
        checkFormat(k.deltaFormat, `kpis[${i}].deltaFormat`);
        if (k.measure === undefined) errors.push(`kpis[${i}].measure is required`);
        checkRef(k.measure, `kpis[${i}].measure`);
        checkRef(k.compareTo, `kpis[${i}].compareTo`);
      });
    }
  }

  if (input.filters !== undefined) {
    if (!Array.isArray(input.filters)) {
      errors.push("filters must be an array");
    } else {
      input.filters.forEach((f, i) => checkFilter(f, `filters[${i}]`));
    }
  }

  if (input.facets !== undefined) {
    if (!Array.isArray(input.facets)) {
      errors.push("facets must be an array");
    } else {
      const seen = new Set<string>();
      input.facets.forEach((f, i) => {
        const field = typeof f === "string" ? f : isObject(f) ? f.field : undefined;
        if (!isNonEmptyString(field)) {
          errors.push(`facets[${i}] must be a field name or { field, label? }`);
          return;
        }
        if (isObject(f)) {
          unknown(f, FACET_KEYS, `facets[${i}]`);
          optString(f.label, `facets[${i}].label`);
        }
        if (seen.has(field)) errors.push(`facets[${i}] "${field}" is duplicated`);
        seen.add(field);
      });
    }
  }

  if (input.fields !== undefined) {
    if (!Array.isArray(input.fields)) {
      errors.push("fields must be an array");
    } else {
      const seen = new Set<string>();
      input.fields.forEach((f, i) => {
        const where = `fields[${i}]`;
        if (!isObject(f) || !isNonEmptyString(f.field)) {
          errors.push(`${where}.field must be a non-empty string`);
          return;
        }
        if (seen.has(f.field)) errors.push(`${where} "${f.field}" is duplicated`);
        seen.add(f.field);
        unknown(f, FIELD_KEYS, where);
        optString(f.label, `${where}.label`);
        optString(f.description, `${where}.description`);
        checkFormat(f.format, `${where}.format`);
        if (f.type !== undefined && !FIELD_TYPES.has(f.type as string)) {
          errors.push(`${where}.type must be one of ${[...FIELD_TYPES].join(" | ")}`);
        }
        if (f.areas !== undefined && !(Array.isArray(f.areas) && f.areas.every((a) => FIELD_AREAS.has(a as string)))) {
          errors.push(`${where}.areas must be an array of ${[...FIELD_AREAS].join(" | ")}`);
        }
        if (f.aggregate !== undefined && !BUILT_IN_AGGREGATES.has(f.aggregate as string)) {
          errors.push(`${where}.aggregate "${String(f.aggregate)}" is not supported`);
        }
        if (f.dateGroup !== undefined && !DATE_GROUPS.has(f.dateGroup as string)) {
          errors.push(`${where}.dateGroup must be one of ${[...DATE_GROUPS].join(" | ")}`);
        }
        if (f.source !== undefined && !isNonEmptyString(f.source)) errors.push(`${where}.source must be a non-empty string`);
        if ((f.source === undefined) !== (f.dateGroup === undefined)) errors.push(`${where}: source and dateGroup go together`);
        if (f.source !== undefined && f.source === f.field) errors.push(`${where}.source must differ from field`);
        const fy = f.fiscalYearStartMonth;
        if (fy !== undefined && !(Number.isInteger(fy) && (fy as number) >= 1 && (fy as number) <= 12)) {
          errors.push(`${where}.fiscalYearStartMonth must be an integer between 1 and 12`);
        }
        const tz = f.timeZoneOffsetMinutes;
        if (tz !== undefined && !(Number.isInteger(tz) && Math.abs(tz as number) <= 840)) {
          errors.push(`${where}.timeZoneOffsetMinutes must be an integer between -840 and 840`);
        }
        if (f.monthNames !== undefined && !(isStringArray(f.monthNames) && f.monthNames.length === 12)) {
          errors.push(`${where}.monthNames must be an array of 12 strings`);
        }
        if (f.dateGroups !== undefined && !(Array.isArray(f.dateGroups) && f.dateGroups.every((g) => DATE_GROUPS.has(g as string)))) {
          errors.push(`${where}.dateGroups must be an array of ${[...DATE_GROUPS].join(" | ")}`);
        }
      });
    }
  }
  if (input.fieldLabels !== undefined && !(isObject(input.fieldLabels) && Object.values(input.fieldLabels).every((v) => typeof v === "string"))) {
    errors.push("fieldLabels must be an object of strings");
  }
  if (input.valuesIndex !== undefined && !(Number.isInteger(input.valuesIndex) && (input.valuesIndex as number) >= 0)) {
    errors.push("valuesIndex must be an integer ≥ 0");
  }

  return errors.length ? { ok: false, errors } : { ok: true, spec: input as unknown as PivotSpec };
}

/**
 * A calculated measure that references a measure whose `showAs` is not `value`: the expression would
 * read the referenced measure's aggregated value *before* its show-as (a "YTD variance" over two
 * running totals would give the monthly variance), so it is rejected. A `groupShowAs` alone is fine:
 * leaf rows show the plain value, and group rows read the group's aggregate, as Excel calculated fields do.
 */
export function pivotCalcShowAsMessage(where: string, ref: string, kind: string): string {
  return (
    `${where}.calculate: references "${ref}", which has showAs "${kind}"; calculated measures read aggregated values before showAs. ` +
    `Reference the plain measure and put showAs on the calculated measure instead (e.g. calculate "actual - budget" with showAs "${kind}")`
  );
}

/** A calculated item with more than one of `after` / `before` / `position`. */
export function pivotItemPlacementMessage(where: string): string {
  return `${where}: use only one of after, before and position`;
}

/** A measure filter on a calculated measure (it aggregates nothing itself). */
export function pivotCalcFilterMessage(where: string): string {
  return `${where}: filter cannot be combined with calculate (filter the measures it references)`;
}

/** `showAsBase` set on a measure whose `showAs` / `groupShowAs` never reads it (it would be ignored). */
export function pivotUnusedShowAsBaseMessage(where: string, kinds: readonly unknown[]): string {
  const used = kinds.filter((k): k is string => typeof k === "string");
  const by = used.length ? `showAs ${used.map((k) => JSON.stringify(k)).join(" / ")}` : "a measure without showAs";
  return `${where}.showAsBase is not used by ${by} (only ${[...PIVOT_SHOW_AS_WITH_BASE].join(", ")} read it)`;
}

/** Throws with every validation error joined, otherwise returns the typed spec. */
export function assertPivotSpec(input: unknown): PivotSpec {
  const result = validatePivotSpec(input);
  if (!result.ok) throw new Error(`Invalid pivot spec:\n- ${result.errors.join("\n- ")}`);
  return result.spec;
}
