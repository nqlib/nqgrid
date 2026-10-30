import { setPivotExpandedAll, setPivotHeatScope, togglePivotGroup } from "../core/pivot/interaction";
import type { PivotHeatScope, PivotModel, PivotSpec } from "../core/pivot/types";

/** Every view-state change the grid can make. All of it lands in the spec ("export what I see"). */
export type PivotGridAction =
  | { readonly type: "toggleGroup"; readonly path: readonly string[] }
  | { readonly type: "expandAll" }
  | { readonly type: "collapseAll" }
  | { readonly type: "setHeatScope"; readonly scope: PivotHeatScope }
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
    case "setSpec":
      return typeof action.spec === "function" ? action.spec(spec) : action.spec;
  }
}
