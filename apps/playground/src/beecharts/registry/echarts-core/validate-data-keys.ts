import type { ChartPart } from "./parts/types";

function partDataKeys(part: ChartPart): string[] {
  switch (part.type) {
    case "bar":
    case "line":
    case "area":
    case "scatter":
    case "radar":
    case "sparkline":
    case "radialBar":
    case "treemap":
    case "heatmap":
    case "calendar":
    case "gauge":
      return [part.dataKey];
    case "pie":
      return part.dataKey ? [part.dataKey] : [];
    case "xAxis":
    case "yAxis":
      return part.dataKey ? [part.dataKey] : [];
    default:
      return [];
  }
}

/** Warn in development when a registered `dataKey` is missing from data rows. */
export function validateDataKeys(
  data: Record<string, unknown>[],
  parts: ChartPart[],
  extraKeys: string[] = [],
): void {
  if (import.meta.env?.PROD) return;
  if (data.length === 0) return;

  const rowKeys = new Set(Object.keys(data[0] ?? {}));
  const warned = new Set<string>();

  for (const key of extraKeys) {
    if (!key || rowKeys.has(key) || warned.has(key)) continue;
    warned.add(key);
    console.warn(
      `[BeeCharts] dataKey "${key}" not found in data rows. Available keys: ${[...rowKeys].join(", ")}`,
    );
  }

  for (const part of parts) {
    for (const key of partDataKeys(part)) {
      if (rowKeys.has(key) || warned.has(`${part.type}:${key}`)) continue;
      warned.add(`${part.type}:${key}`);
      console.warn(
        `[BeeCharts] dataKey "${key}" on ${part.type} part not found in data rows. Available keys: ${[...rowKeys].join(", ")}`,
      );
    }
  }
}
