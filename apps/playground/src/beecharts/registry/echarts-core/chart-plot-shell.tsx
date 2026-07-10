"use client";

import { CHART_LEGEND_LAYER_NAME } from "@/registry/ui/legend";
import {
  ChartLoadingSkeleton,
  type ChartLoadingVariant,
} from "@/registry/ui/chart-loading-skeleton";
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

function isBackgroundLayer(child: ReactNode): child is ReactElement {
  return (
    isValidElement(child) &&
    typeof child.type !== "string" &&
    (child.type as { displayName?: string }).displayName === "BeeChartBackground"
  );
}

function isLegendLayer(child: ReactNode): child is ReactElement {
  return (
    isValidElement(child) &&
    typeof child.type !== "string" &&
    (child.type as { displayName?: string }).displayName === CHART_LEGEND_LAYER_NAME
  );
}

/** Layers background + ECharts canvas + HTML legend without double-mounting children. */
export function ChartPlotShell({
  canvas,
  children,
  isLoading,
  loadingVariant = "generic",
}: {
  canvas: ReactNode;
  children: ReactNode;
  isLoading?: boolean;
  loadingVariant?: ChartLoadingVariant;
}) {
  const childArray = Children.toArray(children);
  const backgrounds = childArray.filter(isBackgroundLayer);
  const legends = childArray.filter(isLegendLayer);
  const registerParts = childArray.filter(
    (child) => !isBackgroundLayer(child) && !isLegendLayer(child),
  );

  return (
    <>
      {registerParts}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {backgrounds}
        <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
          <div className={cn("relative min-h-0 flex-1", isLoading && "opacity-0")}>{canvas}</div>
          {isLoading ? <ChartLoadingSkeleton variant={loadingVariant} /> : null}
          {legends}
        </div>
      </div>
    </>
  );
}
