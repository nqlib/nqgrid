import type { PivotDataRow, PivotFieldSpec, PivotSpec } from "../core/pivot/types";

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

/** Extra fields added by `generatePlanningPivotRows(seed, { extraFields: true })`. */
export interface PlanningPivotExtraFields {
  readonly region: (typeof PLANNING_REGIONS)[number];
  readonly channel: (typeof PLANNING_CHANNELS)[number];
  readonly units: number;
}

export const PLANNING_REGIONS = ["North", "South", "East", "West"] as const;
export const PLANNING_CHANNELS = ["Retail", "Online", "Wholesale"] as const;
/** Average unit price per department (units = actual / price). */
const UNIT_PRICE: Readonly<Record<string, number>> = { Footwear: 120, Apparel: 75, Camp: 160, Packs: 95 };

export interface GeneratePlanningPivotRowsOptions {
  /**
   * Add `region`, `channel` (dimensions) and `units` (measure) to every record, for the field list
   * demo. Drawn from a separate PRNG, so the other fields are identical to the default rows (the
   * `planning.*` goldens do not change).
   */
  readonly extraFields?: boolean;
}

/** One record per department × line × fiscal month. */
export function generatePlanningPivotRows(seed?: number): PlanningPivotRow[];
export function generatePlanningPivotRows(
  seed: number | undefined,
  options: GeneratePlanningPivotRowsOptions & { readonly extraFields: true },
): (PlanningPivotRow & PlanningPivotExtraFields)[];
export function generatePlanningPivotRows(seed?: number, options?: GeneratePlanningPivotRowsOptions): PlanningPivotRow[];
export function generatePlanningPivotRows(seed = 7, options: GeneratePlanningPivotRowsOptions = {}): PlanningPivotRow[] {
  const rand = lcg(seed);
  const extra = options.extraFields ? lcg(seed ^ 0x5eed) : null;
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
          ...(extra
            ? {
                region: PLANNING_REGIONS[Math.floor(extra() * PLANNING_REGIONS.length)]!,
                channel: PLANNING_CHANNELS[Math.floor(extra() * PLANNING_CHANNELS.length)]!,
                units: Math.round(actual / (UNIT_PRICE[dept.name]! * (0.9 + extra() * 0.2))),
              }
            : {}),
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

/**
 * `planningPivotSpec` with filters (golden `planning-filtered.*`): Camp and Packs only, no "Kids"
 * line, the top 3 lines per department by actuals (the rest folded into "Other"), lines sorted by
 * actuals, and slicer facets for Department and Line.
 */
export const planningFilteredPivotSpec: PivotSpec = {
  ...planningPivotSpec,
  id: "planning-fy26-filtered",
  subtitle: "Camp & Packs · top 3 lines",
  rows: [
    planningPivotSpec.rows[0]!,
    {
      ...planningPivotSpec.rows[1]!,
      sortBy: { measure: "actual", direction: "desc" },
      topN: { measure: "actual", count: 3, other: true },
    },
  ],
  expanded: "all",
  filters: [
    { field: "department", include: ["Camp", "Packs"] },
    { field: "line", match: { op: "notContains", value: "kids" } },
  ],
  facets: ["department", "line"],
};

/** Field catalogue for the planning rows with `extraFields` (labels, types, allowed areas, formats). */
export const planningFieldCatalog: readonly PivotFieldSpec[] = [
  { field: "department", label: "Department", type: "dimension" },
  { field: "line", label: "Line", type: "dimension" },
  { field: "month", label: "Month", type: "date", areas: ["rows", "columns", "filters"] },
  { field: "region", label: "Region", type: "dimension" },
  { field: "channel", label: "Channel", type: "dimension" },
  { field: "owner", label: "Owner", type: "text", areas: ["rows", "filters"], description: "Department owner" },
  { field: "actual", label: "Actual", type: "measure", format: usdCompact },
  { field: "plan", label: "Plan", type: "measure", format: usdCompact },
  { field: "forecast", label: "Forecast", type: "measure", format: usdCompact },
  { field: "outlook", label: "Outlook", type: "measure", format: usdCompact },
  { field: "priorYear", label: "Prior year", type: "measure", format: usdCompact },
  { field: "units", label: "Units", type: "measure", format: { decimals: 0, compact: true } },
];

/**
 * `planningPivotSpec` rearranged in the field list (golden `planning-fields.*`, rows from
 * `generatePlanningPivotRows(7, { extraFields: true })`). From `{ ...planningPivotSpec, fields }`:
 * add Units to Values, drag Σ Values before Month (measures outermost), drag Region into Filters
 * and exclude West, drag Channel into Rows between Department and Line.
 */
export const planningFieldsPivotSpec: PivotSpec = {
  ...planningPivotSpec,
  id: "planning-fy26-fields",
  subtitle: "Rearranged in the field list",
  rows: [planningPivotSpec.rows[0]!, { field: "channel", label: "Channel" }, planningPivotSpec.rows[1]!],
  measures: [
    ...planningPivotSpec.measures,
    { id: "units", field: "units", label: "Units", format: { decimals: 0, compact: true } },
  ],
  values: ["actual", "units"],
  valuesIndex: 0,
  filters: [{ field: "region", label: "Region", exclude: ["West"] }],
  fields: planningFieldCatalog,
};
