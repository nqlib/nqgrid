/**
 * Sales-orders ledger fixture for the Spreadsheet page — deterministic (seeded),
 * ~2,000 line items wide enough to sort, filter, group, and pivot meaningfully.
 */

export interface OrderRow {
  id: string;
  orderNo: string;
  date: string; // ISO yyyy-mm-dd
  year: number;
  quarter: string; // "Q1".."Q4"
  month: string; // "Jan".."Dec"
  region: string;
  country: string;
  channel: string;
  category: string;
  product: string;
  salesRep: string;
  status: string;
  units: number;
  unitPrice: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
}

const REGIONS = ["North", "South", "East", "West"] as const;
const COUNTRY_BY_REGION: Record<string, string[]> = {
  North: ["Canada", "Norway", "Sweden"],
  South: ["Brazil", "Spain", "Italy"],
  East: ["Japan", "Singapore", "India"],
  West: ["United States", "Mexico", "Ireland"],
};
const CHANNELS = ["Online", "Retail", "Partner", "Direct"] as const;
const CATEGORIES = ["Hardware", "Software", "Services", "Accessories"] as const;
const PRODUCT_BY_CATEGORY: Record<string, string[]> = {
  Hardware: ["Edge Router", "Rack Server", "Sensor Hub"],
  Software: ["Analytics Suite", "Security License", "Sync Platform"],
  Services: ["Onboarding", "Premium Support", "Field Install"],
  Accessories: ["Cable Kit", "Mount Bracket", "Spare Battery"],
};
const REPS = [
  "Ana Ortiz",
  "Ben Cho",
  "Carla Reyes",
  "Dmitri Volkov",
  "Elena Sato",
  "Frank Idris",
  "Grace Lim",
  "Hassan Park",
];
const STATUSES = ["Won", "Open", "Lost"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Deterministic PRNG so the fixture (and its tests) are stable across runs. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateOrders(count: number): OrderRow[] {
  const rand = mulberry32(0x5a1e5);
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
  const rows: OrderRow[] = [];

  for (let i = 0; i < count; i++) {
    const region = pick(REGIONS);
    const country = pick(COUNTRY_BY_REGION[region]!);
    const category = pick(CATEGORIES);
    const product = pick(PRODUCT_BY_CATEGORY[category]!);
    const channel = pick(CHANNELS);
    const salesRep = pick(REPS);
    const status = pick(STATUSES);

    const monthIdx = Math.floor(rand() * 12);
    const day = 1 + Math.floor(rand() * 28);
    const year = 2025;
    const quarter = `Q${Math.floor(monthIdx / 3) + 1}`;
    const date = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const units = 1 + Math.floor(rand() * 120);
    const unitPrice = Math.round((40 + rand() * 960) * 100) / 100;
    const revenue = Math.round(units * unitPrice * 100) / 100;
    const costRatio = 0.45 + rand() * 0.35; // 45–80% of revenue
    const cost = Math.round(revenue * costRatio * 100) / 100;
    const margin = Math.round((revenue - cost) * 100) / 100;
    const marginPct = revenue > 0 ? Math.round((margin / revenue) * 1000) / 10 : 0;

    rows.push({
      id: `ord-${i + 1}`,
      orderNo: `SO-${String(100000 + i).slice(1)}`,
      date,
      year,
      quarter,
      month: MONTHS[monthIdx]!,
      region,
      country,
      channel,
      category,
      product,
      salesRep,
      status,
      units,
      unitPrice,
      revenue,
      cost,
      margin,
      marginPct,
    });
  }
  return rows;
}

export const SALES_ORDERS: OrderRow[] = generateOrders(2000);

/** Dimensions a user can group / pivot by. */
export const ORDER_DIMENSIONS = [
  { key: "region", label: "Region" },
  { key: "country", label: "Country" },
  { key: "channel", label: "Channel" },
  { key: "category", label: "Category" },
  { key: "product", label: "Product" },
  { key: "salesRep", label: "Sales rep" },
  { key: "status", label: "Status" },
  { key: "quarter", label: "Quarter" },
  { key: "month", label: "Month" },
] as const satisfies ReadonlyArray<{ key: keyof OrderRow; label: string }>;

/** Numeric measures with a default pivot/aggregation hint. */
export const ORDER_MEASURES = [
  { key: "revenue", label: "Revenue", agg: "sum", money: true },
  { key: "cost", label: "Cost", agg: "sum", money: true },
  { key: "margin", label: "Margin", agg: "sum", money: true },
  { key: "units", label: "Units", agg: "sum", money: false },
  { key: "marginPct", label: "Margin %", agg: "avg", money: false },
] as const satisfies ReadonlyArray<{
  key: keyof OrderRow;
  label: string;
  agg: "sum" | "avg" | "count" | "min" | "max";
  money: boolean;
}>;

/** Column display order + width hints for the grid view. */
export const ORDER_COLUMNS = [
  { key: "orderNo", label: "Order #", width: 110, numeric: false },
  { key: "date", label: "Date", width: 110, numeric: false },
  { key: "region", label: "Region", width: 90, numeric: false },
  { key: "country", label: "Country", width: 120, numeric: false },
  { key: "channel", label: "Channel", width: 100, numeric: false },
  { key: "category", label: "Category", width: 110, numeric: false },
  { key: "product", label: "Product", width: 150, numeric: false },
  { key: "salesRep", label: "Sales rep", width: 130, numeric: false },
  { key: "status", label: "Status", width: 90, numeric: false },
  { key: "units", label: "Units", width: 80, numeric: true },
  { key: "unitPrice", label: "Unit price", width: 110, numeric: true },
  { key: "revenue", label: "Revenue", width: 120, numeric: true },
  { key: "cost", label: "Cost", width: 120, numeric: true },
  { key: "margin", label: "Margin", width: 120, numeric: true },
  { key: "marginPct", label: "Margin %", width: 100, numeric: true },
] as const satisfies ReadonlyArray<{ key: keyof OrderRow; label: string; width: number; numeric: boolean }>;
