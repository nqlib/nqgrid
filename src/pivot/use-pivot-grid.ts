import { useCallback, useMemo, useRef, useState } from "react";

import { createPivotModelBuilder, type BuildPivotModelOptions } from "../core/pivot/build-model";
import {
  inferPivotFields,
  resolvePivotFields,
  type InferPivotFieldsOptions,
  type PivotFieldInfo,
  type PivotFieldMove,
} from "../core/pivot/fields";
import type { PivotSortRequest } from "../core/pivot/interaction";
import type {
  PivotBuiltInAggregate,
  PivotDataRow,
  PivotDateGroup,
  PivotFacet,
  PivotFieldArea,
  PivotFilter,
  PivotHeatScope,
  PivotModel,
  PivotSpec,
  PivotTopNSpec,
} from "../core/pivot/types";
import { reducePivotGridSpec, type PivotGridAction } from "./grid-state";

export interface UsePivotGridOptions extends BuildPivotModelOptions {
  /**
   * Controlled mode: when set, the `spec` argument is the source of truth and every change is
   * reported here (store it and pass it back). Without it, `spec` is only the initial value.
   */
  readonly onSpecChange?: (next: PivotSpec) => void;
  /** Sampling for the inferred field catalogue when `spec.fields` is absent (see `inferPivotFields`). */
  readonly inferFields?: InferPivotFieldsOptions;
}

export interface PivotGridState {
  /** Current spec, including view state — send it to a backend to "export what I see". */
  readonly spec: PivotSpec;
  /** The `rows` passed in (for `pivotExportRequestFromGrid(grid, { includeRows: true })`). */
  readonly rows: readonly PivotDataRow[];
  /**
   * `buildPivotModel(spec, rows)`, memoized. Aggregation is cached separately from view state, so
   * expanding groups or changing heat scope does not re-aggregate (see `createPivotModelBuilder`).
   */
  readonly model: PivotModel;
  readonly dispatch: (action: PivotGridAction) => void;
  readonly toggleGroup: (path: readonly string[]) => void;
  readonly expandAll: () => void;
  readonly collapseAll: () => void;
  /** Expand / collapse one column group (key path, e.g. `["2026"]`). */
  readonly toggleColumnGroup: (path: readonly string[]) => void;
  readonly expandAllColumns: () => void;
  readonly collapseAllColumns: () => void;
  readonly setHeatScope: (scope: PivotHeatScope) => void;
  /** Replace the filters on `filter.field` (an empty filter clears them). */
  readonly setFilter: (filter: PivotFilter) => void;
  /** Keep `selected` out of `allKeys` (checkbox list); everything selected clears the filter. */
  readonly setFilterValues: (field: string, allKeys: readonly string[], selected: readonly string[]) => void;
  /** Slicer click: `only` selects just `key`, `toggle` (default) flips it. */
  readonly toggleFilterValue: (field: string, key: string, mode?: "toggle" | "only") => void;
  readonly clearFilter: (field: string) => void;
  readonly clearFilters: () => void;
  readonly setSort: (field: string, sort: PivotSortRequest | null) => void;
  readonly setTopN: (field: string, topN: PivotTopNSpec | null) => void;
  readonly setSpec: (next: PivotSpec | ((prev: PivotSpec) => PivotSpec)) => void;
  /** Field catalogue: `spec.fields` (else inferred from `rows`) plus referenced fields (`resolvePivotFields`). */
  readonly fields: readonly PivotFieldInfo[];
  /**
   * Facet of any field for filter menus: `model.facets` when listed in `spec.facets`, else computed on
   * demand from the cached encoding (one filter pass, no aggregation, memoized per spec).
   */
  readonly facet: (field: string) => PivotFacet;
  /** `movePivotField` with the grid's catalogue. */
  readonly moveField: (move: PivotFieldMove) => void;
  /** Move a chip to final position `index` in its area. */
  readonly reorderField: (area: PivotFieldArea, field: string, index: number) => void;
  readonly removeField: (field: string, from: PivotFieldArea) => void;
  /** Field-list checkbox. */
  readonly toggleField: (field: string, checked: boolean) => void;
  readonly addMeasure: (field: string, aggregate?: PivotBuiltInAggregate, index?: number) => void;
  readonly setMeasureAggregate: (measureId: string, aggregate: PivotBuiltInAggregate) => void;
  /** Σ Values position among the column fields (`0` = measures outermost). */
  readonly setValuesPosition: (index: number) => void;
  /** Transpose rows and columns (`swapPivotRowsColumns`). */
  readonly swapRowsColumns: () => void;
  /** "Group by…" for a date field (`setPivotDateGrouping`); `[]` ungroups. */
  readonly setDateGrouping: (field: string, groups: readonly PivotDateGroup[], area?: "rows" | "columns" | "filters") => void;
}

