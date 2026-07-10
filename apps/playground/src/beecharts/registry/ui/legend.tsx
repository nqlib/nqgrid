"use client";

import { cn } from "@/lib/utils";
import { getColorsCount, useChart } from "@/registry/ui/chart";
import { usePartsSnapshot } from "@/registry/echarts-core/part-registry";
import type { ChartPart } from "@/registry/echarts-core/parts/types";
import type { CSSProperties } from "react";

export type ChartLegendVariant =
  | "square"
  | "circle"
  | "circle-outline"
  | "rounded-square"
  | "rounded-square-outline"
  | "vertical-bar"
  | "horizontal-bar";

export const BEE_CHART_LEGEND_MARKER = Symbol.for("beecharts.ChartLegend");

/** Chart `<Legend />` must use this so `ChartPlotShell` renders it below the canvas. */
export const CHART_LEGEND_LAYER_NAME = "BeeChartLegend";

export function bindChartLegendLayer<T extends (...args: never[]) => unknown>(component: T): T {
  Object.assign(component, { displayName: CHART_LEGEND_LAYER_NAME });
  return component;
}

type ChartLegendContentProps = {
  className?: string;
  hideIcon?: boolean;
  selected?: string | null;
  isClickable?: boolean;
  onSelectChange?: (selected: string | null) => void;
  variant?: ChartLegendVariant;
  align?: "left" | "center" | "right";
  seriesKeys: string[];
};

function getLegendFillStyle(dataKey: string, colorsCount: number): CSSProperties {
  if (colorsCount <= 1) {
    return { backgroundColor: `var(--color-${dataKey}-0)` };
  }
  const stops = Array.from({ length: colorsCount }, (_, i) => {
    const offset = (i / (colorsCount - 1)) * 100;
    return `var(--color-${dataKey}-${i}) ${offset}%`;
  }).join(", ");
  return { background: `linear-gradient(to right, ${stops})` };
}

function getLegendOutlineStyle(dataKey: string, colorsCount: number): CSSProperties {
  const maskStyle: CSSProperties = {
    WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
    WebkitMaskComposite: "xor",
    mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
    maskComposite: "exclude",
  };
  if (colorsCount <= 1) {
    return { backgroundColor: `var(--color-${dataKey}-0)`, ...maskStyle };
  }
  const stops = Array.from({ length: colorsCount }, (_, i) => {
    const offset = (i / (colorsCount - 1)) * 100;
    return `var(--color-${dataKey}-${i}) ${offset}%`;
  }).join(", ");
  return { background: `linear-gradient(to right, ${stops})`, ...maskStyle };
}

function LegendIndicator({
  variant,
  dataKey,
  colorsCount,
}: {
  variant: ChartLegendVariant;
  dataKey: string;
  colorsCount: number;
}) {
  const fillStyle = getLegendFillStyle(dataKey, colorsCount);
  const outlineStyle = getLegendOutlineStyle(dataKey, colorsCount);

  switch (variant) {
    case "square":
      return <div className="h-2.5 w-2.5 shrink-0" style={fillStyle} />;
    case "circle":
      return <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={fillStyle} />;
    case "circle-outline":
      return (
        <div className="h-3 w-3 shrink-0 rounded-full p-[2px]" style={outlineStyle} />
      );
    case "vertical-bar":
      return <div className="h-4 w-1.5 shrink-0 rounded-[2px]" style={fillStyle} />;
    case "horizontal-bar":
      return <div className="h-1.5 w-4 shrink-0 rounded-[2px]" style={fillStyle} />;
    case "rounded-square-outline":
      return (
        <div className="h-3 w-3 shrink-0 rounded-[3px] p-[2px]" style={outlineStyle} />
      );
    case "rounded-square":
    default:
      return <div className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={fillStyle} />;
  }
}

export function ChartLegendContent({
  className,
  hideIcon = false,
  selected = null,
  isClickable = false,
  onSelectChange,
  variant = "rounded-square",
  align = "right",
  seriesKeys,
}: ChartLegendContentProps) {
  const { config } = useChart();

  if (!seriesKeys.length) return null;

  return (
    <div
      className={cn(
        "text-foreground flex items-center gap-4 pt-3 select-none",
        align === "left" && "justify-start",
        align === "center" && "justify-center",
        align === "right" && "justify-end",
        className,
      )}
    >
      {seriesKeys.map((key) => {
        const itemConfig = config[key];
        if (!itemConfig) return null;
        const colorsCount = getColorsCount(itemConfig);
        const isSelected = selected === null || selected === key;

        return (
          <div
            key={key}
            className={cn(
              "flex items-center gap-1.5 transition-opacity",
              !isSelected && "opacity-30",
              isClickable && "cursor-pointer",
            )}
            onClick={() => {
              if (!isClickable) return;
              onSelectChange?.(selected === key ? null : key);
            }}
          >
            {!hideIcon && itemConfig.icon ? (
              <itemConfig.icon />
            ) : (
              !hideIcon && (
                <LegendIndicator variant={variant} dataKey={key} colorsCount={colorsCount} />
              )
            )}
            {itemConfig.label ?? key}
          </div>
        );
      })}
    </div>
  );
}

ChartLegendContent.displayName = "BeeChartLegendContent";

const LEGEND_SERIES_TYPES = new Set([
  "bar",
  "line",
  "area",
  "scatter",
  "radar",
  "radialBar",
]);

type SeriesPart = Extract<ChartPart, { dataKey: string }>;

function seriesKeysFromParts(parts: ChartPart[]) {
  return parts
    .filter(
      (p): p is SeriesPart =>
        LEGEND_SERIES_TYPES.has(p.type) &&
        // `showInLegend` only exists on bar/line; other series default to shown.
        (p as { showInLegend?: boolean }).showInLegend !== false,
    )
    .map((p) => p.dataKey);
}

/** HTML legend rendered below the chart; hides built-in ECharts legend. */
export function BeeChartLegend({
  variant = "rounded-square",
  align = "right",
  hideIcon,
  isClickable,
  className,
  selected = null,
  onSelectChange,
}: {
  variant?: ChartLegendVariant;
  align?: "left" | "center" | "right";
  hideIcon?: boolean;
  isClickable?: boolean;
  className?: string;
  selected?: string | null;
  onSelectChange?: (selected: string | null) => void;
}) {
  const parts = usePartsSnapshot();
  const { segmentKeys } = useChart();
  const fromParts = seriesKeysFromParts(parts);
  const seriesKeys = fromParts.length > 0 ? fromParts : (segmentKeys ?? []);

  return (
    <ChartLegendContent
      className={className}
      variant={variant}
      align={align}
      hideIcon={hideIcon}
      isClickable={isClickable}
      selected={selected}
      onSelectChange={onSelectChange}
      seriesKeys={seriesKeys}
    />
  );
}

BeeChartLegend.displayName = "BeeChartLegend";

export function ChartLegend() {
  return null;
}
