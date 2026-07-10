import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
  ToggleGroupItem,
} from "@nqlib/nqui";
import { ORDER_DIMENSIONS, ORDER_MEASURES, type OrderRow } from "./mock-data";
import { type ChartConfig } from "@/registry/ui/chart";
import {
  BeeBarChart,
  Bar,
  XAxis as BarXAxis,
  Grid as BarGrid,
  Tooltip as BarTooltip,
} from "@/registry/charts/bar-chart";
import {
  BeeLineChart,
  Line,
  XAxis as LineXAxis,
  Grid as LineGrid,
  Tooltip as LineTooltip,
} from "@/registry/charts/line-chart";
import { BeePieChart, Pie, Tooltip as PieTooltip, Legend as PieLegend } from "@/registry/charts/pie-chart";

export interface ChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: readonly OrderRow[];
}

type ChartType = "bar" | "line" | "pie";

/** Five-slot categorical palette, theme-aware via the chart CSS vars. */
const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

type DimensionKey = (typeof ORDER_DIMENSIONS)[number]["key"];
type MeasureKey = (typeof ORDER_MEASURES)[number]["key"];
type AggKind = "sum" | "avg" | "count" | "min" | "max";

interface ChartPoint {
  category: string;
  value: number;
  // ECharts data rows are indexed generically by the chart components.
  [key: string]: string | number;
}

/** Group `rows` by `dimension`, reducing `measure` with its aggregator. */
function aggregateRows(
  rows: readonly OrderRow[],
  dimension: DimensionKey,
  measure: MeasureKey,
  agg: AggKind,
): ChartPoint[] {
  const sums = new Map<string, number>();
  const counts = new Map<string, number>();

  for (const row of rows) {
    const category = String(row[dimension] ?? "—");
    const raw = row[measure];
    const numeric = typeof raw === "number" ? raw : Number(raw) || 0;
    counts.set(category, (counts.get(category) ?? 0) + 1);
    if (agg === "count") {
      sums.set(category, (sums.get(category) ?? 0) + 1);
    } else if (agg === "min") {
      sums.set(category, Math.min(sums.get(category) ?? Infinity, numeric));
    } else if (agg === "max") {
      sums.set(category, Math.max(sums.get(category) ?? -Infinity, numeric));
    } else {
      // sum and avg both accumulate; avg divides by count below.
      sums.set(category, (sums.get(category) ?? 0) + numeric);
    }
  }

  const points: ChartPoint[] = Array.from(sums.entries()).map(([category, total]) => ({
    category,
    value: agg === "avg" ? total / (counts.get(category) || 1) : total,
  }));

  // Descending by value for bars/pie; keeps the chart legible.
  points.sort((a, b) => b.value - a.value);
  return points;
}

export function ChartDialog({ open, onOpenChange, data }: ChartDialogProps) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [dimension, setDimension] = useState<DimensionKey>(ORDER_DIMENSIONS[0].key);
  const [measureKey, setMeasureKey] = useState<MeasureKey>("revenue");

  const measure = useMemo(
    () => ORDER_MEASURES.find((m) => m.key === measureKey) ?? ORDER_MEASURES[0],
    [measureKey],
  );

  const points = useMemo(
    () => aggregateRows(data, dimension, measure.key, measure.agg),
    [data, dimension, measure],
  );

  // Cartesian charts: a single "value" series labelled by the measure.
  const valueConfig = useMemo<ChartConfig>(
    () => ({ value: { label: measure.label, colors: { light: [PALETTE[0]], dark: [PALETTE[0]] } } }),
    [measure.label],
  );

  // Pie: one config entry per category slice, cycling the palette.
  const pieConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};
    points.forEach((point, index) => {
      const color = PALETTE[index % PALETTE.length];
      config[point.category] = {
        label: point.category,
        colors: { light: [color], dark: [color] },
      };
    });
    return config;
  }, [points]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Insert chart</DialogTitle>
          <DialogDescription>
            Aggregate the orders by a category and measure, then preview the chart.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Chart type</Label>
            <ToggleGroup
              type="single"
              value={chartType}
              onValueChange={(v) => v && setChartType(v as ChartType)}
              variant="outline"
              size="sm"
              aria-label="Chart type"
            >
              <ToggleGroupItem value="bar" className="text-xs">
                Bar
              </ToggleGroupItem>
              <ToggleGroupItem value="line" className="text-xs">
                Line
              </ToggleGroupItem>
              <ToggleGroupItem value="pie" className="text-xs">
                Pie
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Select value={dimension} onValueChange={(v) => setDimension(v as DimensionKey)}>
              <SelectTrigger className="w-[11rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDER_DIMENSIONS.map((dim) => (
                  <SelectItem key={dim.key} value={dim.key}>
                    {dim.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Value</Label>
            <Select value={measureKey} onValueChange={(v) => setMeasureKey(v as MeasureKey)}>
              <SelectTrigger className="w-[11rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDER_MEASURES.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="h-[20rem] w-full">
          {chartType === "bar" ? (
            <BeeBarChart
              data={points}
              config={valueConfig}
              className="h-full w-full"
              xDataKey="category"
              barRadius={6}
            >
              <BarGrid />
              <BarXAxis dataKey="category" />
              <BarTooltip />
              <Bar dataKey="value" />
            </BeeBarChart>
          ) : chartType === "line" ? (
            <BeeLineChart
              data={points}
              config={valueConfig}
              className="h-full w-full"
              xDataKey="category"
            >
              <LineGrid />
              <LineXAxis dataKey="category" />
              <LineTooltip />
              <Line dataKey="value" curveType="monotone" />
            </BeeLineChart>
          ) : (
            <BeePieChart
              data={points}
              config={pieConfig}
              className="h-full w-full"
              nameKey="category"
            >
              <PieLegend />
              <PieTooltip />
              <Pie dataKey="value" nameKey="category" innerRadius="45%" />
            </BeePieChart>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
