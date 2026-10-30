import type { CSSProperties, ReactNode } from "react";

import type { PivotHeaderSeriesPoint, PivotModel } from "../core/pivot/types";
import {
  pivotBandCellClass,
  pivotBandSummaryCellClass,
  pivotBandValueClass,
  pivotLegendClass,
  pivotLegendSwatchClass,
  pivotPinnedHeadClass,
  pivotSeriesColorVar,
  pivotStickyHeadClass,
  pivotSummaryLabelClass,
  pivotSummaryNoteClass,
  pivotSummaryValueClass,
} from "../styles";
import { cx, type PivotRenderMode } from "./heat";
import { PivotKpiDelta } from "./pivot-kpi-panel";
import {
  pivotBarPath,
  pivotBarSegments,
  pivotHeaderLegend,
  pivotHeaderPointText,
  pivotHeaderSummary,
  pivotTableGeometry,
  type PivotTableGeometry,
} from "./layout";

export interface PivotHeaderBarProps {
  readonly model: PivotModel;
  readonly point: PivotHeaderSeriesPoint;
  /** SVG width / height in px. */
  readonly width: number;
  readonly height: number;
  /** Print the formatted value above the bar (default true). */
  readonly showValue?: boolean;
}

/** One header bar (stacked by top-level group when the series has a breakdown), as inline SVG. */
export function PivotHeaderBar({ model, point, width, height, showValue = true }: PivotHeaderBarProps) {
  const max = model.headerSeries?.max ?? null;
  const segments = pivotBarSegments(point, max, { width, height });
  const text = pivotHeaderPointText(model, point);
  return (
    <>
      {showValue ? <span className={pivotBandValueClass}>{text}</span> : null}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${point.label}: ${text}`}
        style={{ display: "block", overflow: "visible" }}
        data-nqg-bar={point.columnKey}
      >
        {segments.map((s) => (
          <path
            key={s.key}
            d={pivotBarPath(s, s.top ? 3 : 0)}
            fill={pivotSeriesColorVar(s.seriesIndex)}
            data-series={s.seriesIndex}
          >
            <title>{`${point.label} · ${s.label}: ${pivotHeaderPointText(model, { ...point, value: s.value })}`}</title>
          </path>
        ))}
      </svg>
    </>
  );
}

/** Default band summary: series total, grand headline KPI and the stack legend. */
export function PivotHeaderSummary({ model }: { readonly model: PivotModel }) {
  const summary = pivotHeaderSummary(model);
  if (!summary) return null;
  const legend = pivotHeaderLegend(model);
  return (
    <div data-nqg-summary="">
      <div className={pivotSummaryLabelClass}>{summary.label}</div>
      <div className={pivotSummaryValueClass}>
        {summary.totalText}
        {summary.headline ? (
          <>
            <PivotKpiDelta kpi={summary.headline} />
            <span className={pivotSummaryNoteClass}>{summary.headline.label}</span>
          </>
        ) : null}
      </div>
      {legend.length > 1 ? (
        <div className={pivotLegendClass}>
          {legend.map((l) => (
            <span key={l.key}>
              <span className={pivotLegendSwatchClass} style={{ backgroundColor: pivotSeriesColorVar(l.seriesIndex) }} aria-hidden />
              {l.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export interface PivotHeaderChartBandProps {
  readonly model: PivotModel;
  readonly mode?: PivotRenderMode;
  /** Column geometry (default: `pivotTableGeometry(model)`). */
  readonly geometry?: PivotTableGeometry;
  /** Bar area height in px (default 44). */
  readonly chartHeight?: number;
  /** Row height in px (default `chartHeight + 32`). */
  readonly height?: number;
  /** Top-left cell content (default `PivotHeaderSummary`); `null` leaves it empty. */
  readonly summary?: ReactNode;
  readonly className?: string;
}

/**
 * Header chart band as a `<thead>` row: a summary cell over the row-dimension columns, then one bar
 * per column key, so bars line up with their value columns in both interactive and static output.
 */
export function PivotHeaderChartBand({
  model,
  mode = "interactive",
  geometry = pivotTableGeometry(model),
  chartHeight = 44,
  height = chartHeight + 32,
  summary,
  className,
}: PivotHeaderChartBandProps) {
  const series = model.headerSeries;
  if (!series) return null;
  const pointByKey = new Map(series.points.map((p) => [p.columnKey, p] as const));
  const sticky = mode === "interactive";
  const rowStyle: CSSProperties = { height };
  const top = model.headerRows[0] ?? [];
  return (
    <tr className={className} style={rowStyle} data-nqg-band="">
      <th
        colSpan={geometry.dimensionColumns}
        className={cx(pivotBandSummaryCellClass, sticky && pivotPinnedHeadClass)}
        style={sticky ? { left: 0, top: 0 } : undefined}
        scope="colgroup"
      >
        {summary === undefined ? <PivotHeaderSummary model={model} /> : summary}
      </th>
      {top.map((h, i) => {
        const point = h.columnKey === null || h.columnKey === undefined ? undefined : pointByKey.get(h.columnKey);
        const width = geometry.valueWidth * h.colSpan;
        return (
          <th
            key={`${h.columnKey ?? "total"}:${i}`}
            colSpan={h.colSpan}
            className={cx(pivotBandCellClass, sticky && pivotStickyHeadClass)}
            style={sticky ? { top: 0 } : undefined}
          >
            {point ? <PivotHeaderBar model={model} point={point} width={width} height={chartHeight} /> : null}
          </th>
        );
      })}
    </tr>
  );
}
