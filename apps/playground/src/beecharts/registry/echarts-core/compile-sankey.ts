import type { EChartsOption } from "echarts";
import { applyChartUiToOption } from "./apply-chart-ui";
import type { CompileContext, SankeyPart } from "./parts/types";

function resolveNodeName(
  nodes: Array<{ name: string }>,
  ref: number | string,
): string {
  if (typeof ref === "number") return nodes[ref]?.name ?? String(ref);
  return ref;
}

export function compileSankeyOption(ctx: CompileContext): EChartsOption {
  const sankey = ctx.parts.find((p): p is SankeyPart => p.type === "sankey");
  const graph = sankey?.graph ?? { nodes: [], links: [] };
  const nodes = graph.nodes.map((n) => ({
    name: n.name,
    itemStyle: { color: ctx.resolveColor(n.name, 0) },
  }));

  const links = graph.links.map((link) => ({
    source: resolveNodeName(graph.nodes, link.source),
    target: resolveNodeName(graph.nodes, link.target),
    value: link.value,
    lineStyle: {
      color: sankey?.linkVariant === "source" ? "source" : "gradient",
      opacity: 0.45,
    },
  }));

  const base: EChartsOption = {
    tooltip: { trigger: "item" },
    series: [
      {
        type: "sankey",
        emphasis: { focus: "adjacency" },
        data: nodes,
        links,
        label: { show: true },
        lineStyle: { curveness: 0.5 },
      },
    ],
  };

  return applyChartUiToOption(ctx, base);
}
