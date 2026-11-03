import {
  clearPivotFilter,
  clearPivotFilters,
  setPivotExpandedAll,
  setPivotFilter,
  setPivotFilterValues,
  setPivotHeatScope,
  setPivotSort,
  setPivotTopN,
  togglePivotFilterValue,
  togglePivotGroup,
  type PivotSortRequest,
} from "../core/pivot/interaction";
import type { PivotFilter, PivotHeatScope, PivotModel, PivotSpec, PivotTopNSpec } from "../core/pivot/types";

/** Every view-state change the grid can make. All of it lands in the spec ("export what I see"). */
export type PivotGridAction =
  | { readonly type: "toggleGroup"; readonly path: readonly string[] }
  | { readonly type: "expandAll" }
  | { readonly type: "collapseAll" }
  | { readonly type: "setHeatScope"; readonly scope: PivotHeatScope }
  | { readonly type: "setFilter"; readonly filter: PivotFilter }
  | { readonly type: "setFilterValues"; readonly field: string; readonly allKeys: readonly string[]; readonly selected: readonly string[] }
  | { readonly type: "toggleFilterValue"; readonly field: string; readonly key: string; readonly mode?: "toggle" | "only" }
  | { readonly type: "clearFilter"; readonly field: string }
  | { readonly type: "clearFilters" }
  | { readonly type: "setSort"; readonly field: string; readonly sort: PivotSortRequest | null }
  | { readonly type: "setTopN"; readonly field: string; readonly topN: PivotTopNSpec | null }
  | { readonly type: "setSpec"; readonly spec: PivotSpec | ((prev: PivotSpec) => PivotSpec) };

/**
 * Pure spec transition behind `usePivotGrid`. `model` must be built from `spec`
 * (`togglePivotGroup` reads it to materialize `expanded: "all"`).
 */
export function reducePivotGridSpec(spec: PivotSpec, model: PivotModel, action: PivotGridAction): PivotSpec {
  switch (action.type) {
    case "toggleGroup":
      return togglePivotGroup(spec, model, action.path);
    case "expandAll":
      return setPivotExpandedAll(spec, true);
    case "collapseAll":
      return setPivotExpandedAll(spec, false);
    case "setHeatScope":
      return setPivotHeatScope(spec, action.scope);
    case "setFilter":
      return setPivotFilter(spec, action.filter);
    case "setFilterValues":
      return setPivotFilterValues(spec, action.field, action.allKeys, action.selected);
    case "toggleFilterValue":
      return togglePivotFilterValue(spec, action.field, action.key, { mode: action.mode });
    case "clearFilter":
      return clearPivotFilter(spec, action.field);
    case "clearFilters":
      return clearPivotFilters(spec);
    case "setSort":
      return setPivotSort(spec, action.field, action.sort);
    case "setTopN":
      return setPivotTopN(spec, action.field, action.topN);
    case "setSpec":
      return typeof action.spec === "function" ? action.spec(spec) : action.spec;
  }
}
