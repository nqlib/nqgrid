export type TaskComment = {
  id: string;
  author: string;
  body: string;
  at: string;
};

export type Subtask = {
  id: string;
  title: string;
  done: boolean;
  assignee: string;
  due: string;
};

export type ProjectLeadPerson = {
  name: string;
  image: string;
};

export type ProjectRow = {
  id: string;
  name: string;
  status: "active" | "paused" | "archived" | "risk";
  leads: ProjectLeadPerson[];
  updatedAt: string;
  budgetUsd: number;
  progress: number;
  subtasks: Subtask[];
  comments: TaskComment[];
};

export type PortfolioRow = {
  id: string;
  ticker: string;
  name: string;
  sector: string;
  shares: number;
  avgCost: number;
  last: number;
  dayPnLPct: number;
  weightPct: number;
};

export type FlightRow = {
  id: string;
  code: string;
  start: string;
  duration: string;
  end: string;
  destination: string;
  status: "boarding" | "on_time" | "delayed" | "cancelled";
  /** Operations stress-test / wide table (optional). */
  origin?: string;
  aircraft?: string;
  gate?: string;
  terminal?: string;
  stand?: string;
  pax?: number;
  crew?: number;
  delayMin?: number;
  loadPct?: number;
  fuel1kKg?: number;
  groundHandler?: string;
  belt?: string;
};

/** Stable pravatar.cc faces for demo leads (matches landing avatar set). */
export function demoLeadPerson(name: string): ProjectLeadPerson {
  const img: Record<string, number> = {
    "Maya Chen": 32,
    "Jordan Lee": 12,
    "Sam Okonkwo": 45,
    "Riley Park": 5,
    "Alex Rivera": 68,
  };
  const n = img[name] ?? 1;
  return { name, image: `https://i.pravatar.cc/96?img=${n}` };
}

/** Subtask owner labels are often first names — map to the same demo faces as leads. */
const ASSIGNEE_NICK_TO_FULL: Record<string, string> = {
  Jordan: "Jordan Lee",
  Sam: "Sam Okonkwo",
  Riley: "Riley Park",
  Maya: "Maya Chen",
  Alex: "Alex Rivera",
};

export function demoAssigneePerson(label: string): ProjectLeadPerson {
  const trimmed = label.trim();
  const fullName = ASSIGNEE_NICK_TO_FULL[trimmed] ?? trimmed;
  return demoLeadPerson(fullName);
}

