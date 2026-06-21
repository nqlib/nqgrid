import type { RichSchemaColumnDef } from "@nqlib/nqgrid/advanced";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement, RefObject } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import type { BarBox, DepEdge } from "./dependency-route";
import { routeDependencies } from "./dependency-route";
import type { GanttItem, GanttRoles } from "./gantt-model";
import { buildGanttModel } from "./gantt-model";
import type { DragMode } from "./reschedule";
import { rescheduleInterval } from "./reschedule";
import type { ZoomUnit } from "./time-scale";
import { createTimeScale, recommendedWidth } from "./time-scale";
import { addDays } from "./date-utils";

const DEFAULT_BAR_COLOR = "#6366f1";

export interface GanttProps<TData extends object> {
  readonly rows: readonly TData[];
  readonly schema: readonly RichSchemaColumnDef<TData>[];
  readonly roles: GanttRoles;
  readonly getRowId: (row: TData) => string;
  readonly zoom?: ZoomUnit;
  readonly dependencies?: readonly DepEdge[];
  readonly getDependencies?: (row: TData) => readonly string[];
  /** Called on drag end with the new **dates (raw)** — commit these to your shared store. */
  readonly onReschedule?: (rowId: string, next: { start: Date; end: Date }, row: TData) => void;
  readonly rowHeight?: number;
  readonly headerHeight?: number;
  readonly laneLabelWidth?: number;
  /** Empty days of padding added to each side of the data domain. */
  readonly padDays?: number;
  readonly snapUnit?: ZoomUnit;
  readonly locale?: string;
  readonly className?: string;
  readonly style?: CSSProperties;
}

interface DragState {
  readonly id: string;
  readonly mode: DragMode;
  readonly startX: number;
  deltaX: number;
}

interface VisualRow<TData extends object> {
  readonly kind: "lane" | "item";
  readonly label: string;
  readonly item?: GanttItem<TData>;
}

