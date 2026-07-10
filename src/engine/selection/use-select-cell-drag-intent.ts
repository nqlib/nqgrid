import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

/** Default hold duration before number/grip → drag-ready. Override per instance via `holdMs`. */
export const SELECT_CELL_HOLD_MS = 220;

/** Default horizontal-ish movement that immediately enters drag-ready (px). */
export const SELECT_CELL_MOVE_THRESHOLD_PX = 10;

/** Default vertical movement that cancels hold/drag intent (scroll). */
export const SELECT_CELL_SCROLL_CANCEL_PX = 6;

export function selectCellDragExceededThreshold(
  start: { x: number; y: number },
  current: { x: number; y: number },
  threshold = SELECT_CELL_MOVE_THRESHOLD_PX,
): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) >= threshold;
}

/** True when pointer delta looks like vertical scroll, not row drag. */
export function selectCellMovementLooksLikeScroll(
  start: { x: number; y: number },
  current: { x: number; y: number },
  scrollCancelPx = SELECT_CELL_SCROLL_CANCEL_PX,
): boolean {
  const dx = Math.abs(current.x - start.x);
  const dy = Math.abs(current.y - start.y);
  return dy >= scrollCancelPx && dy > dx * 1.25;
}

/**
 * Semantic meaning of a confirmed drag from the select column. The hook itself
 * stays renderer-agnostic — the consumer declares which mode a given cell is in
 * so the same gesture can drive row reorder OR range selection without the two
 * affordances racing on one boolean.
 */
export type SelectCellDragMode = "reorder" | "select-range";

/** Drag-intent phase. `drag-ready` means the consumer may begin its drag. */
export type SelectCellIntentPhase = "idle" | "holding" | "drag-ready";

