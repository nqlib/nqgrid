import { PIVOT_SPEC_VERSION, type PivotSpec } from "./types";

const isPathList = (v: unknown): boolean =>
  v === "all" || v === "none" || (Array.isArray(v) && v.every((p) => Array.isArray(p) && p.every((k) => typeof k === "string")));

export type PivotSpecValidation =
  | { readonly ok: true; readonly spec: PivotSpec }
  | { readonly ok: false; readonly errors: readonly string[] };

const BUILT_IN_AGGREGATES = new Set(["sum", "avg", "min", "max", "count", "first", "last"]);
const SHOW_AS = new Set([
  "value",
  "percentOfColumnTotal",
  "percentOfParentRow",
  "percentOfParentColumn",
  "percentOfRowTotal",
  "percentOfGrandTotal",
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

/**
 * Structural + referential validation for specs arriving over the wire (e.g. from Python).
 * The JSON Schema in `contract/pivot/v1` covers structure; this also checks that measure ids
 * referenced by `values`, `heat`, `headerCharts`, `kpis`, `sortBy` and `topN` exist, that
 * `sortBy` / `topN` sit on row dimensions and `subtotal` on column dimensions, that a field is not
 * used twice across rows and columns, that filters / facets are well-formed, and that the field
 * catalogue (`fields`, `fieldLabels`, date grouping) and `valuesIndex` are well-formed.
 */
export function validatePivotSpec(input: unknown): PivotSpecValidation {
  const errors: string[] = [];
  if (!isObject(input)) return { ok: false, errors: ["spec must be an object"] };

  if (input.version !== PIVOT_SPEC_VERSION) {
    errors.push(`version must be ${PIVOT_SPEC_VERSION} (got ${JSON.stringify(input.version)})`);
  }

  /** Measure references inside dimensions, checked once measures are known. */
  const dimensionRefs: [unknown, string][] = [];
  const checkDimension = (d: unknown, where: string, isRow: boolean) => {
    if (!isObject(d) || !isNonEmptyString(d.field)) {
      errors.push(`${where}.field must be a non-empty string`);
      return;
    }
    if (d.sortBy !== undefined) {
      if (!isRow) errors.push(`${where}.sortBy is only supported on row dimensions`);
      else if (!isObject(d.sortBy)) errors.push(`${where}.sortBy must be an object`);
      else {
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
    if (d.subtotal !== undefined) {
      if (isRow) errors.push(`${where}.subtotal is only supported on column dimensions`);
      else if (!SUBTOTALS.has(d.subtotal as string)) errors.push(`${where}.subtotal must be "end" | "start" | "none"`);
    }
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

      const agg = m.aggregate ?? "sum";
      let needsField = true;
      if (typeof agg === "string") {
        if (!BUILT_IN_AGGREGATES.has(agg)) errors.push(`${where}.aggregate "${agg}" is not supported`);
        needsField = agg !== "count";
      } else if (isObject(agg)) {
        if (agg.type === "weightedAvg") {
          if (!isNonEmptyString(agg.weightField)) errors.push(`${where}.aggregate.weightField is required`);
        } else if (agg.type === "ratio") {
          needsField = false;
          if (!isNonEmptyString(agg.numeratorField) || !isNonEmptyString(agg.denominatorField)) {
            errors.push(`${where}.aggregate ratio needs numeratorField and denominatorField`);
          }
        } else if (agg.type === "custom") {
          needsField = false;
          if (!isNonEmptyString(agg.name)) errors.push(`${where}.aggregate.name is required`);
        } else {
          errors.push(`${where}.aggregate.type ${JSON.stringify(agg.type)} is not supported`);
        }
      } else {
        errors.push(`${where}.aggregate must be a string or object`);
      }
      if (needsField && !isNonEmptyString(m.field)) errors.push(`${where}.field is required`);

      for (const key of ["showAs", "groupShowAs"] as const) {
        if (m[key] !== undefined && !SHOW_AS.has(m[key] as string)) {
          errors.push(`${where}.${key} ${JSON.stringify(m[key])} is not supported`);
        }
      }
    });
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

  if (isObject(input.heat)) {
    checkRef(input.heat.measure, "heat.measure");
    if (input.heat.scope !== undefined && !HEAT_SCOPES.has(input.heat.scope as string)) {
      errors.push(`heat.scope ${JSON.stringify(input.heat.scope)} is not supported`);
    }
    const levels = input.heat.levels;
    if (levels !== undefined && !(Number.isInteger(levels) && (levels as number) >= 2 && (levels as number) <= 32)) {
      errors.push("heat.levels must be an integer between 2 and 32");
    }
  }
  if (isObject(input.headerCharts)) checkRef(input.headerCharts.measure, "headerCharts.measure");

  if (input.kpis !== undefined) {
    if (!Array.isArray(input.kpis)) {
      errors.push("kpis must be an array");
    } else {
      input.kpis.forEach((k, i) => {
        if (!isObject(k) || !isNonEmptyString(k.id)) {
          errors.push(`kpis[${i}].id must be a non-empty string`);
          return;
        }
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
      input.filters.forEach((f, i) => {
        const where = `filters[${i}]`;
        if (!isObject(f) || !isNonEmptyString(f.field)) {
          errors.push(`${where}.field must be a non-empty string`);
          return;
        }
        for (const key of ["include", "exclude"] as const) {
          if (f[key] !== undefined && !isStringArray(f[key])) errors.push(`${where}.${key} must be an array of strings`);
        }
        if (f.match !== undefined) {
          if (!isObject(f.match) || !MATCH_OPS.has(f.match.op as string)) {
            errors.push(`${where}.match.op must be one of ${[...MATCH_OPS].join(" | ")}`);
          } else if (typeof f.match.value !== "string") {
            errors.push(`${where}.match.value must be a string`);
          }
        }
      });
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

/** Throws with every validation error joined, otherwise returns the typed spec. */
export function assertPivotSpec(input: unknown): PivotSpec {
  const result = validatePivotSpec(input);
  if (!result.ok) throw new Error(`Invalid pivot spec:\n- ${result.errors.join("\n- ")}`);
  return result.spec;
}
