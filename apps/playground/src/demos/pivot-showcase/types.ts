import type { ComponentType } from "react";
import type { PivotDataRow, PivotSpec } from "@nqlib/nqgrid/core";
import type { PivotGridState } from "@nqlib/nqgrid/pivot";
import type { PivotDocRef } from "./docs";

/** Cross-cutting panels under every example. */
export type PivotPanelId = "spec" | "validate" | "diagnostics" | "export";

export const ALL_PIVOT_PANELS: readonly PivotPanelId[] = ["spec", "validate", "diagnostics", "export"];

/** One spec + dataset of an example. Views of one example share their dataset. */
export interface PivotExampleView {
  /** Deep-link id (`?pivot=<id>`); the first view's id is the example id. */
  readonly id: string;
  readonly label: string;
  readonly spec: PivotSpec;
  /** Called once per mount; return a stable array. */
  readonly rows: () => readonly PivotDataRow[];
  /** "What to try" for this view: 2–4 short, concrete steps. */
  readonly tryThis: readonly string[];
  /** One line under the table explaining what the numbers mean. */
  readonly note?: string;
}

export interface PivotExampleToolsProps {
  readonly grid: PivotGridState;
  readonly view: PivotExampleView;
}

/** A feature the example demonstrates, linked to the docs section that explains it. */
export interface PivotFeature {
  readonly label: string;
  readonly docs: PivotDocRef;
}

export interface PivotExample {
  readonly id: string;
  readonly title: string;
  /** One sentence: what the example is. */
  readonly blurb: string;
  readonly views: readonly [PivotExampleView, ...PivotExampleView[]];
  /** Everything this example covers; each links to its docs section. */
  readonly features: readonly PivotFeature[];
  /** Slicer fields (outer, inner); they must be in every view's `spec.facets`. */
  readonly slicers?: readonly [string, string];
  /** Field list open on load on wide screens (it can always be toggled). */
  readonly fieldListOpen?: boolean;
  /** "Heat by" select (the spec must have `heat`). */
  readonly heatControl?: boolean;
  /** Tabular / compact switch. */
  readonly layoutSwitch?: boolean;
  /** Virtualization switch and DOM row count. */
  readonly virtualizeControl?: boolean;
  /**
   * What "Inject bad values" writes into the first records, per view id. Default: `BAD_VALUES` into
   * the first summed measure's field (`badValueFieldOf`).
   */
  readonly badValues?: Readonly<Record<string, { readonly field: string; readonly values?: readonly string[] }>>;
  readonly panels: readonly PivotPanelId[];
  /** Example-specific controls above the table. */
  readonly Tools?: ComponentType<PivotExampleToolsProps>;
}