export const mockProjects: ProjectRow[] = [
  {
    id: "pr-aurora",
    name: "Aurora billing migration",
    status: "active",
    leads: [demoLeadPerson("Maya Chen"), demoLeadPerson("Jordan Lee")],
    updatedAt: "2026-05-09",
    budgetUsd: 240_000,
    progress: 72,
    subtasks: [
      { id: "st-1", title: "Dual-write ledger events", done: true, assignee: "Jordan", due: "2026-05-01" },
      { id: "st-2", title: "Cutover runbook + rollback", done: false, assignee: "Sam", due: "2026-05-14" },
      { id: "st-3", title: "Shadow diff dashboard", done: false, assignee: "Riley", due: "2026-05-18" },
    ],
    comments: [
      { id: "c1", author: "Maya", body: "Stripe webhooks look stable in staging — ship checklist is green.", at: "2026-05-08 14:02" },
      { id: "c2", author: "Jordan", body: "Found one idempotency edge case on partial refunds; patch in review.", at: "2026-05-08 16:41" },
    ],
  },
  {
    id: "pr-pulse",
    name: "Pulse analytics refresh",
    status: "risk",
    leads: [demoLeadPerson("Alex Rivera")],
    updatedAt: "2026-05-10",
    budgetUsd: 128_000,
    progress: 38,
    subtasks: [
      { id: "st-4", title: "Backfill last 90d aggregates", done: true, assignee: "Alex", due: "2026-04-28" },
      { id: "st-5", title: "Replace legacy cohort SQL", done: false, assignee: "Maya", due: "2026-05-20" },
    ],
    comments: [
      { id: "c3", author: "Alex", body: "Query planner still picks seq scan on events_day — need BRIN.", at: "2026-05-10 09:15" },
    ],
  },
  {
    id: "pr-northstar",
    name: "Northstar design system",
    status: "active",
    leads: [demoLeadPerson("Riley Park"), demoLeadPerson("Maya Chen")],
    updatedAt: "2026-05-07",
    budgetUsd: 86_000,
    progress: 91,
    subtasks: [
      { id: "st-6", title: "Token audit (spacing + radius)", done: true, assignee: "Riley", due: "2026-04-10" },
      { id: "st-7", title: "Data table density modes", done: true, assignee: "Maya", due: "2026-05-02" },
      { id: "st-8", title: "Motion guidelines v2", done: false, assignee: "Riley", due: "2026-05-22" },
    ],
    comments: [
      { id: "c4", author: "Riley", body: "Ship compact table shell with two-tone panel — matches marketing spec.", at: "2026-05-07 11:03" },
      { id: "c5", author: "Sam", body: "Can we default to mid theme for enterprise tenants?", at: "2026-05-06 18:22" },
    ],
  },
  {
    id: "pr-ledger",
    name: "Ledger read replicas",
    status: "paused",
    leads: [demoLeadPerson("Jordan Lee")],
    updatedAt: "2026-04-30",
    budgetUsd: 310_000,
    progress: 54,
    subtasks: [
      { id: "st-9", title: "PgBouncer pool sizing", done: true, assignee: "Jordan", due: "2026-04-12" },
      { id: "st-10", title: "Replica lag SLO monitors", done: false, assignee: "Alex", due: "2026-05-30" },
    ],
    comments: [{ id: "c6", author: "Jordan", body: "Paused until infra finishes region pair.", at: "2026-04-30 10:00" }],
  },
  {
    id: "pr-canvas",
    name: "Canvas realtime cursors",
    status: "active",
    leads: [demoLeadPerson("Sam Okonkwo"), demoLeadPerson("Jordan Lee")],
    updatedAt: "2026-05-11",
    budgetUsd: 62_500,
    progress: 44,
    subtasks: [
      { id: "st-11", title: "WS fan-out limits", done: false, assignee: "Sam", due: "2026-05-16" },
      { id: "st-12", title: "Presence debounce + batching", done: false, assignee: "Jordan", due: "2026-05-19" },
    ],
    comments: [
      { id: "c7", author: "Sam", body: "Demo feels great under 50 users; stress test next week.", at: "2026-05-11 08:55" },
    ],
  },
  {
    id: "pr-vault",
    name: "Vault secrets rotation",
    status: "archived",
    leads: [demoLeadPerson("Maya Chen")],
    updatedAt: "2026-03-12",
    budgetUsd: 45_000,
    progress: 100,
    subtasks: [
      { id: "st-13", title: "KMS key rollover", done: true, assignee: "Maya", due: "2026-03-01" },
      { id: "st-14", title: "Audit export", done: true, assignee: "Riley", due: "2026-03-10" },
    ],
    comments: [{ id: "c8", author: "Maya", body: "Archived — quarterly review complete.", at: "2026-03-12 16:40" }],
  },
  {
    id: "pr-search",
    name: "Search relevance v3",
    status: "active",
    leads: [demoLeadPerson("Alex Rivera"), demoLeadPerson("Sam Okonkwo")],
    updatedAt: "2026-05-10",
    budgetUsd: 198_000,
    progress: 61,
    subtasks: [
      { id: "st-15", title: "Learning-to-rank feature store", done: true, assignee: "Alex", due: "2026-04-22" },
      { id: "st-16", title: "Offline eval harness", done: false, assignee: "Sam", due: "2026-05-25" },
      { id: "st-17", title: "Canary traffic 5%", done: false, assignee: "Alex", due: "2026-06-01" },
    ],
    comments: [
      { id: "c9", author: "Alex", body: "NDCG@10 +4.2% on head queries — ship plan drafted.", at: "2026-05-10 13:11" },
    ],
  },
  {
    id: "pr-mobile",
    name: "Mobile offline queue",
    status: "risk",
    leads: [demoLeadPerson("Riley Park")],
    updatedAt: "2026-05-06",
    budgetUsd: 74_000,
    progress: 29,
    subtasks: [
      { id: "st-18", title: "SQLite migration path", done: false, assignee: "Riley", due: "2026-05-28" },
      { id: "st-19", title: "Conflict resolution UX", done: false, assignee: "Maya", due: "2026-06-04" },
    ],
    comments: [{ id: "c10", author: "Riley", body: "iOS background tasks flaky on 17.4 — tracking.", at: "2026-05-06 15:48" }],
  },
  {
    id: "pr-obs",
    name: "Observability cost guardrails",
    status: "active",
    leads: [demoLeadPerson("Jordan Lee"), demoLeadPerson("Sam Okonkwo")],
    updatedAt: "2026-05-11",
    budgetUsd: 52_000,
    progress: 83,
    subtasks: [
      { id: "st-20", title: "Cardinality caps per service", done: true, assignee: "Jordan", due: "2026-04-18" },
      { id: "st-21", title: "Budget alerts → Slack", done: true, assignee: "Sam", due: "2026-05-01" },
    ],
    comments: [{ id: "c11", author: "Jordan", body: "Saved ~18% last month after dropping unused labels.", at: "2026-05-11 07:12" }],
  },
  {
    id: "pr-auth",
    name: "Passkeys rollout",
    status: "active",
    leads: [demoLeadPerson("Sam Okonkwo")],
    updatedAt: "2026-05-09",
    budgetUsd: 96_000,
    progress: 67,
    subtasks: [
      { id: "st-22", title: "WebAuthn fallback flows", done: true, assignee: "Sam", due: "2026-04-25" },
      { id: "st-23", title: "Enterprise IdP mapping", done: false, assignee: "Alex", due: "2026-05-27" },
    ],
    comments: [{ id: "c12", author: "Sam", body: "Support wants a one-click “lost device” path.", at: "2026-05-09 19:03" }],
  },
  {
    id: "pr-data",
    name: "Data residency EU cell",
    status: "paused",
    leads: [demoLeadPerson("Maya Chen"), demoLeadPerson("Jordan Lee")],
    updatedAt: "2026-04-22",
    budgetUsd: 420_000,
    progress: 22,
    subtasks: [
      { id: "st-24", title: "Object store replication policy", done: false, assignee: "Maya", due: "2026-06-10" },
      { id: "st-25", title: "Tenant routing layer", done: false, assignee: "Jordan", due: "2026-06-18" },
    ],
    comments: [{ id: "c13", author: "Maya", body: "Legal review slotted for June.", at: "2026-04-22 12:00" }],
  },
  {
    id: "pr-support",
    name: "Support macro suggestions",
    status: "active",
    leads: [demoLeadPerson("Riley Park"), demoLeadPerson("Sam Okonkwo")],
    updatedAt: "2026-05-08",
    budgetUsd: 38_000,
    progress: 55,
    subtasks: [
      { id: "st-26", title: "LLM guardrails + citations", done: false, assignee: "Riley", due: "2026-05-21" },
      { id: "st-27", title: "Agent feedback loop", done: false, assignee: "Sam", due: "2026-05-26" },
    ],
    comments: [{ id: "c14", author: "Riley", body: "Quality bar: no answer without doc link.", at: "2026-05-08 09:30" }],
  },
];

