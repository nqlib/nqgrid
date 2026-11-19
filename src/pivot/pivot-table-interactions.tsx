import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

import { pivotResizeHandleClass } from "../styles";
import type { PivotResizeInfo } from "./design";
import type { PivotHeaderLayoutCell } from "./header-layout";

/**
 * Pointer / keyboard plumbing of the `PivotTable` design callbacks (resize handles, measure drag).
 * Internal: not exported from `@nqlib/nqgrid/pivot`. Nothing here keeps design state — every change
 * goes out through the callback and comes back as props; only a gesture in progress is tracked.
 */

const VERTICAL_HANDLE_STYLE: CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  // `--nq-pivot-resize-size` widens the grab area (default 6 px).
  width: "var(--nq-pivot-resize-size, 6px)",
  cursor: "col-resize",
  touchAction: "none",
  userSelect: "none",
  zIndex: 1,
};
const HORIZONTAL_HANDLE_STYLE: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: "var(--nq-pivot-resize-size, 6px)",
  cursor: "row-resize",
  touchAction: "none",
  userSelect: "none",
  zIndex: 1,
};

export interface PivotResizeHandleProps {
  /** `vertical`: a column edge (drag along x); `horizontal`: a row edge (drag along y). */
  readonly orientation: "vertical" | "horizontal";
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  /** Arrow key step (Shift: `largeStep`). */
  readonly step: number;
  readonly largeStep: number;
  readonly onChange: (value: number, info: PivotResizeInfo) => void;
  /** Double-click: the auto-fit size, or `null` to do nothing. */
  readonly onAutoFit?: (handle: HTMLElement) => number | null;
  /** While dragging, draw a guide line across the visible table (`resizeGuide`). */
  readonly guide?: boolean;
}

/** A `role="separator"` drag handle on a cell edge, reachable with Tab. */
export function PivotResizeHandle({ orientation, label, value, min, max, step, largeStep, onChange, onAutoFit, guide }: PivotResizeHandleProps) {
  const latest = useRef({ onChange, value });
  latest.current = { onChange, value };
  const vertical = orientation === "vertical";
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const origin = vertical ? e.clientX : e.clientY;
    const startValue = latest.current.value;
    const handle = e.currentTarget;
    capture(handle, e.pointerId);
    // Gesture state for CSS: `data-nq-resizing` on the handle and its table; the cursor stays a
    // resize cursor (and text stays unselected) while the pointer leaves the handle.
    const table = handle.closest("table");
    const root = document.documentElement;
    const restore = { cursor: root.style.cursor, userSelect: root.style.userSelect };
    handle.dataset.nqResizing = "";
    if (table) table.dataset.nqResizing = vertical ? "column" : "row";
    root.style.cursor = vertical ? "col-resize" : "row-resize";
    root.style.userSelect = "none";
    const line = guide ? pivotResizeGuide(handle, vertical) : null;
    let last = startValue;
    let frame = 0;
    let emitted = false;
    let done = false;
    const flush = () => {
      frame = 0;
      emitted = true;
      latest.current.onChange(last, { source: "pointer", final: false });
    };
    const move = (ev: PointerEvent | MouseEvent) => {
      const next = clamp(startValue + ((vertical ? ev.clientX : ev.clientY) - origin));
      if (next === last) return;
      last = next;
      line?.move(next - startValue);
      if (typeof requestAnimationFrame === "undefined") flush();
      else if (frame === 0) frame = requestAnimationFrame(flush);
    };
    const finish = (commit: boolean) => {
      if (done) return;
      done = true;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key, true);
      handle.removeEventListener("lostpointercapture", up);
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = 0;
      delete handle.dataset.nqResizing;
      if (table) delete table.dataset.nqResizing;
      root.style.cursor = restore.cursor;
      root.style.userSelect = restore.userSelect;
      line?.remove();
      // A host that keeps a draft until `final` always gets one once anything was sent.
      if (last === startValue && !emitted) return;
      latest.current.onChange(commit ? last : startValue, { source: "pointer", final: true });
    };
    const up = () => finish(true);
    const cancel = () => finish(false);
    const key = (ev: globalThis.KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      ev.stopPropagation();
      finish(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key, true);
    handle.addEventListener("lostpointercapture", up);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const less = vertical ? "ArrowLeft" : "ArrowUp";
    const more = vertical ? "ArrowRight" : "ArrowDown";
    let next: number | null = null;
    if (e.key === less || e.key === more) next = value + (e.key === more ? 1 : -1) * (e.shiftKey ? largeStep : step);
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = max;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    const v = clamp(next);
    if (v !== value) onChange(v, { source: "keyboard", final: true });
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={orientation}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      className={pivotResizeHandleClass}
      style={vertical ? VERTICAL_HANDLE_STYLE : HORIZONTAL_HANDLE_STYLE}
      data-nq-resize={vertical ? "column" : "row"}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const v = onAutoFit?.(e.currentTarget);
        if (v !== null && v !== undefined && clamp(v) !== value) onChange(clamp(v), { source: "autofit", final: true });
      }}
    />
  );
}

