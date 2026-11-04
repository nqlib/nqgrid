import type { ChartConfig } from "@/registry/ui/chart";
import { getColorsCount } from "@/registry/ui/chart";
import type { TooltipPart } from "./parts/types";
import type { EChartsOption } from "echarts";

type TooltipAxisParams = {
  seriesName?: string;
  seriesId?: string;
  name?: string;
  value?: unknown;
};

const ROUNDNESS_CLASS = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
} as const;

const VARIANT_CLASS = {
  default: "bg-background",
  "frosted-glass": "bg-background/70 backdrop-blur-sm",
} as const;

function escapeHtml(value: unknown) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function indicatorStyle(dataKey: string, colorsCount: number) {
  if (colorsCount <= 1) {
    return `background:var(--color-${dataKey}-0)`;
  }
  const stops = Array.from({ length: colorsCount }, (_, i) => {
    const offset = (i / (colorsCount - 1)) * 100;
    return `var(--color-${dataKey}-${i}) ${offset}%`;
  }).join(", ");
  return `background:linear-gradient(to right,${stops})`;
}

function configKeyFromDisplayName(name: string, config: ChartConfig): string {
  if (name in config) return name;
  for (const [key, entry] of Object.entries(config)) {
    if (entry.label?.toString() === name) return key;
  }
  return name;
}

function formatValue(value: unknown): string {
  if (typeof value === "number") return value.toLocaleString();
  if (Array.isArray(value) && typeof value[0] === "number") {
    return value[0].toLocaleString();
  }
  return escapeHtml(value);
}

function tooltipShell(
  inner: string,
  tooltip: TooltipPart | undefined,
  chartId: string,
) {
  const variant = tooltip?.variant ?? "default";
  const roundness = tooltip?.roundness ?? "lg";
  return `<div class="bee-echarts-tooltip text-foreground border-border/50 grid min-w-32 gap-1.5 border px-2.5 py-1.5 text-xs shadow-xl ${ROUNDNESS_CLASS[roundness]} ${VARIANT_CLASS[variant]}" data-chart="${chartId}">
    ${inner}
  </div>`;
}

function formatItemTooltipHtml(
  params: TooltipAxisParams | TooltipAxisParams[],
  config: ChartConfig,
  tooltip: TooltipPart | undefined,
  chartId: string,
) {
  const item = (Array.isArray(params) ? params[0] : params) as TooltipAxisParams | undefined;
  if (!item) return "";

  const displayName = String(item.name ?? item.seriesName ?? "");
  const key = configKeyFromDisplayName(displayName, config);
  const entry = config[key];
  const labelText = escapeHtml(entry?.label ?? displayName);
  const hideLabel = tooltip?.hideLabel ?? false;
  const hideIndicator = tooltip?.hideIndicator ?? false;
  const colorsCount = entry ? getColorsCount(entry) : 1;
  const dot = hideIndicator
    ? ""
    : `<span class="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px] mr-2" style="${indicatorStyle(key, colorsCount)}"></span>`;

  const row = `<div class="flex w-full items-center justify-between gap-4 leading-none">
    <span class="text-muted-foreground flex items-center">${dot}${labelText}</span>
    <span class="font-mono font-medium tabular-nums">${formatValue(item.value)}</span>
  </div>`;

  const labelRow =
    !hideLabel && displayName && entry?.label?.toString() !== displayName
      ? `<div class="font-medium mb-1">${escapeHtml(displayName)}</div>`
      : "";

  return tooltipShell(`${labelRow}<div class="grid gap-1.5">${row}</div>`, tooltip, chartId);
}

function inferTooltipTrigger(option: EChartsOption): "axis" | "item" {
  const series = Array.isArray(option.series)
    ? option.series
    : option.series
      ? [option.series]
      : [];
  const types = series.map((s) => (s as { type?: string })?.type);
  if (types.some((t) => t === "pie" || t === "gauge" || t === "funnel" || t === "sankey")) {
    return "item";
  }
  if (option.polar && types.some((t) => t === "bar")) {
    return "item";
  }
  return "axis";
}

function sharedTooltipOptions() {
  return {
    confine: true,
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent" as const,
    extraCssText: "box-shadow:none;",
  };
}

function formatAxisTooltipHtml(
  params: TooltipAxisParams | TooltipAxisParams[],
  config: ChartConfig,
  tooltip: TooltipPart | undefined,
  chartId: string,
) {
  const items = (Array.isArray(params) ? params : [params]).filter(
    (p) => p.seriesName != null,
  );
  if (!items.length) return "";

  const variant = tooltip?.variant ?? "default";
  const roundness = tooltip?.roundness ?? "lg";
  const hideLabel = tooltip?.hideLabel ?? false;
  const hideIndicator = tooltip?.hideIndicator ?? false;

  const label = !hideLabel ? escapeHtml(items[0]?.name ?? "") : "";
  const labelRow = label
    ? `<div class="font-medium mb-1">${label}</div>`
    : "";

  const rows = items
    .map((item) => {
      const key = configKeyFromDisplayName(String(item.seriesName ?? item.seriesId ?? ""), config);
      const entry = config[key];
      const labelText = escapeHtml(entry?.label ?? key);
      const value = formatValue(item.value);
      const colorsCount = entry ? getColorsCount(entry) : 1;
      const dot = hideIndicator
        ? ""
        : `<span class="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px] mr-2" style="${indicatorStyle(key, colorsCount)}"></span>`;

      return `<div class="flex w-full items-center justify-between gap-4 leading-none">
        <span class="text-muted-foreground flex items-center">${dot}${labelText}</span>
        <span class="font-mono font-medium tabular-nums">${value}</span>
      </div>`;
    })
    .join("");

  return tooltipShell(`${labelRow}<div class="grid gap-1.5">${rows}</div>`, tooltip, chartId);
}

export function applyTooltipToOption(
  option: EChartsOption,
  config: ChartConfig,
  chartId: string,
  tooltipPart: TooltipPart | undefined,
): EChartsOption {
  if (tooltipPart?.hide) {
    return { ...option, tooltip: { show: false } };
  }

  if (!tooltipPart) {
    return option;
  }

  const trigger = inferTooltipTrigger(option);
  const formatter =
    trigger === "item"
      ? (params: TooltipAxisParams | TooltipAxisParams[]) =>
          formatItemTooltipHtml(params, config, tooltipPart, chartId)
      : (params: TooltipAxisParams | TooltipAxisParams[]) =>
          formatAxisTooltipHtml(params, config, tooltipPart, chartId);

  return {
    ...option,
    tooltip: {
      trigger,
      ...sharedTooltipOptions(),
      formatter,
    },
  };
}

export function hideBuiltInLegend(option: EChartsOption): EChartsOption {
  if (!option.legend) {
    return { ...option, legend: { show: false } };
  }
  if (Array.isArray(option.legend)) {
    return {
      ...option,
      legend: option.legend.map((l) => ({ ...l, show: false })),
    };
  }
  return { ...option, legend: { ...option.legend, show: false } };
}
