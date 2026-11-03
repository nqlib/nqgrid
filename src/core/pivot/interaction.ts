import { pivotPathId } from "./build-model";
import { pivotColumnFields, withPivotColumnFields } from "./columns";
import { isPivotFilterActive } from "./filter";
import type {
  PivotDimension,
  PivotFilter,
  PivotHeatScope,
  PivotModel,
  PivotSortBySpec,
  PivotSpec,
  PivotTopNSpec,
} from "./types";

/**
 * View state lives in the spec, so "export what I see" is just sending the spec.
 * These helpers return a new spec; rebuild the model afterwards.
 */

/** Expand or collapse one group. `model` must be built from `spec` (used to materialize `"all"`). */
export function togglePivotGroup(spec: PivotSpec, model: PivotModel, path: readonly string[]): PivotSpec {
  const current: (readonly string[])[] =
    spec.expanded === undefined || spec.expanded === "all"
      ? model.rows.filter((r) => r.kind === "group" && r.expanded).map((r) => r.path)
      : spec.expanded === "none"
        ? []
        : [...spec.expanded];
  const id = pivotPathId(path);
  const without = current.filter((p) => pivotPathId(p) !== id);
  const expanded = without.length === current.length ? [...current, [...path]] : without;
  return { ...spec, expanded };
}

export function setPivotExpandedAll(spec: PivotSpec, expanded: boolean): PivotSpec {
  return { ...spec, expanded: expanded ? "all" : "none" };
}

/**
 * Expand or collapse one column group (key path from the outermost column field, e.g. `["2026"]`).
 * `model` must be built from `spec` (used to materialize `"all"` from the visible groups). A
 * collapsed group shows only its total column.
 */
export function togglePivotColumnGroup(spec: PivotSpec, model: PivotModel, path: readonly string[]): PivotSpec {
  const current: (readonly string[])[] =
    spec.columnsExpanded === undefined || spec.columnsExpanded === "all"
      ? pivotExpandedColumnGroups(model)
      : spec.columnsExpanded === "none"
        ? []
        : [...spec.columnsExpanded];
  const id = pivotPathId(path);
  const without = current.filter((p) => pivotPathId(p) !== id);
  const columnsExpanded = without.length === current.length ? [...current, [...path]] : without;
  return { ...spec, columnsExpanded };
}

/** Expand (`"all"`) or collapse (`"none"`) every column group. */
export function setPivotColumnsExpandedAll(spec: PivotSpec, expanded: boolean): PivotSpec {
  return { ...spec, columnsExpanded: expanded ? "all" : "none" };
}

/** Key paths of the expanded column groups visible in `model` (header cells with `expanded: true`). */
export function pivotExpandedColumnGroups(model: PivotModel): string[][] {
  const out: string[][] = [];
  const seen = new Set<string>();
  for (const row of model.headerRows) {
    for (const h of row) {
      if (h.expanded !== true || !h.columnPath) continue;
      const id = pivotPathId(h.columnPath);
      if (!seen.has(id)) {
        seen.add(id);
        out.push([...h.columnPath]);
      }
    }
  }
  return out;
}