export const mockPortfolio: PortfolioRow[] = [
  { id: "pf-1", ticker: "NVDA", name: "NVIDIA Corp.", sector: "Semiconductors", shares: 42, avgCost: 612.4, last: 928.1, dayPnLPct: 1.82, weightPct: 14.2 },
  { id: "pf-2", ticker: "MSFT", name: "Microsoft Corp.", sector: "Software", shares: 88, avgCost: 362.1, last: 401.55, dayPnLPct: -0.34, weightPct: 12.8 },
  { id: "pf-3", ticker: "ASML", name: "ASML Holding", sector: "Semiconductors", shares: 11, avgCost: 721.0, last: 812.4, dayPnLPct: 0.91, weightPct: 9.6 },
  { id: "pf-4", ticker: "V", name: "Visa Inc.", sector: "Payments", shares: 55, avgCost: 244.8, last: 268.2, dayPnLPct: 0.12, weightPct: 8.1 },
  { id: "pf-5", ticker: "SHOP", name: "Shopify Inc.", sector: "Commerce", shares: 120, avgCost: 62.4, last: 88.9, dayPnLPct: 2.41, weightPct: 7.4 },
  { id: "pf-6", ticker: "CRWD", name: "CrowdStrike", sector: "Cybersecurity", shares: 64, avgCost: 198.7, last: 312.6, dayPnLPct: -1.05, weightPct: 7.0 },
  { id: "pf-7", ticker: "NET", name: "Cloudflare", sector: "Infrastructure", shares: 210, avgCost: 76.2, last: 102.4, dayPnLPct: 0.66, weightPct: 6.5 },
  { id: "pf-8", ticker: "MELI", name: "MercadoLibre", sector: "Commerce", shares: 18, avgCost: 1420.0, last: 1688.3, dayPnLPct: 1.12, weightPct: 6.2 },
  { id: "pf-9", ticker: "ADBE", name: "Adobe Inc.", sector: "Software", shares: 44, avgCost: 512.0, last: 478.9, dayPnLPct: -0.88, weightPct: 5.4 },
  { id: "pf-10", ticker: "SNOW", name: "Snowflake", sector: "Data", shares: 95, avgCost: 142.3, last: 156.8, dayPnLPct: 0.45, weightPct: 5.1 },
  { id: "pf-11", ticker: "ZS", name: "Zscaler", sector: "Cybersecurity", shares: 72, avgCost: 168.4, last: 204.1, dayPnLPct: 0.73, weightPct: 4.8 },
  { id: "pf-12", ticker: "DDOG", name: "Datadog", sector: "Observability", shares: 130, avgCost: 98.2, last: 112.7, dayPnLPct: -0.21, weightPct: 4.5 },
  { id: "pf-13", ticker: "PANW", name: "Palo Alto Networks", sector: "Cybersecurity", shares: 28, avgCost: 168.9, last: 182.4, dayPnLPct: 0.05, weightPct: 3.9 },
  { id: "pf-14", ticker: "NOW", name: "ServiceNow", sector: "Software", shares: 22, avgCost: 612.0, last: 688.1, dayPnLPct: 0.54, weightPct: 3.5 },
  { id: "pf-15", ticker: "MDB", name: "MongoDB", sector: "Data", shares: 48, avgCost: 228.4, last: 246.9, dayPnLPct: -0.62, weightPct: 3.0 },
];

