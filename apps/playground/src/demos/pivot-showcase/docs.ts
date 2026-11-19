/** Where each feature is documented one by one; the playground examples only link there. */
export const DOCS_BASE = "https://github.com/nqlib/nqgrid/blob/dev/docs/";

export type DocsFile = "pivot-headless.md" | "pivot-recipes.md" | "pivot-performance.md";

export interface PivotDocRef {
  readonly file: DocsFile;
  /** Exact heading text (without the leading #s); tested against the file. */
  readonly heading: string;
}

/** GitHub's heading anchor: lowercase, drop punctuation except `-` and `_`, spaces become `-`. */
export function githubSlug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

export function docsUrl(ref: PivotDocRef): string {
  return `${DOCS_BASE}${ref.file}#${githubSlug(ref.heading)}`;
}

const headless = (heading: string): PivotDocRef => ({ file: "pivot-headless.md", heading });
const recipes = (heading: string): PivotDocRef => ({ file: "pivot-recipes.md", heading });

export const DOCS = {
  spec: headless("Spec highlights (v1)"),
  filters: headless("Filters, slicers & sorting (Excel parity)"),
  fieldList: headless("Field list & drag-and-drop (Excel parity, step 2)"),
  columns: headless("Several column fields (Excel parity, step 3)"),
  dates: headless("Date grouping (Excel parity, step 3)"),
  calculated: headless("Calculated measures"),
  showAs: headless("Show values as along a field"),
  subtotals: headless("Row subtotal positions"),
  distinctCount: headless("Distinct count"),
  drillThrough: headless("Drill-through"),
  scale: headless("Scaling (`format.scale`) and units"),
  validation: headless("Validation and diagnostics"),
  percentOf: headless("% Of (`percentOf`) and `showAsBase.scope`"),
  signField: headless("Sign field (`measures[i].signField`)"),
  subtotalLabels: headless("Per-level subtotal labels (`rows[i].subtotalLabel`, `columns[i].subtotalLabel`)"),
  calculatedItems: headless("Calculated items (`rows[i].calculatedItems`)"),
  measureFilters: headless("Measure filters (`measures[i].filter`)"),
  semiAdditive: headless("Semi-additive aggregates (`closingBalance`, `openingBalance`, `averageOverTime`)"),
  react: headless("React renderer (`@nqlib/nqgrid/pivot`)"),
  staticHtml: headless("Static HTML (`@nqlib/nqgrid/render-static`)"),
  exportService: headless("Export CLI & service (`packages/nqgrid-export`)"),
  incomeRecipe: recipes("Financial statement (P&L / income statement)"),
  budgetRecipe: recipes("Budget vs actual (long format)"),
  balanceRecipe: recipes("Balance sheet"),
  headcountRecipe: recipes("Headcount"),
  performance: { file: "pivot-performance.md", heading: "Performance review" },
} satisfies Record<string, PivotDocRef>;
