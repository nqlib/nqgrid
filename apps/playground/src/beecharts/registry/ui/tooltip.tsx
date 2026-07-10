"use client";

import { usePartId, useRegisterPart } from "@/registry/echarts-core/part-registry";

export type TooltipVariant = "default" | "frosted-glass";
export type TooltipRoundness = "sm" | "md" | "lg" | "xl";

type ChartTooltipProps = {
  variant?: TooltipVariant;
  roundness?: TooltipRoundness;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  hide?: boolean;
};

/** Registers tooltip styling; ECharts renders HTML via `echarts-tooltip.ts`. */
export function ChartTooltip({
  variant = "default",
  roundness = "lg",
  hideLabel,
  hideIndicator,
  hide,
}: ChartTooltipProps) {
  const id = usePartId();
  useRegisterPart({
    type: "tooltip",
    id,
    variant,
    roundness,
    hideLabel,
    hideIndicator,
    hide,
  });
  return null;
}

export function ChartTooltipContent() {
  return null;
}
