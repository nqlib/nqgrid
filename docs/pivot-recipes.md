# Pivot recipes

Complete, tested specs for reports that need more than one feature working together. Each recipe shows the data
shape, the full spec, what every piece does, the result, and what the engine cannot do. The figures in each result
table are asserted by a test (named per recipe), so the doc cannot drift from the engine.

- [Financial statement (P&L / income statement)](#financial-statement-pl--income-statement): calculated items (Gross margin, EBITDA), per-section subtotal labels; or section subtotals only
- [Budget vs actual (long format)](#budget-vs-actual-long-format): scenarios as a column, measure filters, variance, YTD, prior year
- [Balance sheet](#balance-sheet): month-end balances with `closingBalance`
- [Headcount](#headcount): FTE with `averageOverTime`
- [Analyst workbook (XLSX)](#analyst-workbook-xlsx)

## Financial statement (P&L / income statement)

Rows **section → line** in statement order, quarters as columns, signed amounts, a total under each section with its
own label, formula rows between sections (**Gross margin**, **Gross margin %**, **EBITDA**) and **Operating income**
at the bottom — from the leaf-grain data as it comes, without adding rows to it.

Golden example: `contract/pivot/v1/examples/planning-income.*` (spec, rows, model, sheet, statement HTML). Fixture:
`generateIncomePivotRows()` / `incomePivotSpec` from `@nqlib/nqgrid/fixtures`. Test:
`src/core/pivot/calculated-items.test.ts` ("income statement recipe"). Playground: `?pivot=income`.

A simpler variant without formula rows (every total is a section subtotal or the grand total, plus a % of Revenue
column, unsigned amounts with a sign column) follows below:
[Section subtotals only](#simpler-section-subtotals-only).

### Data shape

Leaf-grain records, one per line × month (× any other key). Amounts are **signed** (costs negative); `LINE_SORT` is the
line's position in the statement.

| SECTION | LINE | LINE_SORT | PERIOD | AMOUNT |
|---|---|---:|---|---:|
| Revenue | Product revenue | 10 | 2026-01-01 | 800 |
| Revenue | Services revenue | 20 | 2026-01-01 | 200 |
| Cost of sales | COGS | 30 | 2026-01-01 | -400 |
| Operating expenses | Salaries | 40 | 2026-01-01 | -250 |
| Operating expenses | Rent | 50 | 2026-01-01 | -50 |
| Depreciation & amortization | Depreciation | 60 | 2026-01-01 | -40 |
| … 12 months (`2026-01-01` … `2026-12-01`), 72 records | | | | |

Unsigned amounts with a `SIGN` column work the same way: add `"signField": "SIGN"` to the amount measure (see the
variant below).

### Spec

```json
{
  "version": 1,
  "id": "income-statement-items",
  "title": "Income statement",
  "subtitle": "FY 2026 · EUR",
  "layout": "compact",
  "rows": [
    {
      "field": "SECTION", "label": "Section", "subtotal": "end",
      "subtotalLabels": {
        "Revenue": "Total revenue",
        "Cost of sales": "Total cost of sales",
        "Operating expenses": "Total operating expenses",
        "Depreciation & amortization": "Total depreciation & amortization"
      },
      "sortBy": { "measure": "ord", "direction": "asc" },
      "calculatedItems": [
        { "key": "Gross margin", "formula": "[Revenue] + [Cost of sales]", "after": "Cost of sales" },
        { "key": "Gross margin %", "formula": "[Gross margin] / [Revenue]", "after": "Gross margin",
          "format": { "style": "percent", "decimals": 1 } },
        { "key": "EBITDA", "formula": "[Gross margin] + [Operating expenses]", "after": "Operating expenses" }
      ]
    },
    { "field": "LINE", "label": "Line", "sortBy": { "measure": "ord", "direction": "asc" } }
  ],
  "columns": { "field": "PERIOD:quarter", "label": "Quarter" },
  "measures": [
    { "id": "amount", "label": "Amount", "field": "AMOUNT", "format": { "decimals": 0, "negative": "parentheses" } },
    { "id": "ord", "label": "Line order", "field": "LINE_SORT", "aggregate": "min" }
  ],
  "values": ["amount"],
  "totals": { "grandTotalLabel": "Operating income", "rowTotal": true, "rowTotalLabel": "FY 2026" }
}
```

### What each piece does

| Piece | Effect |
|---|---|
| `calculatedItems` on SECTION | Formula rows over keys of SECTION ([Calculated items](./pivot-headless.md#calculated-items-rowsicalculateditems)). On the outermost row field a key's value is the section total, so `[Revenue] + [Cost of sales]` is the gross margin in every quarter and in the FY column (the formula over the year totals). |
| `Gross margin %` = `[Gross margin] / [Revenue]` | An item may reference other items (cycles are rejected). Its `format` makes it a percent row in a currency statement: `59.7%`, and in the XLSX the cell keeps the ratio with `#,##0.0%`. The FY value is 8,190 / 13,980 = 58.6 %, not the average of the quarters. |
| `EBITDA` = `[Gross margin] + [Operating expenses]` | A cascading total over an item and a section. |
| `after` | Each item sits right after that key's whole block (the section heading, its lines and its subtotal row), whatever `sortBy` does to the sections. `Gross margin %` is anchored to the `Gross margin` item. |
| Items stay out of totals | `includeInTotals` defaults to false: Operating income (the grand total) adds the four sections only, not Gross margin and EBITDA again. Excel adds calculated items into totals, which double counts statement rows. |
| `subtotal: "end"` + `subtotalLabels` | A total row after each section's lines, named per section (`Total revenue`, `Total operating expenses`); sections without an entry fall back to `subtotalLabel` / `totals.subtotalLabel`. |
| Hidden measure `ord` + `sortBy` on both levels | `min(LINE_SORT)` orders lines and sections (a section by its smallest line number); the fixture emits costs first on purpose. |
| `totals.grandTotalLabel: "Operating income"` | The grand total of all signed amounts is the operating income. |
| `columns: { "field": "PERIOD:quarter" }`, `rowTotal` | Quarters of the ISO dates (`Q1` … `Q4`) and the year total. |

### Result

| Section / Line | Q1 | Q2 | Q3 | Q4 | FY 2026 |
|---|---:|---:|---:|---:|---:|
| **Revenue** | | | | | |
| &nbsp;&nbsp;Product revenue | 2,460 | 2,640 | 2,820 | 3,000 | 10,920 |
| &nbsp;&nbsp;Services revenue | 630 | 720 | 810 | 900 | 3,060 |
| **Total revenue** | **3,090** | **3,360** | **3,630** | **3,900** | **13,980** |
| **Cost of sales** | | | | | |
| &nbsp;&nbsp;COGS | (1,245) | (1,380) | (1,515) | (1,650) | (5,790) |
| **Total cost of sales** | **(1,245)** | **(1,380)** | **(1,515)** | **(1,650)** | **(5,790)** |
| **Gross margin** | **1,845** | **1,980** | **2,115** | **2,250** | **8,190** |
| **Gross margin %** | **59.7%** | **58.9%** | **58.3%** | **57.7%** | **58.6%** |
| **Operating expenses** | | | | | |
| &nbsp;&nbsp;Salaries | (750) | (750) | (750) | (750) | (3,000) |
| &nbsp;&nbsp;Rent | (150) | (150) | (150) | (150) | (600) |
| **Total operating expenses** | **(900)** | **(900)** | **(900)** | **(900)** | **(3,600)** |
| **EBITDA** | **945** | **1,080** | **1,215** | **1,350** | **4,590** |
| **Depreciation & amortization** | | | | | |
| &nbsp;&nbsp;Depreciation | (120) | (120) | (120) | (120) | (480) |
| **Total depreciation & amortization** | **(120)** | **(120)** | **(120)** | **(120)** | **(480)** |
| **Operating income** | **825** | **960** | **1,095** | **1,230** | **4,110** |

The three item rows are `kind: "calculated"` in the model (with their `formula`); the statement print profile and the
XLSX statement rules print them bold with a rule above, like subtotals. Drill-through on Gross margin lists the
Revenue and Cost of sales records.

**Editing in the app.** The Section chip in the field list lists the calculated items; "Calculated item…" opens an
editor with the formula checked as you type (syntax with position, cycles, a taken name), an insert-item picker, the
position (after / before a key, start, end), the format and "Add to totals". Keys the data does not have (a typo in
`[Cost of sale]`) are not validation errors — a validator does not see the data — but come back in
`model.diagnostics` as `itemKeyNotFound` (and from the Python client's `export_report`).

**Alternatives inside the same report.** A leaf-level item works too (`calculatedItems` on LINE: `[Product revenue] -
[Services revenue]` shows under Revenue only, because an item appears only under parents that have at least one key
it reads). Per-line number formats for data rows (a headcount line in FTE) go in `"itemFormats": { "Headcount":
{ "decimals": 1, "suffix": " FTE" } }` on the dimension. A % of Revenue column: add `{"id": "pct", "field": "AMOUNT",
"showAs": "percentOf", "showAsBase": {"field": "SECTION", "item": "Revenue", "scope": "all"}, "percentFormat": {"style":
"percent", "decimals": 1}}` — every row, the items
included, gets amount / Revenue (Gross margin 59.7 % in Q1; the Gross margin % row itself then shows a ratio of
ratios, so leave it out or accept it).

### Simpler: section subtotals only

When every total you need is a section subtotal or the grand total, no items are needed. Golden example:
`contract/pivot/v1/examples/planning-statement.*`. Fixture: `generateStatementPivotRows()` / `statementPivotSpec`. Test:
`src/core/pivot/statement.test.ts` ("financial statement recipe"). Playground: `?pivot=statement`. This variant also
shows a **% of Revenue** column and **unsigned** amounts with a sign column.

#### Data shape

Leaf-grain records, one per line × month (× any other key, here a department). Amounts are **unsigned**; a separate
`SIGN` column says whether a line adds (`1`) or subtracts (`-1`). `LINE_SORT` is the line's position in the
statement.

| SECTION | LINE | LINE_SORT | DEPT | PERIOD | AMOUNT | SIGN |
|---|---|---:|---|---|---:|---:|
| Gross margin | Revenue | 10 | North | 2026-01-01 | 600 | 1 |
| Gross margin | Revenue | 10 | South | 2026-01-01 | 400 | "1" |
| Gross margin | COGS | 20 | North | 2026-01-01 | 360 | "-1" |
| Gross margin | COGS | 20 | South | 2026-01-01 | 240 | "-1" |
| Operating expenses | Salaries | 30 | North | 2026-01-01 | 100 | -1 |
| Operating expenses | Salaries | 30 | South | 2026-01-01 | 80 | -1 |
| Operating expenses | Rent | 40 | North | 2026-01-01 | 50 | -1 |
| Operating expenses | Marketing | 50 | South | 2026-01-01 | 20 | -1 |
| … 12 months (`2026-01-01` … `2026-12-01`), 96 records | | | | | | |

Signs may be numbers or numeric strings (serialized decimals). If your amounts are **already signed** (costs
negative, like a `PL_AMOUNT` column), drop `signField` from the spec below; nothing else changes.

#### Spec

```json
{
  "version": 1,
  "id": "income-statement",
  "title": "Income statement",
  "subtitle": "FY 2026 · EUR",
  "layout": "compact",
  "rows": [
    { "field": "SECTION", "label": "Section", "subtotal": "end", "subtotalLabel": "{label}",
      "sortBy": { "measure": "ord", "direction": "asc" } },
    { "field": "LINE", "label": "Line", "sortBy": { "measure": "ord", "direction": "asc" } }
  ],
  "columns": { "field": "PERIOD:month", "label": "Month" },
  "measures": [
    { "id": "amount", "label": "Amount", "field": "AMOUNT", "signField": "SIGN",
      "format": { "decimals": 0, "negative": "parentheses" } },
    { "id": "pctRevenue", "label": "% of Revenue", "field": "AMOUNT", "signField": "SIGN",
      "showAs": "percentOf", "showAsBase": { "field": "LINE", "item": "Revenue", "scope": "all" },
      "percentFormat": { "style": "percent", "decimals": 1, "negative": "parentheses" } },
    { "id": "ord", "label": "Line order", "field": "LINE_SORT", "aggregate": "min" }
  ],
  "values": ["amount", "pctRevenue"],
  "valuesIndex": 0,
  "totals": { "grandTotalLabel": "Operating income", "rowTotal": true, "rowTotalLabel": "FY 2026" }
}
```

#### What each piece does

| Piece | Effect |
|---|---|
| `measures[].signField: "SIGN"` | Each record's `AMOUNT` is multiplied by its `SIGN` before aggregation, so COGS and expenses are negative and every total (subtotals, grand total, the `FY 2026` column) is a true net figure. A missing or non-numeric sign counts as `1`. Every measure that reads the amount needs it (here `amount` and `pctRevenue`). |
| Hidden measure `ord` | `min(LINE_SORT)`, defined in `measures` but **not** listed in `values`, so it is computed but never shown. A section's value is its smallest line number. |
| `sortBy: { measure: "ord", direction: "asc" }` on both row levels | Lines and sections follow `LINE_SORT` instead of first-seen order (the fixture deliberately emits expenses first). |
| `subtotal: "end"` on SECTION | Each expanded section gets a subtotal row **after** its lines: the Gross margin row. The section's own row above its lines stays as a heading with blank cells. |
| `subtotalLabel: "{label}"` on SECTION | Names the subtotal row after the section (`Gross margin`) instead of `Gross margin Total`. Only this level; `totals.subtotalLabel` would rename every subtotal row and column. |
| `totals.grandTotalLabel: "Operating income"` | The grand total of all signed amounts is the operating income. |
| `showAs: "percentOf"` + `showAsBase: { field: "LINE", item: "Revenue", scope: "all" }` | Each cell divided by Revenue in the same column. `scope: "all"` takes the base from the Revenue line wherever it sits, so lines of other sections, the subtotal rows and the grand total all get a percentage (Gross margin 40 %, Operating income 15 % in January). With the default `scope: "parent"` (Excel's "% Of") only Revenue's siblings (COGS) would. |
| `percentFormat` / `format` with `negative: "parentheses"` | Costs print as `(600)` and `(60.0%)`; XLSX gets the same numFmt (`#,##0;(#,##0)`). |
| `columns: { field: "PERIOD:month" }` | Month of the ISO date, labelled `Jan` … `Dec` and sorted chronologically. For data over several years use `PERIOD:yearMonth` (`Jan 2026`) or add a `PERIOD:year` column level. |
| `valuesIndex: 0`, `rowTotal: true` | The 12 amount columns come first, then the 12 percentage columns, then the year total of both. |

#### Result

Selected columns (the model has 12 amount columns, 12 % of Revenue columns and the two `FY 2026` totals):

| Section / Line | Jan | Feb | … | Dec | FY 2026 | % of Revenue Jan | % of Revenue FY 2026 |
|---|---:|---:|---|---:|---:|---:|---:|
| **Gross margin** | | | | | | | |
| &nbsp;&nbsp;Revenue | 1,000 | 1,100 | … | 2,100 | 18,600 | 100.0% | 100.0% |
| &nbsp;&nbsp;COGS | (600) | (660) | … | (1,260) | (11,160) | (60.0%) | (60.0%) |
| **Gross margin** | **400** | **440** | … | **840** | **7,440** | **40.0%** | **40.0%** |
| **Operating expenses** | | | | | | | |
| &nbsp;&nbsp;Salaries | (180) | (180) | … | (180) | (2,160) | (18.0%) | (11.6%) |
| &nbsp;&nbsp;Rent | (50) | (50) | … | (50) | (600) | (5.0%) | (3.2%) |
| &nbsp;&nbsp;Marketing | (20) | (25) | … | (75) | (570) | (2.0%) | (3.1%) |
| **Operating expenses** | **(250)** | **(255)** | … | **(305)** | **(3,330)** | **(25.0%)** | **(17.9%)** |
| **Operating income** | **150** | **185** | … | **535** | **4,110** | **15.0%** | **22.1%** |

In the app: `usePivotGrid(statementPivotSpec, rows)` + `PivotTable`; on the server:
`exportPivot({ spec, rows, format: "pdf" | "xlsx" })` or the Python client (below).

### Server-side (Python, nqgrid-export)

```python
from nqgrid_export import NqgridExportClient, validate_pivot_spec

assert validate_pivot_spec(spec) == []    # rejects what the engine / nqgrid-export reject (shared vectors)
out = NqgridExportClient("http://127.0.0.1:8787").export_report(spec, rows, format="pdf",
                                                              options={"profile": "statement"})
pdf, warnings = out.data, out.diagnostics  # e.g. amounts like "(500)" that are not numbers
```

`validate_pivot_spec` (JSON Schema + referential checks) and the engine's `validatePivotSpec` accept and reject the
same specs; `contract/pivot/v1/invalid-specs.json` is run by both test suites. Messages are identical for unknown keys
and the newer referential checks; for schema enums and types the Python message comes from jsonschema and names the
same path. `export_report` also returns the model's `diagnostics` (see
[Validation and diagnostics](./pivot-headless.md#validation-and-diagnostics)).

**Print.** `"profile": "statement"` (export option, or `renderPivotHtml(model, { profile: "statement" })`) prints the
subtotal and Operating income rows bold in the full text colour, with a rule above each subtotal and a double rule
under Operating income, without grey bands, child counts or sort arrows. **In thousands:** add
`"scale": 1000, "decimals": 1` to the amount's `format` and `"units": "EUR thousands"` to the spec (printed under the
title and in the XLSX page header); XLSX cells keep the exact amounts with an Excel format such as
`#,##0.0,;(#,##0.0,)`.

"Server-side" means the Node service `nqgrid-export` (`serve` mode, Docker image or `node dist/cli.js serve`) receives
the spec **and the raw rows** as JSON and pivots them **in memory**, with the same engine as the browser; Python only
validates and sends. Nothing is pushed down to SQL. Practical ceilings (see
[pivot-performance.md](./pivot-performance.md#remaining-risks-and-recommended-limits)):

- The request body is capped at 10 MiB by default (`--max-body-mb`); at ~120 bytes of JSON per record (this dataset) that is
  roughly 85,000 records. Aggregate in SQL to the grain you display first
  (`GROUP BY SECTION, LINE, LINE_SORT, SIGN, month[, cost centre]` with `SUM(AMOUNT)`): a P&L at line × month grain
  is a few thousand rows. (Sums survive pre-aggregation; `avg` / `min` / distinct counts do not.)
- In-process (browser or Node API) builds stay interactive up to about 1M records.
- PDFs up to ~300 pages; use XLSX for long listings.

### Limits (what does not work, and the workarounds)

| You want | Status | Workaround |
|---|---|---|
| A formula over lines of **different** sections (`[Revenue › Product revenue] - [Cost of sales › COGS]`) | Not supported | Item formulas reference keys of their own field under one parent. Put the item on the level whose keys you need (sections: SECTION; lines of one section: LINE), or move the lines you combine into one section. |
| A calculated item on a **column** field (e.g. a "Q1 − Q2" column) | Not supported (rejected) | Use a calculated measure with measure filters (one measure per period) or `showAs: "differenceFrom"` along the column field. |
| Items **added into** subtotals and the grand total (Excel's default) | Opt-in | `"includeInTotals": true` per item (e.g. an adjustment row); statement rows stay out by default. |
| A formula row whose inputs may be missing in some columns | Null propagates | `[Revenue] + coalesce([Other income], 0)`. An item whose inputs are all missing (filtered out) is not shown. |
| Hide the section heading row above the lines (with `subtotal: "end"`) | Not supported | The heading row stays (blank cells; it is the row users expand / collapse). Use `subtotal: "start"` (the default) if the totals may sit on the heading row instead. |
| "% of Revenue" in the total column only | Not supported | A measure appears in every column. `valuesIndex: 0` groups the percentage columns after the amounts; or export a second spec without columns. |
| Display costs as positive numbers but still subtract them in totals | Not supported | Totals add what is displayed. Show signed figures (with `negative: "parentheses"`), or keep a separate unsigned report. |
| Sign as a field-list setting | Spec only | The field list has no sign control; set `signField` in the spec (or with `setPivotMeasureSignField(spec, id, field)` / `grid.setMeasureSignField`). |
| `signField` on `count`, `distinctCount`, custom aggregates or calculated measures | Rejected (`validatePivotSpec`) | Counts have no values to sign; a calculated measure uses the signs of the measures it references. Ratios sign the numerator only. |
| Custom aggregators (functions) from Python / JSON | Not supported | JavaScript only (`BuildPivotModelOptions.aggregators`); nqgrid-export rejects them. |
| Balance-sheet lines (closing balances) by quarter or year | Supported: `closingBalance` | `sum` adds the monthly balances (Q1 cash = Jan + Feb + Mar) and `last` takes the last **record in input order**; use `{ "type": "closingBalance", "timeField": "PERIOD" }` (see [Balance sheet](#balance-sheet)). |
| Headcount / FTE averaged over time | Supported: `averageOverTime` | `avg` averages records; use `{ "type": "averageOverTime", "timeField": "PERIOD" }` (see [Headcount](#headcount)). |
| Latest estimate (actual where closed, else budget) | **Wrong at totals** with `coalesce` | Calculated measures see aggregated values: `coalesce(actual, budget)` on the year total is actual-to-date only. Use two measure filters, actual on the closed months and budget on the open ones, and add them: `actual_closed + budget_open` (see the note under [Budget vs actual](#budget-vs-actual-long-format)), or compute `LE` per row in SQL. |
| A calculated measure over a "show values as" measure (YTD variance = `ytd - ytdBudget`) | Rejected (`validatePivotSpec`) | It would read the values before the show-as (the monthly variance). Calculate first, then show: `{"calculate": "actual - budget", "showAs": "runningTotal", "showAsBase": {"field": "PERIOD:month"}}`. |
| Variance % on costs (negative bases) | Excel-consistent, FP&A-surprising | `percentDifferenceFrom` divides by the signed base, so a cost overrun shows **+10 %**. Use a calculated measure `(actual - budget) / abs(budget)`. |
| Several currencies | Not supported | Rows are summed as they come; convert to one reporting currency before export (and say which in `units`). |
| Scenario (Actual / Budget) as a column dimension | Totals add scenarios | The row total and outer subtotals add Actual + Budget, and calculated measures cannot reference a scenario. Keep `SCENARIO` out of the columns and give each scenario a measure with a measure filter (see [Budget vs actual](#budget-vs-actual-long-format)). |
| SQL pushdown / database-side pivoting | Not supported | The engine pivots rows in memory (browser, Node API or nqgrid-export); pre-aggregate in SQL (above). |

Notes:

- **Hidden measures** are simply measures not listed in `values`: they are computed for every row and column, can
  drive `sortBy`, `topN`, KPIs and calculated measures, and are never shown.
- `percentOf` with `scope: "all"` needs `item` and a **row** field; the base is the aggregate of every record whose
  `LINE` is `Revenue` in that column after filters (filtering Revenue out empties the column). Base 0 or missing →
  empty cell. It is a view-only change: switching it on in the app reuses the aggregated cube.
- Drill-through (`pivotDrillThrough`) returns the raw records (unsigned `AMOUNT` and its `SIGN`) and lists `SIGN` in
  its suggested fields.

## Budget vs actual (long format)

Actual, Budget, the variance, Var %, YTD actual and prior-year actual side by side, by quarter, from **one long table**
where the scenario is a column (how GL and EPM extracts arrive). Amounts in USD thousands.

Golden example: `contract/pivot/v1/examples/planning-fpa.*`. Fixture: `generateFpaPivotRows()` / `fpaPivotSpec` from
`@nqlib/nqgrid/fixtures`. Test: `src/core/pivot/fpa.test.ts` ("recipe: budget vs actual"). Playground: `?pivot=fpa`.

### Data shape

One record per scenario × line × month, amounts unsigned with a `SIGN` column, P&L lines (`KIND: "flow"`), balances and
headcount in the same table (used by the next two recipes). H1 2026 actual and budget, H1 2025 actual.

| KIND | SECTION | LINE | LINE_SORT | SCENARIO | PERIOD | AMOUNT | SIGN |
|---|---|---|---:|---|---|---:|---:|
| flow | Revenue | Product revenue | 10 | Actual | 2026-01-01 | 105,000 | 1 |
| flow | Revenue | Product revenue | 10 | Budget | 2026-01-01 | 100,000 | 1 |
| flow | Revenue | Product revenue | 10 | Actual | 2025-01-01 | 90,000 | 1 |
| flow | Cost of sales | COGS | 30 | Actual | 2026-01-01 | 49,350 | -1 |
| flow | Operating expenses | Salaries | 40 | Budget | 2026-01-01 | 50,000 | -1 |
| balance | Assets | Cash | 110 | Actual | 2026-01-01 | 210,000 | 1 |
| headcount | Headcount | Engineering | 210 | Actual | 2026-01-01 | 31 | 1 |
| … 150 records | | | | | | | |

### Spec

```json
{
  "version": 1,
  "id": "fpa-budget-vs-actual",
  "title": "Management P&L: budget vs actual",
  "subtitle": "H1 2026 by quarter",
  "units": "USD thousands",
  "layout": "compact",
  "rows": [
    { "field": "SECTION", "subtotal": "end", "subtotalLabel": "{label}", "sortBy": { "measure": "ord", "direction": "asc" } },
    { "field": "LINE", "sortBy": { "measure": "ord", "direction": "asc" } }
  ],
  "columns": { "field": "PERIOD:quarter", "label": "Quarter" },
  "filters": [{ "field": "KIND", "include": ["flow"], "label": "Kind" }],
  "measures": [
    { "id": "actual", "label": "Actual", "field": "AMOUNT", "signField": "SIGN", "format": { "style": "currency", "currency": "USD", "scale": 1000, "decimals": 1, "negative": "parentheses" },
      "filter": [{ "field": "SCENARIO", "include": ["Actual"] }, { "field": "PERIOD:year", "include": ["2026"] }] },
    { "id": "budget", "label": "Budget", "field": "AMOUNT", "signField": "SIGN", "format": { "…": "same" },
      "filter": [{ "field": "SCENARIO", "include": ["Budget"] }, { "field": "PERIOD:year", "include": ["2026"] }] },
    { "id": "variance", "label": "Var", "calculate": "actual - budget", "format": { "…": "same" } },
    { "id": "variancePct", "label": "Var %", "calculate": "(actual - budget) / abs(budget)",
      "format": { "style": "percent", "decimals": 1, "negative": "parentheses" } },
    { "id": "ytd", "label": "YTD actual", "field": "AMOUNT", "signField": "SIGN", "filter": "… same as actual",
      "showAs": "runningTotal", "groupShowAs": "runningTotal", "showAsBase": { "field": "PERIOD:quarter" } },
    { "id": "priorYear", "label": "PY actual", "field": "AMOUNT", "signField": "SIGN",
      "filter": [{ "field": "SCENARIO", "include": ["Actual"] }, { "field": "PERIOD:year", "include": ["2025"] }] },
    { "id": "ord", "field": "LINE_SORT", "aggregate": "min" }
  ],
  "values": ["actual", "budget", "variance", "variancePct", "ytd", "priorYear"],
  "totals": { "grandTotalLabel": "Operating income", "rowTotal": true, "rowTotalLabel": "H1" }
}
```

(`"…"` marks repetition; the complete JSON is `planning-fpa.spec.json`.)

### What each piece does

| Piece | Effect |
|---|---|
| `measures[].filter` on `SCENARIO` | Each measure aggregates only its scenario's records; rows, columns and totals still come from every record. Nothing adds Actual and Budget together (with `SCENARIO` in Columns the row total and outer subtotals would). |
| `PERIOD:year` inside the measure filters, not in `spec.filters` | A report filter on 2026 would remove the 2025 records before the prior-year measure sees them; a measure filter only narrows. |
| `columns: PERIOD:quarter` | Quarter of any year (Q1, Q2), so 2026 and 2025 share a column and PY sits next to Actual. Use `PERIOD:month` for months. |
| `variance`, `variancePct` | Calculated over the filtered measures per cell, so totals are `sum(actual) - sum(budget)`. `abs(budget)` keeps the sign of the variance on cost lines: a cost overrun is negative (COGS −9.7 %), unlike `percentDifferenceFrom`, which divides by the signed base. |
| `ytd` | Running total of actual along the quarter (`groupShowAs` too, so subtotals and Operating income accumulate). |
| `filters: KIND = flow` | Balance and headcount lines of the same table stay out of the P&L. |
| `format.scale: 1000` + `units` | Cells print in thousands with one decimal; XLSX keeps exact values with `"$"#,##0.0,`; "USD thousands" prints under the title and in the XLSX page header. |

### Result

H1 (row-total column), USD thousands:

| Section / Line | Actual | Budget | Var | Var % |
|---|---:|---:|---:|---:|
| &nbsp;&nbsp;Product revenue | $645.8 | $615.0 | $30.8 | 5.0% |
| &nbsp;&nbsp;Services revenue | $228.0 | $240.0 | ($12.0) | (5.0%) |
| **Revenue** | **$873.8** | **$855.0** | **$18.8** | **2.2%** |
| &nbsp;&nbsp;COGS | ($303.5) | ($276.8) | ($26.8) | (9.7%) |
| **Cost of sales** | **($303.5)** | **($276.8)** | **($26.8)** | **(9.7%)** |
| &nbsp;&nbsp;Salaries | ($306.0) | ($300.0) | ($6.0) | (2.0%) |
| &nbsp;&nbsp;Rent | ($60.0) | ($60.0) | $0.0 | 0.0% |
| **Operating expenses** | **($366.0)** | **($360.0)** | **($6.0)** | **(1.7%)** |
| **Operating income** | **$204.2** | **$218.3** | **($14.0)** | **(6.4%)** |

By quarter (selected rows):

| Line | Q1 Actual | Q1 PY actual | Q2 Actual | Q2 YTD actual | Q2 PY actual |
|---|---:|---:|---:|---:|---:|
| Product revenue | $318.2 | $273.0 | $327.6 | $645.8 | $282.0 |
| Operating income | $99.6 | $88.7 | $104.6 | $204.2 | $93.6 |

Print it as a statement with the export option `"profile": "statement"`. Drill-through on a Budget cell
(`measureId: "budget"`) lists only budget records.

**Latest estimate** (actual for closed months, budget for the rest) is two more measure filters and a sum:
`{ "id": "le_actual", …, "filter": [{ "field": "SCENARIO", "include": ["Actual"] }, { "field": "PERIOD:yearMonth", "include": ["2026-01", "2026-02", "2026-03"] }] }`,
`{ "id": "le_budget", …, "filter": [{ "field": "SCENARIO", "include": ["Budget"] }, { "field": "PERIOD:yearMonth", "exclude": ["2026-01", "2026-02", "2026-03"] }] }`
and `{ "id": "le", "calculate": "coalesce(le_actual, 0) + coalesce(le_budget, 0)" }`: totals add both parts,
unlike `coalesce(actual, budget)`.

### Limits

| You want | Status | Workaround |
|---|---|---|
| "YTD as of a date" / rolling 12 months presets | Not built in | Build them from measure filters on `PERIOD:yearMonth` (enumerate the months) and `runningTotal`. |
| Favourable / unfavourable colouring of variances | Not supported | `abs(budget)` keeps the sign right; colouring by line type is the app's (no sentiment flag in the model yet). |
| A measure filter on a calculated measure | Rejected | Filter the measures it references. |

## Balance sheet

Month-end balances by quarter: a quarter shows its **last month**, the half-year its last month, groups add their
accounts, and liabilities net off against assets.

Golden example: `contract/pivot/v1/examples/planning-fpa-bs.*` (same rows as above). Test: `src/core/pivot/fpa.test.ts`
("recipe: balance sheet"). Playground: `?pivot=balance`.

### Spec

```json
{
  "version": 1,
  "title": "Balance sheet and headcount",
  "units": "USD thousands · FTE",
  "rows": [
    { "field": "SECTION", "sortBy": { "measure": "ord", "direction": "asc" } },
    { "field": "LINE", "sortBy": { "measure": "ord", "direction": "asc" } }
  ],
  "columns": [{ "field": "PERIOD:yearQuarter" }, { "field": "PERIOD:month" }],
  "columnsExpanded": [["2026-Q2"]],
  "filters": [{ "field": "KIND", "exclude": ["flow"] }],
  "measures": [
    { "id": "balance", "label": "Balance", "field": "AMOUNT", "signField": "SIGN",
      "aggregate": { "type": "closingBalance", "timeField": "PERIOD" },
      "filter": [{ "field": "SCENARIO", "include": ["Actual"] }, { "field": "PERIOD:year", "include": ["2026"] },
                 { "field": "KIND", "include": ["balance"] }],
      "format": { "style": "currency", "currency": "USD", "scale": 1000, "decimals": 1, "negative": "parentheses" } },
    { "id": "fte", "label": "FTE", "field": "AMOUNT", "aggregate": { "type": "averageOverTime", "timeField": "PERIOD" },
      "filter": [{ "field": "SCENARIO", "include": ["Actual"] }, { "field": "PERIOD:year", "include": ["2026"] },
                 { "field": "KIND", "include": ["headcount"] }],
      "format": { "decimals": 1 } },
    { "id": "ord", "field": "LINE_SORT", "aggregate": "min" }
  ],
  "values": ["balance", "fte"],
  "totals": { "grandTotalLabel": "Net assets · total FTE", "rowTotal": true, "rowTotalLabel": "H1 2026" }
}
```

`closingBalance` takes, for every account (the non-time row and column keys of the layout), its records at the latest
`PERIOD` it has in the cell, and adds accounts. `SIGN` −1 on Payables makes the grand total net assets. Q1 is collapsed,
so its single column is the quarter (= the March balance).

### Result

| Section / Line | Q1 2026 | Apr | May | Jun | Q2 2026 Total | H1 2026 |
|---|---:|---:|---:|---:|---:|---:|
| **Assets** | **$310.0** | **$320.0** | **$330.0** | **$340.0** | **$340.0** | **$340.0** |
| &nbsp;&nbsp;Cash | $230.0 | $240.0 | $250.0 | $260.0 | $260.0 | $260.0 |
| &nbsp;&nbsp;Receivables | $80.0 | $80.0 | $80.0 | $80.0 | $80.0 | $80.0 |
| **Liabilities** | **($66.0)** | **($68.0)** | **($70.0)** | **($72.0)** | **($72.0)** | **($72.0)** |
| &nbsp;&nbsp;Payables | ($66.0) | ($68.0) | ($70.0) | ($72.0) | ($72.0) | ($72.0) |
| **Net assets** | **$244.0** | **$252.0** | **$260.0** | **$268.0** | **$268.0** | **$268.0** |

With `aggregate: "sum"` Q1 cash would read $660.0 (Jan + Feb + Mar); with `last` it depends on record order.

### Notes and limits

- **Sparse accounts.** The latest period is per account in the cell: an account without a March record counts with its
  February balance in Q1, and is empty in the March column. If a missing month means "zero balance", send the zero.
- **Accounts must be in the layout** to be carried forward separately: with only `SECTION` in the rows, a section takes
  the records at its own latest period. Keep `LINE` (account) as the innermost row level and collapse it with
  `expanded` if needed.
- `openingBalance` takes the earliest period (an opening-balance column next to the closing one).
- A movement / cash-flow view is not derived: send movements as flow lines (`sum`).

## Headcount

Average FTE over time: the average of the monthly totals, not of the records.

Same spec and golden as the balance sheet (`fte` measure). Test: `src/core/pivot/fpa.test.ts` ("recipe: headcount").

| Line | Q1 2026 | Jun | Q2 2026 Total | H1 2026 |
|---|---:|---:|---:|---:|
| **Headcount** | **44.0** | **48.0** | **47.0** | **45.5** |
| &nbsp;&nbsp;Engineering | 32.0 | 36.0 | 35.0 | 33.5 |
| &nbsp;&nbsp;Sales | 12.0 | 12.0 | 12.0 | 12.0 |

Engineering Q1 = (31 + 32 + 33) / 3. `averageOverTime` divides the cell's sum by the number of distinct `timeField` keys
with a value in it, so the department average is the average of its monthly totals (44 = 32 + 12, not the average
team). Months without data in a cell are not counted; use `timeField: "PERIOD:yearMonth"` when the data is daily and
the average should run over months.

## Analyst workbook (XLSX)

`format: "xlsx"` (and the Python openpyxl writer from `format: "sheet"`) writes what a recipient needs to work with the
report: title, subtitle, units and the filters above the table; frozen panes; a row outline whose groups collapse and
expand, with groups collapsed in the app written hidden instead of dropped; compact labels indented by alignment;
tabular labels repeated on every row (no merges, so AutoFilter and sort work; `options.xlsx.rowLabels: "merge"` for the
printed look); landscape, fit to width, header rows repeated on every page, page numbers. With `"profile": "statement"`
totals are bold with a rule above and a double rule under the grand total.

```json
{ "format": "xlsx", "options": { "profile": "statement", "xlsx": { "subtotalFormulas": true } } }
```

`subtotalFormulas` writes `SUBTOTAL(9, …)` on group, subtotal and grand-total cells of plain `sum` / `count` measures
(cached values kept in the Node workbook). Off by default: the Python writer cannot cache results (cells show values
only after Excel recalculates), and an analyst who deletes rows changes the totals. Details:
[Workbooks](./pivot-headless.md#workbooks-xlsx-and-the-sheet-shape).
