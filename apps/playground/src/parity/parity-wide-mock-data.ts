/** Wide mock rows so parity tables span the scroll viewport horizontally. */

export type WidePipelineRow = {
  id: string;
  name: string;
  score: number;
  stage: string;
  owner: string;
  region: string;
  sector: string;
  arrK: number;
  mrrK: number;
  health: string;
  lastTouch: string;
  nextStep: string;
};

export const WIDE_PIPELINE_ROWS: WidePipelineRow[] = [
  {
    id: "1",
    name: "Alpha Corp",
    score: 92,
    stage: "Review",
    owner: "Sam",
    region: "NA",
    sector: "SaaS",
    arrK: 420,
    mrrK: 35,
    health: "Strong",
    lastTouch: "2026-05-28",
    nextStep: "Security review",
  },
  {
    id: "2",
    name: "Bravo LLC",
    score: 78,
    stage: "Draft",
    owner: "Jo",
    region: "NA",
    sector: "Fintech",
    arrK: 180,
    mrrK: 15,
    health: "Watch",
    lastTouch: "2026-05-25",
    nextStep: "Pricing workshop",
  },
  {
    id: "3",
    name: "Charlie Inc",
    score: 65,
    stage: "Won",
    owner: "Alex",
    region: "EU",
    sector: "Retail",
    arrK: 90,
    mrrK: 7.5,
    health: "Stable",
    lastTouch: "2026-05-20",
    nextStep: "Kickoff",
  },
  {
    id: "4",
    name: "Delta Group",
    score: 88,
    stage: "Review",
    owner: "Sam",
    region: "APAC",
    sector: "Logistics",
    arrK: 310,
    mrrK: 26,
    health: "Strong",
    lastTouch: "2026-05-29",
    nextStep: "Legal redlines",
  },
  {
    id: "5",
    name: "Echo Partners",
    score: 71,
    stage: "Lost",
    owner: "Riley",
    region: "EU",
    sector: "Healthcare",
    arrK: 55,
    mrrK: 4.6,
    health: "At risk",
    lastTouch: "2026-05-18",
    nextStep: "Re-engage Q3",
  },
  {
    id: "6",
    name: "Foxtrot Systems",
    score: 84,
    stage: "Review",
    owner: "Jo",
    region: "NA",
    sector: "Security",
    arrK: 240,
    mrrK: 20,
    health: "Strong",
    lastTouch: "2026-05-27",
    nextStep: "POC sign-off",
  },
];

export type WideOpsRow = {
  id: string;
  country: string;
  city: string;
  units: number;
  channel: string;
  segment: string;
  quota: number;
  variance: number;
  owner: string;
  quarter: string;
  status: string;
  notes: string;
};

export const WIDE_OPS_ROWS: WideOpsRow[] = [
  {
    id: "1",
    country: "US",
    city: "NYC",
    units: 12,
    channel: "Direct",
    segment: "Enterprise",
    quota: 100,
    variance: 12,
    owner: "Sam",
    quarter: "Q2",
    status: "On track",
    notes: "Renewal pending",
  },
  {
    id: "2",
    country: "US",
    city: "SF",
    units: 8,
    channel: "Partner",
    segment: "Mid-market",
    quota: 80,
    variance: -4,
    owner: "Jo",
    quarter: "Q2",
    status: "Behind",
    notes: "Needs exec sponsor",
  },
  {
    id: "3",
    country: "DE",
    city: "BER",
    units: 5,
    channel: "Direct",
    segment: "SMB",
    quota: 40,
    variance: 5,
    owner: "Alex",
    quarter: "Q2",
    status: "Ahead",
    notes: "Upsell motion",
  },
  {
    id: "4",
    country: "DE",
    city: "MUC",
    units: 7,
    channel: "Partner",
    segment: "Enterprise",
    quota: 90,
    variance: 2,
    owner: "Riley",
    quarter: "Q2",
    status: "On track",
    notes: "Pilot complete",
  },
  {
    id: "5",
    country: "UK",
    city: "LON",
    units: 15,
    channel: "Direct",
    segment: "Enterprise",
    quota: 120,
    variance: 15,
    owner: "Sam",
    quarter: "Q2",
    status: "Ahead",
    notes: "Expand EMEA",
  },
];

export type WideHubRow = {
  id: string;
  name: string;
  region: string;
  revenue: number;
  headcount: number;
  marginPct: number;
  product: string;
  tier: string;
  support: string;
  contractEnd: string;
};

export const WIDE_HUB_ROWS: WideHubRow[] = [
  {
    id: "1",
    name: "North Hub",
    region: "NA",
    revenue: 1200,
    headcount: 42,
    marginPct: 18,
    product: "Platform",
    tier: "Gold",
    support: "24/7",
    contractEnd: "2027-03-01",
  },
  {
    id: "2",
    name: "South Hub",
    region: "NA",
    revenue: 980,
    headcount: 31,
    marginPct: 15,
    product: "Platform",
    tier: "Silver",
    support: "Business",
    contractEnd: "2026-11-15",
  },
  {
    id: "3",
    name: "EU Core",
    region: "EU",
    revenue: 2100,
    headcount: 58,
    marginPct: 22,
    product: "Suite",
    tier: "Platinum",
    support: "24/7",
    contractEnd: "2028-01-30",
  },
  {
    id: "4",
    name: "APAC Edge",
    region: "APAC",
    revenue: 760,
    headcount: 24,
    marginPct: 12,
    product: "Add-on",
    tier: "Silver",
    support: "Standard",
    contractEnd: "2026-09-01",
  },
];

export type WideSelectionRow = {
  id: string;
  label: string;
  amount: number;
  category: string;
  owner: string;
  status: string;
  region: string;
  updated: string;
  priority: string;
};

export const WIDE_SELECTION_ROWS: WideSelectionRow[] = [
  { id: "a", label: "Alpha", amount: 120, category: "Ops", owner: "Sam", status: "Open", region: "NA", updated: "2026-05-29", priority: "High" },
  { id: "b", label: "Bravo", amount: 45, category: "Sales", owner: "Jo", status: "Review", region: "EU", updated: "2026-05-27", priority: "Medium" },
  { id: "c", label: "Charlie", amount: 210, category: "Finance", owner: "Alex", status: "Closed", region: "APAC", updated: "2026-05-22", priority: "Low" },
  { id: "d", label: "Delta", amount: 88, category: "Ops", owner: "Riley", status: "Open", region: "NA", updated: "2026-05-30", priority: "High" },
];