/** Nearest ancestor that scrolls (`null`: the viewport). */
function scrollBox(el: Element): Element | null {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (/(auto|scroll|overlay)/.test(`${s.overflowX} ${s.overflowY}`)) return p;
  }
  return null;
}

/**
 * The resize guide: a `position: fixed` line (`data-nq-resize-guide`) on the edge being dragged,
 * across the visible part of the table, appended to `document.body` so no cell clips it. Color
 * `--nq-pivot-resize-guide` (default: the table's text color) and thickness
 * `--nq-pivot-resize-guide-size` (default 1 px), read from the table when the drag starts.
 */
function pivotResizeGuide(handle: HTMLElement, vertical: boolean): { move: (delta: number) => void; remove: () => void } {
  const table = handle.closest("table") ?? handle;
  const t = table.getBoundingClientRect();
  const box = scrollBox(table)?.getBoundingClientRect() ?? { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth };
  const h = handle.getBoundingClientRect();
  const line = document.createElement("div");
  line.dataset.nqResizeGuide = vertical ? "column" : "row";
  line.setAttribute("aria-hidden", "true");
  // The line lives in <body>, outside the host's wrapper: read the table's variables now.
  const styles = getComputedStyle(table);
  const size = styles.getPropertyValue("--nq-pivot-resize-guide-size").trim() || "1px";
  const color = styles.getPropertyValue("--nq-pivot-resize-guide").trim() || styles.color;
  const start = vertical ? h.right : h.bottom;
  Object.assign(line.style, {
    position: "fixed",
    pointerEvents: "none",
    zIndex: "2147483646",
    background: color,
    ...(vertical
      ? { top: `${Math.max(t.top, box.top)}px`, height: `${Math.max(0, Math.min(t.bottom, box.bottom) - Math.max(t.top, box.top))}px`, width: size }
      : { left: `${Math.max(t.left, box.left)}px`, width: `${Math.max(0, Math.min(t.right, box.right) - Math.max(t.left, box.left))}px`, height: size }),
  });
  const move = (delta: number) => {
    if (vertical) line.style.left = `${start + delta - 1}px`;
    else line.style.top = `${start + delta - 1}px`;
  };
  move(0);
  document.body.appendChild(line);
  return { move, remove: () => line.remove() };
}

/** Elements that are not cell content when measuring (handles, bars). */
const isDecoration = (node: Node): boolean =>
  node instanceof HTMLElement && (node.dataset.nqResize !== undefined || node.dataset.nqBar !== undefined);

/**
 * Natural width of a cell's content plus its horizontal padding and borders: the content is cloned
 * into a hidden `max-content` box inside the cell (so it keeps the cell's fonts and classes).
 */
export function pivotCellContentWidth(cell: HTMLElement): number {
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;left:0;top:0;visibility:hidden;width:max-content;white-space:nowrap;pointer-events:none";
  for (const node of Array.from(cell.childNodes)) if (!isDecoration(node)) probe.appendChild(node.cloneNode(true));
  cell.appendChild(probe);
  const content = probe.getBoundingClientRect().width;
  probe.remove();
  const s = getComputedStyle(cell);
  const px = (v: string) => Number.parseFloat(v) || 0;
  return content + px(s.paddingLeft) + px(s.paddingRight) + px(s.borderLeftWidth) + px(s.borderRightWidth);
}

/** Widest rendered cell carrying `data-<attribute>="<value>"` inside `root` (header and body). */
export function pivotAutoFitWidth(root: HTMLElement | null, attribute: "data-nq-col" | "data-nq-dim-col", value: number): number | null {
  if (!root) return null;
  let widest = 0;
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(`[${attribute}="${value}"]`))) widest = Math.max(widest, pivotCellContentWidth(el));
  return widest > 0 ? Math.ceil(widest + 1) : null;
}

// ---------------------------------------------------------------------------
// Measure reorder (drag a measure header; Alt+Arrow on a focused one)
// ---------------------------------------------------------------------------

const DRAG_THRESHOLD = 4;
const INDICATOR = "var(--nq-pivot-drop-indicator, currentColor)";

/** Cells inside a header that start their own gesture (buttons, handles, field-list drags). */
const OWN_GESTURE = "button, a, input, select, textarea, [data-nq-resize], [draggable='true'], [data-nqg-field-drag]";

/**
 * Start a measure drag from a pointer-down on a measure header (`th[data-nq-run]`). Siblings are the
 * `th`s with the same `data-nq-run` in its table; a drop indicator (inset line +
 * `data-nq-drop="before|after"`) marks the insertion point; Escape cancels. `onDrop(order)` gets the
 * run's measure ids in their new order, only when they changed.
 */
