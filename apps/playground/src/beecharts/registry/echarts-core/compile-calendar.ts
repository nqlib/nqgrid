import type { EChartsOption } from "echarts";
import { applyChartUiToOption } from "./apply-chart-ui";
import type { CompileContext, CalendarPart } from "./parts/types";
import type { CalendarCell } from "@/registry/lib/chart-recipes";

function resolveRange(part: CalendarPart | undefined, cells: CalendarCell[]) {
  if (part?.range) return part.range;
  if (cells.length === 0) return new Date().toISOString().slice(0, 7);

  const dates = cells.map((c) => c.date).sort();
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;

  if (first.slice(0, 7) === last.slice(0, 7)) {
    return first.slice(0, 7);
  }

  return [first, last] as [string, string];
}

function isYearRange(range: string | [string, string]) {
  return typeof range === "string" && /^\d{4}$/.test(range);
}

function isSingleMonthRange(range: string | [string, string]) {
  return typeof range === "string" && /^\d{4}-\d{2}$/.test(range);
}

/** Vertical = classic month grid (7 day columns × week rows). Horizontal = GitHub-style year strips. */
function resolveOrient(part: CalendarPart | undefined, range: string | [string, string]) {
  if (part?.orient) return part.orient;
  return isYearRange(range) ? "horizontal" : "vertical";
}

export function compileCalendarOption(ctx: CompileContext): EChartsOption {
  const calendars = ctx.parts.filter((p): p is CalendarPart => p.type === "calendar");
  const part = calendars[0];
  const cells = (part?.cells ?? []) as CalendarCell[];

  if (!cells.length) {
    return { series: [] };
  }

  const min = part?.min ?? Math.min(...cells.map((c) => c.value));
  const max = part?.max ?? Math.max(...cells.map((c) => c.value));
  const range = resolveRange(part, cells);
  const orient = resolveOrient(part, range);
  const cellSize = (part?.cellSize ?? (orient === "vertical" ? 22 : ["auto", 14])) as
    | number
    | "auto"
    | (number | "auto")[];
  const showDayLabel = part?.showDayLabel ?? true;
  const colorKey = part?.dataKey ?? "utilization";
  const themeColors =
    ctx.config[colorKey]?.colors?.light ?? ctx.config[colorKey]?.colors?.dark ?? [];
  const colorStops = Math.min(Math.max(themeColors.length, 3), 4);

  const data = cells.map((c) => [c.date, c.value]);

  const base: EChartsOption = {
    tooltip: {
      position: "top",
      formatter: (params: unknown) => {
        const item = Array.isArray(params) ? params[0] : params;
        if (!item || typeof item !== "object" || !("data" in item)) return "";
        const tuple = (item as { data: [string, number] }).data;
        const date = tuple[0];
        const cell = cells.find((c) => c.date === date);
        if (!cell) return `${date}<br/>${tuple[1]}%`;

        const assigned = cell.assignedHours.toFixed(1);
        const available = cell.availableHours.toFixed(1);
        const utilization = cell.value.toFixed(0);
        return [
          date,
          `Assigned: ${assigned}h`,
          `Available: ${available}h`,
          `Utilization: ${utilization}%`,
        ].join("<br/>");
      },
    },
    calendar: {
      top: isSingleMonthRange(range) ? 56 : 72,
      left: 48,
      right: 24,
      bottom: 64,
      range,
      cellSize,
      orient,
      dayLabel: {
        show: showDayLabel,
        firstDay: 1,
        nameMap: "en",
      },
      monthLabel: {
        show: true,
        nameMap: "en",
      },
      yearLabel: {
        show: !isSingleMonthRange(range),
      },
      splitLine: { show: true },
      itemStyle: {
        borderWidth: 0.5,
        borderColor: "transparent",
      },
    },
    visualMap: {
      min,
      max,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      seriesIndex: 0,
      dimension: 1,
      inRange: {
        color: Array.from({ length: colorStops }, (_, index) =>
          ctx.resolveColor(colorKey, Math.min(index, Math.max(themeColors.length - 1, 0))),
        ),
      },
    },
    series: [
      {
        type: "heatmap",
        coordinateSystem: "calendar",
        calendarIndex: 0,
        data,
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 8 } },
      },
    ],
  };

  return applyChartUiToOption(ctx, base);
}