/**
 * Spec state + memoized pivot model for a React grid. All pivot logic stays in
 * `@nqlib/nqgrid/core`; this hook only owns which spec is current.
 *
 * Pass a stable `rows` array (and `aggregators` object) — new identities re-aggregate. Within the
 * same rows, filter / sort changes reuse the column encoding, and view-only changes (expanded,
 * heat, labels, formats) reuse the aggregated cube.
 */
export function usePivotGrid(
  spec: PivotSpec,
  rows: readonly PivotDataRow[],
  options: UsePivotGridOptions = {},
): PivotGridState {
  const { onSpecChange, aggregators, validate, inferFields } = options;
  const [internal, setInternal] = useState(spec);
  const [builder] = useState(createPivotModelBuilder);
  const current = onSpecChange ? spec : internal;

  const model = useMemo(
    () => builder.build(current, rows, { aggregators, validate }),
    [builder, current, rows, aggregators, validate],
  );

  const sample = inferFields?.sample;
  const hasCatalogue = current.fields !== undefined;
  const inferred = useMemo(() => (hasCatalogue ? null : inferPivotFields(rows, { sample })), [hasCatalogue, rows, sample]);
  // Rows let declared `date` fields prove their values parse before they offer "Group by…".
  const fields = useMemo(() => resolvePivotFields(inferred ? { ...current, fields: inferred } : current, rows), [current, inferred, rows]);

  // Several dispatches before the next render (e.g. a menu applying values and Top N) chain on
  // each other instead of each starting from the rendered spec.
  const pending = useRef<{ readonly from: PivotSpec; readonly spec: PivotSpec } | null>(null);
  const dispatch = useCallback(
    (action: PivotGridAction) => {
      const base = pending.current?.from === current ? pending.current.spec : current;
      const next = reducePivotGridSpec(base, model, action);
      if (next === base) return;
      pending.current = { from: current, spec: next };
      if (onSpecChange) onSpecChange(next);
      else setInternal(next);
    },
    [current, model, onSpecChange],
  );

  return useMemo(
    () => ({
      spec: current,
      rows,
      model,
      dispatch,
      toggleGroup: (path) => dispatch({ type: "toggleGroup", path }),
      expandAll: () => dispatch({ type: "expandAll" }),
      collapseAll: () => dispatch({ type: "collapseAll" }),
      toggleColumnGroup: (path) => dispatch({ type: "toggleColumnGroup", path }),
      expandAllColumns: () => dispatch({ type: "expandAllColumns" }),
      collapseAllColumns: () => dispatch({ type: "collapseAllColumns" }),
      setHeatScope: (scope) => dispatch({ type: "setHeatScope", scope }),
      setFilter: (filter) => dispatch({ type: "setFilter", filter }),
      setFilterValues: (field, allKeys, selected) => dispatch({ type: "setFilterValues", field, allKeys, selected }),
      toggleFilterValue: (field, key, mode) => dispatch({ type: "toggleFilterValue", field, key, mode }),
      clearFilter: (field) => dispatch({ type: "clearFilter", field }),
      clearFilters: () => dispatch({ type: "clearFilters" }),
      setSort: (field, sort) => dispatch({ type: "setSort", field, sort }),
      setTopN: (field, topN) => dispatch({ type: "setTopN", field, topN }),
      setSpec: (next) => dispatch({ type: "setSpec", spec: next }),
      fields,
      facet: (field) => builder.facet(current, rows, field),
      moveField: (move) => dispatch({ type: "moveField", move, fields }),
      reorderField: (area, field, index) => dispatch({ type: "reorderField", area, field, index, fields }),
      removeField: (field, from) => dispatch({ type: "removeField", field, from, fields }),
      toggleField: (field, checked) => dispatch({ type: "toggleField", field, checked, fields }),
      addMeasure: (field, aggregate, index) => dispatch({ type: "addMeasure", field, aggregate, index, fields }),
      setMeasureAggregate: (measureId, aggregate) => dispatch({ type: "setMeasureAggregate", measureId, aggregate, fields }),
      setValuesPosition: (index) => dispatch({ type: "setValuesPosition", index }),
      swapRowsColumns: () => dispatch({ type: "swapRowsColumns" }),
      setDateGrouping: (field, groups, area) => dispatch({ type: "setDateGrouping", field, groups, area, fields }),
    }),
    [current, rows, model, dispatch, fields, builder],
  );
}
