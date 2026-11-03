import { useCallback, useMemo, useRef, useState } from "react";

import { createPivotModelBuilder, type BuildPivotModelOptions } from "../core/pivot/build-model";
import type { PivotSortRequest } from "../core/pivot/interaction";
import type { PivotDataRow, PivotFilter, PivotHeatScope, PivotModel, PivotSpec, PivotTopNSpec } from "../core/pivot/types";
import { reducePivotGridSpec, type PivotGridAction } from "./grid-state";

export interface UsePivotGridOptions extends BuildPivotModelOptions {
  /**
   * Controlled mode: when set, the `spec` argument is the source of truth and every change is
   * reported here (store it and pass it back). Without it, `spec` is only the initial value.
   */
  readonly onSpecChange?: (next: PivotSpec) => void;
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
  const { onSpecChange, aggregators, validate } = options;
  const [internal, setInternal] = useState(spec);
  const [builder] = useState(createPivotModelBuilder);
  const current = onSpecChange ? spec : internal;

  const model = useMemo(
    () => builder.build(current, rows, { aggregators, validate }),
    [builder, current, rows, aggregators, validate],
  );

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
      setHeatScope: (scope) => dispatch({ type: "setHeatScope", scope }),
      setFilter: (filter) => dispatch({ type: "setFilter", filter }),
      setFilterValues: (field, allKeys, selected) => dispatch({ type: "setFilterValues", field, allKeys, selected }),
      toggleFilterValue: (field, key, mode) => dispatch({ type: "toggleFilterValue", field, key, mode }),
      clearFilter: (field) => dispatch({ type: "clearFilter", field }),
      clearFilters: () => dispatch({ type: "clearFilters" }),
      setSort: (field, sort) => dispatch({ type: "setSort", field, sort }),
      setTopN: (field, topN) => dispatch({ type: "setTopN", field, topN }),
      setSpec: (next) => dispatch({ type: "setSpec", spec: next }),
    }),
    [current, rows, model, dispatch],
  );
}
