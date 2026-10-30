import type { PivotDataRow, PivotSpec } from "../core/pivot/types";

/** Fiscal months (Nov → Oct) used as the pivot column dimension. */
export const PLANNING_FISCAL_MONTHS = [
  "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct",
] as const;

const DEPARTMENTS: readonly { name: string; owner: string; scale: number; lines: readonly string[] }[] = [
  { name: "Footwear", owner: "Maya Chen", scale: 1.4, lines: ["Trail Runners", "Hiking Boots", "Sandals", "Approach Shoes", "Socks"] },
  {
    name: "Apparel",
    owner: "Luis Ortega",
    scale: 1.9,
    lines: ["Jackets", "Fleece", "Base Layers", "Pants", "Shirts", "Accessories"],
  },
  { name: "Camp", owner: "Ingrid Solberg", scale: 1.0, lines: ["Tents", "Sleeping Bags", "Sleeping Pads", "Camp Kitchen", "Camp Chairs"] },
  { name: "Packs", owner: "Sam Okafor", scale: 0.8, lines: ["Daypacks", "Backpacking", "Travel", "Hydration", "Kids", "Duffels"] },
];

/** Winter-peaking seasonality per fiscal month. */
const SEASONALITY = [0.9, 1.3, 0.7, 0.6, 0.75, 0.85, 1.0, 1.1, 1.05, 0.95, 0.8, 0.85];

/** Small deterministic PRNG so fixtures (and golden contract files) never change between runs. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export interface PlanningPivotRow extends PivotDataRow {
  readonly department: string;
  readonly owner: string;
  readonly line: string;
  readonly month: (typeof PLANNING_FISCAL_MONTHS)[number];
  readonly actual: number;
  readonly plan: number;
  readonly forecast: number;
  readonly outlook: number;
  readonly priorYear: number;
}

/** One record per department × line × fiscal month. */
export function generatePlanningPivotRows(seed = 7): PlanningPivotRow[] {
  const rand = lcg(seed);
  const rows: PlanningPivotRow[] = [];
  for (const dept of DEPARTMENTS) {
    dept.lines.forEach((line, li) => {
      const base = 60_000 + 260_000 * dept.scale * (1 - li * 0.15);
      PLANNING_FISCAL_MONTHS.forEach((month, mi) => {
        const actual = Math.round(base * SEASONALITY[mi]! * (0.85 + rand() * 0.3));
        const plan = Math.round(actual * (0.95 + rand() * 0.1));
        const outlook = Math.round(actual * (0.97 + rand() * 0.06));
        rows.push({
          department: dept.name,
          owner: dept.owner,
          line,
          month,
          actual,
          plan,
          forecast: Math.round(outlook * 0.33),
          outlook,
          priorYear: Math.round(actual / (0.95 + rand() * 0.12)),
        });
      });
    });
  }
  return rows;
}

const usdCompact = { style: "currency", currency: "USD", compact: true } as const;

/** Planning grid: Department → Line × fiscal month, heatmap, header bars and KPI panel. */
export const planningPivotSpec: PivotSpec = {
  version: 1,
  id: "planning-fy26",
  title: "FY26 Sales Plan",
  rows: [
    { field: "department", label: "Department", attributes: ["owner"] },
    { field: "line", label: "Line" },
  ],
  columns: { field: "month", label: "Month", order: [...PLANNING_FISCAL_MONTHS], keepEmpty: true },
  measures: [
    {
      id: "actual",
      field: "actual",
      label: "Actual",
      format: usdCompact,
      groupShowAs: "percentOfColumnTotal",
    },
    { id: "plan", field: "plan", label: "Plan", format: usdCompact },
    { id: "forecast", field: "forecast", label: "Forecast", format: usdCompact },
    { id: "outlook", field: "outlook", label: "Outlook", format: usdCompact },
    {
      id: "growth",
      label: "Growth on FY25",
      aggregate: { type: "ratio", numeratorField: "actual", denominatorField: "priorYear", offset: -1 },
      format: { style: "percent", signDisplay: "exceptZero" },
    },
  ],
  values: ["actual"],
  expanded: [["Camp"], ["Packs"]],
  heat: { measure: "actual", scope: "all", applyTo: "leaf" },
  headerCharts: { measure: "actual", type: "bar", breakdown: true },
  kpis: [
    { id: "growth", label: "Growth on FY25", measure: "growth" },
    { id: "forecast", label: "Forecast", measure: "forecast" },
    { id: "outlook", label: "Outlook", measure: "outlook", compareTo: "plan" },
    { id: "plan", label: "Plan", measure: "plan" },
  ],
  kpiLevels: [0],
};