/** Change the heat color domain (`all`, `column`, `row`, `group`); adds a default heat spec when absent. */
export function setPivotHeatScope(spec: PivotSpec, scope: PivotHeatScope): PivotSpec {
  return { ...spec, heat: { ...(spec.heat ?? {}), scope } };
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/** `spec` with `filters` replaced (the key is dropped when empty, keeping exported specs minimal). */
function withFilters(spec: PivotSpec, filters: readonly PivotFilter[]): PivotSpec {
  if (filters.length) return { ...spec, filters };
  return spec.filters === undefined ? spec : omit(spec, "filters");
}

/** The first filter on `field`, if any. */
export function getPivotFilter(spec: PivotSpec, field: string): PivotFilter | undefined {
  return spec.filters?.find((f) => f.field === field);
}

/**
 * Replace every filter on `filter.field` with `filter` (kept in place of the first one).
 * A filter without include / exclude / match removes the field's filters instead.
 */
export function setPivotFilter(spec: PivotSpec, filter: PivotFilter): PivotSpec {
  const current = spec.filters ?? [];
  const at = current.findIndex((f) => f.field === filter.field);
  const rest = current.filter((f) => f.field !== filter.field);
  if (!isPivotFilterActive(filter)) return at < 0 ? spec : withFilters(spec, rest);
  const next = [...rest];
  next.splice(at < 0 ? rest.length : at, 0, filter);
  return withFilters(spec, next);
}

/** Remove the filters on `field`. */
export function clearPivotFilter(spec: PivotSpec, field: string): PivotSpec {
  if (!spec.filters?.some((f) => f.field === field)) return spec;
  return withFilters(spec, spec.filters.filter((f) => f.field !== field));
}

/** Remove every report / label filter (Top N stays: see `setPivotTopN`). */
export function clearPivotFilters(spec: PivotSpec): PivotSpec {
  return withFilters(spec, []);
}

/**
 * Slicer click on one key of `field`:
 *
 * - `only` (plain click): show just this key (`include: [key]`).
 * - `toggle` (Ctrl/Cmd-click, multi-select mode, checkbox): flip it. From "everything" this
 *   excludes the key; with an include list it adds / removes it. Emptying the list clears the
 *   filter, so deselecting the last key shows everything again (like an Excel slicer).
 *
 * A `match` on the same filter is kept.
 */
export function togglePivotFilterValue(
  spec: PivotSpec,
  field: string,
  key: string,
  options: { readonly mode?: "toggle" | "only" } = {},
): PivotSpec {
  const mode = options.mode ?? "toggle";
  const current = getPivotFilter(spec, field);
  const base: PivotFilter = current ?? { field };
  const { include, exclude } = base;
  const keep = omit(base, "include", "exclude");
  if (mode === "only") {
    if (include?.length === 1 && include[0] === key && !exclude?.length) return spec;
    return setPivotFilter(spec, { ...keep, include: [key] });
  }
  if (include) {
    const next = include.includes(key) ? include.filter((k) => k !== key) : [...include, key];
    return setPivotFilter(spec, { ...keep, ...(next.length ? { include: next } : {}), ...(exclude?.length ? { exclude } : {}) });
  }
  const list = exclude ?? [];
  const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
  return setPivotFilter(spec, { ...keep, ...(next.length ? { exclude: next } : {}) });
}

/**
 * Filter that keeps `selected` out of `allKeys` (e.g. a checkbox list), or `null` when every key is
 * selected. Uses whichever of `include` / `exclude` is shorter (ties → `include`); `exclude` also
 * keeps keys that appear in later data.
 */
export function pivotFilterForSelection(
  field: string,
  allKeys: readonly string[],
  selected: Iterable<string>,
): PivotFilter | null {
  const chosen = new Set(selected);
  const include = allKeys.filter((k) => chosen.has(k));
  const exclude = allKeys.filter((k) => !chosen.has(k));
  if (exclude.length === 0) return null;
  return include.length <= exclude.length ? { field, include } : { field, exclude };
}

/** `setPivotFilter` with `pivotFilterForSelection` (keeps an existing `match` / `label`). */
export function setPivotFilterValues(
  spec: PivotSpec,
  field: string,
  allKeys: readonly string[],
  selected: Iterable<string>,
): PivotSpec {
  const current = getPivotFilter(spec, field);
  const next = pivotFilterForSelection(field, allKeys, selected);
  const keep = { ...(current?.match ? { match: current.match } : {}), ...(current?.label ? { label: current.label } : {}) };
  return setPivotFilter(spec, { field, ...keep, ...(next ?? {}) });
}

// ---------------------------------------------------------------------------
// Sorting / Top N
// ---------------------------------------------------------------------------

/** Sort request for `setPivotSort`: by key (label) or by an aggregated measure. */
export type PivotSortRequest =
  | { readonly by: "label"; readonly direction: "asc" | "desc" | "none" }
  | ({ readonly by: "value" } & PivotSortBySpec);

function updateRowDimension(spec: PivotSpec, field: string, update: (d: PivotDimension) => PivotDimension): PivotSpec {
  const index = spec.rows.findIndex((d) => d.field === field);
  if (index < 0) return spec;
  const rows = spec.rows.map((d, i) => (i === index ? update(d) : d));
  return { ...spec, rows };
}

function omit<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
  const out = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}

/**
 * Sort a dimension (by `field`). Row dimensions: `{ by: "label" }` sets `sort` and drops `sortBy`;
 * `{ by: "value", measure, direction?, columnKey? }` sets `sortBy` (keeping `sort` as tie-breaker);
 * `null` removes both. Column dimensions support label sorting only. Unknown fields: unchanged.
 */
export function setPivotSort(spec: PivotSpec, field: string, sort: PivotSortRequest | null): PivotSpec {
  if (!spec.rows.some((d) => d.field === field)) {
    const dims = pivotColumnFields(spec);
    const at = dims.findIndex((d) => d.field === field);
    if (at < 0) return spec;
    if (sort?.by === "value") throw new TypeError("nqgrid pivot: sorting a column dimension by value is not supported");
    const d = dims[at]!;
    dims[at] = sort === null || sort.direction === "none" ? omit(d, "sort") : { ...d, sort: sort.direction };
    return withPivotColumnFields(spec, dims);
  }
  return updateRowDimension(spec, field, (d) => {
    if (sort === null) return omit(d, "sort", "sortBy");
    if (sort.by === "label") {
      const base = omit(d, "sortBy");
      return sort.direction === "none" ? omit(base, "sort") : { ...base, sort: sort.direction };
    }
    const sortBy: PivotSortBySpec = {
      measure: sort.measure,
      ...(sort.direction ? { direction: sort.direction } : {}),
      ...(sort.columnKey !== undefined ? { columnKey: sort.columnKey } : {}),
    };
    return { ...d, sortBy };
  });
}

/** Set (or with `null`, remove) the Top / Bottom N value filter of a row dimension. */
export function setPivotTopN(spec: PivotSpec, field: string, topN: PivotTopNSpec | null): PivotSpec {
  return updateRowDimension(spec, field, (d) => (topN === null ? omit(d, "topN") : { ...d, topN }));
}
