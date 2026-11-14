import { balanceHeadcountScenario } from "./scenarios/balance-headcount";
import { bigDataScenario } from "./scenarios/big-data";
import { budgetVsActualScenario } from "./scenarios/budget-vs-actual";
import { calculatedMeasuresScenario } from "./scenarios/calculated-measures";
import { columnHierarchyScenario } from "./scenarios/column-hierarchy";
import { fieldListScenario } from "./scenarios/field-list";
import { incomeStatementScenario } from "./scenarios/income-statement";
import { percentOfRevenueScenario } from "./scenarios/percent-of-revenue";
import { planningGridScenario } from "./scenarios/planning-grid";
import { sliceFilterScenario } from "./scenarios/slice-filter";
import type { PivotScenario, PivotScenarioVariant } from "./types";

/** The guided pivot showcase, in reading order. */
export const PIVOT_SCENARIOS: readonly PivotScenario[] = [
  planningGridScenario,
  sliceFilterScenario,
  fieldListScenario,
  columnHierarchyScenario,
  calculatedMeasuresScenario,
  incomeStatementScenario,
  percentOfRevenueScenario,
  budgetVsActualScenario,
  balanceHeadcountScenario,
  bigDataScenario,
];

/** `?pivot=` ids of the former "Planning pivot" preset dropdown; each is a scenario or variant id. */
export const LEGACY_PIVOT_IDS = ["planning", "dates", "calc", "statement", "income", "fpa", "balance"] as const;

/** Extra spellings that resolve to a scenario. */
export const LEGACY_PIVOT_ALIASES: Readonly<Record<string, string>> = {
  multicol: "columns",
  bigdata: "big",
};

export interface PivotLinkTarget {
  readonly scenario: PivotScenario;
  readonly variant: PivotScenarioVariant;
}

const byLinkId = new Map<string, PivotLinkTarget>();
for (const scenario of PIVOT_SCENARIOS) {
  for (const variant of scenario.variants) byLinkId.set(variant.id, { scenario, variant });
  if (!byLinkId.has(scenario.id)) byLinkId.set(scenario.id, { scenario, variant: scenario.variants[0] });
}

/** Resolve a `?pivot=` value (scenario id, variant id or legacy alias); unknown → `null`. */
export function resolvePivotLink(id: string | null | undefined): PivotLinkTarget | null {
  if (!id) return null;
  return byLinkId.get(id) ?? byLinkId.get(LEGACY_PIVOT_ALIASES[id] ?? "") ?? null;
}

export const DEFAULT_PIVOT_LINK: PivotLinkTarget = { scenario: PIVOT_SCENARIOS[0]!, variant: PIVOT_SCENARIOS[0]!.variants[0] };
