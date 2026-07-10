import type { FunnelConnection, FunnelStylePart, FunnelTaper } from "./parts/types";
import type { CompileContext } from "./parts/types";

/** Vertical spacing + dividers between funnel stages. */
export const FUNNEL_CONNECTION = {
  /** Stages touch — no gap or segment border. */
  seamless: { gap: 0, borderWidth: 0 },
  /** Balanced separation (default). */
  default: { gap: 6, borderWidth: 2 },
  /** Clearly separated blocks. */
  segmented: { gap: 12, borderWidth: 2 },
} as const satisfies Record<
  FunnelConnection,
  { gap: number; borderWidth: number }
>;

/** How gradually stage widths taper (ECharts `minSize`). */
export const FUNNEL_TAPER = {
  soft: "22%",
  default: "12%",
  steep: "6%",
} as const satisfies Record<FunnelTaper, string>;

export function resolveFunnelLayout(
  ctx: CompileContext,
  style: FunnelStylePart | undefined,
): { gap: number; borderWidth: number; minSize: string } {
  const connection = style?.connection ?? ctx.funnel?.funnelConnection ?? "default";
  const taper = style?.taper ?? ctx.funnel?.funnelTaper ?? "default";
  const preset = FUNNEL_CONNECTION[connection];
  const gap = style?.stageGap ?? ctx.funnel?.stageGap ?? preset.gap;
  const borderWidth = preset.borderWidth;

  return {
    gap,
    borderWidth,
    minSize: FUNNEL_TAPER[taper],
  };
}
