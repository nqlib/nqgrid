import { pivotPathId } from "./build-model";
import type { PivotHeatScope, PivotModel, PivotSpec } from "./types";

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

/** Change the heat color domain (`all`, `column`, `row`, `group`); adds a default heat spec when absent. */
export function setPivotHeatScope(spec: PivotSpec, scope: PivotHeatScope): PivotSpec {
  return { ...spec, heat: { ...(spec.heat ?? {}), scope } };
}
