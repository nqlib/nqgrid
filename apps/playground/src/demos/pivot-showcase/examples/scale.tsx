import { BIG_DATA_SIZES, bigDataPivotSpec, generateBigDataRows } from "../big-data-rows";
import { DOCS } from "../docs";
import type { PivotExample, PivotExampleView } from "../types";

const sizeLabel = (n: number) => `${n / 1000}k rows`;

const views = BIG_DATA_SIZES.map(
  (n, i): PivotExampleView => ({
    id: i === 0 ? "scale" : `scale-${n / 1000}k`,
    label: sizeLabel(n),
    spec: { ...bigDataPivotSpec, subtitle: `${sizeLabel(n)} generated in the browser` },
    rows: () => generateBigDataRows(n),
    tryThis: [
      "Pick 500k rows and read the generate and build times under the table.",
      "Scroll: the rendered row count stays small while the scroll height covers every row.",
      "Set Virtualize to Off on 100k rows to feel what rendering every row costs, then back to Auto.",
    ],
    note: "Every group is expanded; only the rows in view (plus overscan) are in the DOM.",
  }),
) as unknown as PivotExample["views"];

export const scaleExample: PivotExample = {
  id: "scale",
  title: "Scale",
  blurb: "Hundreds of thousands of order lines aggregated in the browser into ~12,000 expanded rows, rendered with row virtualization.",
  views,
  features: [
    { label: "Row virtualization", docs: DOCS.react },
    { label: "Performance notes", docs: DOCS.performance },
  ],
  heatControl: true,
  virtualizeControl: true,
  badValues: Object.fromEntries(views.map((v) => [v.id, { field: "revenue" }])),
  panels: ["spec", "validate", "diagnostics"],
};
