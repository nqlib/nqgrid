"use client";

import { type ChartConfig, ChartContainer, getLoadingData } from "@/registry/ui/chart";
import { BeeChartBrush } from "@/registry/echarts-core/bee-chart-brush";
import type { ChartPlotInsets } from "@/registry/echarts-core/chart-grid";
import { ChartPlotShell } from "@/registry/echarts-core/chart-plot-shell";
import { EChartsHost } from "@/registry/echarts-core/echarts-host";
import { PartRegistryProvider } from "@/registry/echarts-core/part-registry";
import { useChartBrush } from "@/registry/echarts-core/use-chart-brush";
import { useCompiledOption, type CompileRootFields } from "@/registry/echarts-core/use-compiled-option";
import type { CompileContext } from "@/registry/echarts-core/parts/types";
import type { ChartLoadingVariant } from "@/registry/ui/chart-loading-skeleton";
import type { EChartsOption } from "echarts";
import { type ReactNode, useState } from "react";

export type CartesianChartBaseProps<
  TData extends Record<string, unknown>,
  TConfig extends Record<string, ChartConfig[string]>,
> = {
  config: TConfig;
  data: TData[];
  children: ReactNode;
  className?: string;
  xDataKey?: keyof TData & string;
  isLoading?: boolean;
  showBrush?: boolean;
  brushFormatLabel?: (value: unknown, index: number) => string;
};

export type CartesianPlotRectState = {
  plotAlign: ChartPlotInsets | null;
  onPlotRect: (insets: ChartPlotInsets) => void;
  canvasProps: Record<string, unknown>;
};

export type CartesianShellState<TData extends Record<string, unknown>> = {
  chartData: TData[];
  xKey: string | undefined;
  externalBrush: boolean;
  onPlotRect: (insets: ChartPlotInsets) => void;
  canvasProps: Record<string, unknown>;
};

type CreateCartesianChartConfig<
  TData extends Record<string, unknown>,
  TConfig extends Record<string, ChartConfig[string]>,
  TChartProps extends CartesianChartBaseProps<TData, TConfig>,
  TCanvasProps extends Record<string, unknown>,
> = {
  displayName: string;
  compile: (ctx: CompileContext<TData>) => EChartsOption;
  loadingVariant: ChartLoadingVariant;
  defaultLoadingPoints?: number;
  defaults?: Partial<TChartProps>;
  getRootFields: (
    props: TChartProps,
    xKey: string | undefined,
  ) => Omit<CompileRootFields<TData>, "data">;
  mapCanvasProps: (props: TChartProps, shell: CartesianShellState<TData>) => TCanvasProps;
  getCompileRoot?: (canvasProps: TCanvasProps) => CompileRootFields<TData>;
  Canvas?: React.ComponentType<TCanvasProps>;
  usePlotRectState?: () => CartesianPlotRectState;
  getLoadingPoints?: (props: TChartProps) => number;
};

function useDefaultPlotRectState(): CartesianPlotRectState {
  const [plotAlign, setPlotAlign] = useState<ChartPlotInsets | null>(null);
  return { plotAlign, onPlotRect: setPlotAlign, canvasProps: {} };
}

function createDefaultCanvas<TData extends Record<string, unknown>, TCanvasProps extends Record<string, unknown>>(
  compile: (ctx: CompileContext<TData>) => EChartsOption,
  getCompileRoot: (canvasProps: TCanvasProps) => CompileRootFields<TData>,
) {
  return function DefaultCartesianCanvas(canvasProps: TCanvasProps) {
    const compileRoot = getCompileRoot(canvasProps);
    const { option, colorEpoch } = useCompiledOption(compile, compileRoot);
    const onPlotRect = (canvasProps as { onPlotRect?: (insets: ChartPlotInsets) => void }).onPlotRect;
    return <EChartsHost option={option} colorEpoch={colorEpoch} onPlotRect={onPlotRect} />;
  };
}

export function createCartesianChart<
  TData extends Record<string, unknown>,
  TConfig extends Record<string, ChartConfig[string]>,
  TChartProps extends CartesianChartBaseProps<TData, TConfig> = CartesianChartBaseProps<TData, TConfig>,
  TCanvasProps extends Record<string, unknown> = {
    data: TData[];
    xDataKey?: string;
    externalBrush?: boolean;
    onPlotRect?: (insets: ChartPlotInsets) => void;
  },
>(config: CreateCartesianChartConfig<TData, TConfig, TChartProps, TCanvasProps>) {
  const {
    displayName,
    compile,
    loadingVariant,
    defaultLoadingPoints = 12,
    defaults,
    getRootFields,
    mapCanvasProps,
    getCompileRoot,
    Canvas: CustomCanvas,
    usePlotRectState = useDefaultPlotRectState,
    getLoadingPoints,
  } = config;

  const Canvas =
    CustomCanvas ??
    (getCompileRoot
      ? createDefaultCanvas<TData, TCanvasProps>(compile, getCompileRoot)
      : (() => {
          throw new Error(`${displayName}: getCompileRoot is required when Canvas is omitted`);
        }) as React.ComponentType<TCanvasProps>);

  function CartesianChart(props: TChartProps) {
    const merged = { ...defaults, ...props } as TChartProps;
    const {
      config: chartConfig,
      data,
      children,
      className,
      xDataKey,
      isLoading = false,
      showBrush = true,
      brushFormatLabel,
    } = merged;

    const loadingPoints = getLoadingPoints?.(merged) ?? defaultLoadingPoints;
    const displayData = isLoading
      ? (getLoadingData(loadingPoints) as unknown as TData[])
      : data;
    const { visibleData, brushProps } = useChartBrush({ data: displayData });
    const xKey = xDataKey as string | undefined;
    const chartData = showBrush && !isLoading ? visibleData : displayData;
    const externalBrush = showBrush && !isLoading;
    const { plotAlign, onPlotRect, canvasProps } = usePlotRectState();

    const canvasElementProps = mapCanvasProps(merged, {
      chartData,
      xKey,
      externalBrush,
      onPlotRect,
      canvasProps,
    });

    return (
      <PartRegistryProvider>
        <ChartContainer
          config={chartConfig}
          className={className}
          isLoading={isLoading}
          footer={
            showBrush && !isLoading ? (
              <BeeChartBrush
                data={displayData}
                compile={compile}
                rootFields={getRootFields(merged, xKey)}
                xDataKey={xKey}
                formatLabel={brushFormatLabel}
                plotAlign={plotAlign}
                {...brushProps}
              />
            ) : undefined
          }
        >
          <ChartPlotShell
            isLoading={isLoading}
            loadingVariant={loadingVariant}
            canvas={<Canvas {...canvasElementProps} />}
          >
            {children}
          </ChartPlotShell>
        </ChartContainer>
      </PartRegistryProvider>
    );
  }

  CartesianChart.displayName = displayName;
  return { Chart: CartesianChart };
}
