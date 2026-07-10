/** Data helpers for common BI chart shapes — use with primitive Bee*Chart components. */

const formatBin = (value: number) => {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

/** Bin numeric samples for use with `BeeBarChart` (`bin` + `count` keys). */
export function binForHistogram(values: number[], binCount = 8) {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const step = span / binCount;
  const counts = Array.from({ length: binCount }, () => 0);

  for (const value of values) {
    const index = Math.min(binCount - 1, Math.floor((value - min) / step));
    counts[index] = (counts[index] ?? 0) + 1;
  }

  return counts.map((count, index) => {
    const start = min + index * step;
    const end = start + step;
    return {
      bin: `${formatBin(start)}–${formatBin(end)}`,
      count,
    };
  });
}

/** Sort by value, add `count` and `cumulative` (0–100) for Pareto / composed charts. */
export function prepareParetoData<TData extends Record<string, unknown>>(
  data: TData[],
  nameKey: string,
  valueKey: string,
) {
  const sorted = [...data].sort(
    (a, b) => Number(b[valueKey] ?? 0) - Number(a[valueKey] ?? 0),
  );
  const total = sorted.reduce((sum, row) => sum + Number(row[valueKey] ?? 0), 0) || 1;
  let cumulative = 0;

  return sorted.map((row) => {
    const count = Number(row[valueKey] ?? 0);
    cumulative += count;
    return {
      ...row,
      count,
      cumulative: Number(((cumulative / total) * 100).toFixed(1)),
    };
  });
}

export type HeatmapCell = {
  row: string;
  col: string;
  x: number;
  y: number;
  value: number;
};

export type WorkloadDay = {
  /** ISO date `YYYY-MM-DD`. */
  date: string;
  availableHours: number;
  assignedHours: number;
};

export type CalendarCell = {
  date: string;
  /** Utilization percent — assigned ÷ available × 100. */
  value: number;
  assignedHours: number;
  availableHours: number;
};

/** Utilization percent for workload monitoring (0 when available is 0). */
export function workloadUtilization(assignedHours: number, availableHours: number) {
  if (availableHours <= 0) return 0;
  return Number(((assignedHours / availableHours) * 100).toFixed(1));
}

/**
 * Map daily capacity + assignments into calendar cells for `BeeCalendarChart`.
 * `value` is utilization %; values above 100 indicate overbooking.
 */
export function prepareCalendarWorkloadCells(
  days: WorkloadDay[],
  options?: { min?: number; max?: number },
): { cells: CalendarCell[]; min: number; max: number; range: string | [string, string] } {
  const cells: CalendarCell[] = days.map((day) => {
    const value = workloadUtilization(day.assignedHours, day.availableHours);
    return {
      date: day.date,
      value,
      assignedHours: day.assignedHours,
      availableHours: day.availableHours,
    };
  });

  if (cells.length === 0) {
    const month = new Date().toISOString().slice(0, 7);
    return { cells: [], min: 0, max: 100, range: month };
  }

  const values = cells.map((c) => c.value);
  const min = options?.min ?? Math.min(...values);
  const max = options?.max ?? Math.max(...values, 100);

  const dates = cells.map((c) => c.date).sort();
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;
  const range =
    first.slice(0, 7) === last.slice(0, 7) ? first.slice(0, 7) : ([first, last] as [string, string]);

  return { cells, min, max, range };
}

export type TeamWorkloadRow = {
  employee: string;
  /** Daily available hours (same length as `dates`). */
  availableByDay: number[];
  /** Daily assigned hours (same length as `dates`). */
  assignedByDay: number[];
};

/**
 * Flatten team × day utilization into a heatmap matrix for `BeeHeatmapChart`.
 * Rows are employees; columns are short date labels (e.g. `Mon 3`).
 */
export function prepareTeamWorkloadMatrix(
  dates: string[],
  rows: TeamWorkloadRow[],
  options?: { dateFormatter?: (iso: string) => string },
): { cells: HeatmapCell[]; min: number; max: number; rowLabels: string[]; colLabels: string[] } {
  const formatDate =
    options?.dateFormatter ??
    ((iso: string) => {
      const d = new Date(`${iso}T12:00:00`);
      return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
    });

  const rowLabels = rows.map((r) => r.employee);
  const colLabels = dates.map(formatDate);
  const matrix = rows.map((row) =>
    dates.map((_, i) =>
      workloadUtilization(row.assignedByDay[i] ?? 0, row.availableByDay[i] ?? 0),
    ),
  );

  const { cells, min, max } = prepareHeatmapCells(rowLabels, colLabels, matrix);
  return { cells, min, max: Math.max(max, 100), rowLabels, colLabels };
}

/** Flatten a row × column matrix for categorical heatmaps on `BeeHeatmapChart`. */
export function prepareHeatmapCells(
  rowLabels: string[],
  colLabels: string[],
  values: number[][],
): { cells: HeatmapCell[]; min: number; max: number } {
  const cells: HeatmapCell[] = [];
  let min = Infinity;
  let max = -Infinity;

  for (let y = 0; y < rowLabels.length; y++) {
    for (let x = 0; x < colLabels.length; x++) {
      const value = values[y]?.[x] ?? 0;
      min = Math.min(min, value);
      max = Math.max(max, value);
      cells.push({
        row: rowLabels[y]!,
        col: colLabels[x]!,
        x,
        y,
        value,
      });
    }
  }

  if (cells.length === 0) {
    return { cells: [], min: 0, max: 0 };
  }

  return { cells, min, max };
}

export type BulletRow = {
  label: string;
  poor: number;
  satisfactory: number;
  good: number;
  actual: number;
  target: number;
  max: number;
};

/** One horizontal bullet row for `BeeBarChart` with `layout="horizontal"`. */
export function prepareBulletRow(
  label: string,
  options: {
    actual: number;
    target: number;
    max?: number;
    poor?: number;
    satisfactory?: number;
    good?: number;
  },
): BulletRow {
  const max = options.max ?? 100;
  const poor = options.poor ?? max * 0.33;
  const satisfactory = options.satisfactory ?? max * 0.34;
  const good = options.good ?? Math.max(0, max - poor - satisfactory);

  return {
    label,
    poor,
    satisfactory,
    good,
    actual: options.actual,
    target: options.target,
    max,
  };
}

/** Map a KPI value into 0–100 for semi radial gauges. */
export function normalizeGaugeValue(value: number, min = 0, max = 100) {
  const span = Math.max(max - min, 1);
  return Math.min(100, Math.max(0, ((value - min) / span) * 100));
}

export type GaugeSeriesRow = {
  series: string;
  value: number;
};

/**
 * Rows for `BeeRadialChart` gauges. Each `series` key must match a `chartConfig` entry;
 * use `nameKey="series"` and `<RadialBar dataKey="value" />`.
 */
export function prepareGaugeRows(metrics: Record<string, number>): GaugeSeriesRow[] {
  return Object.entries(metrics).map(([series, value]) => ({ series, value }));
}

export type BoxPlotRow = {
  category: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
};

/** Summarize numeric samples into quartiles for box plot recipes on `BeeComposedChart`. */
export function prepareBoxPlotRow(category: string, samples: number[]): BoxPlotRow {
  if (samples.length === 0) {
    return { category, min: 0, q1: 0, median: 0, q3: 0, max: 0 };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const quantile = (p: number) => {
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower]!;
    const weight = index - lower;
    return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
  };

  return {
    category,
    min: sorted[0]!,
    q1: quantile(0.25),
    median: quantile(0.5),
    q3: quantile(0.75),
    max: sorted[sorted.length - 1]!,
  };
}
