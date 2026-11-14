import type { PivotDataRow, PivotSpec } from "@nqlib/nqgrid/core";

/** Dataset sizes offered by the big-data scenario. */
export const BIG_DATA_SIZES = [100_000, 250_000, 500_000] as const;

const REGIONS = ["Americas", "EMEA", "APAC", "LATAM", "Nordics", "Middle East"] as const;
const CITIES_PER_REGION = 10;
const SKUS = 200;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export interface BigDataRow extends PivotDataRow {
  readonly region: string;
  readonly city: string;
  readonly sku: string;
  readonly month: string;
  readonly revenue: number;
  readonly units: number;
}

/** Deterministic PRNG (mulberry32) so screenshots and timings compare run to run. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `count` order lines: 6 regions × 10 cities × 200 SKUs × 12 months. With everything expanded the
 * pivot has ~12k body rows, far more than a browser can lay out at once: `PivotTable` virtualizes them.
 */
export function generateBigDataRows(count: number, seed = 42): BigDataRow[] {
  const rand = mulberry32(seed);
  const cities = REGIONS.map((region) => Array.from({ length: CITIES_PER_REGION }, (_, i) => `${region} ${String(i + 1).padStart(2, "0")}`));
  const skus = Array.from({ length: SKUS }, (_, i) => `SKU-${String(i + 1).padStart(4, "0")}`);
  const rows: BigDataRow[] = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const r = Math.floor(rand() * REGIONS.length);
    const units = 1 + Math.floor(rand() * 20);
    const sku = Math.floor(rand() * SKUS);
    rows[i] = {
      region: REGIONS[r]!,
      city: cities[r]![Math.floor(rand() * CITIES_PER_REGION)]!,
      sku: skus[sku]!,
      month: MONTHS[Math.floor(rand() * MONTHS.length)]!,
      units,
      revenue: Math.round(units * (20 + (sku % 37) * 3) * (0.8 + rand() * 0.4)),
    };
  }
  return rows;
}

export const bigDataPivotSpec: PivotSpec = {
  version: 1,
  id: "big-data-orders",
  title: "Order lines by region, city and SKU",
  subtitle: "Generated in the browser",
  rows: [
    { field: "region", label: "Region", subtotal: "end" },
    { field: "city", label: "City" },
    { field: "sku", label: "SKU" },
  ],
  columns: { field: "month", label: "Month", order: [...MONTHS] },
  measures: [
    { id: "revenue", field: "revenue", label: "Revenue", format: { style: "currency", currency: "USD", compact: true } },
    { id: "units", field: "units", label: "Units", format: { decimals: 0 } },
  ],
  values: ["revenue"],
  expanded: "all",
  totals: { rowTotal: true },
  heat: { measure: "revenue", scope: "column", applyTo: "leaf" },
};
