import type { PointerEvent as ReactPointerEvent } from "react";

import type { PivotFieldLocation } from "../core/pivot/fields";
import { pivotDragPreviewClass, pivotDropIndicatorClass } from "../styles";

/**
 * Dependency-free pointer drag-and-drop for field chips (mouse, pen and touch).
 *
 * Drop targets are plain DOM attributes, so any element can be one (the field list's areas, or
 * the grid's dimension headers via `renderDimensionHeader`):
 *
 * - `data-nqg-drop-zone="rows|columns|values|filters|unused"` on a container;
 * - `data-nqg-drop-item` on each chip inside it (insertion index = chips before the pointer);
 * - optional `data-nqg-drop-axis="x"` (horizontal lists, e.g. header cells) and
 *   `data-nqg-drop-offset="n"` (added to the index, e.g. a header's row level).
 *
 * While dragging, nothing re-renders: pointer moves are coalesced to one hit test per animation
 * frame, and the preview, insertion indicator and zone highlight (`data-nqg-drop-active`) are
 * updated directly in the DOM. Only the drop calls back (`onDrop`), so the pivot rebuilds once.
 * Escape cancels. Touch drags start after a short press (`touchDelay`) so lists still scroll.
 */

export interface PivotFieldDragSource {
  /** `movePivotField` id: record field, measure id (Values) or `PIVOT_VALUES_FIELD`. */
  readonly field: string;
  readonly from: PivotFieldLocation;
  /** Text of the drag preview and announcements. */
  readonly label: string;
}

export interface PivotFieldDropTarget {
  readonly to: PivotFieldLocation;
  /** Insertion index in `to`, as displayed (see `PivotFieldMove.index`). */
  readonly index: number;
}

export interface PivotFieldDragOptions {
  readonly source: PivotFieldDragSource;
  /** Whether `target` accepts the source (evaluated once per target change). Default: always. */
  readonly canDrop?: (target: PivotFieldDropTarget, source: PivotFieldDragSource) => boolean;
  readonly onDrop: (target: PivotFieldDropTarget, source: PivotFieldDragSource) => void;
  /** Called when the drag starts (after the activation distance / delay). */
  readonly onStart?: (source: PivotFieldDragSource) => void;
  /** Escape, pointer cancel, or a drop outside any accepting zone. */
  readonly onCancel?: (source: PivotFieldDragSource) => void;
  /** Mouse / pen activation distance in px (default 4). */
  readonly distance?: number;
  /** Touch press delay in ms before the drag starts (default 250). Moving more than 8 px first scrolls instead. */
  readonly touchDelay?: number;
  readonly previewClassName?: string;
  readonly indicatorClassName?: string;
}

const ZONE = "[data-nqg-drop-zone]";
const ITEM = "[data-nqg-drop-item]";
/** Distance from a scroll container's edge (px) where auto-scroll kicks in. */
const EDGE = 28;
const MAX_SCROLL_STEP = 14;

/** Insertion index for a pointer coordinate given the items' rects (midpoint rule). Pure. */
export function pivotDropIndex(rects: readonly { readonly start: number; readonly end: number }[], pointer: number): number {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]!;
    if (pointer < (r.start + r.end) / 2) return i;
  }
  return rects.length;
}

/** Auto-scroll step (px, signed) for a pointer near a container edge; 0 outside the edge band. Pure. */
export function pivotAutoScrollStep(pointer: number, start: number, end: number, edge = EDGE, max = MAX_SCROLL_STEP): number {
  if (end - start <= edge * 2) return 0;
  if (pointer < start + edge) return -Math.ceil(max * Math.min(1, (start + edge - pointer) / edge));
  if (pointer > end - edge) return Math.ceil(max * Math.min(1, (pointer - (end - edge)) / edge));
  return 0;
}

function scrollParent(el: Element | null): HTMLElement | null {
  for (let node = el as HTMLElement | null; node && node !== node.ownerDocument.body; node = node.parentElement) {
    if (node.scrollHeight > node.clientHeight + 1) {
      const overflow = node.ownerDocument.defaultView?.getComputedStyle(node).overflowY;
      if (overflow === "auto" || overflow === "scroll") return node;
    }
  }
  return null;
}

interface Hit {
  readonly zone: HTMLElement;
  readonly target: PivotFieldDropTarget;
  /** Indicator rect in viewport px, `null` for a zone-wide highlight (e.g. `unused`). */
  readonly line: { readonly left: number; readonly top: number; readonly width: number; readonly height: number } | null;
}

