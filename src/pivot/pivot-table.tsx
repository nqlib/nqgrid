import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { pivotCellDrillTarget } from "../core/pivot/build-model";
import type { PivotDrillThroughTarget } from "../core/pivot/cube";
import type { PivotBodyRow, PivotCell, PivotHeaderCell, PivotModel, PivotModelDimension, PivotValueColumn } from "../core/pivot/types";
import {
  pivotCountClass,
  pivotGrandTotalCellClass,
  pivotGrandTotalLabelClass,
  pivotGroupCellClass,
  pivotGroupLabelClass,
  pivotGroupValueClass,
  pivotHeadCellClass,
  pivotHeadLabelClass,
  pivotHeadValueCellClass,
  pivotLabelTextClass,
  pivotLeafCellClass,
  pivotPinnedClass,
  pivotPinnedEdgeClass,
  pivotRowHeaderClass,
  pivotPinnedHeadClass,
  pivotSpanCellClass,
  pivotStickyHeadClass,
  pivotTableClass,
  pivotToggleClass,
  pivotValueClass,
} from "../styles";
import { cx, pivotHeatCellProps, type PivotRenderMode } from "./heat";
import { PivotHeaderChartBand } from "./pivot-header-chart";
import { pivotAriaSort, pivotDimensionStatus, PivotHeaderIndicator, type PivotDimensionStatus } from "./pivot-header-indicator";
import { PivotKpiDelta, PivotKpiPanel } from "./pivot-kpi-panel";
import {
  pivotBodyGroups,
  pivotColumnHeaderRole,
  pivotDimensionSlots,
  pivotModelColumnDimensions,
  pivotKpiPanelHeight,
  pivotRowCaption,
  pivotTableGeometry,
  pivotVirtualRowWindow,
  type PivotColumnHeaderRole,
  type PivotTableGeometry,
} from "./layout";

export interface PivotSpanCellContext {
  readonly model: PivotModel;
  readonly mode: PivotRenderMode;
  readonly level: number;
  readonly rowSpan: number;
  /** Toggle control for this group (`null` in static mode or without `onToggleGroup`). */
  readonly toggle: ReactNode;
}

export interface PivotDimensionHeaderContext {
  readonly model: PivotModel;
  readonly mode: PivotRenderMode;
  /** Row-dimension level (`0` = outermost). In compact layout the single header reports level 0. */
  readonly level: number;
  readonly dimension: PivotModelDimension;
  /** Sort / filter state (see `pivotDimensionStatus`). */
  readonly status: PivotDimensionStatus;
  /** Default header text (compact: all labels joined with " / "). */
  readonly label: string;
  /** Default `PivotHeaderIndicator` (`null` when nothing is active). */
  readonly indicator: ReactNode;
}

export interface PivotColumnHeaderContext extends PivotColumnHeaderRole {
  readonly model: PivotModel;
  readonly mode: PivotRenderMode;
  readonly cell: PivotHeaderCell;
  /** Header row index (`0` = outermost). */
  readonly row: number;
  /** Column field of `dimension` / `subtotal` cells, else `null`. */
  readonly dimension: { readonly field: string; readonly label: string } | null;
  /** The field has an active report / label filter. */
  readonly filtered: boolean;
  /** Default header text. */
  readonly label: string;
  /** Expand / collapse button of a column group (`null` otherwise, in static mode or without `onToggleColumnGroup`). */
  readonly toggle: ReactNode;
}

/** A value cell of `PivotTable` (passed to `onDrillThrough`). */
export interface PivotCellContext {
  readonly model: PivotModel;
  readonly row: PivotBodyRow;
  /** Index in `model.rows`. */
  readonly rowIndex: number;
  readonly column: PivotValueColumn;
  /** Index in `model.columns`. */
  readonly columnIndex: number;
  readonly cell: PivotCell;
}