export const mockFlights: FlightRow[] = [
  {
    id: "f1",
    code: "WN4567",
    start: "06:10",
    duration: "2h 15m",
    end: "08:25",
    destination: "Austin",
    status: "boarding",
    origin: "SFO",
    aircraft: "738",
    gate: "B12",
    terminal: "T1",
    stand: "S-14",
    pax: 143,
    crew: 4,
    delayMin: 0,
    loadPct: 87,
    fuel1kKg: 8,
    groundHandler: "Swissport",
    belt: "3",
  },
  {
    id: "f2",
    code: "UA1204",
    start: "07:45",
    duration: "4h 02m",
    end: "11:47",
    destination: "Seattle",
    status: "on_time",
    origin: "ORD",
    aircraft: "739",
    gate: "C6",
    terminal: "T2",
    stand: "S-22",
    pax: 162,
    crew: 5,
    delayMin: 0,
    loadPct: 91,
    fuel1kKg: 11,
    groundHandler: "United Ground",
    belt: "5",
  },
  {
    id: "f3",
    code: "DL882",
    start: "09:20",
    duration: "1h 08m",
    end: "10:28",
    destination: "Boston",
    status: "delayed",
    origin: "JFK",
    aircraft: "321",
    gate: "A18",
    terminal: "T4",
    stand: "S-31",
    pax: 128,
    crew: 4,
    delayMin: 42,
    loadPct: 79,
    fuel1kKg: 6,
    groundHandler: "Menzies",
    belt: "2",
  },
  {
    id: "f4",
    code: "LH7890",
    start: "11:05",
    duration: "7h 40m",
    end: "18:45",
    destination: "Munich",
    status: "cancelled",
    origin: "ATL",
    aircraft: "359",
    gate: "F4",
    terminal: "INTL",
    stand: "S-08",
    pax: 0,
    crew: 0,
    delayMin: 0,
    loadPct: 0,
    fuel1kKg: 0,
    groundHandler: "Dnata",
    belt: "—",
  },
  {
    id: "f5",
    code: "AA334",
    start: "13:15",
    duration: "3h 22m",
    end: "16:37",
    destination: "Denver",
    status: "on_time",
    origin: "DFW",
    aircraft: "788",
    gate: "D22",
    terminal: "T0",
    stand: "S-55",
    pax: 214,
    crew: 6,
    delayMin: 0,
    loadPct: 88,
    fuel1kKg: 14,
    groundHandler: "Menzies",
    belt: "7",
  },
  {
    id: "f6",
    code: "B61408",
    start: "15:50",
    duration: "5h 10m",
    end: "21:00",
    destination: "San Juan",
    status: "on_time",
    origin: "BOS",
    aircraft: "320",
    gate: "E9",
    terminal: "C",
    stand: "S-41",
    pax: 150,
    crew: 4,
    delayMin: 0,
    loadPct: 82,
    fuel1kKg: 9,
    groundHandler: "Swissport",
    belt: "4",
  },
  {
    id: "f7",
    code: "SK990",
    start: "18:30",
    duration: "8h 05m",
    end: "02:35",
    destination: "Stockholm",
    status: "boarding",
    origin: "EWR",
    aircraft: "333",
    gate: "B44",
    terminal: "B",
    stand: "S-19",
    pax: 198,
    crew: 5,
    delayMin: 0,
    loadPct: 93,
    fuel1kKg: 16,
    groundHandler: "United Ground",
    belt: "6",
  },
  {
    id: "f8",
    code: "FR221",
    start: "20:10",
    duration: "2h 50m",
    end: "23:00",
    destination: "Dublin",
    status: "delayed",
    origin: "STN",
    aircraft: "738",
    gate: "K2",
    terminal: "L",
    stand: "S-03",
    pax: 189,
    crew: 5,
    delayMin: 28,
    loadPct: 76,
    fuel1kKg: 7,
    groundHandler: "Menzies",
    belt: "1",
  },
];

