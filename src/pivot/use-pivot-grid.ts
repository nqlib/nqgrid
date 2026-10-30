import { useCallback, useMemo, useState } from "react";

import { buildPivotModel, type BuildPivotModelOptions } from "../core/pivot/build-model";
import type { PivotDataRow, PivotHeatScope, PivotModel, PivotSpec } from "../core/pivot/types";
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
  /** `buildPivotModel(spec, rows)`, memoized on `spec`, `rows`, `aggregators` and `validate`. */
  readonly model: PivotModel;
  readonly dispatch: (action: PivotGridAction) => void;
  readonly toggleGroup: (path: readonly string[]) => void;
  readonly expandAll: () => void;
  readonly collapseAll: () => void;
  readonly setHeatScope: (scope: PivotHeatScope) => void;
  readonly setSpec: (next: PivotSpec | ((prev: PivotSpec) => PivotSpec)) => void;
}

/**
 * Spec state + memoized pivot model for a React grid. All pivot logic stays in
 * `@nqlib/nqgrid/core`; this hook only owns which spec is current.
 *
 * Pass a stable `rows` array (and `aggregators` object) — new identities rebuild the model.
 */
export function usePivotGrid(
  spec: PivotSpec,
  rows: readonly PivotDataRow[],
  options: UsePivotGridOptions = {},
): PivotGridState {
  const { onSpecChange, aggregators, validate } = options;
  const [internal, setInternal] = useState(spec);
  const current = onSpecChange ? spec : internal;

  const model = useMemo(
    () => buildPivotModel(current, rows, { aggregators, validate }),
    [current, rows, aggregators, validate],
  );

  const dispatch = useCallback(
    (action: PivotGridAction) => {
      const next = reducePivotGridSpec(current, model, action);
      if (next === current) return;
      if (onSpecChange) onSpecChange(next);
      else setInternal(next);
    },
    [current, model, onSpecChange],
  );

  const toggleGroup = useCallback((path: readonly string[]) => dispatch({ type: "toggleGroup", path }), [dispatch]);
  const expandAll = useCallback(() => dispatch({ type: "expandAll" }), [dispatch]);
  const collapseAll = useCallback(() => dispatch({ type: "collapseAll" }), [dispatch]);
  const setHeatScope = useCallback((scope: PivotHeatScope) => dispatch({ type: "setHeatScope", scope }), [dispatch]);
  const setSpec = useCallback(
    (next: PivotSpec | ((prev: PivotSpec) => PivotSpec)) => dispatch({ type: "setSpec", spec: next }),
    [dispatch],
  );

  return useMemo(
    () => ({ spec: current, rows, model, dispatch, toggleGroup, expandAll, collapseAll, setHeatScope, setSpec }),
    [current, rows, model, dispatch, toggleGroup, expandAll, collapseAll, setHeatScope, setSpec],
  );
}