export function pivotStartMeasureDrag(
  e: ReactPointerEvent<HTMLElement>,
  run: readonly PivotHeaderLayoutCell[],
  onDrop: (runOrder: readonly string[]) => void,
): void {
  const table = e.currentTarget.closest("table");
  if (e.button !== 0 || !table) return;
  if ((e.target as Element).closest(OWN_GESTURE)) return;
  const source = e.currentTarget;
  const runId = source.dataset.nqRun;
  const from = run.findIndex((c) => c.cell.measureId === source.dataset.nqMeasure);
  if (!runId || from < 0) return;
  const originX = e.clientX;
  const originY = e.clientY;
  capture(source, e.pointerId);
  let done = false;
  let active = false;
  let insert = -1;
  let marked: HTMLElement | null = null;
  // No text selection while a header is dragged (restored at the end).
  const root = document.documentElement;
  const userSelect = root.style.userSelect;
  const siblings = () => Array.from(table.querySelectorAll<HTMLElement>(`th[data-nq-run="${runId}"]`));
  const clearMark = () => {
    if (!marked) return;
    delete marked.dataset.nqDrop;
    marked.style.boxShadow = "";
    marked = null;
  };
  const move = (ev: PointerEvent | MouseEvent) => {
    if (!active) {
      if (Math.abs(ev.clientX - originX) < DRAG_THRESHOLD && Math.abs(ev.clientY - originY) < DRAG_THRESHOLD) return;
      active = true;
      source.dataset.nqDragging = "";
      root.style.userSelect = "none";
      window.getSelection()?.removeAllRanges();
    }
    ev.preventDefault();
    const cells = siblings();
    let at = cells.length;
    for (let i = 0; i < cells.length; i++) {
      const r = cells[i]!.getBoundingClientRect();
      if (ev.clientX < r.left + r.width / 2) {
        at = i;
        break;
      }
    }
    insert = at;
    clearMark();
    // Dropping on either side of the dragged header changes nothing: no indicator.
    if (at === from || at === from + 1 || cells.length === 0) return;
    const after = at === cells.length;
    marked = cells[after ? cells.length - 1 : at]!;
    marked.dataset.nqDrop = after ? "after" : "before";
    marked.style.boxShadow = `inset ${after ? -2 : 2}px 0 0 0 ${INDICATOR}`;
  };
  const finish = (commit: boolean) => {
    if (done) return;
    done = true;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
    source.removeEventListener("lostpointercapture", up);
    clearMark();
    delete source.dataset.nqDragging;
    if (active) root.style.userSelect = userSelect;
    if (!commit || !active || insert < 0 || insert === from || insert === from + 1) return;
    const ids = run.map((c) => c.cell.measureId!);
    const [moved] = ids.splice(from, 1);
    ids.splice(insert > from ? insert - 1 : insert, 0, moved!);
    onDrop(ids);
  };
  const up = () => finish(true);
  const cancel = () => finish(false);
  const key = (ev: globalThis.KeyboardEvent) => {
    if (ev.key !== "Escape") return;
    ev.preventDefault();
    ev.stopPropagation();
    finish(false);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", key, true);
  source.addEventListener("lostpointercapture", up);
}

/**
 * Keep pointer events coming while the pointer is outside the window, so a release there still ends
 * the gesture (and its listeners). No-op where pointer capture is unavailable.
 */
function capture(el: Element, pointerId: number | undefined): void {
  if (pointerId === undefined || typeof el.setPointerCapture !== "function") return;
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // Not an active pointer (e.g. a synthetic event): window listeners still end the gesture.
  }
}

/**
 * After an Alt+Arrow move: focus the moved measure's header again once the host has re-rendered
 * (header cells are keyed by position, so focus would otherwise stay on the old place).
 */
export function pivotRefocusMeasure(from: HTMLElement, run: string, measureId: string): void {
  const table = from.closest("table");
  if (!table) return;
  const focus = () => {
    // Leave focus alone once the person has moved it elsewhere.
    const active = document.activeElement;
    if (active !== from && active !== document.body && active !== null) return;
    const heads = Array.from(table.querySelectorAll<HTMLElement>(`th[data-nq-run="${run}"]`));
    heads.find((th) => th.dataset.nqMeasure === measureId)?.focus();
  };
  // React commits a state update made in a key handler before this microtask runs, so a second
  // key press lands on the moved header; the frame callback covers hosts that update later.
  queueMicrotask(focus);
  if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(focus);
}

/** The full measure order after a run was rearranged (measures outside the run keep their order, after it). */
export function pivotMergeRunOrder(current: readonly string[], runOrder: readonly string[]): readonly string[] {
  const inRun = new Set(runOrder);
  return [...runOrder, ...current.filter((id) => !inRun.has(id))];
}
