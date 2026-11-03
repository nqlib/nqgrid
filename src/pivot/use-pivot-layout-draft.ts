import { useCallback, useMemo, useRef, useState } from "react";

import { canMovePivotField, planPivotFieldMove, type PivotFieldMove, type PivotFieldMovePlan } from "../core/pivot/fields";
import type { PivotSpec } from "../core/pivot/types";
import type { PivotGridState } from "./use-pivot-grid";

export interface UsePivotLayoutDraftOptions {
  /** Initial "Defer layout update" state (default false). */
  readonly defaultDeferred?: boolean;
}

/**
 * Shared "Defer layout update" state for every layout editor of one grid: the field list and the
 * grid's draggable headers. While deferred, every change lands in one draft spec, and the grid
 * keeps showing the last applied layout until `update()` (Excel's Update button).
 */
export interface PivotLayoutDraftState {
  /** Spec the layout editors show and edit: the draft while one is pending, else the grid's spec. */
  readonly spec: PivotSpec;
  readonly deferred: boolean;
  /** Pending draft (`null` when there is nothing to apply). */
  readonly draft: PivotSpec | null;
  /** Turning deferral off applies a pending draft. */
  readonly setDeferred: (deferred: boolean) => void;
  /** A layout change: into the draft while deferred, else straight to the grid. Changes before the next render chain. */
  readonly apply: (next: PivotSpec | ((prev: PivotSpec) => PivotSpec)) => void;
  /** `planPivotFieldMove` on `spec` with the grid's catalogue, applied through `apply`. */
  readonly moveField: (move: PivotFieldMove) => PivotFieldMovePlan;
  /** Whether `move` would change `spec` (for drag `canDrop`). */
  readonly canMoveField: (move: PivotFieldMove) => boolean;
  /** Apply the draft to the grid (Update). */
  readonly update: () => void;
  /** Drop the draft. */
  readonly discard: () => void;
  /** Controlled draft (`PivotFieldList` `draft` / `onDraftChange`). */
  readonly setDraft: (draft: PivotSpec | null) => void;
}

/**
 * One deferred-layout draft per grid, shared by `PivotFieldList` (`pivotFieldListProps(grid, layout)`)
 * and header drags (`layout.moveField`, `layout.canMoveField`), so a header drag made while "Defer
 * layout update" is on joins the same draft instead of applying at once (and being overwritten on
 * Update).
 */
export function usePivotLayoutDraft(grid: PivotGridState, options: UsePivotLayoutDraftOptions = {}): PivotLayoutDraftState {
  const [deferred, setDeferredState] = useState(options.defaultDeferred ?? false);
  const [draft, setDraftState] = useState<PivotSpec | null>(null);
  const live = grid.spec;
  const spec = deferred && draft ? draft : live;
  const { setSpec, fields } = grid;

  // Several changes before the next render chain on each other.
  const latest = useRef<{ readonly from: PivotSpec; readonly spec: PivotSpec } | null>(null);
  const current = useCallback(() => (latest.current?.from === spec ? latest.current.spec : spec), [spec]);
  const apply = useCallback(
    (next: PivotSpec | ((prev: PivotSpec) => PivotSpec)) => {
      const from = current();
      const value = typeof next === "function" ? next(from) : next;
      if (value === from) return;
      latest.current = { from: spec, spec: value };
      if (deferred) setDraftState(value);
      else setSpec(value);
    },
    [current, deferred, setSpec, spec],
  );
  const update = useCallback(() => {
    if (draft) setSpec(draft);
    setDraftState(null);
    latest.current = null;
  }, [draft, setSpec]);
  const discard = useCallback(() => {
    setDraftState(null);
    latest.current = null;
  }, []);
  const setDeferred = useCallback(
    (next: boolean) => {
      if (!next && draft) setSpec(draft);
      setDraftState(null);
      latest.current = null;
      setDeferredState(next);
    },
    [draft, setSpec],
  );
  const moveField = useCallback(
    (move: PivotFieldMove) => {
      const plan = planPivotFieldMove(current(), move, { fields });
      if (plan.changed) apply(plan.spec);
      return plan;
    },
    [apply, current, fields],
  );
  const canMoveField = useCallback((move: PivotFieldMove) => canMovePivotField(current(), move, { fields }), [current, fields]);
  const setDraft = useCallback((next: PivotSpec | null) => {
    setDraftState(next);
    latest.current = null;
  }, []);

  return useMemo(
    () => ({ spec, deferred, draft, setDeferred, apply, moveField, canMoveField, update, discard, setDraft }),
    [spec, deferred, draft, setDeferred, apply, moveField, canMoveField, update, discard, setDraft],
  );
}
