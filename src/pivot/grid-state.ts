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
import {
  addPivotMeasure,
  movePivotField,
  removePivotField,
  reorderPivotField,
  setPivotMeasureAggregate,
  setPivotValuesPosition,
  swapPivotRowsColumns,
  togglePivotField,
  type PivotFieldMove,
} from "../core/pivot/fields";
import type {
  PivotBuiltInAggregate,
  PivotFieldArea,
  PivotFieldSpec,
  PivotFilter,
  PivotHeatScope,
  PivotModel,
  PivotSpec,
  PivotTopNSpec,
} from "../core/pivot/types";

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
  | { readonly type: "setSpec"; readonly spec: PivotSpec | ((prev: PivotSpec) => PivotSpec) }
  // Field list (`fields`: the catalogue for labels / types / allowed areas; default: `resolvePivotFields(spec)`).
  | { readonly type: "moveField"; readonly move: PivotFieldMove; readonly fields?: readonly PivotFieldSpec[] }
  | { readonly type: "reorderField"; readonly area: PivotFieldArea; readonly field: string; readonly index: number; readonly fields?: readonly PivotFieldSpec[] }
  | { readonly type: "removeField"; readonly field: string; readonly from: PivotFieldArea; readonly fields?: readonly PivotFieldSpec[] }
  | { readonly type: "toggleField"; readonly field: string; readonly checked: boolean; readonly fields?: readonly PivotFieldSpec[] }
  | {
      readonly type: "addMeasure";
      readonly field: string;
      readonly aggregate?: PivotBuiltInAggregate;
      readonly index?: number;
      readonly fields?: readonly PivotFieldSpec[];
    }
  | { readonly type: "setMeasureAggregate"; readonly measureId: string; readonly aggregate: PivotBuiltInAggregate; readonly fields?: readonly PivotFieldSpec[] }
  | { readonly type: "setValuesPosition"; readonly index: number }
  | { readonly type: "swapRowsColumns" };

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
    case "moveField":
      return movePivotField(spec, action.move, { fields: action.fields });
    case "reorderField":
      return reorderPivotField(spec, { area: action.area, field: action.field, index: action.index }, { fields: action.fields });
    case "removeField":
      return removePivotField(spec, { field: action.field, from: action.from }, { fields: action.fields });
    case "toggleField":
      return togglePivotField(spec, action.field, action.checked, { fields: action.fields });
    case "addMeasure":
      return addPivotMeasure(spec, { field: action.field, aggregate: action.aggregate, index: action.index }, { fields: action.fields });
    case "setMeasureAggregate":
      return setPivotMeasureAggregate(spec, action.measureId, action.aggregate, { fields: action.fields });
    case "setValuesPosition":
      return setPivotValuesPosition(spec, action.index);
    case "swapRowsColumns":
      return swapPivotRowsColumns(spec);
  }
}
