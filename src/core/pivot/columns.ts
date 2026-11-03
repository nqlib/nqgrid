import type { PivotDimension, PivotSpec } from "./types";

/**
 * Helpers for `spec.columns`, which is a single dimension (the original v1 shape, valid forever) or
 * a list of dimensions, outermost first.
 */

/** The column dimensions as a list (`[]` without columns). */
export function pivotColumnFields(spec: Pick<PivotSpec, "columns">): PivotDimension[] {
  const c = spec.columns;
  if (c === undefined) return [];
  return Array.isArray(c) ? [...(c as readonly PivotDimension[])] : [c as PivotDimension];
}

/**
 * `spec` with these column dimensions: no key for none, a single object for one (so specs that
 * never use several column fields keep the original shape), an array for several.
 */
export function withPivotColumnFields(spec: PivotSpec, dims: readonly PivotDimension[]): PivotSpec {
  if (dims.length === 0) {
    if (spec.columns === undefined) return spec;
    const rest = { ...spec };
    delete (rest as { columns?: unknown }).columns;
    return rest;
  }
  return { ...spec, columns: dims.length === 1 ? dims[0]! : [...dims] };
}

/**
 * Model column key of a column key path: the key itself with one column field (unchanged from the
 * single-column contract), otherwise the URI-encoded keys joined by `/` (`2026/Q1`).
 */
export function pivotColumnKeyOf(path: readonly string[], columnFieldCount: number): string {
  return columnFieldCount <= 1 && path.length === 1 ? path[0]! : path.map(encodeURIComponent).join("/");
}

/** The row or column dimension on `field`, if any. */
export function pivotDimensionOf(spec: Pick<PivotSpec, "rows" | "columns">, field: string): PivotDimension | undefined {
  return spec.rows.find((d) => d.field === field) ?? pivotColumnFields(spec).find((d) => d.field === field);
}
