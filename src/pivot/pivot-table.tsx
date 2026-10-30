import type { CSSProperties, ReactNode } from "react";

import type { PivotBodyRow, PivotModel } from "../core/pivot/types";
import {
  pivotCountClass,
  pivotGrandTotalCellClass,
  pivotGrandTotalLabelClass,
  pivotGroupCellClass,
  pivotGroupLabelClass,
  pivotGroupValueClass,
  pivotHeadCellClass,
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
import { PivotKpiDelta, PivotKpiPanel } from "./pivot-kpi-panel";
import { pivotDimensionSlots, pivotRowCaption, pivotTableGeometry, type PivotTableGeometry } from "./layout";

export interface PivotSpanCellContext {
  readonly model: PivotModel;
  readonly mode: PivotRenderMode;
  readonly level: number;
  readonly rowSpan: number;
  /** Toggle control for this group (`null` in static mode or without `onToggleGroup`). */
  readonly toggle: ReactNode;
}

export interface PivotTableProps {
  readonly model: PivotModel;
  /** `interactive` (default): toggles + CSS sticky pinning. `static`: plain markup for HTML/PDF. */
  readonly mode?: PivotRenderMode;
  /** Called with a group's key path (e.g. `usePivotGrid().toggleGroup`). Toggles render only when set. */
  readonly onToggleGroup?: (path: readonly string[]) => void;
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
  /** Replace the outer span cell content (the KPI side-panel slot). */
  readonly renderSpanCell?: (row: PivotBodyRow, context: PivotSpanCellContext) => ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly "aria-label"?: string;
}

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
 * Wrap it in a scroll container for interactive use.
 */
export function PivotTable({
  model,
  mode = "interactive",
  onToggleGroup,
  dimensionWidths,
  valueWidth,
  rowHeight = 36,
  headRowHeight = 36,
  headerChart,
  chartHeight = 44,
  headerSummary,
  kpiHeadlineId,
  kpiCaptionAttribute,
  renderSpanCell,
  className,
  style,
  "aria-label": ariaLabel,
}: PivotTableProps) {
  const interactive = mode === "interactive";
  const geometry = pivotTableGeometry(model, { dimensionWidths, valueWidth });
  const showBand = (headerChart ?? true) && model.headerSeries !== null;
  const bandHeight = chartHeight + 32;
  const headTop = showBand ? bandHeight : 0;
  const headerHeight = headTop + model.headerRows.length * headRowHeight;
  const heatLevels = model.heat?.levels ?? 9;
  const lastDim = geometry.dimensionColumns - 1;
  const compact = model.layout === "compact";
  const slots = compact ? null : pivotDimensionSlots(model);

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
    if (row.kpis?.length && row.expanded) {
      return (
        <PivotKpiPanel
          kpis={row.kpis}
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
    row.kind === "grandTotal" ? pivotGrandTotalCellClass : row.kind === "group" ? pivotGroupCellClass : pivotLeafCellClass;

  const dimensionCells = (row: PivotBodyRow, rowIndex: number): ReactNode[] => {
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
          {row.kind === "group" ? groupLabel(row, row.depth * 16) : <span style={{ paddingLeft: row.depth * 16 }}>{row.label}</span>}
        </th>,
      ];
    }
    return slots![rowIndex]!.flatMap((slot) => {
      if (slot.type === "covered" || slot.type === "grandTotal") return [];
      const p = pinned(slot.level);
      if (slot.type === "span") {
        // Interactive: the panel sticks under the header while its rows scroll past.
        const inner: CSSProperties | undefined = interactive && slot.rowSpan > 1 ? { position: "sticky", top: headerHeight + 8 } : undefined;
        return [
          <th
            key={`d${slot.level}`}
            scope="rowgroup"
            rowSpan={slot.rowSpan}
            className={cx(pivotSpanCellClass, pivotRowHeaderClass, edge(slot.level), p.className)}
            style={p.style}
            data-nqg-span={slot.rowSpan}
          >
            <div style={inner}>{spanContent(row, slot.level, slot.rowSpan)}</div>
          </th>,
        ];
      }
      const content = slot.type === "group" ? groupLabel(row) : slot.type === "leaf" ? <span className={pivotLabelTextClass}>{row.label}</span> : null;
      return [
        <td key={`d${slot.level}`} className={cx(base, edge(slot.level), p.className)} style={p.style}>
          {content}
        </td>,
      ];
    });
  };

  const valueCells = (row: PivotBodyRow): ReactNode[] =>
    row.cells.map((cell, i) => {
      const heat = pivotHeatCellProps(cell, heatLevels);
      return (
        <td
          key={model.columns[i]!.id}
          className={cx(rowCellClass(row), pivotValueClass, row.kind === "group" && pivotGroupValueClass, heat.className)}
          style={heat.style}
          data-heat={heat["data-heat"]}
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

  const dimensionHeaders = compact ? [model.rowDimensions.map((d) => d.label).join(" / ")] : model.rowDimensions.map((d) => d.label);

  return (
    <table
      className={cx(pivotTableClass, className)}
      style={{ width: geometry.width, minWidth: geometry.width, ...style }}
      aria-label={ariaLabel ?? model.title}
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
                  return (
                    <th
                      key={`dh${col}`}
                      scope="col"
                      rowSpan={model.headerRows.length}
                      className={cx(pivotHeadCellClass, col === lastDim && pivotPinnedEdgeClass, pos.className)}
                      style={pos.style}
                    >
                      {label}
                    </th>
                  );
                })
              : null}
            {cells.map((h, i) => {
              const pos = headCellPos(r);
              return (
                <th key={`v${r}:${i}`} scope="col" colSpan={h.colSpan} className={cx(pivotHeadValueCellClass, pos.className)} style={pos.style}>
                  {h.label}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {model.rows.map((row, rowIndex) => (
          <tr key={row.id} data-kind={row.kind} data-depth={row.depth} style={{ height: rowHeight }}>
            {dimensionCells(row, rowIndex)}
            {valueCells(row)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

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

