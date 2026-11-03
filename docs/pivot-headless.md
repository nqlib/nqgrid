# Pivot core & headless export

`@nqlib/nqgrid/core` is the **framework-free** half of nqgrid: no React, TanStack or DOM.
The same code builds a pivot in the browser, a Tauri webview, or a Node export process,
so the grid a user sees and the PDF/XLSX a backend emails are computed identically.

```
            PivotSpec JSON (dims, measures, formats, heat, charts, expanded state)
                 │                                   ▲
   Backend / MCP agent ─── data rows ───┐            │ "Export what I see"
   (query, clean, aggregate             ▼            │ (send the spec back)
    to leaf grain)            buildPivotModel() ─────┤
                                     │ PivotModel (plain JSON)
                  ┌──────────────────┼────────────────────┐
  React renderer (app, /pivot)  static HTML → PDF   pivotModelToSheet() → XLSX / CSV
```

**Division of labour**

| Layer | Owns |
|-------|------|
| Backend (e.g. Python MCP) | Querying, cleaning, heavy aggregation to the leaf grain (e.g. Department × Line × Month), agent logic, email. |
| `@nqlib/nqgrid/core` | Grouping, subtotals, "show values as", heat levels, header series, KPIs, row spans, number formatting, sheet layout. |
| Renderers | Pixels only. React (interactive), static HTML (PDF), XLSX writers. |

Do **not** re-implement pivot logic in another language — numbers and formatting would drift
between the app and the emailed report.

## Quick start

```ts
import { buildPivotModel, togglePivotGroup, pivotModelToSheet } from "@nqlib/nqgrid/core";

const model = buildPivotModel(spec, rows);           // validates the spec first
model.rows;          // visible body rows (group / leaf / grandTotal) with formatted cells
model.spans[0];      // tabular row spans for the outer dimension (e.g. Department)
model.headerSeries;  // per-column values (+ breakdown) for header bar charts
model.kpis;          // grand-level KPIs; group rows carry their own `kpis`

const next = togglePivotGroup(spec, model, ["Camp"]); // view state lives in the spec
const sheet = pivotModelToSheet(model);               // rectangular cells + merges + numFmt
```

The playground-style fixture lives in `@nqlib/nqgrid/fixtures`:
`planningPivotSpec` + `generatePlanningPivotRows()`.

## Spec highlights (v1)

- `rows` — row hierarchy, outermost first; every level except the last is a collapsible group.
  `attributes` copies fields (e.g. `owner`) onto that level's rows.
- `columns` — optional column dimension. `order` + `keepEmpty` keep fiscal months stable.
- `measures` — `aggregate`: `sum | avg | min | max | count | first | last`,
  `{ type: "weightedAvg", weightField }`, `{ type: "ratio", numeratorField, denominatorField, offset }`
  (`offset: -1` = growth), or `{ type: "custom", name }` resolved from `options.aggregators`.
- `showAs` / `groupShowAs` — Excel-style `percentOfColumnTotal`, `percentOfParentRow`,
  `percentOfRowTotal`, `percentOfGrandTotal`. Cells keep both `raw` and the displayed `value`.
- `values` — measure ids shown as grid columns; other measures can still feed KPIs/charts.
- `heat` — discrete levels (default 9) by `scope`: `all`, `column`, `row`, or `group` (siblings).
  Levels — not colors — cross the wire; each renderer maps them to its palette
  (e.g. `--nqg-heat-0 … --nqg-heat-8`).
- `headerCharts` — per-column series for the chart band above the header (`breakdown` for stacks).
- `kpis` + `kpiLevels` — KPI values (with optional `compareTo` delta) for the side panel.
- `expanded` — `"all"` (default), `"none"`, or key paths like `[["Camp"], ["Packs"]]`.
  Paths are plain strings, so any language can produce them.