function useElementWidth(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export function Gantt<TData extends object>({
  rows,
  schema,
  roles,
  getRowId,
  zoom = "week",
  dependencies,
  getDependencies,
  onReschedule,
  rowHeight = 36,
  headerHeight = 32,
  laneLabelWidth = 200,
  padDays = 3,
  snapUnit = "day",
  locale,
  className,
  style,
}: GanttProps<TData>): ReactElement {
  const [viewportRef, viewportWidth] = useElementWidth();
  const [drag, setDrag] = useState<DragState | null>(null);

  const model = useMemo(
    () => buildGanttModel({ rows, schema, roles, getRowId, getDependencies }),
    [rows, schema, roles, getRowId, getDependencies],
  );

  const domainStart = model.domain ? addDays(model.domain.start, -padDays) : new Date();
  const domainEnd = model.domain ? addDays(model.domain.end, padDays) : addDays(new Date(), 30);

  const timeWidth = Math.max(
    recommendedWidth(domainStart, domainEnd, zoom),
    Math.max(0, viewportWidth - laneLabelWidth),
  );
  const scale = createTimeScale({ start: domainStart, end: domainEnd, width: timeWidth, unit: zoom });

  // Flatten lanes → visual rows (lane header rows only when grouping into >1 lane).
  const showLaneHeaders = model.lanes.length > 1 || model.lanes[0]?.label !== "";
  const visualRows: VisualRow<TData>[] = [];
  for (const lane of model.lanes) {
    if (showLaneHeaders) visualRows.push({ kind: "lane", label: lane.label });
    for (const item of model.items.filter((i) => i.laneId === lane.id)) {
      visualRows.push({ kind: "item", label: item.label, item });
    }
  }

  const ticks = scale.ticks(locale);

  // Bar geometry (time-area coordinates) — recomputed every render, never stored.
  const barBoxes: BarBox[] = [];
  const barTop = (rowIndex: number) => rowIndex * rowHeight;
  visualRows.forEach((vr, idx) => {
    if (vr.kind !== "item" || !vr.item) return;
    const isDragging = drag?.id === vr.item.id;
    const dx = isDragging ? drag.deltaX : 0;
    let x = scale.toX(vr.item.start);
    let w = Math.max(6, scale.toX(vr.item.end) - x);
    if (isDragging) {
      if (drag.mode === "move") x += dx;
      else if (drag.mode === "resize-start") {
        x += dx;
        w -= dx;
      } else w += dx;
    }
    w = Math.max(6, w);
    barBoxes.push({ id: vr.item.id, x, y: barTop(idx) + 6, width: w, height: rowHeight - 12 });
  });

  // Routed every render from the live bar boxes (which already track drag + scale).
  const depEdges: DepEdge[] = dependencies
    ? [...dependencies]
    : model.items.flatMap((i) => i.dependsOn.map((from) => ({ from, to: i.id })));
  const depPaths = routeDependencies(depEdges, barBoxes);

  const bodyHeight = visualRows.length * rowHeight;

  function beginDrag(e: ReactPointerEvent, id: string, mode: DragMode) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id, mode, startX: e.clientX, deltaX: 0 });
  }

  function moveDrag(e: ReactPointerEvent) {
    if (!drag) return;
    setDrag({ ...drag, deltaX: e.clientX - drag.startX });
  }

  function endDrag(e: ReactPointerEvent) {
    if (!drag) return;
    const item = model.items.find((i) => i.id === drag.id);
    if (item && onReschedule && drag.deltaX !== 0) {
      const next = rescheduleInterval({
        start: item.start,
        end: item.end,
        deltaMs: scale.toDuration(drag.deltaX),
        mode: drag.mode,
        snapUnit,
      });
      onReschedule(drag.id, next, item.row);
    }
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    setDrag(null);
  }

  const cornerStyle: CSSProperties = {
    position: "sticky",
    left: 0,
    zIndex: 4,
    width: laneLabelWidth,
    flex: "none",
    background: "var(--nqgantt-surface, #fff)",
    borderRight: "1px solid var(--nqgantt-border, #e5e7eb)",
  };

  return (
    <div
      ref={viewportRef}
      className={className}
      style={{ position: "relative", overflow: "auto", fontSize: 13, ...style }}
    >
      <div style={{ position: "relative", width: laneLabelWidth + timeWidth }}>
        {/* Header: sticky top, with a sticky corner over the label column. */}
        <div
          style={{
            display: "flex",
            position: "sticky",
            top: 0,
            zIndex: 3,
            height: headerHeight,
            background: "var(--nqgantt-surface, #fff)",
            borderBottom: "1px solid var(--nqgantt-border, #e5e7eb)",
          }}
        >
          <div style={{ ...cornerStyle, display: "flex", alignItems: "center", paddingInline: 12, fontWeight: 600 }}>
            Timeline
          </div>
          <div style={{ position: "relative", width: timeWidth }}>
            {ticks.map((t) => (
              <div
                key={t.date.getTime()}
                style={{
                  position: "absolute",
                  left: t.x,
                  top: 0,
                  bottom: 0,
                  paddingLeft: 4,
                  borderLeft: "1px solid var(--nqgantt-grid, #f1f5f9)",
                  color: "var(--nqgantt-muted, #64748b)",
                  display: "flex",
                  alignItems: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {t.label}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ position: "relative" }}>
          {visualRows.map((vr, idx) => (
            <div key={`${vr.kind}-${idx}-${vr.item?.id ?? vr.label}`} style={{ display: "flex", height: rowHeight }}>
              <div
                style={{
                  ...cornerStyle,
                  zIndex: 2,
                  display: "flex",
                  alignItems: "center",
                  paddingInline: vr.kind === "lane" ? 8 : 12,
                  fontWeight: vr.kind === "lane" ? 600 : 400,
                  background:
                    vr.kind === "lane" ? "var(--nqgantt-laneHeader, #f8fafc)" : "var(--nqgantt-surface, #fff)",
                  color: vr.kind === "lane" ? "var(--nqgantt-muted, #64748b)" : "inherit",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={vr.label}
              >
                {vr.label}
              </div>
              <div
                style={{
                  position: "relative",
                  width: timeWidth,
                  borderBottom: "1px solid var(--nqgantt-grid, #f1f5f9)",
                  background:
                    vr.kind === "lane" ? "var(--nqgantt-laneHeader, #f8fafc)" : "transparent",
                }}
              >
                {vr.kind === "item" && vr.item ? renderBar(vr.item, barBoxes[barBoxesIndex(barBoxes, vr.item.id)]) : null}
              </div>
            </div>
          ))}

          {/* Dependency arrows overlay (time-area coordinates). */}
          {depPaths.length > 0 ? (
            <svg
              width={timeWidth}
              height={bodyHeight}
              style={{ position: "absolute", left: laneLabelWidth, top: 0, pointerEvents: "none", overflow: "visible" }}
            >
              <defs>
                <marker id="nqgantt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="var(--nqgantt-dep, #94a3b8)" />
                </marker>
              </defs>
              {depPaths.map((p) => (
                <path
                  key={`${p.from}->${p.to}`}
                  d={p.d}
                  fill="none"
                  stroke="var(--nqgantt-dep, #94a3b8)"
                  strokeWidth={1.5}
                  markerEnd="url(#nqgantt-arrow)"
                />
              ))}
            </svg>
          ) : null}
        </div>
      </div>
    </div>
  );

  function renderBar(item: GanttItem<TData>, box: BarBox | undefined): ReactElement | null {
    if (!box) return null;
    const color = item.color ?? DEFAULT_BAR_COLOR;
    const cursor = drag?.id === item.id ? "grabbing" : "grab";

    if (item.isMilestone) {
      const size = box.height;
      return (
        <div
          role="button"
          aria-label={`${item.label} (milestone)`}
          onPointerDown={(e) => beginDrag(e, item.id, "move")}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          title={item.label}
          style={{
            position: "absolute",
            left: box.x - size / 2,
            top: box.y,
            width: size,
            height: size,
            background: color,
            transform: "rotate(45deg)",
            borderRadius: 3,
            cursor,
          }}
        />
      );
    }

    return (
      <div
        role="button"
        aria-label={item.label}
        onPointerDown={(e) => beginDrag(e, item.id, "move")}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        title={item.label}
        style={{
          position: "absolute",
          left: box.x,
          top: box.y,
          width: box.width,
          height: box.height,
          background: color,
          borderRadius: 6,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          paddingInline: 8,
          fontSize: 12,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          cursor,
          userSelect: "none",
        }}
      >
        <span
          onPointerDown={(e) => beginDrag(e, item.id, "resize-start")}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, cursor: "ew-resize" }}
        />
        {item.label}
        <span
          onPointerDown={(e) => beginDrag(e, item.id, "resize-end")}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "ew-resize" }}
        />
      </div>
    );
  }
}

function barBoxesIndex(boxes: readonly BarBox[], id: string): number {
  return boxes.findIndex((b) => b.id === id);
}