function hitTest(doc: Document, x: number, y: number): Hit | null {
  const el = doc.elementFromPoint(x, y);
  const zone = el?.closest<HTMLElement>(ZONE);
  if (!zone) return null;
  const to = zone.dataset.nqgDropZone as PivotFieldLocation;
  const horizontal = zone.dataset.nqgDropAxis === "x";
  const offset = Number(zone.dataset.nqgDropOffset ?? 0) || 0;
  const items = [...zone.querySelectorAll<HTMLElement>(ITEM)].filter((i) => i.closest(ZONE) === zone);
  const rects = items.map((i) => i.getBoundingClientRect());
  const index = pivotDropIndex(
    rects.map((r) => (horizontal ? { start: r.left, end: r.right } : { start: r.top, end: r.bottom })),
    horizontal ? x : y,
  );
  if (to === "unused") return { zone, target: { to, index: 0 }, line: null };
  const box = zone.getBoundingClientRect();
  let line: Hit["line"];
  if (rects.length === 0) {
    line = horizontal ? { left: box.left + 2, top: box.top, width: 2, height: box.height } : { left: box.left + 6, top: box.top + 6, width: box.width - 12, height: 2 };
  } else if (horizontal) {
    const r = rects[Math.min(index, rects.length - 1)]!;
    const left = index < rects.length ? r.left : r.right;
    line = { left: left - 1, top: r.top, width: 2, height: r.height };
  } else {
    const r = rects[Math.min(index, rects.length - 1)]!;
    const prev = index > 0 ? rects[index - 1]! : null;
    const top = index < rects.length ? (prev ? (prev.bottom + r.top) / 2 : r.top - 2) : r.bottom + 2;
    line = { left: r.left, top: top - 1, width: r.width, height: 2 };
  }
  return { zone, target: { to, index: offset + index }, line };
}

/**
 * Start tracking a possible drag from a `pointerdown` (React or native event) on `element`.
 * Returns a function that aborts it. Primary button / single touch only.
 */