- `filters`, `facets`, and per row dimension `sortBy` / `topN`: see [Filters, slicers & sorting](#filters-slicers--sorting-excel-parity).

## Filters, slicers & sorting (Excel parity)

All of it is plain JSON in the spec, so it round-trips through "export what I see", the PDF header and the
Python backend. The golden example is `contract/pivot/v1/examples/planning-filtered.*`.

```jsonc
{
  "version": 1,
  "rows": [
    { "field": "department", "label": "Department" },
    {
      "field": "line", "label": "Line",
      "sortBy": { "measure": "actual", "direction": "desc" },            // siblings by value, per parent
      "topN":   { "measure": "actual", "count": 3, "other": true }       // top 3 per department + "Other"
    }
  ],
  "columns": { "field": "month", "order": ["Nov", "Dec", "…"], "keepEmpty": true },
  "measures": [{ "id": "actual", "field": "actual" }],
  "filters": [
    { "field": "department", "include": ["Camp", "Packs"] },             // report / slicer filter
    { "field": "region", "exclude": ["Online"] },                        // any field, not only rows / columns
    { "field": "line", "match": { "op": "notContains", "value": "kids" } } // label filter
  ],
  "facets": ["department", "line"]                                       // slicer data in model.facets
}
```

**Semantics**

| Topic | Rule |
|-------|------|
| Order of operations | 1. Report and label `filters` drop records. 2. `topN` per row level, outermost first; each level ranks on what the levels above kept. 3. Aggregation. 4. Sibling ordering. |
| Totals | Group totals, the grand total, `showAs` denominators, KPIs and header bars all reflect the filtered records (Excel's default for value filters too). Keys excluded by Top N leave every total, unless `other: true` folds them into one "Other" row, which keeps totals complete. |
| Matching | Keys compare as strings (`null` → `""`, `2024` → `"2024"`). `include` keeps only the listed keys (`include: []` keeps nothing), `exclude` drops keys, `match` tests the key with `contains`, `notContains`, `beginsWith`, `endsWith`, `equals` or `notEquals`, case-insensitive unless `caseSensitive`. The parts of one filter are ANDed, and so are filters on different fields. A filter with none of the three is inactive. |
| Top N | `count` keys per parent group by `measure` (raw value, before `showAs`), using the row total or `columnKey`. `direction: "bottom"` keeps the smallest. Keys without a value rank last. Ties are cut strictly at `count` in natural order (`order` → `sort` → first seen), so Excel's "include ties" is **not** applied. The "Other" row uses the key `PIVOT_OTHER_KEY` (`"\u0000other"`, safe in `expanded` paths), the label `otherLabel` (default `Other`) and `otherCount`, and always sorts last. |
| Sort precedence | `sortBy` (value) > `order` > `sort` (label) > first seen. The lower rules only break ties. Keys without a value sort last in both directions. Value sorting is per parent group and for row dimensions only. The column dimension supports `order` / `sort` / `keepEmpty`, and `validatePivotSpec` rejects `columns.sortBy` / `columns.topN`. |
| Facets | For each field in `facets`, every distinct key in the data gets: `count` (records that pass the filters on **other** fields, i.e. cross-filtered like an Excel slicer), `total` (unfiltered), `hasData` (`count > 0`; slicers grey the rest out) and `selected` (passes the field's own filter, or every key when the field is unfiltered). Values follow dimension order for row / column fields and ascending order otherwise. Top N does not affect facets. |
| Model | Present only when used, so existing models stay identical: `filters` (`{ field, label, kind: "items" \| "label" \| "value", text }`, e.g. `Department = Camp, Packs`), `recordCount: { total, matched }`, `facets`, `rowDimensions[i].sort / sortBy / topN / filtered` (for header indicators) and `PivotBodyRow.otherCount`. |

**Pure spec helpers** (`@nqlib/nqgrid/core`) return a new spec. Rebuild the model afterwards.

```ts
import {
  setPivotFilter, togglePivotFilterValue, setPivotFilterValues, clearPivotFilter, clearPivotFilters,
  setPivotSort, setPivotTopN, pivotFilterForSelection,
} from "@nqlib/nqgrid/core";

spec = togglePivotFilterValue(spec, "department", "Camp", { mode: "only" }); // slicer click → include ["Camp"]
spec = togglePivotFilterValue(spec, "department", "Packs");                  // Ctrl-click → include ["Camp","Packs"]
spec = togglePivotFilterValue(spec, "line", "Kids");                         // from "all" → exclude ["Kids"]
spec = setPivotFilterValues(spec, "line", allKeys, checkedKeys);             // checkbox list (shorter of include/exclude)
spec = setPivotFilter(spec, { field: "line", match: { op: "contains", value: "pack" } }); // replaces the field's filters
spec = setPivotSort(spec, "line", { by: "value", measure: "actual", direction: "desc" }); // or { by: "label", direction }
spec = setPivotTopN(spec, "line", { measure: "actual", count: 5, other: true });         // null removes
spec = clearPivotFilter(spec, "line"); spec = clearPivotFilters(spec);       // the `filters` key is dropped when empty
```

Deselecting the last key of an include list, or the last excluded key, clears the filter, like an Excel slicer
returning to "all". `describePivotFilters(spec)` gives the printable summary without building a model.

**React components** (`@nqlib/nqgrid/pivot`) are plain props, class slots and no portals. They also work without
`@nqlib/nqui`.

```tsx
const grid = usePivotGrid({ ...spec, facets: ["department", "line"] }, rows);
// Keep it stable (PivotTable is memoized).
const renderDimensionHeader = useCallback(
  (ctx: PivotDimensionHeaderContext) => (
    <>
      {ctx.label}
      {ctx.indicator}
      {ctx.dimension.field === "line" ? (
        <PivotHeaderMenu label="Filter Line" active={ctx.status.filtered}>
          {(close) => <PivotFilterMenu {...pivotFilterMenuProps(grid, "line")} onClose={close} />}
        </PivotHeaderMenu>
      ) : null}
    </>
  ),
  [grid],
);

<PivotSlicer {...pivotSlicerProps(grid, "department")} columns={2} />   {/* click / Ctrl-click / clear */}
<PivotTable model={grid.model} onToggleGroup={grid.toggleGroup} renderDimensionHeader={renderDimensionHeader} />
```

| Export | Purpose |
|--------|---------|
| `PivotSlicer` | Excel-style slicer for one `PivotFacet`: grid of value buttons (`columns`), selected values highlighted (all of them while unfiltered), items with no data greyed out and listed last (`noDataLast`, `hideItemsWithNoData`), clear button, optional multi-select toggle (`multiSelect` / `onMultiSelectChange`), `showCounts`, `renderItem`, `classNames` slots. ARIA: `group` + multi-select `listbox` of `option` buttons with one roving tab stop. Keys: arrows / Home / End move, Enter selects only, Space toggles, Delete or Alt+C clears. Stateless. |
| `PivotFilterMenu` | Header filter panel: sort (A→Z, Z→A, by a measure, largest / smallest), Top / Bottom N with "Other", searchable checkbox list with tri-state "Select all" and counts. The list and Top N are drafts until Apply, and sort applies immediately. Callbacks: `onApplyValues`, `onTopNChange`, `onSortChange`, `onClear`, `onClose`. Native inputs, `labels` for i18n, `classNames` slots. Put it in any popover (the playground uses the nqui `Popover`). |
| `PivotHeaderMenu` | Minimal inline disclosure (trigger plus absolutely positioned `role="dialog"` panel, no portal, no effects). Escape or focus leaving the menu closes it. |
| `PivotHeaderIndicator`, `pivotDimensionStatus`, `pivotAriaSort` | Sort arrow and funnel with an accessible description ("Sorted by Actual, descending · Line: Top 3 by Actual"). `PivotTable` shows them on dimension headers (also in static mode) and sets `aria-sort`. |
| `pivotSlicerProps(grid, field)`, `pivotFilterMenuProps(grid, field)`, `pivotFacetOf(model, field)` | Bind the components to `usePivotGrid`. The field must be listed in `spec.facets`. |
| `usePivotGrid` actions | `setFilter`, `setFilterValues`, `toggleFilterValue(field, key, mode)`, `clearFilter`, `clearFilters`, `setSort`, `setTopN`, which are also `reducePivotGridSpec` actions. Several actions dispatched before the next render chain on each other. |

**Exports.** `renderPivotHtml` prints "Filters: Department = Camp, Packs · Line: Top 3 by Actual, rest as Other"
under the title (`locale.filters` renames the label). `PivotSheet.filters` carries the same lines. The
`nqgrid-export` XLSX lists them under the KPIs and on the hidden `Spec` sheet.

**Performance.** Filters and facets run in one pass over column-encoded records, and the aggregated cube is reused
for view-only changes (expanded state, heat, labels, formats). `usePivotGrid` does this automatically. Headless
callers use `createPivotModelBuilder()`. Numbers are in [pivot-performance.md](./pivot-performance.md).

### Formatting is deterministic

`formatPivotNumber` does not use `Intl`. WebKit (macOS Tauri), WebView2 (Windows Tauri) and Node
can disagree on compact notation; core always prints `$302k`, `$4.76M`, `+5.5%` the same way.
`toExcelNumFmt` gives the matching Excel format so XLSX cells stay numeric.

## Cross-language contract

Everything a non-JS producer needs is in [`contract/pivot/v1`](../contract/pivot/v1):

| File | Purpose |
|------|---------|
| `pivot-spec.schema.json` | JSON Schema (2020-12) for `PivotSpec`. Generate Pydantic models with `datamodel-codegen --input pivot-spec.schema.json --input-file-type jsonschema`. |
| `examples/planning.spec.json` + `planning.rows.json` | Golden inputs. |
| `examples/planning.model.json` | Expected `buildPivotModel` output. |
| `examples/planning.sheet.json` | Expected `pivotModelToSheet` output (what an XLSX writer consumes). |
| `examples/planning.html` | Expected `renderPivotHtml` output (`generatedAt: "2026-01-15 09:30 UTC"`), i.e. what the PDF prints. |
| `examples/planning-filtered.{spec,model,sheet}.json` + `.html` | Same rows with filters, a label filter, Top 3 + "Other", sort by value and facets. |
| `export-request.schema.json` + `examples/planning.request.json` | The export request `{ spec, rows \| dataset, format?, options? }` (CLI / `POST /export`, and app → backend with a `dataset` reference). TS: `buildPivotExportRequest`, `PIVOT_EXPORT_REQUEST_JSON_SCHEMA`; Python: [`integrations/python`](../integrations/python/README.md). |

The golden files are regenerated by `src/core/pivot/contract.test.ts` and `src/render-static/render-static.test.ts` (`pnpm test -u`);
any diff is a contract change and should bump the spec `version` if it is breaking.
`validatePivotSpec` additionally checks references the schema cannot express
(unknown measure ids in `values`, `heat`, `headerCharts`, `kpis`, `sortBy`, `topN`; duplicate measure ids and facets;
`sortBy` / `topN` only on row dimensions).

### XLSX without Node

`PivotSheet` is already spreadsheet-shaped (cells with `v` / `numFmt` / `bold` / `heat`,
`merges`, `frozenRows`, `frozenCols`), so a Python service can write `.xlsx` with openpyxl
directly from the sheet JSON. PDF still goes through the Node renderer (below) so it matches the app.

## React renderer (`@nqlib/nqgrid/pivot`)

```tsx
import { PivotTable, usePivotGrid } from "@nqlib/nqgrid/pivot";

const grid = usePivotGrid(spec, rows);              // uncontrolled; pass { onSpecChange } to own the spec
grid.toggleGroup(["Camp"]); grid.expandAll(); grid.collapseAll(); grid.setHeatScope("group");
grid.spec;                                          // view state included → POST it for "export what I see"

<div style={{ overflow: "auto", maxHeight: 640 }}>   {/* any scroll container (the playground uses nqui ScrollArea) */}
  <PivotTable model={grid.model} onToggleGroup={grid.toggleGroup} />
</div>

renderToStaticMarkup(<PivotTable model={model} mode="static" />);   // same layout, no buttons / sticky
```

| Export | Purpose |
|--------|---------|
| `usePivotGrid(spec, rows, options)` | Spec state (controlled via `onSpecChange`, otherwise uncontrolled) + memoized model (`createPivotModelBuilder`: view-only changes reuse the aggregation); actions `toggleGroup`, `expandAll`, `collapseAll`, `setHeatScope`, filter / sort / Top N actions, `setSpec`, `dispatch`. The pure transition is `reducePivotGridSpec(spec, model, action)`. |
| `PivotTable` | Semantic `<table>` (memoized): header chart band, row-dimension columns, outer-dimension span cell with `PivotKpiPanel`, heat cells, sort / filter indicators. Props: `mode`, widths, `headerChart`, `headerSummary`, `kpiHeadlineId`, `kpiCaptionAttribute`, `renderSpanCell` (KPI side-panel slot), `renderDimensionHeader` (filter-menu slot). |
| `PivotHeaderChartBand`, `PivotHeaderBar`, `PivotHeaderSummary` | Inline-SVG header bars (stacked by top-level group when `headerCharts.breakdown`), as a `<thead>` row so bars align with their columns. |
| `PivotKpiPanel`, `PivotKpiDelta` | Group KPIs: signed headline, label/value rows, "vs Plan" deltas (`PivotKpiValue.compareLabel`), owner caption. |
| `pivotHeatCellProps(cell, levels)` | `nqg-heat-N` class, `data-heat` and `var(--nqg-heat-N, …)` background for your own cells. |
| `pivotModelToTanstack(model)` | `{ columns, data, columnPinning, getRowId }` for `useReactTable` (`meta.pivot` on each column). |
| `pivotDimensionSlots`, `pivotBarSegments`, `pivotTableGeometry`, … | The pure render math, reusable by the static renderer. |

**Design choices**

- **Spans are real `rowSpan`s.** Each outer-dimension span from `model.spans[0]` is one `<th rowSpan>`.
  It is pinned with `position: sticky; left` like the other dimension cells (verified in Chromium;
  sticky table cells are also supported by current WebKit and Gecko), and in interactive mode its content is
  `position: sticky; top: <header height>` so the KPI panel stays under the header while that
  group's rows scroll by. The same markup prints correctly (static mode drops the sticky styles),
  so the PDF path needs no overlay layer.
- **No effects, no measurement.** Components are plain functions of the model: fixed column widths
  (`table-layout: fixed`) give the sticky offsets and header-bar geometry, so there is no
  `useLayoutEffect` / `ResizeObserver`. `mode="static"` additionally drops buttons and sticky classes.
- **Inline geometry, tokenized chrome.** Widths, offsets, bar paths and data colors are inline styles;
  surfaces and typography are class tokens in `@nqlib/nqgrid/styles` (`pivot*Class`). Each token starts with a
  stable semantic class (`nqg-pivot`, `nqg-pivot-cell`, `nqg-pivot-kpi`, …) that the static stylesheet targets. Colors resolve via
  `--nqg-heat-0 … --nqg-heat-8` (default: `--nqg-heat-color` mixed over the surface, so one ramp works in
  light and dark) and `--nqg-series-0 … --nqg-series-7` (`pivotThemeVars("dark")` for dark steps).
- No `@nqlib/nqui` dependency — the playground's "Planning pivot" demo adds nqui controls (Select, Button, ScrollArea) around it.

## Static HTML (`@nqlib/nqgrid/render-static`)

```ts
import { renderPivotHtml, renderPivotHtmlFromSpec, PIVOT_STATIC_CSS } from "@nqlib/nqgrid/render-static";

const html = renderPivotHtml(model, {
  theme: "light",                                   // or "dark"
  page: { size: "A4", orientation: "landscape", margins: { top: 16, right: 10, bottom: 14, left: 10 } }, // mm
  title: "FY26 Sales Plan", subtitle: "Actuals",    // default: model.title / model.subtitle
  generatedAt: "2026-10-30 09:00 UTC",              // passed in (string or Date) → byte-identical output
  maxColumnsPerPage: 6,                             // default: fit at minScale (0.7), else balanced chunks
  locale: { lang: "de", continued: "(Forts.)" },
  kpiPanel: true,
});
const same = renderPivotHtmlFromSpec(spec, rows, options);   // validates + buildPivotModel
```

A complete document: `renderToStaticMarkup` of `PivotTable` in static mode plus the inlined, hand-authored
`PIVOT_STATIC_CSS` (light on `:root`, dark under `:root[data-theme="dark"]` / `.dark`, including the dark series steps
and solid heat fills). No scripts, fonts, links or URLs; only the semantic `nqg-*` classes are kept (no Tailwind build).
The golden output is `contract/pivot/v1/examples/planning.html`.

**Paging**

| Concern | Behaviour |
|---------|-----------|
| Page box | `@page { size; margin }` from `page` (A4 / A3 / Letter / Legal / Tabloid, landscape default); `@page` background follows the theme so dark PDFs have no white margins. |
| Width | Print geometry (`[184, 152]` dimension columns, 76 px values). If the table is wider than the page it is zoomed down (`zoom`, ≥ `minScale` 0.7) — 12 months fit A4/Letter landscape. |
| Column paging | Beyond that (or with `maxColumnsPerPage`), value columns split into **balanced chunks** that never split a top-level header (12 at 5/page → 4 + 4 + 4). Each chunk is its own table starting on a new page, repeats the dimension columns and the full-year band summary, keeps one header-bar scale, and is titled "… (cont.)" with "Month May – Oct · Columns 7–12 of 12". |
| Rows | `<thead>` (header chart band + column headers) repeats on every page; each top-level group is its own `<tbody>` with `break-inside: avoid` (a group taller than a page still breaks). |
| Tall KPI panels | When a department's KPI panel is taller than its rows (`pivotKpiPanelHeight` vs `rowSpan × rowHeight`), static mode adds a blank filler row covered by the span cell, so data rows keep their height. |

Pure helpers: `pivotStaticLayout`, `resolvePivotStaticPage`, `pivotColumnChunks`, `slicePivotModelColumns`,
`pivotColumnsPerPage`, `pivotHeatFillHex` / `pivotHeatLevelFillHex` (also used for XLSX fills).

## Export CLI & service (`packages/nqgrid-export`)

`@nqlib/nqgrid-export` (bin `nqgrid-export`) turns `{ spec, rows, options? }` into PDF (Playwright Chromium:
`setContent` + `page.pdf`, running header with the title and "Page X of Y" footer), XLSX (exceljs from
`pivotModelToSheet`: values + numFmt, merges, frozen panes, bold, heat fills, widths, `KPIs` sheet, hidden `Spec`
sheet), HTML, or the model / sheet JSON. Full reference: [`packages/nqgrid-export/README.md`](../packages/nqgrid-export/README.md).

```bash
nqgrid-export --input req.json --format pdf --out report.pdf          # or --input - / --out -
nqgrid-export --spec spec.json --rows rows.json --out report.xlsx     # format from the extension
nqgrid-export serve --port 8787                                       # 127.0.0.1, one warm Chromium
```

- **Validation** — `validatePivotSpec` plus request/option checks; errors print as JSON on stderr.
  Exit `2` = invalid input, `1` = internal error.
- **Serve mode** — `GET /healthz` → `{ ok, version, browser, formats }`; `POST /export?format=pdf|xlsx|html|model|sheet`
  with the request JSON → the file (`Content-Type`, `Content-Disposition: attachment; filename="<spec.id>.<ext>"`).
  Errors `{ error: { code, message, details? } }` with 400 / 404 / 405 / 413 (body cap, default 10 MiB) / 415 / 500.
  PDFs render in isolated contexts with JavaScript off and network blocked; `--concurrency` caps parallel PDFs.
- **Node API** — `exportPivot({ spec, rows, format, options })` → `Uint8Array` (pdf, xlsx) or `string`;
  `createPivotExporter()` keeps a browser warm; `startPivotExportServer()`.
- **Playwright** is an optional peer resolved at runtime (package, cwd or `NODE_PATH`); `NQGRID_CHROMIUM_PATH`
  overrides the binary. XLSX / HTML / JSON never start a browser.
- **Docker** — `docker build -f packages/nqgrid-export/Dockerfile -t nqgrid-export .` (repo root context) on
  `mcr.microsoft.com/playwright:v1.63.0-noble` (version pinned to the `playwright` package it installs), with
  `fonts-inter`, user `pwuser`, a `/healthz` health check, and `serve --host 0.0.0.0` as the default command
  (`docker run -p 127.0.0.1:8787:8787 nqgrid-export`; pass CLI flags instead for one-shot exports).

Calling it from a Python backend ([`integrations/python`](../integrations/python/README.md)):

```python
from nqgrid_export import NqgridExportClient, NqgridInvalidInput

client = NqgridExportClient(EXPORT_URL, timeout=60)
try:
    pdf = client.export(spec, rows, format="pdf", options={"generatedAt": stamp})
except NqgridInvalidInput as e:   # HTTP 400 / exit 2: e.details lists every spec / option problem
    ...
```

Tests: `pnpm test` (library, incl. the HTML golden), `pnpm -r test` (packages: XLSX read-back against
`planning.sheet.json`, PDF smoke tests that skip without Chromium, spawned-CLI exit codes, serve mode), or `pnpm test:all`.

## Roadmap

1. **Phase 0 — done.** Framework-free modules moved to `src/core` (re-exported from `engine` /
   `advanced`, no import changes for consumers). Guarded by ESLint `no-restricted-imports` and
   `src/core/purity.test.ts`.
2. **Phase 1 — done.** Pivot core, JSON Schema, golden contract fixtures, sheet export shape.
3. **Phase 2 — done.** `@nqlib/nqgrid/pivot`: `usePivotGrid(spec, rows)` + TanStack adapter; CSS-sticky
   pinned dimension columns with real `rowSpan` span cells; heat CSS variables; header chart band;
   KPI side-panel slot; static render mode; playground "Planning pivot" demo.
4. **Phase 3 — done.** `@nqlib/nqgrid/render-static` (`renderPivotHtml(model, { theme, page, … })`: self-contained
   HTML + CSS, inline SVG header bars, landscape pages, repeated headers, `break-inside: avoid` per group, balanced
   column chunks, tall-KPI filler rows) and `packages/nqgrid-export` (CLI, Node API and HTTP serve mode; Playwright
   Chromium for PDF, exceljs for XLSX; Dockerfile).
5. **Phase 4 — done.** Backend integration ([docs/integrations/secolab.md](./integrations/secolab.md)):
   `contract/pivot/v1/export-request.schema.json` + `buildPivotExportRequest` (core) and
   `pivotExportRequestFromGrid(grid, { format, includeRows })` (`/pivot`, default: spec + `dataset` reference);
   the Python package [`integrations/python`](../integrations/python/README.md) (`nqgrid-export-client`: sync / async HTTP
   client, subprocess exporter, typed errors, Pydantic models generated from the schemas, openpyxl writer, email,
   and an MCP server with `export_pivot_report` / `describe_pivot_spec`); the playground Export button (request JSON,
   optional PDF / XLSX via `VITE_NQGRID_EXPORT_URL`); CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).
   Contract tests run on both sides against `contract/pivot/v1/examples`.
6. **Excel parity, step 1 — done.** Report / slicer / label filters, cross-filtered facets, sort by value and
   Top / Bottom N (with "Other") in the spec; `PivotSlicer`, `PivotFilterMenu`, `PivotHeaderMenu` and header
   indicators; filters in the PDF header and XLSX; a faster engine with an aggregate / view split
   ([pivot-performance.md](./pivot-performance.md)). Next: field list + drag-and-drop (step 2).