const OPS_EXTRA_DESTINATIONS = [
  "Austin",
  "Seattle",
  "Boston",
  "Munich",
  "Denver",
  "San Juan",
  "Stockholm",
  "Dublin",
  "Atlanta",
  "Chicago",
  "Dallas",
  "Phoenix",
  "Miami",
  "Portland",
  "Toronto",
  "Vancouver",
  "London",
  "Paris",
  "Amsterdam",
  "Zurich",
  "Singapore",
  "Tokyo",
  "Sydney",
  "Honolulu",
];

const OPS_EXTRA_AIRLINES = ["WN", "UA", "DL", "LH", "AA", "B6", "SK", "FR", "AS", "BA", "KL", "AF", "AC", "QF", "JL", "SQ"];

const OPS_EXTRA_ORIGINS = [
  "SFO",
  "LAX",
  "JFK",
  "ORD",
  "DFW",
  "DEN",
  "SEA",
  "MIA",
  "ATL",
  "PHX",
  "IAH",
  "MSP",
  "LAS",
  "CLT",
  "BOS",
  "EWR",
];

const OPS_EXTRA_AIRCRAFT = ["738", "739", "7M8", "321", "320", "223", "E75", "CR9", "788", "359", "333", "77W"];

const OPS_EXTRA_HANDLERS = ["Swissport", "Menzies", "Dnata", "United Ground", "Alliance", "ASIG", "SAS GS"];

const OPS_EXTRA_STATUSES: FlightRow["status"][] = ["boarding", "on_time", "delayed", "cancelled"];

function padClock(n: number) {
  return String(n).padStart(2, "0");
}

function minutesToTime(m: number) {
  const wrapped = ((m % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${padClock(Math.floor(wrapped / 60))}:${padClock(wrapped % 60)}`;
}

/** Deterministic synthetic rows for stress-testing long / wide tables (after the small seed set). */
export function generateExtraMockFlights(count: number): FlightRow[] {
  const rows: FlightRow[] = [];
  for (let i = 0; i < count; i++) {
    const startM = 360 + (i * 37) % 1320;
    const durM = 50 + (i * 29) % 540;
    const endM = startM + durM;
    const h = Math.floor(durM / 60);
    const mm = durM % 60;
    const status = OPS_EXTRA_STATUSES[i % OPS_EXTRA_STATUSES.length];
    const delayMin = status === "delayed" ? 12 + (i * 13) % 140 : 0;
    rows.push({
      id: `f-gen-${i}`,
      code: `${OPS_EXTRA_AIRLINES[i % OPS_EXTRA_AIRLINES.length]}${String(1000 + (i % 8999)).padStart(4, "0")}`,
      start: minutesToTime(startM),
      duration: `${h}h ${mm}m`,
      end: minutesToTime(endM),
      destination: OPS_EXTRA_DESTINATIONS[i % OPS_EXTRA_DESTINATIONS.length],
      status,
      origin: OPS_EXTRA_ORIGINS[i % OPS_EXTRA_ORIGINS.length],
      aircraft: OPS_EXTRA_AIRCRAFT[i % OPS_EXTRA_AIRCRAFT.length],
      gate: `${String.fromCharCode(65 + (i % 6))}${(i % 32) + 1}`,
      terminal: `T${(i % 5) + 1}`,
      stand: `S-${100 + (i % 90)}`,
      pax: status === "cancelled" ? 0 : 48 + (i * 17) % 174,
      crew: status === "cancelled" ? 0 : 3 + (i % 5),
      delayMin,
      loadPct: status === "cancelled" ? 0 : 52 + (i * 11) % 48,
      fuel1kKg: status === "cancelled" ? 0 : 4 + (i % 19),
      groundHandler: OPS_EXTRA_HANDLERS[i % OPS_EXTRA_HANDLERS.length],
      belt: status === "cancelled" ? "—" : `${(i % 9) + 1}`,
    });
  }
  return rows;
}

/** Seed flights plus synthetic rows — 500 total, wide ops columns, for the Operations workspace. */
export const mockFlightsOperations: FlightRow[] = [...mockFlights, ...generateExtraMockFlights(492)];
