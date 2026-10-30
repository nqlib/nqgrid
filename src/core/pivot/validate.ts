import { PIVOT_SPEC_VERSION, type PivotSpec } from "./types";

export type PivotSpecValidation =
  | { readonly ok: true; readonly spec: PivotSpec }
  | { readonly ok: false; readonly errors: readonly string[] };

const BUILT_IN_AGGREGATES = new Set(["sum", "avg", "min", "max", "count", "first", "last"]);
const SHOW_AS = new Set([
  "value",
  "percentOfColumnTotal",
  "percentOfParentRow",
  "percentOfRowTotal",
  "percentOfGrandTotal",
]);
const HEAT_SCOPES = new Set(["all", "column", "row", "group"]);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.length > 0;

/**
 * Structural + referential validation for specs arriving over the wire (e.g. from Python).
 * The JSON Schema in `contract/pivot/v1` covers structure; this also checks that measure ids
 * referenced by `values`, `heat`, `headerCharts` and `kpis` exist.
 */
export function validatePivotSpec(input: unknown): PivotSpecValidation {
  const errors: string[] = [];
  if (!isObject(input)) return { ok: false, errors: ["spec must be an object"] };

  if (input.version !== PIVOT_SPEC_VERSION) {
    errors.push(`version must be ${PIVOT_SPEC_VERSION} (got ${JSON.stringify(input.version)})`);
  }

  const checkDimension = (d: unknown, where: string) => {
    if (!isObject(d) || !isNonEmptyString(d.field)) {
      errors.push(`${where}.field must be a non-empty string`);
      return;
    }
    if (d.order !== undefined && !(Array.isArray(d.order) && d.order.every((k) => typeof k === "string"))) {
      errors.push(`${where}.order must be an array of strings`);
    }
    if (d.sort !== undefined && !["asc", "desc", "none"].includes(d.sort as string)) {
      errors.push(`${where}.sort must be "asc" | "desc" | "none"`);
    }
  };

  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    errors.push("rows must be a non-empty array of dimensions");
  } else {
    input.rows.forEach((d, i) => checkDimension(d, `rows[${i}]`));
  }
  if (input.columns !== undefined) checkDimension(input.columns, "columns");

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

  const expanded = input.expanded;
  if (
    expanded !== undefined &&
    expanded !== "all" &&
    expanded !== "none" &&
    !(
      Array.isArray(expanded) &&
      expanded.every((p) => Array.isArray(p) && p.every((k) => typeof k === "string"))
    )
  ) {
    errors.push('expanded must be "all", "none", or an array of string key paths');
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

  return errors.length ? { ok: false, errors } : { ok: true, spec: input as unknown as PivotSpec };
}

/** Throws with every validation error joined, otherwise returns the typed spec. */
export function assertPivotSpec(input: unknown): PivotSpec {
  const result = validatePivotSpec(input);
  if (!result.ok) throw new Error(`Invalid pivot spec:\n- ${result.errors.join("\n- ")}`);
  return result.spec;
}
