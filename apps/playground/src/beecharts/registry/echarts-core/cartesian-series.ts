import type { ChartPart, CompileContext } from "./parts/types";

/**
 * Resolves the category (x) key for a cartesian chart: explicit `xDataKey`,
 * else the registered `<XAxis dataKey>`, else the first data column, else `"x"`.
 * Shared by the line, area, bar, and composed compilers so they stay in sync.
 */
export function getXKey(ctx: CompileContext): string {
  if (ctx.xDataKey) return ctx.xDataKey;
  const xPart = ctx.parts.find((p): p is Extract<ChartPart, { type: "xAxis" }> => p.type === "xAxis");
  if (xPart?.dataKey) return xPart.dataKey;
  return Object.keys(ctx.data[0] ?? {})[0] ?? "x";
}

/** Stringified category axis values for the resolved x key. */
export function categoryValues(ctx: CompileContext, xKey: string): string[] {
  return ctx.data.map((row) => String(row[xKey] ?? ""));
}

/**
 * Default point-marker config shared by every line-style series (line, area,
 * and the line series inside composed charts) so markers look identical
 * regardless of which chart root renders the `<Line>`.
 */
export const LINE_MARKER = {
  showSymbol: true,
  symbol: "circle" as const,
  symbolSize: 5,
};
