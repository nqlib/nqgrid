import type { ComponentType } from "react";
import type { PivotDataRow, PivotSpec } from "@nqlib/nqgrid/core";
import type { PivotGridState } from "@nqlib/nqgrid/pivot";

/** Cross-cutting panels under every scenario. */
export type PivotPanelId = "spec" | "validate" | "diagnostics" | "export";

export const ALL_PIVOT_PANELS: readonly PivotPanelId[] = ["spec", "validate", "diagnostics", "export"];

/** One spec + dataset of a scenario (most scenarios have one; "Column hierarchy" has two). */
export interface PivotScenarioVariant {
  /** Deep-link id (`?pivot=<id>`); the first variant's id is the scenario id. */
  readonly id: string;
  readonly label: string;
  readonly spec: PivotSpec;
  /** Called once per mount; return a stable array. */
  readonly rows: () => readonly PivotDataRow[];
  /** One line under the table explaining what the numbers mean. */
  readonly note?: string;
}

export interface PivotScenarioToolsProps {
  readonly grid: PivotGridState;
  readonly variant: PivotScenarioVariant;
}

export interface PivotScenario {
  readonly id: string;
  readonly title: string;
  /** One sentence: what the scenario shows. */
  readonly blurb: string;
  /** "What to try": 2–4 short, concrete steps. */
  readonly tryThis: readonly string[];
  readonly variants: readonly [PivotScenarioVariant, ...PivotScenarioVariant[]];
  /** Slicer fields (outer, inner); they must be in `spec.facets`. */
  readonly slicers?: readonly [string, string];
  /** Field list open on load (it can always be toggled). */
  readonly fieldListOpen?: boolean;
  /** "Heat by" select (the spec must have `heat`). */
  readonly heatControl?: boolean;
  /** Tabular / compact switch. */
  readonly layoutSwitch?: boolean;
  /** Virtualization switch and DOM row count (big data). */
  readonly virtualizeControl?: boolean;
  /**
   * What "Inject bad values" writes into the first records. Default: `BAD_VALUES` into the first
   * summed measure's field (`badValueFieldOf`).
   */
  readonly badValues?: { readonly field: string; readonly values?: readonly string[] };
  readonly panels: readonly PivotPanelId[];
  /** Scenario-specific controls, rendered above the table. */
  readonly Tools?: ComponentType<PivotScenarioToolsProps>;
}