export interface PointerModifiers {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

const NO_MODIFIERS: PointerModifiers = {
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
};

export interface SelectCellDragReadyContext {
  mode: SelectCellDragMode;
  modifiers: PointerModifiers;
  pointerId: number;
}

export interface UseSelectCellDragIntentOptions {
  /** Master switch. Flipping to false mid-gesture safely resets state. Default true. */
  enabled?: boolean;
  /** Semantic discriminator surfaced back as `mode` and in `onDragReady`. Default `reorder`. */
  mode?: SelectCellDragMode;
  /**
   * Capture the pointer on the grip so move/up keep firing past the cell edge.
   * Enable ONLY when this hook drives the drag motion itself (e.g. range select).
   * Leave **false** (default) when the actual drag is delegated to a parent
   * handle such as dnd-kit `asHandle` — capturing here starves that sensor and
   * the drag never starts.
   */
  capturePointer?: boolean;
  /** Hold duration before drag-ready (ms). Default {@link SELECT_CELL_HOLD_MS}. */
  holdMs?: number;
  /** Movement that enters drag-ready before the hold elapses (px). Default {@link SELECT_CELL_MOVE_THRESHOLD_PX}. */
  moveThresholdPx?: number;
  /** Vertical movement that cancels intent as scroll (px). Default {@link SELECT_CELL_SCROLL_CANCEL_PX}. */
  scrollCancelPx?: number;
  /** Fires once when the gesture is confirmed (timer or threshold). */
  onDragReady?: (ctx: SelectCellDragReadyContext) => void;
  /** Fires when an in-flight gesture is abandoned (pointerup, cancel, blur, disable). */
  onCancel?: () => void;
}

export interface SelectCellDragZoneProps {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerCancel: (e: ReactPointerEvent) => void;
  onPointerLeave: (e: ReactPointerEvent) => void;
  onContextMenu: (e: ReactMouseEvent) => void;
}

export interface UseSelectCellDragIntentResult {
  /** Discriminated phase. Prefer this over the derived booleans below. */
  intent: SelectCellIntentPhase;
  /** Echoes `options.mode` so consumers can branch reorder vs range-select. */
  mode: SelectCellDragMode;
  /** Modifier keys captured at pointerdown (for shift/ctrl-aware drag semantics). */
  modifiers: PointerModifiers;
  /** @deprecated Use `intent === "drag-ready"`. */
  dragReady: boolean;
  /** @deprecated Use `intent === "holding"`. */
  holding: boolean;
  /** Attach only to the drag zone (# / grip strip) — never the checkbox. */
  dragZoneProps: SelectCellDragZoneProps;
}

function readModifiers(e: ReactPointerEvent): PointerModifiers {
  return {
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    altKey: e.altKey,
  };
}

/**
 * Press-and-hold / movement intent for the select-column drag zone (# / grip).
 *
 * Renderer-agnostic state machine — returns phase + modifiers + mode, never a
 * className. Keep checkbox clicks isolated: attach `dragZoneProps` only to the
 * grip strip, not the checkbox.
 *
 * Correctness guarantees:
 * - Pointer capture on pointerdown keeps move/up firing if the pointer leaves
 *   the cell, so flicks past the edge don't drop the gesture.
 * - Hold timer and the deferred reset frame are cancelled on unmount, on
 *   `pointercancel`, on window blur, and on `visibilitychange` — no setState on
 *   an unmounted row in a virtualized list.
 * - Flipping `enabled` to false mid-gesture resets cleanly (no stuck `holding`).
 */
export function useSelectCellDragIntent(
  options: UseSelectCellDragIntentOptions = {},
): UseSelectCellDragIntentResult {
  const {
    enabled = true,
    mode = "reorder",
    capturePointer = false,
    holdMs = SELECT_CELL_HOLD_MS,
    moveThresholdPx = SELECT_CELL_MOVE_THRESHOLD_PX,
    scrollCancelPx = SELECT_CELL_SCROLL_CANCEL_PX,
    onDragReady,
    onCancel,
  } = options;

  const [intent, setIntent] = useState<SelectCellIntentPhase>("idle");
  const [modifiers, setModifiers] = useState<PointerModifiers>(NO_MODIFIERS);

  const intentRef = useRef<SelectCellIntentPhase>("idle");
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetFrameRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const modifiersRef = useRef<PointerModifiers>(NO_MODIFIERS);
  /** Element + pointer id holding pointer capture, so we can release on reset. */
  const captureRef = useRef<{ el: Element; pointerId: number } | null>(null);

  // Keep the latest callbacks/values in refs so window listeners stay stable.
  const onDragReadyRef = useRef(onDragReady);
  const onCancelRef = useRef(onCancel);
  const modeRef = useRef(mode);
  onDragReadyRef.current = onDragReady;
  onCancelRef.current = onCancel;
  modeRef.current = mode;

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const cancelResetFrame = useCallback(() => {
    if (resetFrameRef.current !== null) {
      cancelAnimationFrame(resetFrameRef.current);
      resetFrameRef.current = null;
    }
  }, []);

  const releaseCapture = useCallback(() => {
    const cap = captureRef.current;
    captureRef.current = null;
    if (!cap) return;
    try {
      if (cap.el.hasPointerCapture?.(cap.pointerId)) {
        cap.el.releasePointerCapture(cap.pointerId);
      }
    } catch {
      // Element may be detached during unmount — capture is already gone.
    }
  }, []);

  const setIntentPhase = useCallback((phase: SelectCellIntentPhase) => {
    intentRef.current = phase;
    setIntent(phase);
  }, []);

  const resetDragIntent = useCallback(() => {
    clearHoldTimer();
    cancelResetFrame();
    releaseCapture();
    startRef.current = null;
    modifiersRef.current = NO_MODIFIERS;
    if (intentRef.current !== "idle") onCancelRef.current?.();
    setIntentPhase("idle");
    setModifiers(NO_MODIFIERS);
  }, [clearHoldTimer, cancelResetFrame, releaseCapture, setIntentPhase]);

  const enterDragReady = useCallback(() => {
    clearHoldTimer();
    if (!enabled || intentRef.current === "idle") return;
    setIntentPhase("drag-ready");
    const cap = captureRef.current;
    onDragReadyRef.current?.({
      mode: modeRef.current,
      modifiers: modifiersRef.current,
      pointerId: cap?.pointerId ?? -1,
    });
  }, [clearHoldTimer, enabled, setIntentPhase]);

  const cancelPendingHold = useCallback(() => {
    clearHoldTimer();
    releaseCapture();
    startRef.current = null;
    if (intentRef.current !== "idle") onCancelRef.current?.();
    setIntentPhase("idle");
    setModifiers(NO_MODIFIERS);
  }, [clearHoldTimer, releaseCapture, setIntentPhase]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      // Primary button / touch / pen only — ignore right & middle click.
      if (!enabled || (e.pointerType === "mouse" && e.button !== 0)) return;
      const mods = readModifiers(e);
      startRef.current = { x: e.clientX, y: e.clientY };
      modifiersRef.current = mods;
      setModifiers(mods);
      // Capture so move/up keep firing past the cell edge — only when this hook
      // owns the drag. When delegating to a parent handle (dnd-kit), capturing
      // here would intercept the pointer stream the sensor needs.
      if (capturePointer) {
        try {
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          captureRef.current = { el: e.currentTarget as Element, pointerId: e.pointerId };
        } catch {
          captureRef.current = null;
        }
      }
      setIntentPhase("holding");
      clearHoldTimer();
      holdTimerRef.current = setTimeout(enterDragReady, holdMs);
    },
    [enabled, capturePointer, clearHoldTimer, enterDragReady, holdMs, setIntentPhase],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!enabled || !startRef.current || intentRef.current === "drag-ready") return;
      const current = { x: e.clientX, y: e.clientY };
      if (selectCellMovementLooksLikeScroll(startRef.current, current, scrollCancelPx)) {
        cancelPendingHold();
        return;
      }
      if (selectCellDragExceededThreshold(startRef.current, current, moveThresholdPx)) {
        enterDragReady();
      }
    },
    [enabled, cancelPendingHold, enterDragReady, moveThresholdPx, scrollCancelPx],
  );

  const onPointerUp = useCallback(() => {
    if (intentRef.current === "drag-ready") {
      // Defer so a synthetic click on the cell can land before chrome resets.
      cancelResetFrame();
      resetFrameRef.current = requestAnimationFrame(resetDragIntent);
      return;
    }
    cancelPendingHold();
  }, [cancelPendingHold, cancelResetFrame, resetDragIntent]);

  const onPointerCancel = useCallback(() => {
    resetDragIntent();
  }, [resetDragIntent]);

  const onPointerLeave = useCallback(() => {
    // With pointer capture this rarely fires mid-gesture; guard drag-ready anyway.
    if (intentRef.current === "drag-ready") return;
    cancelPendingHold();
  }, [cancelPendingHold]);

  const onContextMenu = useCallback(() => {
    // Right-click / long-press menu interrupts the gesture — reset cleanly.
    resetDragIntent();
  }, [resetDragIntent]);

  // Reset when disabled mid-gesture so `holding` never sticks.
  useEffect(() => {
    if (!enabled && intentRef.current !== "idle") resetDragIntent();
  }, [enabled, resetDragIntent]);

  // Backstop: OS-level interruptions (alt-tab, app switch, focus loss).
  useEffect(() => {
    if (intent === "idle") return;
    const finish = () => {
      cancelResetFrame();
      resetFrameRef.current = requestAnimationFrame(resetDragIntent);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") resetDragIntent();
    };
    window.addEventListener("pointerup", finish);
    window.addEventListener("blur", resetDragIntent);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("blur", resetDragIntent);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intent, cancelResetFrame, resetDragIntent]);

  // Unmount: clear timer + pending frame + capture. No setState after teardown.
  useEffect(() => {
    return () => {
      clearHoldTimer();
      cancelResetFrame();
      releaseCapture();
    };
  }, [clearHoldTimer, cancelResetFrame, releaseCapture]);

  return {
    intent,
    mode,
    modifiers,
    dragReady: intent === "drag-ready",
    holding: intent === "holding",
    dragZoneProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onPointerLeave,
      onContextMenu,
    },
  };
}
