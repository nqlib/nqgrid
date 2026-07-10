"use client";

import { type ChartConfig, ChartContainer, getLoadingData } from "@/registry/ui/chart";
import { ChartPlotShell } from "@/registry/echarts-core/chart-plot-shell";
import { EChartsHost } from "@/registry/echarts-core/echarts-host";
import { PartRegistryProvider, usePartId, useRegisterPart } from "@/registry/echarts-core/part-registry";
import { compilePieOption } from "@/registry/echarts-core/compile-pie";
import { segmentKeysFromData } from "@/registry/echarts-core/segment-keys";
import { useCompiledOption } from "@/registry/echarts-core/use-compiled-option";
import {
  BeeChartLegend,
  bindChartLegendLayer,
  type ChartLegendVariant,
} from "@/registry/ui/legend";
import {
  ChartTooltip,
  type TooltipRoundness,
  type TooltipVariant,
} from "@/registry/ui/tooltip";
import { type ReactNode, useMemo, useState } from "react";

type BeePieChartProps<
  TData extends Record<string, unknown>,
  TConfig extends Record<string, ChartConfig[string]>,
> = {
  config: TConfig;
  data: TData[];
  children: ReactNode;
  className?: string;
  nameKey?: keyof TData & string;
  isLoading?: boolean;
};

function PieChartCanvas<TData extends Record<string, unknown>>({
  data,
  nameKey,
}: {
  data: TData[];
  nameKey?: string;
}) {
  const { option, colorEpoch } = useCompiledOption(compilePieOption, { data, nameKey });
  return <EChartsHost option={option} colorEpoch={colorEpoch} />;
}

export function BeePieChart<
  TData extends Record<string, unknown>,
  TConfig extends Record<string, ChartConfig[string]>,
>({ config, data, children, className, nameKey, isLoading }: BeePieChartProps<TData, TConfig>) {
  const resolvedNameKey = (nameKey ?? Object.keys(data[0] ?? {})[0] ?? "name") as string;
  const displayData = isLoading ? (getLoadingData(5) as unknown as TData[]) : data;
  const segmentKeys = useMemo(
    () => segmentKeysFromData(displayData, resolvedNameKey),
    [displayData, resolvedNameKey],
  );

  return (
    <PartRegistryProvider>
      <ChartContainer config={config} className={className} segmentKeys={segmentKeys} isLoading={isLoading}>
        <ChartPlotShell
          isLoading={isLoading}
          loadingVariant="pie"
          canvas={<PieChartCanvas data={displayData} nameKey={resolvedNameKey} />}
        >
          {children}
        </ChartPlotShell>
      </ChartContainer>
    </PartRegistryProvider>
  );
}

export function Pie({
  dataKey,
  nameKey,
  innerRadius,
  outerRadius,
  showLabels,
}: {
  dataKey?: string;
  nameKey?: string;
  innerRadius?: number | string;
  outerRadius?: number | string;
  showLabels?: boolean;
}) {
  const id = usePartId();
  useRegisterPart({ type: "pie", id, dataKey, nameKey, innerRadius, outerRadius, showLabels });
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
