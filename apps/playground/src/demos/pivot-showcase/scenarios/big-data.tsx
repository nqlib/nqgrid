import { BIG_DATA_SIZES, bigDataPivotSpec, generateBigDataRows } from "../big-data-rows";
import type { PivotScenario, PivotScenarioVariant } from "../types";

const sizeLabel = (n: number) => `${n / 1000}k rows`;

const variants = BIG_DATA_SIZES.map(
  (n, i): PivotScenarioVariant => ({
    id: i === 0 ? "big" : `big-${n / 1000}k`,
    label: sizeLabel(n),
    spec: { ...bigDataPivotSpec, subtitle: `${sizeLabel(n)} generated in the browser` },
    rows: () => generateBigDataRows(n),
    note: "Every group is expanded: only the rows in view (plus overscan) are in the DOM.",
  }),
) as unknown as PivotScenario["variants"];

export const bigDataScenario: PivotScenario = {
  id: "big",
  title: "Big data",
  blurb: "Hundreds of thousands of order lines aggregated in the browser into ~12,000 expanded rows, rendered with row virtualization.",
  tryThis: [
    "Pick 500k rows and read the generate and build times under the table.",
    "Scroll the table: the rendered row count stays small while the scroll height covers every row.",
    "Set Virtualize to Off on 100k rows to see what rendering every row costs, then back to Auto.",
  ],
  variants,
  heatControl: true,
  layoutSwitch: true,
  virtualizeControl: true,
  badValues: { field: "revenue" },
  panels: ["spec", "validate", "diagnostics"],
};
