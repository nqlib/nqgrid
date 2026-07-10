export type EngineLabCommitmentStatus = "on_track" | "at_risk" | "over_budget" | "closed";

export type EngineLabRow = {
  id: string;
  wbs: string;
  project: string;
  costCenter: string;
  glAccount: string;
  budgetUsd: number;
  actualUsd: number;
  variancePct: number;
  period: string;
  manager: string;
  status: EngineLabCommitmentStatus;
  /** Shown when master-detail is enabled. */
  detail?: string;
};

const PROGRAMS = [
  "HQ Campus Modernization",
  "Regional ERP Rollout",
  "Cloud Migration Phase II",
  "Manufacturing Line 4 Retrofit",
  "Customer Data Platform",
  "Procurement Automation",
] as const;

const COST_CENTERS = ["CC-4100 Ops", "CC-4200 IT", "CC-4300 CapEx", "CC-4400 Facilities", "CC-4500 G&A"] as const;

const GL_ACCOUNTS = [
  "1510 · Capital WIP",
  "1520 · Equipment",
  "1530 · Software",
  "1540 · Leasehold",
  "6200 · Professional fees",
  "6300 · Contractor services",
] as const;

const MANAGERS = [
  "Elena Vasquez",
  "Marcus Chen",
  "Priya Nair",
  "Jordan Blake",
  "Sam Okonkwo",
  "Riley Park",
] as const;

const STATUSES: EngineLabCommitmentStatus[] = ["on_track", "at_risk", "over_budget", "closed"];

const PERIODS = ["FY25-Q1", "FY25-Q2", "FY25-Q3", "FY25-Q4", "FY26-Q1"] as const;

function variancePct(budget: number, actual: number): number {
  if (budget === 0) return 0;
  return Math.round(((actual - budget) / budget) * 1000) / 10;
}

/** Client-side capital program ledger — ~480 commitment lines. */
export function buildEngineLabRows(count = 480): EngineLabRow[] {
  return Array.from({ length: count }, (_, i) => {
    const program = PROGRAMS[i % PROGRAMS.length]!;
    const costCenter = COST_CENTERS[i % COST_CENTERS.length]!;
    const gl = GL_ACCOUNTS[i % GL_ACCOUNTS.length]!;
    const budgetUsd = 120_000 + (i % 37) * 48_500 + (i % 11) * 12_000;
    const actualUsd = Math.round(budgetUsd * (0.72 + (i % 13) * 0.025));
    const status = STATUSES[i % STATUSES.length]!;
    const wbs = `${String((i % 6) + 1).padStart(2, "0")}.${String((i % 12) + 1).padStart(2, "0")}.${String((i % 40) + 1).padStart(3, "0")}`;

    return {
      id: `line-${i + 1}`,
      wbs,
      project: program,
      costCenter,
      glAccount: gl,
      budgetUsd,
      actualUsd,
      variancePct: variancePct(budgetUsd, actualUsd),
      period: PERIODS[i % PERIODS.length]!,
      manager: MANAGERS[i % MANAGERS.length]!,
      status,
      detail:
        i % 18 === 0
          ? `Journal note: reclass ${gl.split("·")[0]?.trim()} accrual for ${program} — approver queue #${1000 + i}.`
          : undefined,
    };
  });
}

export const ENGINE_LAB_CLIENT_ROWS = buildEngineLabRows();

/** Async virtual source — same schema, 10k rows for streaming mode. */
export function engineLabVirtualCell(row: number, col: number): string {
  const r = buildEngineLabRows(10_000)[row];
  if (!r) return "";
  switch (col) {
    case 0:
      return r.wbs;
    case 1:
      return r.project;
    case 2:
      return r.costCenter;
    case 3:
      return r.glAccount;
    case 4:
      return String(r.budgetUsd);
    case 5:
      return String(r.actualUsd);
    case 6:
      return `${r.variancePct}%`;
    case 7:
      return r.period;
    case 8:
      return r.manager;
    case 9:
      return r.status.replace("_", " ");
    default:
      return "";
  }
}

export const ENGINE_LAB_COLUMN_HEADERS = [
  "WBS",
  "Program",
  "Cost center",
  "GL account",
  "Budget",
  "Actual",
  "Variance",
  "Period",
  "Manager",
  "Status",
] as const;

export const ENGINE_LAB_COLUMN_WIDTHS = [88, 168, 112, 128, 96, 96, 80, 80, 120, 96] as const;

export function formatEngineLabCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function engineLabStatusLabel(status: EngineLabCommitmentStatus): string {
  switch (status) {
    case "on_track":
      return "On track";
    case "at_risk":
      return "At risk";
    case "over_budget":
      return "Over budget";
    case "closed":
      return "Closed";
  }
}
