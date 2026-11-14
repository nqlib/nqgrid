# Pivot recipes

Complete, tested specs for reports that need more than one feature working together. Each recipe shows the data
shape, the full spec, what every piece does, the result, and what the engine cannot do. The figures in each result
table are asserted by a test (named per recipe), so the doc cannot drift from the engine.

- [Financial statement (P&L / income statement)](#financial-statement-pl--income-statement)

## Financial statement (P&L / income statement)

Rows **section → line** in statement order, months as columns, signed amounts, a **Gross margin** row after the
gross-margin lines, **Operating income** at the bottom and a **% of Revenue** column.

Golden example: `contract/pivot/v1/examples/planning-statement.*` (spec, rows, model, sheet, HTML). Fixture:
`generateStatementPivotRows()` / `statementPivotSpec` from `@nqlib/nqgrid/fixtures`. Test:
`src/core/pivot/statement.test.ts` ("financial statement recipe"). Playground: `?pivot=statement`.

### Data shape

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

### Spec

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

### What each piece does

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

### Result

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

assert validate_pivot_spec(spec) == []                       # same checks and messages as the engine
pdf = NqgridExportClient("http://127.0.0.1:8787").export(spec, rows, format="pdf")
```

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
| A formula row over keys (Excel **calculated item**), e.g. a "Gross margin" line = Revenue − COGS that is not a subtotal, or "EBITDA" between two sections | Not supported | Arrange sections so that every total you need is a **section subtotal** (`subtotal: "end"`) or the **grand total**. Rows that are neither must come from the data (add them as records) or from a second report. |
| Cascading totals (Gross margin → Operating income → Net income) as rows | Partly | Only one subtotal per section plus the grand total. A second measure on the amount with `"groupShowAs": "runningTotal", "showAsBase": { "field": "SECTION" }` shows the **cumulative** total on each section's subtotal row (for the year: 7,440 on Gross margin, then 4,110 — the operating income — on Operating expenses), in its own column; leaf rows show their plain amounts. |
| A different subtotal label per section ("Gross margin", but "Total operating expenses") | Not supported | `subtotalLabel` is per **level** (all sections). Name the sections in the data the way the subtotal rows should read. |
| Hide the section heading row above the lines (with `subtotal: "end"`) | Not supported | The heading row stays (blank cells; it is the row users expand / collapse). Use `subtotal: "start"` (the default) if the totals may sit on the heading row instead. |
| "% of Revenue" in the total column only | Not supported | A measure appears in every column. `valuesIndex: 0` groups the percentage columns after the amounts; or export a second spec without columns. |
| Display costs as positive numbers but still subtract them in totals | Not supported | Totals add what is displayed. Show signed figures (with `negative: "parentheses"`), or keep a separate unsigned report. |
| Sign as a field-list setting | Spec only | The field list has no sign control; set `signField` in the spec (or with `setPivotMeasureSignField(spec, id, field)` / `grid.setMeasureSignField`). |
| `signField` on `count`, `distinctCount`, custom aggregates or calculated measures | Rejected (`validatePivotSpec`) | Counts have no values to sign; a calculated measure uses the signs of the measures it references. Ratios sign the numerator only. |
| Custom aggregators (functions) from Python / JSON | Not supported | JavaScript only (`BuildPivotModelOptions.aggregators`); nqgrid-export rejects them. |
| SQL pushdown / database-side pivoting | Not supported | The engine pivots rows in memory (browser, Node API or nqgrid-export); pre-aggregate in SQL (above). |

Notes:

- **Hidden measures** are simply measures not listed in `values`: they are computed for every row and column, can
  drive `sortBy`, `topN`, KPIs and calculated measures, and are never shown.
- `percentOf` with `scope: "all"` needs `item` and a **row** field; the base is the aggregate of every record whose
  `LINE` is `Revenue` in that column after filters (filtering Revenue out empties the column). Base 0 or missing →
  empty cell. It is a view-only change: switching it on in the app reuses the aggregated cube.
- Drill-through (`pivotDrillThrough`) returns the raw records (unsigned `AMOUNT` and its `SIGN`) and lists `SIGN` in
  its suggested fields.