export interface PivotTableProps {
  readonly model: PivotModel;
  /** `interactive` (default): toggles + CSS sticky pinning. `static`: plain markup for HTML/PDF. */
  readonly mode?: PivotRenderMode;
  /** Called with a group's key path (e.g. `usePivotGrid().toggleGroup`). Toggles render only when set. */
  readonly onToggleGroup?: (path: readonly string[]) => void;
  /**
   * Called with a column group's key path (e.g. `usePivotGrid().toggleColumnGroup`). Expand / collapse
   * buttons render on column-group headers only when set.
   */
  readonly onToggleColumnGroup?: (path: readonly string[]) => void;
  /** Row-dimension column widths in px (tabular default `[208, 172]`). */
  readonly dimensionWidths?: readonly number[];
  /** Value column width in px (default 84). */
  readonly valueWidth?: number;
  /** Body row height in px (default 36). */
  readonly rowHeight?: number;
  /** Column header row height in px (default 36). */
  readonly headRowHeight?: number;
  /** Header chart band above the column headers (default: when `model.headerSeries` exists). */
  readonly headerChart?: boolean;
  /** Bar area height in px (default 44). */
  readonly chartHeight?: number;
  /** Band summary cell (default `PivotHeaderSummary`). */
  readonly headerSummary?: ReactNode;
  /** KPI id shown large in the side panel (default: first KPI). */
  readonly kpiHeadlineId?: string;
  /** Row attribute printed as the KPI panel caption (default: first attribute, e.g. `owner`). */
  readonly kpiCaptionAttribute?: string;
  /** Show `PivotKpiPanel` in expanded span cells (default true); `false` prints the compact label + headline delta. */
  readonly kpiPanel?: boolean;
  /**
   * When a KPI panel is taller than its group's rows, add a blank filler row under the group so the
   * panel fits without stretching the data rows (default: static mode only).
   */
  readonly fillSpanHeight?: boolean;
  /**
   * Replace a row-dimension header's content, e.g. to add a filter menu button
   * (`PivotHeaderMenu` + `PivotFilterMenu`, or your own popover). Default: label + indicator.
   */
  readonly renderDimensionHeader?: (context: PivotDimensionHeaderContext) => ReactNode;
  /**
   * Replace a value-column header's content, e.g. to make column-field headers drag handles for the
   * field list (`pivotFieldDragHandleProps`) and drop zones (`pivotDropZoneProps("columns", { axis: "x",
   * offset: context.areaIndex })`). Default: the label, plus `toggle` on column groups.
   */
  readonly renderColumnHeader?: (context: PivotColumnHeaderContext) => ReactNode;
  /** Replace the outer span cell content (the KPI side-panel slot). */
  readonly renderSpanCell?: (row: PivotBodyRow, context: PivotSpanCellContext) => ReactNode;
  /**
   * Excel's "Show details": called on double-click of a value cell (interactive mode) with its
   * drill-through target (`pivotCellDrillTarget`). Pass it to `grid.drillThrough(target)` /
   * `pivotDrillThrough(spec, rows, target)` and show the records, e.g. in `PivotDrillThroughPanel`.
   */
  readonly onDrillThrough?: (target: PivotDrillThroughTarget, context: PivotCellContext) => void;
  /**
   * Row virtualization (interactive mode only; static output always renders every row). When on,
   * only the body rows inside the nearest scrolling ancestor (else the window), plus `overscan`
   * rows, are in the DOM; spacer rows keep the scroll height, and span cells that start above the
   * rendered rows are drawn clipped at the first rendered row. Rows count as `rowHeight` tall until
   * rendered (then their measured height is used), and KPI panels get filler rows
   * (`fillSpanHeight`) so they never stretch rows.
   *
   * `"auto"` (default): on when the body has more than `PIVOT_VIRTUALIZE_AUTO_CELLS` value cells
   * (rows × value columns) and more than 200 rows. `false` always renders every row (e.g. for the
   * browser's find-in-page over all rows), `true` always virtualizes.
   */
  readonly virtualize?: boolean | "auto";
  /** Extra rows rendered above and below the viewport when virtualized (default 12). */
  readonly overscan?: number;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly "aria-label"?: string;
}

/**
 * `virtualize: "auto"` turns row virtualization on above this many body value cells (rows × value
 * columns). Measured in Chromium (docs/pivot-performance.md): a fully rendered 6,000-row × 39-column
 * body takes about 3.6 s to mount and 0.7 s per update; virtualized, about 0.1 s and 30 ms at any size.
 */
export const PIVOT_VIRTUALIZE_AUTO_CELLS = 10_000;
/** `virtualize: "auto"` never virtualizes bodies of at most this many rows. */
const PIVOT_VIRTUALIZE_MIN_ROWS = 200;

