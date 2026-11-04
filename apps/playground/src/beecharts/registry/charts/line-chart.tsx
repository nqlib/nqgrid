"use client";

import { type ChartConfig } from "@/registry/ui/chart";
import { createCartesianChart } from "@/registry/echarts-core/create-cartesian-chart";
import { compileLineOption } from "@/registry/echarts-core/compile-line";
import { usePartId, useRegisterPart } from "@/registry/echarts-core/part-registry";
import { ChartBackground } from "@/registry/ui/background";
import {
  BeeChartLegend,
  bindChartLegendLayer,
  type ChartLegendVariant,
} from "@/registry/ui/legend";
import { ChartTooltip, type TooltipRoundness, type TooltipVariant } from "@/registry/ui/tooltip";
import { useState } from "react";

type BeeLineChartProps<
  TData extends Record<string, unknown>,
  TConfig extends Record<string, ChartConfig[string]>,
> = {
  config: TConfig;
  data: TData[];
  children: React.ReactNode;
  className?: string;
  xDataKey?: keyof TData & string;
  isLoading?: boolean;
  showBrush?: boolean;
  brushFormatLabel?: (value: unknown, index: number) => string;
};

const { Chart: LineChartInner } = createCartesianChart<
  Record<string, unknown>,
  Record<string, ChartConfig[string]>,
  BeeLineChartProps<Record<string, unknown>, Record<string, ChartConfig[string]>>
>({
  displayName: "BeeLineChart",
  compile: compileLineOption,
  loadingVariant: "line",
  defaultLoadingPoints: 12,
  getRootFields: (_props, xKey) => ({
    xDataKey: xKey,
    cartesian: { externalBrush: true },
  }),
  getCompileRoot: ({ data, xDataKey, externalBrush }) => ({
    data,
    xDataKey,
    cartesian: { externalBrush },
  }),
  mapCanvasProps: (_props, { chartData, xKey, externalBrush, onPlotRect }) => ({
    data: chartData,
    xDataKey: xKey,
    externalBrush,
    onPlotRect,
  }),
});

export function BeeLineChart<
  TData extends Record<string, unknown>,
  TConfig extends Record<string, ChartConfig[string]>,
>(props: BeeLineChartProps<TData, TConfig>) {
  return <LineChartInner {...props} />;
}

export { ChartBackground as Background };

export function Grid() {
  const id = usePartId();
  useRegisterPart({ type: "grid", id });
  return null;
}

export function XAxis({
  dataKey,
  tickFormatter,
}: {
  dataKey?: string;
  tickFormatter?: (value: unknown) => string;
}) {
  const id = usePartId();
  useRegisterPart({ type: "xAxis", id, dataKey, tickFormatter });
  return null;
}

export function YAxis() {
  const id = usePartId();
  useRegisterPart({ type: "yAxis", id });
  return null;
}

export function Line({
  dataKey,
  curveType = "linear",
}: {
  dataKey: string;
  curveType?: "linear" | "monotone" | "step";
  lineProps?: Record<string, unknown>;
}) {
  const id = usePartId();
  useRegisterPart({ type: "line", id, dataKey, curveType });
  return null;
}

export function Tooltip({
  variant,
  roundness,
  hideLabel,
  hideIndicator,
  hide,
}: {
  variant?: TooltipVariant;
  roundness?: TooltipRoundness;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  hide?: boolean;
}) {
  return (
    <ChartTooltip
      variant={variant}
      roundness={roundness}
      hideLabel={hideLabel}
      hideIndicator={hideIndicator}
      hide={hide}
    />
  );
}

export function Legend({
  variant = "rounded-square",
  align = "right",
  isClickable = false,
  hideIcon,
  className,
}: {
  variant?: ChartLegendVariant;
  align?: "left" | "center" | "right";
  isClickable?: boolean;
  hideIcon?: boolean;
  className?: string;
}) {
  const id = usePartId();
  useRegisterPart({ type: "legend", id, variant, align, isClickable });
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <BeeChartLegend
      variant={variant}
      align={align}
      hideIcon={hideIcon}
      isClickable={isClickable}
      className={className}
      selected={selected}
      onSelectChange={setSelected}
    />
  );
}

bindChartLegendLayer(Legend);
