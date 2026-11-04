import type { EChartsOption } from "echarts";
import { compileGaugeOption } from "./compile-gauge";
import { compileRadialBarOption, compileRoseBarOption } from "./compile-radial-bar";
import type { CompileContext } from "./parts/types";

/** Multi-row → polar bar (concentric or rose); single-row → gauge. */
export function compileRadialOption(ctx: CompileContext): EChartsOption {
  if (ctx.data.length > 1) {
    if (ctx.radial?.radialLayout === "rose") {
      return compileRoseBarOption(ctx);
    }
    return compileRadialBarOption(ctx);
  }
  return compileGaugeOption(ctx);
}