/** Inline so static HTML (no Tailwind) keeps label and indicator on one line. */
const HEAD_LABEL_STYLE: CSSProperties = { display: "flex", alignItems: "center", gap: 4, minWidth: 0 };

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={{ display: "block" }}>
      <path
        d={expanded ? "M4 6l4 4 4-4" : "M6 4l4 4-4 4"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Planning-style pivot as a semantic `<table>`: a header chart band, row-dimension columns
 * (pinned with CSS `position: sticky` in interactive mode), a tall outer-dimension cell with a
 * KPI panel (real `rowSpan` from `model.spans`), and heat-colored value cells.
 *
 * Renders from the model alone — no hooks, effects or measurement — so
 * `renderToStaticMarkup(<PivotTable model={m} mode="static" />)` gives the same layout.
 * Wrap it in a scroll container for interactive use. Memoized (`React.memo`): re-renders only when
 * a prop changes, e.g. a new model — keep callbacks such as `renderDimensionHeader` stable.
 */
export const PivotTable = memo(function PivotTable({
  model,
  mode = "interactive",
  onToggleGroup,
  onToggleColumnGroup,
  dimensionWidths,
  valueWidth,
  rowHeight = 36,
  headRowHeight = 36,
  headerChart,
  chartHeight = 44,
  headerSummary,
  kpiHeadlineId,
  kpiCaptionAttribute,
  kpiPanel = true,
  fillSpanHeight,
  renderSpanCell,
  renderDimensionHeader,
  renderColumnHeader,
  onDrillThrough,
  virtualize = "auto",
  overscan = 12,
  className,
  style,
  "aria-label": ariaLabel,
}: PivotTableProps) {
  const interactive = mode === "interactive";
  const virtual =
    interactive &&
    (virtualize === true ||
      (virtualize === "auto" &&
        model.rows.length > PIVOT_VIRTUALIZE_MIN_ROWS &&
        model.rows.length * model.columns.length > PIVOT_VIRTUALIZE_AUTO_CELLS));
  const geometry = pivotTableGeometry(model, { dimensionWidths, valueWidth });
  const showBand = (headerChart ?? true) && model.headerSeries !== null;
  const bandHeight = chartHeight + 32;
  const headTop = showBand ? bandHeight : 0;
  const headerHeight = headTop + model.headerRows.length * headRowHeight;
  const heatLevels = model.heat?.levels ?? 9;
  const lastDim = geometry.dimensionColumns - 1;
  const compact = model.layout === "compact";
  const slots = compact ? null : pivotDimensionSlots(model);
  const showsKpiPanel = (row: PivotBodyRow) => !renderSpanCell && kpiPanel && Boolean(row.kpis?.length) && row.expanded;

  // Top-level spans whose KPI panel needs more height than their rows: row index of the group's
  // last row → filler height in px (the span cell then covers the filler row as well).
  const fillers = new Map<number, number>();
  const extendedSpans = new Set<number>();
  if (slots && (fillSpanHeight ?? (!interactive || virtual))) {
    for (const s of model.spans[0] ?? []) {
      const row = model.rows[s.rowIndex];
      if (!row || row.depth !== 0 || !showsKpiPanel(row)) continue;
      const need = pivotKpiPanelHeight(row.kpis!, {
        headlineId: kpiHeadlineId,
        caption: pivotRowCaption(row, kpiCaptionAttribute) !== null,
      });
      const deficit = Math.ceil(need - s.span * rowHeight);
      if (deficit > 0) {
        fillers.set(s.rowIndex + s.span - 1, deficit);
        extendedSpans.add(s.rowIndex);
      }
    }
  }

  const pinned = (col: number, extra?: CSSProperties): { className?: string; style?: CSSProperties } =>
    interactive ? { className: pivotPinnedClass, style: { left: geometry.dimensionOffsets[col], ...extra } } : { style: extra };

  const toggleFor = (row: PivotBodyRow): ReactNode =>
    interactive && onToggleGroup && row.expandable ? (
      <button
        type="button"
        className={pivotToggleClass}
        aria-expanded={row.expanded}
        aria-label={`${row.expanded ? "Collapse" : "Expand"} ${row.label}`}
        onClick={() => onToggleGroup(row.path)}
      >
        <Chevron expanded={row.expanded} />
      </button>
    ) : null;

  const groupLabel = (row: PivotBodyRow, indent = 0) => (
    <div className={pivotGroupLabelClass} style={{ justifyContent: "space-between", paddingLeft: indent }}>
      <span className={pivotGroupLabelClass}>
        <span className={pivotLabelTextClass}>{row.label}</span>
        <span className={pivotCountClass} title={`${row.childCount} items`}>
          {row.childCount}
        </span>
      </span>
      {toggleFor(row)}
    </div>
  );

  const spanContent = (row: PivotBodyRow, level: number, rowSpan: number): ReactNode => {
    const toggle = toggleFor(row);
    if (renderSpanCell) return renderSpanCell(row, { model, mode, level, rowSpan, toggle });
    if (showsKpiPanel(row)) {
      return (
        <PivotKpiPanel
          kpis={row.kpis!}
          title={row.label}
          titleAddon={toggle}
          caption={pivotRowCaption(row, kpiCaptionAttribute) ?? undefined}
          headlineId={kpiHeadlineId}
        />
      );
    }
    const headline = row.kpis?.find((k) => k.id === kpiHeadlineId) ?? row.kpis?.[0];
    return (
      <div className={pivotGroupLabelClass} style={{ justifyContent: "space-between" }}>
        <span className={pivotGroupLabelClass}>
          <span className={pivotLabelTextClass} style={{ fontWeight: 600 }}>
            {row.label}
          </span>
          {headline ? <PivotKpiDelta kpi={headline} /> : null}
        </span>
        {toggle}
      </div>
    );
  };

  const rowCellClass = (row: PivotBodyRow) =>
    row.kind === "grandTotal" ? pivotGrandTotalCellClass : row.kind === "group" || row.kind === "subtotal" ? pivotGroupCellClass : pivotLeafCellClass;

  /** Rendered `<tr>`s a span cell covers from `from` (owner row or first rendered row) to its last row, within `[.., end)`. */
  const spanRows = (level: number, owner: number, ownerSpan: number, from: number, end: number): number => {
    const last = owner + ownerSpan - 1;
    const rows = Math.min(last, end - 1) - from + 1;
    return rows + (level === 0 && extendedSpans.has(owner) && last <= end - 1 ? 1 : 0);
  };
  /** Row of the span cell that covers `rowIndex` at `level` (a `covered` slot). */
  const spanOwner = (level: number, rowIndex: number): number => {
    let r = rowIndex;
    while (r > 0 && slots![r]![level]?.type === "covered") r--;
    return r;
  };
  const spanCell = (owner: number, level: number, ownerSpan: number, rowSpan: number): ReactNode => {
    const row = model.rows[owner]!;
    const p = pinned(level);
    // Interactive: the panel sticks under the header while its rows scroll past.
    const inner: CSSProperties | undefined = interactive && ownerSpan > 1 ? { position: "sticky", top: headerHeight + 8 } : undefined;
    return (
      <th
        key={`d${level}`}
        scope="rowgroup"
        rowSpan={rowSpan}
        className={cx(pivotSpanCellClass, pivotRowHeaderClass, level === lastDim ? pivotPinnedEdgeClass : undefined, p.className)}
        style={p.style}
        data-nqg-span={ownerSpan}
      >
        <div style={inner}>{spanContent(row, level, ownerSpan)}</div>
      </th>
    );
  };

  const dimensionCells = (row: PivotBodyRow, rowIndex: number, windowStart: number, windowEnd: number): ReactNode[] => {
    const base = rowCellClass(row);
    const edge = (col: number) => (col === lastDim ? pivotPinnedEdgeClass : undefined);
    if (row.kind === "grandTotal") {
      const p = pinned(0);
      return [
        <th key="gt" scope="row" colSpan={geometry.dimensionColumns} className={cx(base, pivotGrandTotalLabelClass, pivotPinnedEdgeClass, p.className)} style={p.style}>
          {row.label}
        </th>,
      ];
    }
    if (compact) {
      const p = pinned(0);
      return [
        <th key="c" scope="row" className={cx(base, pivotRowHeaderClass, edge(0), p.className)} style={p.style}>
          {row.kind === "group" ? (
            groupLabel(row, row.depth * 16)
          ) : (
            <span className={row.kind === "subtotal" ? pivotLabelTextClass : undefined} style={{ paddingLeft: row.depth * 16 }}>
              {row.label}
            </span>
          )}
        </th>,
      ];
    }
    return slots![rowIndex]!.flatMap((slot): ReactNode[] => {
      if (slot.type === "grandTotal") return [];
      if (slot.type === "covered") {
        // Virtualized: a span that starts above the rendered rows is drawn from the first one.
        if (rowIndex !== windowStart || rowIndex === 0) return [];
        const owner = spanOwner(slot.level, rowIndex);
        const ownerSlot = slots![owner]![slot.level];
        if (ownerSlot?.type !== "span") return [];
        return [spanCell(owner, slot.level, ownerSlot.rowSpan, spanRows(slot.level, owner, ownerSlot.rowSpan, rowIndex, windowEnd))];
      }
      const p = pinned(slot.level);
      if (slot.type === "span") return [spanCell(rowIndex, slot.level, slot.rowSpan, spanRows(slot.level, rowIndex, slot.rowSpan, rowIndex, windowEnd))];
      const content =
        slot.type === "group" ? groupLabel(row) : slot.type === "leaf" || slot.type === "subtotal" ? <span className={pivotLabelTextClass}>{row.label}</span> : null;
      return [
        <td key={`d${slot.level}`} className={cx(base, edge(slot.level), p.className)} style={p.style}>
          {content}
        </td>,
      ];
    });
  };

  const drill = interactive ? onDrillThrough : undefined;
  const valueCells = (row: PivotBodyRow, rowIndex: number): ReactNode[] =>
    row.cells.map((cell, i) => {
      const heat = pivotHeatCellProps(cell, heatLevels);
      const column = model.columns[i]!;
      return (
        <td
          key={column.id}
          className={cx(rowCellClass(row), pivotValueClass, (row.kind === "group" || row.kind === "subtotal") && pivotGroupValueClass, heat.className)}
          style={heat.style}
          data-heat={heat["data-heat"]}
          onDoubleClick={drill ? () => drill(pivotCellDrillTarget(model, row, i), { model, row, rowIndex, column, columnIndex: i, cell }) : undefined}
          // Keep a double-click from selecting the cell text.
          onMouseDown={drill ? (e) => e.detail > 1 && e.preventDefault() : undefined}
        >
          {cell.text}
        </td>
      );
    });

  const headCellPos = (r: number, pinnedCol?: number): { className?: string; style?: CSSProperties } => {
    const height = headRowHeight;
    if (!interactive) return { style: { height } };
    const top = headTop + r * headRowHeight;
    return pinnedCol === undefined
      ? { className: pivotStickyHeadClass, style: { top, height } }
      : { className: pivotPinnedHeadClass, style: { top, left: geometry.dimensionOffsets[pinnedCol], height } };
  };

  const bodyRows = (row: PivotBodyRow, rowIndex: number, windowStart = 0, windowEnd = model.rows.length): ReactNode => {
    const filler = fillers.get(rowIndex);
    const tr = (
      <tr
        key={row.id}
        data-kind={row.kind}
        data-depth={row.depth}
        style={{ height: rowHeight }}
        aria-rowindex={virtual ? model.headerRows.length + rowIndex + 1 : undefined}
      >
        {dimensionCells(row, rowIndex, windowStart, windowEnd)}
        {valueCells(row, rowIndex)}
      </tr>
    );
    if (filler === undefined) return tr;
    return [
      tr,
      <tr key={`${row.id}:filler`} data-nqg-filler="" aria-hidden style={{ height: filler }}>
        {Array.from({ length: geometry.dimensionColumns - 1 }, (_, i) => (
          <td key={`d${i + 1}`} className={cx(pivotLeafCellClass, i + 1 === lastDim && pivotPinnedEdgeClass)} />
        ))}
        {model.columns.map((c) => (
          <td key={c.id} className={pivotLeafCellClass} />
        ))}
      </tr>,
    ];
  };

  const columnFields = pivotModelColumnDimensions(model);
  const filteredFields = new Set(model.filters?.map((f) => f.field) ?? []);
  const columnHeader = (h: PivotHeaderCell, r: number): ReactNode => {
    const path = h.columnPath;
    const toggle =
      interactive && onToggleColumnGroup && h.expanded !== undefined && path ? (
        <button
          type="button"
          className={pivotToggleClass}
          aria-expanded={h.expanded}
          aria-label={`${h.expanded ? "Collapse" : "Expand"} ${h.label}`}
          onClick={() => onToggleColumnGroup(path)}
          data-nqg-column-toggle=""
        >
          <Chevron expanded={h.expanded} />
        </button>
      ) : null;
    if (renderColumnHeader) {
      const role = pivotColumnHeaderRole(model, r, h);
      const dimension = role.level === null ? null : (columnFields[role.level] ?? null);
      return renderColumnHeader({
        ...role,
        model,
        mode,
        cell: h,
        row: r,
        dimension,
        filtered: dimension !== null && filteredFields.has(dimension.field),
        label: h.label,
        toggle,
      });
    }
    if (!toggle) return h.label;
    return (
      <span className={pivotHeadLabelClass} style={HEAD_LABEL_STYLE}>
        {toggle}
        <span className={pivotLabelTextClass}>{h.label}</span>
      </span>
    );
  };

  const dimensionHeaders = compact ? [model.rowDimensions.map((d) => d.label).join(" / ")] : model.rowDimensions.map((d) => d.label);
  const statuses = model.rowDimensions.map((_, level) => pivotDimensionStatus(model, level));
  /** Header content + `aria-sort`; plain text when nothing is active (keeps markup minimal). */
  const dimensionHeader = (label: string, col: number): { content: ReactNode; ariaSort?: "ascending" | "descending" } => {
    const levels = compact ? statuses.map((_, i) => i) : [col];
    const indicators = levels.map((level) => <PivotHeaderIndicator key={level} status={statuses[level]!} />);
    const active = levels.some((level) => statuses[level]!.sort !== null || statuses[level]!.filtered);
    const ariaSort = compact ? undefined : pivotAriaSort(statuses[col]!);
    if (renderDimensionHeader) {
      const level = levels[0]!;
      const content = renderDimensionHeader({
        model,
        mode,
        level,
        dimension: model.rowDimensions[level]!,
        status: statuses[level]!,
        label,
        indicator: active ? indicators : null,
      });
      return { content, ariaSort };
    }
    if (!active) return { content: label, ariaSort };
    return {
      content: (
        <span className={pivotHeadLabelClass} style={HEAD_LABEL_STYLE}>
          <span className={pivotLabelTextClass}>{label}</span>
          {indicators}
        </span>
      ),
      ariaSort,
    };
  };

  /**
   * Virtualized: widen the rendered rows so that a span cell clipped at the first or last rendered
   * row still has room for its content (a KPI panel, else at least two rows); otherwise the content
   * would stretch the rows next to it and shift the view.
   */
  const keepSpanPanelsWhole = (start: number, end: number): { start: number; end: number } => {
    if (!slots) return { start, end };
    // A KPI panel's height; other span content (label, delta) is a little taller than one row.
    const need = (owner: number): number => {
      const row = model.rows[owner]!;
      return showsKpiPanel(row) ? pivotKpiPanelHeight(row.kpis!, { headlineId: kpiHeadlineId, caption: pivotRowCaption(row, kpiCaptionAttribute) !== null }) : 2 * rowHeight;
    };
    // First rendered row inside a span: rows start…last must be tall enough.
    for (let pass = 0; pass < geometry.dimensionColumns && start > 0; pass++) {
      let moved = false;
      for (const slot of slots[start] ?? []) {
        if (slot.type !== "covered") continue;
        const owner = spanOwner(slot.level, start);
        const ownerSlot = slots[owner]![slot.level];
        if (ownerSlot?.type !== "span") continue;
        const height = need(owner);
        const last = Math.min(owner + ownerSlot.rowSpan - 1, end - 1);
        const next = Math.max(owner, Math.min(start, last + 1 - Math.ceil(height / rowHeight)));
        if (next < start) {
          start = next;
          moved = true;
          break;
        }
      }
      if (!moved) break;
    }
    // Spans starting in the window: render enough of their rows (or all of them).
    let wanted = end;
    for (let r = start; r < Math.min(wanted, model.rows.length); r++) {
      for (const slot of slots[r] ?? []) {
        if (slot.type !== "span" || slot.rowSpan <= 1) continue;
        wanted = Math.max(wanted, Math.min(r + slot.rowSpan, r + Math.ceil(need(r) / rowHeight)));
      }
    }
    return { start, end: Math.min(model.rows.length, wanted) };
  };

  return (
    <table
      className={cx(pivotTableClass, className)}
      style={{ width: geometry.width, minWidth: geometry.width, ...style }}
      aria-label={ariaLabel ?? model.title}
      aria-rowcount={virtual ? model.headerRows.length + model.rows.length : undefined}
      data-nqg-pivot=""
      data-nqg-mode={mode}
    >
      <PivotColGroup geometry={geometry} columns={model.columns.length} />
      <thead>
        {showBand ? (
          <PivotHeaderChartBand
            model={model}
            mode={mode}
            geometry={geometry}
            chartHeight={chartHeight}
            height={bandHeight}
            summary={headerSummary}
          />
        ) : null}
        {model.headerRows.map((cells, r) => (
          <tr key={`h${r}`}>
            {r === 0
              ? dimensionHeaders.map((label, col) => {
                  const pos = headCellPos(0, col);
                  const head = dimensionHeader(label, col);
                  return (
                    <th
                      key={`dh${col}`}
                      scope="col"
                      rowSpan={model.headerRows.length}
                      className={cx(pivotHeadCellClass, col === lastDim && pivotPinnedEdgeClass, pos.className)}
                      style={pos.style}
                      aria-sort={head.ariaSort}
                    >
                      {head.content}
                    </th>
                  );
                })
              : null}
            {cells.map((h, i) => {
              const pos = headCellPos(r);
              // Σ Values outermost / column groups: the cell spans several columns; left-align so the
              // label stays in view.
              const left = h.colSpan > 1 && (h.measureId !== undefined || h.columnPath !== undefined);
              // Subtotal labels ("FY26 Total") span several header rows: let them wrap there.
              const style = left || h.rowSpan ? { ...pos.style, ...(left ? { textAlign: "left" as const } : {}), ...(h.rowSpan ? { whiteSpace: "normal" as const } : {}) } : pos.style;
              return (
                <th
                  key={`v${r}:${i}`}
                  scope="col"
                  colSpan={h.colSpan}
                  rowSpan={h.rowSpan}
                  className={cx(pivotHeadValueCellClass, pos.className)}
                  style={style}
                  data-nqg-subtotal={h.subtotal ? "" : undefined}
                  data-nqg-column-level={h.columnLevel}
                >
                  {columnHeader(h, r)}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      {virtual ? (
        <PivotVirtualBody
          resetKey={model}
          rowCount={model.rows.length}
          rowHeight={rowHeight}
          fillers={fillers}
          overscan={overscan}
          columnCount={geometry.dimensionColumns + model.columns.length}
          adjustWindow={keepSpanPanelsWhole}
          renderRows={(start, end) => {
            const out: ReactNode[] = [];
            for (let i = start; i < end; i++) out.push(bodyRows(model.rows[i]!, i, start, end));
            return out;
          }}
        />
      ) : interactive ? (
        <tbody>{model.rows.map((row, rowIndex) => bodyRows(row, rowIndex))}</tbody>
      ) : (
        // Static: one <tbody> per top-level group, so print CSS can keep each group on one page.
        pivotBodyGroups(model).map((g) => (
          <tbody key={g.id} data-nqg-group={g.kind}>
            {model.rows.slice(g.start, g.end).map((row, i) => bodyRows(row, g.start + i))}
          </tbody>
        ))
      )}
    </table>
  );
});

function PivotColGroup({ geometry, columns }: { geometry: PivotTableGeometry; columns: number }) {
  return (
    <colgroup>
      {geometry.dimensionWidths.map((w, i) => (
        <col key={`d${i}`} style={{ width: w }} />
      ))}
      {Array.from({ length: columns }, (_, i) => (
        <col key={`v${i}`} style={{ width: geometry.valueWidth }} />
      ))}
    </colgroup>
  );
}


const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Nearest ancestor that scrolls vertically (`null`: the window). An `overflow-x: auto` wrapper also
 * computes `overflow-y: auto`, so the element must be shorter than its content to count.
 */
function scrollParentOf(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p !== null && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const overflowY = getComputedStyle(p).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") && p.scrollHeight > p.clientHeight + 1) return p;
  }
  return null;
}

const SPACER_CELL_STYLE: CSSProperties = { padding: 0, border: 0 };

interface PivotVirtualBodyProps {
  /** Row heights are estimated again when this changes (a new model). */
  readonly resetKey: unknown;
  readonly rowCount: number;
  readonly rowHeight: number;
  /** Row index → filler row height under it. */
  readonly fillers: ReadonlyMap<number, number>;
  readonly overscan: number;
  readonly columnCount: number;
  readonly adjustWindow: (start: number, end: number) => { readonly start: number; readonly end: number };
  readonly renderRows: (start: number, end: number) => ReactNode[];
}

/** Row heights (row + its filler row), `rowHeight` until measured, with lazily rebuilt running tops. */
interface RowHeights {
  readonly heights: Float64Array;
  tops: Float64Array | null;
}

function rowHeightsFor(rowCount: number, rowHeight: number, fillers: ReadonlyMap<number, number>): RowHeights {
  const heights = new Float64Array(rowCount).fill(rowHeight);
  for (const [row, height] of fillers) if (row < rowCount) heights[row]! += height;
  return { heights, tops: null };
}

function rowTops(r: RowHeights): Float64Array {
  if (!r.tops) {
    const tops = new Float64Array(r.heights.length + 1);
    for (let i = 0; i < r.heights.length; i++) tops[i + 1] = tops[i]! + r.heights[i]!;
    r.tops = tops;
  }
  return r.tops;
}

/**
 * The windowed `<tbody>` of a virtualized `PivotTable`: a top spacer, rows `start…end`, a bottom
 * spacer. Scroll and resize events are coalesced to one window computation per animation frame and
 * re-render only when the (chunk-aligned) window changes. Rendered rows are measured, so spacers
 * stay exact for rows taller than `rowHeight`.
 */
function PivotVirtualBody({ resetKey, rowCount, rowHeight, fillers, overscan, columnCount, adjustWindow, renderRows }: PivotVirtualBodyProps) {
  const ref = useRef<HTMLTableSectionElement>(null);
  const [heights, setHeights] = useState(() => ({ key: [resetKey, rowCount, rowHeight] as const, r: rowHeightsFor(rowCount, rowHeight, fillers) }));
  // New model / geometry: start from estimates again (render-time reset, no extra commit).
  let current = heights;
  if (heights.key[0] !== resetKey || heights.key[1] !== rowCount || heights.key[2] !== rowHeight) {
    current = { key: [resetKey, rowCount, rowHeight] as const, r: rowHeightsFor(rowCount, rowHeight, fillers) };
    setHeights(current);
  }
  const [measured, setMeasured] = useState(0);
  const [range, setRange] = useState(() => {
    const viewport = typeof window === "undefined" ? 1000 : window.innerHeight;
    return adjustWindow(0, Math.min(rowCount, Math.ceil(viewport / rowHeight) + 2 * overscan));
  });
  const tops = rowTops(current.r);
  const start = Math.min(range.start, rowCount);
  const end = Math.min(Math.max(range.end, start), rowCount);

  const latest = useRef({ rowCount, overscan, tops, adjustWindow, range: { start, end } });
  latest.current = { rowCount, overscan, tops, adjustWindow, range: { start, end } };

  useIsomorphicLayoutEffect(() => {
    const body = ref.current;
    if (!body) return;
    const scroller = scrollParentOf(body);
    let frame = 0;
    const update = () => {
      frame = 0;
      const { rowCount: n, overscan: over, tops: t, adjustWindow: adjust, range: shown } = latest.current;
      const viewTop = scroller ? scroller.getBoundingClientRect().top : 0;
      const viewHeight = scroller ? scroller.clientHeight : window.innerHeight;
      const next = pivotVirtualRowWindow(n, (i) => t[i]!, viewTop - body.getBoundingClientRect().top, viewHeight, over);
      const w = adjust(next.start, next.end);
      if (w.start !== shown.start || w.end !== shown.end) setRange(w);
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };
    update();
    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver === "undefined" || !scroller ? null : new ResizeObserver(schedule);
    observer?.observe(scroller!);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      target.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [current, measured, overscan]);

  // Measure the rendered rows (with their filler rows); re-render once when an estimate was off.
  useIsomorphicLayoutEffect(() => {
    const body = ref.current;
    if (!body || end <= start) return;
    const h = current.r.heights;
    let row = start - 1;
    let changed = false;
    const blocks = new Float64Array(end - start);
    for (let k = 0; k < body.rows.length; k++) {
      const tr = body.rows[k]!;
      if (tr.dataset.kind !== undefined) row++;
      else if (tr.dataset.nqgFiller === undefined || row < start) continue;
      if (row >= end) break;
      blocks[row - start]! += tr.getBoundingClientRect().height;
    }
    for (let i = start; i < end; i++) {
      const b = blocks[i - start]!;
      if (b > 0 && Math.abs(b - h[i]!) > 0.25) {
        h[i] = b;
        changed = true;
      }
    }
    if (changed) {
      current.r.tops = null;
      setMeasured((m) => m + 1);
    }
  });

  const before = tops[start]!;
  const after = tops[rowCount]! - tops[end]!;
  return (
    <tbody ref={ref} data-nqg-virtual="">
      {before > 0 ? (
        <tr aria-hidden data-nqg-spacer="" style={{ height: before, overflowAnchor: "none" }}>
          <td colSpan={columnCount} style={SPACER_CELL_STYLE} />
        </tr>
      ) : null}
      {renderRows(start, end)}
      {after > 0 ? (
        <tr aria-hidden data-nqg-spacer="" style={{ height: after, overflowAnchor: "none" }}>
          <td colSpan={columnCount} style={SPACER_CELL_STYLE} />
        </tr>
      ) : null}
    </tbody>
  );
}