export function startPivotFieldDrag(event: PointerEvent | ReactPointerEvent, element: HTMLElement, options: PivotFieldDragOptions): () => void {
  if (event.button !== 0 || !event.isPrimary) return () => {};
  const doc = element.ownerDocument;
  const win = doc.defaultView!;
  const touch = event.pointerType === "touch";
  const distance = options.distance ?? 4;
  const startX = event.clientX;
  const startY = event.clientY;
  const pointerId = event.pointerId;
  let x = startX;
  let y = startY;
  let active = false;
  let frame = 0;
  let preview: HTMLElement | null = null;
  let indicator: HTMLElement | null = null;
  let current: Hit | null = null;
  let accepted = false;
  const verdicts = new Map<string, boolean>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const accepts = (target: PivotFieldDropTarget) => {
    const key = `${target.to}:${target.index}`;
    let ok = verdicts.get(key);
    if (ok === undefined) verdicts.set(key, (ok = options.canDrop ? options.canDrop(target, options.source) : true));
    return ok;
  };

  const setZone = (zone: HTMLElement | null, ok: boolean) => {
    if (current?.zone && current.zone !== zone) {
      delete current.zone.dataset.nqgDropActive;
      delete current.zone.dataset.nqgDropInvalid;
    }
    if (zone) {
      if (ok) {
        zone.dataset.nqgDropActive = "";
        delete zone.dataset.nqgDropInvalid;
      } else {
        zone.dataset.nqgDropInvalid = "";
        delete zone.dataset.nqgDropActive;
      }
    }
  };

  const tick = () => {
    frame = 0;
    if (!active) return;
    if (preview) preview.style.transform = `translate3d(${x + 12}px, ${y + 10}px, 0)`;
    const hit = hitTest(doc, x, y);
    const ok = hit ? accepts(hit.target) : false;
    setZone(hit?.zone ?? null, ok);
    current = hit;
    accepted = ok;
    if (indicator) {
      if (hit && ok && hit.line) {
        indicator.style.display = "block";
        indicator.style.transform = `translate3d(${hit.line.left}px, ${hit.line.top}px, 0)`;
        indicator.style.width = `${hit.line.width}px`;
        indicator.style.height = `${hit.line.height}px`;
      } else {
        indicator.style.display = "none";
      }
    }
    doc.body.style.cursor = hit && !ok ? "no-drop" : "grabbing";
    // Auto-scroll the list under the pointer (zone or its scroll parent).
    const scroller = scrollParent(hit?.zone ?? doc.elementFromPoint(x, y));
    if (scroller) {
      const box = scroller.getBoundingClientRect();
      const step = pivotAutoScrollStep(y, box.top, box.bottom);
      if (step !== 0) {
        scroller.scrollTop += step;
        schedule();
      }
    }
  };
  const schedule = () => {
    if (!frame) frame = win.requestAnimationFrame(tick);
  };

  const activate = () => {
    if (active) return;
    active = true;
    preview = doc.createElement("div");
    preview.className = [pivotDragPreviewClass, options.previewClassName].filter(Boolean).join(" ");
    preview.textContent = options.source.label;
    preview.setAttribute("aria-hidden", "true");
    preview.dataset.nqgDragPreview = "";
    // Inline fallbacks keep the preview visible without Tailwind (the class tokens refine it).
    Object.assign(preview.style, {
      position: "fixed",
      left: "0",
      top: "0",
      zIndex: "2147483646",
      pointerEvents: "none",
      willChange: "transform",
      padding: "4px 8px",
      font: "500 12px/1.4 system-ui, sans-serif",
      color: "var(--popover-foreground, #111)",
      background: "var(--popover, #fff)",
      border: "1px solid var(--primary, #2563eb)",
      borderRadius: "6px",
      boxShadow: "0 6px 16px rgb(0 0 0 / 0.18)",
      whiteSpace: "nowrap",
    });
    indicator = doc.createElement("div");
    indicator.className = [pivotDropIndicatorClass, options.indicatorClassName].filter(Boolean).join(" ");
    indicator.setAttribute("aria-hidden", "true");
    indicator.dataset.nqgDropIndicator = "";
    Object.assign(indicator.style, {
      position: "fixed",
      left: "0",
      top: "0",
      zIndex: "2147483647",
      pointerEvents: "none",
      display: "none",
      background: "var(--primary, #2563eb)",
      borderRadius: "2px",
    });
    doc.body.append(preview, indicator);
    element.dataset.nqgDragging = "";
    doc.body.style.userSelect = "none";
    doc.body.style.webkitUserSelect = "none";
    options.onStart?.(options.source);
    schedule();
  };

  const cleanup = () => {
    clearTimeout(timer);
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
    win.removeEventListener("pointermove", onMove, true);
    win.removeEventListener("pointerup", onUp, true);
    win.removeEventListener("pointercancel", onCancel, true);
    win.removeEventListener("keydown", onKey, true);
    doc.removeEventListener("touchmove", onTouchMove);
    preview?.remove();
    indicator?.remove();
    setZone(null, false);
    delete element.dataset.nqgDragging;
    if (active) {
      doc.body.style.cursor = "";
      doc.body.style.userSelect = "";
      doc.body.style.webkitUserSelect = "";
    }
  };

  const suppressClick = () => {
    // The pointerup of a drag would also "click" the chip (open its menu / toggle a checkbox).
    const swallow = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
    };
    win.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => win.removeEventListener("click", swallow, { capture: true }), 0);
  };

  function onMove(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    x = e.clientX;
    y = e.clientY;
    if (!active) {
      const moved = Math.hypot(x - startX, y - startY);
      if (touch) {
        if (moved > 8) abort(); // the user is scrolling
      } else if (moved >= distance) {
        activate();
      }
      return;
    }
    e.preventDefault();
    schedule();
  }
  function onUp(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    const wasActive = active;
    if (wasActive) {
      x = e.clientX;
      y = e.clientY;
      if (frame) win.cancelAnimationFrame(frame);
      tick();
    }
    const hit = current;
    const ok = accepted;
    cleanup();
    if (!wasActive) return;
    suppressClick();
    if (hit && ok) options.onDrop(hit.target, options.source);
    else options.onCancel?.(options.source);
  }
  function onCancel(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    const wasActive = active;
    cleanup();
    if (wasActive) options.onCancel?.(options.source);
  }
  function onKey(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    const wasActive = active;
    cleanup();
    if (wasActive) {
      suppressClick();
      options.onCancel?.(options.source);
    }
  }
  function onTouchMove(e: TouchEvent) {
    // Once a touch drag is active, keep the page from scrolling under it.
    if (active && e.cancelable) e.preventDefault();
  }
  function abort() {
    cleanup();
  }

  win.addEventListener("pointermove", onMove, true);
  win.addEventListener("pointerup", onUp, true);
  win.addEventListener("pointercancel", onCancel, true);
  win.addEventListener("keydown", onKey, true);
  doc.addEventListener("touchmove", onTouchMove, { passive: false });
  if (touch) timer = setTimeout(activate, options.touchDelay ?? 250);
  return abort;
}

/**
 * Props that make any element a drag handle for a field (spread onto it). For the grid's
 * dimension headers: `<span {...pivotFieldDragHandleProps({ source, onDrop: … })}>{label}</span>`.
 */
export function pivotFieldDragHandleProps(options: PivotFieldDragOptions): {
  readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly "data-nqg-drag-source": string;
  readonly style: { readonly touchAction: "manipulation"; readonly cursor: "grab" };
} {
  return {
    onPointerDown: (event) => {
      startPivotFieldDrag(event, event.currentTarget, options);
    },
    "data-nqg-drag-source": options.source.field,
    style: { touchAction: "manipulation", cursor: "grab" },
  };
}

/** Attributes that make an element a drop zone (see the module comment). */
export function pivotDropZoneProps(
  to: PivotFieldLocation,
  options: { readonly axis?: "x" | "y"; readonly offset?: number } = {},
): Record<`data-nqg-drop-${string}`, string> {
  return {
    "data-nqg-drop-zone": to,
    ...(options.axis === "x" ? { "data-nqg-drop-axis": "x" } : {}),
    ...(options.offset ? { "data-nqg-drop-offset": String(options.offset) } : {}),
  };
}
