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
- `columns` — optional column dimension, or a list of them (Year → Quarter → Month), with subtotal columns per group,
  a grand total column and collapsible column groups (`columnsExpanded`): see
  [Several column fields](#several-column-fields-excel-parity-step-3). `order` + `keepEmpty` keep fiscal months stable.
- Date fields group by naming a derived field (`orderDate:year`, `orderDate:quarter`, …): see
  [Date grouping](#date-grouping-excel-parity-step-3).
- `measures` — `aggregate`: `sum | avg | min | max | count | distinctCount | first | last` (`first` / `last` are the
  first / last record **in input order** with a value; a group or total takes one record, not the sum of each
  account's last value, so they are not opening / closing balances),
  `{ type: "weightedAvg", weightField }`, `{ type: "ratio", numeratorField, denominatorField, offset }`
  (`offset: -1` = growth), the semi-additive `{ type: "closingBalance" | "openingBalance" | "averageOverTime", timeField }`
  (see [Planning](#planning-measure-filters-and-semi-additive-aggregates)), or `{ type: "custom", name }` resolved
  from `options.aggregators`. `filter` restricts the records one measure aggregates (Actual / Budget / prior year
  from one long table, see [Planning](#planning-measure-filters-and-semi-additive-aggregates)). Calculated measures:
  `calculate: "actual / plan - 1"` (see [step 4](#calculated-measures-show-values-as-subtotals-distinct-count-drill-through-excel-parity-step-4)).
  `signField` multiplies each record's value by a sign column before aggregation (see
  [Financial statements](#financial-statements)).
- `showAs` / `groupShowAs` — Excel-style `percentOfColumnTotal`, `percentOfParentRow`, `percentOfParentColumn`,
  `percentOfRowTotal`, `percentOfGrandTotal`, and along a field (`showAsBase`) `percentOf`, `differenceFrom`,
  `percentDifferenceFrom`, `runningTotal`, `percentRunningTotal`, `rankAscending`, `rankDescending`
  (`showAsBase.scope: "all"` compares every row with one base item). Cells keep both `raw` and the displayed `value`.
- `rows[i].subtotal` — subtotals at the top (default), bottom (`end`: subtotal rows) or off, labelled per level with
  `subtotalLabel` or per group with `subtotalLabels`; `pivotDrillThrough` lists the records behind a cell.
- `rows[i].calculatedItems` — Excel calculated items: formula rows over keys of the field (Gross margin =
  `[Revenue] + [Cost of sales]`, EBITDA over an item and a section), see
  [Calculated items](#calculated-items-rowsicalculateditems). `rows[i].itemFormats` sets a number format per key.
- `values` — measure ids shown as grid columns; other measures can still feed KPIs/charts.
- `heat` — discrete levels (default 9) by `scope`: `all`, `column` (each leaf column), `row`, or `group` (siblings).
  Levels — not colors — cross the wire; each renderer maps them to its palette
  (e.g. `--nqg-heat-0 … --nqg-heat-8`).
- `headerCharts` — per-column series for the chart band above the header (`breakdown` for stacks).
- `kpis` + `kpiLevels` — KPI values (with optional `compareTo` delta) for the side panel.
- `expanded` — `"all"` (default), `"none"`, or key paths like `[["Camp"], ["Packs"]]`.
  Paths are plain strings, so any language can produce them.
- `filters`, `facets`, and per row dimension `sortBy` / `topN`: see [Filters, slicers & sorting](#filters-slicers--sorting-excel-parity).
- `fields`, `fieldLabels` (field catalogue, metadata only) and `valuesIndex` (Σ Values position): see
  [Field list & drag-and-drop](#field-list--drag-and-drop-excel-parity-step-2).
- `format.scale` (display in thousands / millions) and `units` (the unit note printed under the title): see
  [Scaling and units](#scaling-formatscale-and-units).

Specs are validated strictly (unknown keys, bad enums and the referential checks), and every model can carry
`diagnostics` for data problems: see [Validation and diagnostics](#validation-and-diagnostics).

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
| `PivotHeaderIndicator`, `pivotDimensionStatus`, `pivotAriaSort` | Sort arrow and funnel with an accessible description ("Sorted by Actual, descending · Line: Top 3 by Actual"). `PivotTable` shows them on dimension headers in interactive mode (static / print output leaves them out unless `headerIndicators`) and always sets `aria-sort`. |
| `pivotSlicerProps(grid, field)`, `pivotFilterMenuProps(grid, field)`, `pivotFacetOf(model, field)` | Bind the components to `usePivotGrid`. The field must be listed in `spec.facets`. |
| `usePivotGrid` actions | `setFilter`, `setFilterValues`, `toggleFilterValue(field, key, mode)`, `clearFilter`, `clearFilters`, `setSort`, `setTopN`, which are also `reducePivotGridSpec` actions. Several actions dispatched before the next render chain on each other. |

**Exports.** `renderPivotHtml` prints "Filters: Department = Camp, Packs · Line: Top 3 by Actual, rest as Other"
under the title (`locale.filters` renames the label). `PivotSheet.filters` carries the same lines. The
XLSX writers print them as a `Filters: …` line above the table on the report sheet (`PivotSheet.preamble`), and the
`nqgrid-export` workbook also lists them on the hidden `Spec` sheet and under the KPIs on the `KPIs` sheet when the
spec has KPIs.

**Performance.** Filters and facets run in one pass over column-encoded records, and the aggregated cube is reused
for view-only changes (expanded state, heat, labels, formats). `usePivotGrid` does this automatically. Headless
callers use `createPivotModelBuilder()`. Numbers are in [pivot-performance.md](./pivot-performance.md).

## Field list & drag-and-drop (Excel parity, step 2)

Excel's PivotTable field list: a searchable field checklist and four areas (Filters, Columns, Rows, Values). Layout
changes are pure spec transforms in core, so a backend, an agent and the React panel rearrange a pivot the same way.
The golden example is `contract/pivot/v1/examples/planning-fields.*` (rows from
`generatePlanningPivotRows(7, { extraFields: true })`, which adds `region`, `channel` and `units`).

```jsonc
{
  "rows": [{ "field": "department" }, { "field": "channel", "label": "Channel" }, { "field": "line" }],
  "columns": { "field": "month", "order": ["Nov", "…"], "keepEmpty": true },
  "measures": [{ "id": "actual", "field": "actual" }, { "id": "units", "field": "units", "label": "Units" }],
  "values": ["actual", "units"],
  "valuesIndex": 0,                                          // Σ Values before Month: Actual › Nov…Oct, Units › Nov…Oct
  "filters": [{ "field": "region", "label": "Region", "exclude": ["West"] }],   // Region sits in the Filters area
  "fields": [                                                // optional catalogue (else inferred from the rows)
    { "field": "region", "label": "Region", "type": "dimension" },
    { "field": "month", "label": "Month", "type": "date", "areas": ["rows", "columns", "filters"] },
    { "field": "units", "label": "Units", "type": "measure", "format": { "decimals": 0, "compact": true } }
  ],
  "fieldLabels": { "priorYear": "Prior year" }               // labels only, wins over fields[].label
}
```

**Catalogue.** `fields` entries have `field`, `label?`, `type?` (`dimension | text | date | number | measure`),
`areas?` (default: `["values"]` for measures, every area otherwise), `aggregate?` (for measures created in Values:
default `sum` for `measure` / `number`, `count` otherwise), `format?` and `description?`. They never change the model
(`pivotSpecDataKey` ignores them), except the date properties of step 3 (`source`, `dateGroup`,
`fiscalYearStartMonth`, `timeZoneOffsetMinutes`; see [Date grouping](#date-grouping-excel-parity-step-3)). Without `fields`, `inferPivotFields(rows, { sample })` reads `sample` records (default 500,
spread evenly) and classifies numbers as `measure` (or `number` for integers with ≤ 12 distinct values, e.g. a year),
`Date` / ISO-8601 strings as `date`, mostly unique strings with more than 50 values as `text`, everything else as
`dimension`. Numeric strings stay dimensions; declare serialized decimals as measures. `resolvePivotFields(spec, rows?)`
merges the catalogue with every field the spec references and fills labels (`fieldLabels` › `fields[].label` › dimension /
filter label › label of a `sum` measure › `humanizePivotField`: `priorYear` → `Prior Year`). Python mirrors the inference
(`infer_pivot_fields`, checked against `planning-fields.catalog.json`).

**Areas.** `pivotFieldListState(spec, fields)` returns the chips per area plus the checklist (`usedIn`, `checked`) and
calculated measures (no source field, e.g. ratios):

| Area | Comes from |
|------|------------|
| Rows | `spec.rows` |
| Columns | `spec.columns` (one object or a list) plus the **Σ Values** chip at `valuesIndex` when there are 2+ values |
| Values | `spec.values` (default: every measure), as measure ids |
| Filters | fields with an entry in `spec.filters` that are not row / column fields, in filter order. `{ "field": "region" }` (no include / exclude / match) is an inactive placeholder that keeps a field in the area. |

**Pure move helpers** (`@nqlib/nqgrid/core`), each returning a new spec (or the same object when refused):

```ts
import {
  movePivotField, planPivotFieldMove, canMovePivotField, reorderPivotField, removePivotField, togglePivotField,
  addPivotMeasure, setPivotMeasureAggregate, setPivotValuesPosition, swapPivotRowsColumns, ensurePivotFilterField,
  PIVOT_VALUES_FIELD,
} from "@nqlib/nqgrid/core";

const opts = { fields };                                                   // catalogue (default: resolvePivotFields(spec))
spec = movePivotField(spec, { field: "line", from: "rows", to: "columns" }, opts);   // Month swaps into Rows
spec = movePivotField(spec, { field: "region", from: "unused", to: "filters", index: 0 }, opts);
spec = addPivotMeasure(spec, { field: "units" }, opts);                    // "Units" (sum, catalogue format)
spec = setPivotMeasureAggregate(spec, "units", "avg", opts);               // label → "Average of Units"
spec = setPivotValuesPosition(spec, 0);                                    // Σ Values outermost (valuesIndex: 0)
spec = movePivotField(spec, { field: PIVOT_VALUES_FIELD, from: "columns", to: "columns", index: 2 }); // …and back
spec = reorderPivotField(spec, { area: "rows", field: "line", index: 0 }, opts);     // final position
spec = togglePivotField(spec, "channel", true, opts);                      // checkbox: default area
spec = swapPivotRowsColumns(spec);                                         // transpose button
const plan = planPivotFieldMove(spec, move, opts); // { spec, changed, reason?, displaced?, measureId? }
```

`move.field` is the record field; in Values it is the measure id, for the Σ chip `PIVOT_VALUES_FIELD`, and a calculated
measure's id when adding it from `unused`. `move.index` is the insertion point as the area is displayed (the drop
indicator), so dragging a chip below its neighbour is `index = position + 2`. `reorderPivotField` takes final positions.

**Move rules and edge cases**

| Topic | Rule |
|-------|------|
| One area per field | A field sits in at most one of Rows / Columns / Filters (plus any number of Values). Moving it from the field list (`from: "unused"`) moves it from wherever it is. |
| Column fields | Up to `PIVOT_MAX_COLUMN_FIELDS` (4) column fields (step 3; it was 1 in step 2). A field dropped into a full Columns area stays, and the **innermost** other column field **swaps** into the source area when that was Rows (same index) or Filters; from Values or the field list it **leaves** the layout and loses its filters. `plan.displaced` reports it. One column field is written as an object, several as an array, none removes the key. |
| `sortBy` / `topN` / `subtotal` | `sortBy` / `topN` travel with a row field that is reordered. They are invalid on `columns`, so they are **stripped** on the way into Columns (and do not come back); a column field's `subtotal` is stripped on the way into Rows. A row field moved to Filters drops its dimension settings. |
| Filters | Moving to Filters keeps the field's filters (they become report filters), or adds a placeholder. Moving from Filters to Rows / Columns keeps active filters and drops the placeholder. Removing a field from Rows / Columns / Filters, or moving it to Values, clears its filters (like Excel). `ensurePivotFilterField` re-adds the placeholder after a filter menu clears the filter of a Filters-area field. |
| `expanded` / `columnsExpanded` | Paths survive while the levels they span keep their fields and order and still name a group level. When structural changes drop every path, `expanded` returns to `"all"` (Excel opens new layouts expanded); `columnsExpanded` does the same (`withCleanColumnsExpanded`), or disappears below two column fields. |
| Values | Dropping a field reuses an identical hidden measure (same field and aggregate, e.g. the planning `plan` measure kept for KPIs) or creates `{ id, field, label, aggregate?, format? }` with a unique id. A field can be added twice (`units_2`). Dimensions count (`Count of Region`). Calculated measures (ratio, custom) can be added / removed but never become dimensions (`noSourceField`). |
| Measure references | A measure that leaves Values: `sortBy` / `topN` on it are dropped (Excel drops value filters on removed fields); `heat.measure` / `headerCharts.measure` repoint to the first remaining value; the measure itself is deleted unless a KPI (or a remaining sort / Top N) references it, so KPIs always stay valid. |
| Aggregates | `setPivotMeasureAggregate(spec, id, sum | count | avg | min | max | first | last)`. Auto labels follow (`Units` → `Average of Units`), custom labels stay. Switching to `count` drops the format; switching back restores the catalogue format. Calculated measures only accept `count`. |
| Σ Values | Shown in Columns with 2+ values. `valuesIndex: 0` puts measures outermost: `headerRows[0]` holds measure cells spanning the months, header bars sit under the series measure's months, row totals stay last. `valuesIndex` is dropped when it is the default, with fewer than 2 values or without a column field. Σ Values cannot leave Columns (Excel's "Σ Values in Rows" is not supported yet). |
| Transpose | `swapPivotRowsColumns` turns row fields into column fields and vice versa (`Department › Line × Month` → `Month × Department › Line`), and `expanded` / `columnsExpanded` trade places with them. With more than 4 row fields, the outer ones stay in Rows. |
| Dates | A date field dropped from the field list is grouped by default (Year → Quarter in Columns, Year → Month in Rows, Year in Filters; `plan.grouped`); see [Date grouping](#date-grouping-excel-parity-step-3). |
| Refusals | `planPivotFieldMove` never produces an invalid spec: the last row field or value cannot leave (`rowsRequired`, `valuesRequired`), catalogue `areas` are enforced (`notAllowed`), plus `notFound` and `unchanged`. Seeded property tests run 1,200 random steps (moves, toggles, aggregate changes, transposes, filters) and 400 more with a date field (Group by, column-group toggles, up to 4 column fields) through `validatePivotSpec` and the model builder. |

**React** (`@nqlib/nqgrid/pivot`):

```tsx
const grid = usePivotGrid({ ...spec, fields: catalogue }, rows);   // grid.fields, grid.facet(field), grid.moveField(…)
<PivotFieldList {...pivotFieldListProps(grid)} />                  // spec, fields, onSpecChange, getFacet, model
```

| Export | Purpose |
|--------|---------|
| `PivotFieldList` | Excel-style panel: search, field checklist (checkbox → default area: Values for numeric types, else Rows; unchecking removes the field everywhere), Filters / Columns / Rows / Values drop zones with chips, a transpose button, and "Defer layout update" (changes collect in a draft until **Update**; `deferLayout` / `defaultDeferLayout` / `onDeferLayoutChange`). Chip menu (⋯ / Shift+F10): move up / down / to another area, remove, "Summarize values by", and the field's `PivotFilterMenu` (any field, via `getFacet`), shown in flow under the areas (no portal, nothing clipped). A pure spec editor: every change goes through the core helpers and `onSpecChange`. `classNames` slots, `labels` (i18n, announcements), `renderField`, `renderChip`, `filterMenuProps`, `onMove(plan, move)`. |
| `startPivotFieldDrag`, `pivotFieldDragHandleProps`, `pivotDropZoneProps` | The dependency-free drag engine. Drop zones are DOM attributes (`data-nqg-drop-zone`, `data-nqg-drop-item`, optional `data-nqg-drop-axis="x"` / `data-nqg-drop-offset`), so any element can be a zone or a handle, e.g. the grid's dimension headers. |
| `pivotKeyboardDragStep`, `pivotKeyboardDropIndex`, `pivotDropIndex`, `pivotAutoScrollStep` | Pure keyboard-move and geometry helpers (unit-tested; reusable by custom UIs). |
| `usePivotGrid` additions | `fields` (resolved catalogue; inferred when `spec.fields` is absent, `inferFields: { sample }`), `facet(field)` (any field, computed on demand from the cached encoding: one filter pass, no aggregation), `moveField`, `reorderField`, `removeField`, `toggleField`, `addMeasure`, `setMeasureAggregate`, `setValuesPosition`, `swapRowsColumns`, also as `reducePivotGridSpec` actions. `pivotFilterMenuProps(grid, field)` now works for fields that are not in `spec.facets`. |

**Drag-and-drop design**

- **Pointer Events, no dependency.** Mouse and pen start after 4 px; touch starts after a 250 ms press (moving more
  than 8 px first scrolls the list instead), and an active touch drag cancels `touchmove` so the page does not scroll.
  The preview and insertion line are fixed-position elements appended to `document.body` for the drag only (plain DOM,
  not a React portal), with inline fallback colours so they work without Tailwind.
- **No re-render while dragging.** Pointer moves are coalesced to one hit test per animation frame
  (`elementFromPoint` → closest zone → midpoint rule); the preview, indicator and zone state
  (`data-nqg-drop-active` / `data-nqg-drop-invalid`) are updated in the DOM. `canDrop` (`canMovePivotField`) is
  memoized per target. Only the drop calls `onSpecChange`, so the pivot rebuilds once; with "Defer layout update",
  only when Update is clicked.
- **Auto-scroll.** Near the top / bottom 28 px of the scroll container under the pointer (a zone, the checklist or the
  panel), it scrolls up to 14 px per frame, faster towards the edge.
- **Cancel.** Escape, `pointercancel` or a drop outside an accepting zone cancels; the click after a drag is swallowed.
- **Keyboard (WCAG 2.1.1 / 2.5.7).** Chip labels are buttons (`aria-roledescription="draggable field"`, instructions via
  `aria-describedby`). Space / Enter picks a chip up; ↑ / ↓ move it within an area and continue into the previous / next
  one, ← / → jump areas (Filters, Columns, Rows, Values), Home / End; Space / Enter drops, Escape (or Tab / blur)
  cancels. Areas that refuse the chip are skipped. An in-flow insertion line shows the target, every step is announced
  in an `aria-live="assertive"` region ("Line: Rows, position 3 of 3"), and focus follows the chip after the drop.
  Delete removes a chip; Shift+F10 opens its menu.
- **Grid headers.** `renderDimensionHeader` can make each row header a handle (drag it onto a field-list area) and a
  one-item horizontal zone (`pivotDropZoneProps("rows", { axis: "x", offset: level })`), so dropping on another header
  reorders the row levels. Since step 3, `renderColumnHeader` does the same for column headers (`context.areaIndex` is
  the offset; measure cells drag Σ Values). The playground does both, through `usePivotLayoutDraft` so that header
  drags made while "Defer layout update" is on join the same draft and wait for Update.

**Exports.** Rearranged specs export like any other: the PDF / XLSX test in `packages/nqgrid-export` exports a spec
after a sequence of moves (swap, added measures, Σ Values outermost, a report filter, a new row field, an aggregate
change). With Σ Values outermost the static renderer names column chunks by measure ("Actual · Columns 1–12 of 24").

## Several column fields (Excel parity, step 3)

`columns` takes a list of dimensions, outermost first; a single object (the original v1 shape) stays valid forever, and a
one-element list builds the same model. The golden example is `contract/pivot/v1/examples/planning-multicol.*`.

```jsonc
{
  "rows": [{ "field": "department" }, { "field": "line" }],
  "columns": [
    { "field": "region", "order": ["North", "South", "East", "West"], "subtotal": "end" },   // "end" (default) | "start" | "none"
    { "field": "channel" }
  ],
  "measures": [
    { "id": "actual", "field": "actual" },
    { "id": "share", "field": "actual", "label": "Share of region", "showAs": "percentOfParentColumn" }
  ],
  "values": ["actual", "share"],
  "valuesIndex": 1,                       // Region › Σ Values › Channel
  "totals": { "rowTotal": true, "subtotalLabel": "{label} Total" },
  "columnsExpanded": [["North"], ["South"]]   // "all" (default) | "none" | expanded group paths
}
```

**Semantics**

| Topic | Rule |
|-------|------|
| Column tree | Keys seen in the matching records, per parent group (Excel shows only combinations with data), ordered per level by `order` → `sort` → first seen (chronological for date fields). `keepEmpty` adds a level's `order` keys under every parent, and fills date gaps (below). |
| Subtotals | Every level but the innermost gets a subtotal column per group, `subtotal: "end"` (default, Excel's position), `"start"` or `"none"`, set per column dimension. Labels follow `totals.subtotalLabel` (default `{label} Total`). |
| Grand total | `totals.rowTotal` adds the grand total column(s), one per value measure, after every group (the generalized step-1 row total; label `rowTotalLabel`, default `Total`). |
| Collapsing | `columnsExpanded` works like `expanded`: `"all"`, `"none"`, or key paths of expanded groups (`[["2026"]]`). A collapsed group shows a single total column (whatever its `subtotal` setting), labelled with the group key and marked `collapsed`. Collapsing is view state: the cube is reused. |
| Σ Values | `valuesIndex` places the measures at any level: `0` outermost, `n` (the default) innermost, in between nests measures inside the outer groups. Subtotals and the grand total keep their measures below them. |
| `showAs` | `percentOfColumnTotal` divides by the grand total of the **same** column (a leaf, subtotal or collapsed group). `percentOfParentColumn` (Excel's "% of Parent Column Total") divides by the same row's value in the enclosing column group; for the outermost level, subtotals and with a single column field that is the row total, so the grand total column shows 100 %. `percentOfRowTotal`, `percentOfParentRow` and `percentOfGrandTotal` are unchanged. |
| Heat | `scope: "column"` gives every leaf column (and every subtotal / collapsed column) its own domain. The other scopes skip subtotal and collapsed columns, so group totals never flatten the leaf colours. The grand total column never gets heat. |
| Sort / Top N | `sortBy.columnKey` / `topN.columnKey` accept a leaf or group column key (`"2026"`, `"2026/Q1"`). |
| Header bars | `headerSeries.points` has one point per leaf column and per collapsed group (subtotals are left out), and with several column fields `groups` holds one point per outermost group (`groupMax`), e.g. per year. |

**Model.** Present only with two or more column fields, so single-column models are byte-identical: `columnDimensions`
(all column fields; `columnDimension` is the outermost), `PivotValueColumn.columnPath` / `subtotal` / `collapsed`,
`PivotHeaderCell.rowSpan` (a subtotal under several levels), `columnPath`, `columnLevel`, `expanded` (`true` on an
expanded group's header, `false` on a collapsed group) and `subtotal`, and `headerSeries.groups`. Column keys of leaves
are the URI-encoded keys joined by `/` (`2026/Q1`); subtotal and collapsed columns carry their group's key path (`2026`,
column id `s:2026:actual`). `columnKeys` lists the leaves and collapsed groups with labels joined by spaces (`FY26 Q1`).

**Pure helpers** (`@nqlib/nqgrid/core`):

```ts
import { togglePivotColumnGroup, setPivotColumnsExpandedAll, pivotExpandedColumnGroups, pivotColumnFields } from "@nqlib/nqgrid/core";

spec = togglePivotColumnGroup(spec, model, ["2025"]);   // materializes "all" from the visible groups, like togglePivotGroup
spec = setPivotColumnsExpandedAll(spec, false);         // columnsExpanded: "none"
pivotColumnFields(spec);                                // columns as a list, whatever the shape
```

**React.** `usePivotGrid` adds `toggleColumnGroup(path)`, `expandAllColumns()`, `collapseAllColumns()` (also
`reducePivotGridSpec` actions). `PivotTable` renders multi-row headers with real `rowSpan`s and, with
`onToggleColumnGroup={grid.toggleColumnGroup}`, a chevron on every column-group header (expanded groups) and collapsed
total column (`aria-expanded`). `renderColumnHeader(context)` replaces a value header's content: the context has the
cell, its `kind` (`dimension | subtotal | measure | total`), column-field `level`, `dimension`, `areaIndex` (its
position among the Columns chips, for `pivotDropZoneProps("columns", { axis: "x", offset: context.areaIndex })`) and
the default `toggle`. `pivotColumnHeaderRole(model, row, cell)` is the same classification as a pure function.

```tsx
const layout = usePivotLayoutDraft(grid);   // one "Defer layout update" draft for the field list and header drags
const renderColumnHeader = useCallback((ctx: PivotColumnHeaderContext) => {
  if (ctx.kind !== "dimension" || !ctx.dimension) return <>{ctx.toggle}{ctx.label}</>;
  const source = { field: ctx.dimension.field, from: "columns" as const, label: ctx.dimension.label };
  return (
    <span {...pivotDropZoneProps("columns", { axis: "x", offset: ctx.areaIndex })} data-nqg-drop-item="">
      {ctx.toggle}
      <span {...pivotFieldDragHandleProps({ source, canDrop: (t) => layout.canMoveField({ ...source, ...t }), onDrop: (t) => layout.moveField({ ...source, ...t }) })}>
        {ctx.label}
      </span>
    </span>
  );
}, [layout]);

<PivotTable model={grid.model} onToggleColumnGroup={grid.toggleColumnGroup} renderColumnHeader={renderColumnHeader} />
<PivotFieldList {...pivotFieldListProps(grid, layout)} />
```

`usePivotLayoutDraft(grid, { defaultDeferred })` returns `{ spec, deferred, draft, setDeferred, apply, moveField,
canMoveField, update, discard, setDraft }`. `PivotFieldList` takes the controlled `draft` / `onDraftChange` from
`pivotFieldListProps(grid, layout)`, so a header dragged while "Defer layout update" is on lands in the field list's
draft (and the grid keeps the applied layout) instead of applying at once and being overwritten on Update.

**Exports.** Static HTML and PDF print the multi-row header with the same `rowSpan`s (long leaf labels end in an
ellipsis via an extra rule appended only to reports with several column fields, so other reports keep a byte-identical
stylesheet). Column chunks never split a top-level group when it fits on a page; a group wider than a page is split
along its next level (a fiscal year into its quarters, its subtotal staying one unit), and chunk captions carry the outer
labels (`Year FY26 Q1 – FY26 Q4`). `pivotModelToSheet` places header cells around row spans and emits `rowSpan` merges
(the `nqgrid-export` XLSX and the Python openpyxl writer merge them as is); frozen rows cover every header row.

## Date grouping (Excel parity, step 3)

Excel's "Group by Years / Quarters / Months / Days" without a second data pass. **Design:** a date field `orderDate`
feeds derived key fields named **`orderDate:<group>`**, which work anywhere a key field does (rows, columns, filters,
facets, `sortBy` keys, the field list) and need no declaration. One date can therefore feed Year in Columns and Month in
Rows at the same time, and filters, slicers and the move helpers treat each grouping as an ordinary field. A catalogue
entry with `source` + `dateGroup` declares a derived field under another name (`{ "field": "fy", "source":
"orderDate", "dateGroup": "year" }`). The golden example is `contract/pivot/v1/examples/planning-dates.*`.

```jsonc
{
  "columns": [{ "field": "orderDate:year" }, { "field": "orderDate:quarter" }],
  "rows": [{ "field": "department" }, { "field": "orderDate:month" }],          // the same date, another grouping
  "filters": [{ "field": "orderDate:year", "include": ["2026"] }],
  "fields": [
    { "field": "orderDate", "type": "date", "fiscalYearStartMonth": 11,          // FY26 = Nov 2025 – Oct 2026
      "timeZoneOffsetMinutes": 0, "monthNames": ["Jan", "Feb", "…", "Dec"] }
  ]
}
```

| Group | Key | Label (calendar / fiscal) |
|-------|-----|------|
| `year` | `2026` | `2026` / `FY26` |
| `quarter` | `Q1` … `Q4` (any year) | `Q1` |
| `month` | `01` … `12` (any year; calendar month) | `Jan` (`monthNames`) |
| `yearQuarter` | `2026-Q1` | `Q1 2026` / `Q1 FY26` |
| `yearMonth` | `2026-01` | `Jan 2026` |
| `week` | `2026-W03` (ISO 8601 week and week-year) | `W03 2026` |
| `day` | `2026-01-15` | `15 Jan 2026` |

**Rules**

| Topic | Rule |
|-------|------|
| Parsing | Deterministic and in **UTC**, never the runtime's time zone. Numbers are epoch milliseconds and `Date`s are instants; ISO strings are `YYYY-MM`, `YYYY-MM-DD` or `YYYY-MM-DD[T ]HH:mm[:ss[.fff]]` with an optional `Z` / `±HH[:mm]`. Strings without a zone are wall-clock dates (taken as is); instants (numbers, `Date`s, zoned strings) are shifted by `timeZoneOffsetMinutes` (default 0, −840…840) before taking the calendar day. The calendar is computed with integer arithmetic (no `Date` methods, no `Intl`). |
| Blanks | Missing, empty, unparseable or impossible dates (`2026-02-30`) and years outside 1–9999 get the key `""`, labelled by the dimension's `blankLabel` (default `(blank)`), always sorted last. |
| Order | Keys sort chronologically, not alphabetically: keys with a year compare as strings (they are zero-padded), months follow the fiscal year (`fiscalYearStartMonth: 11` → Nov, Dec, Jan, …). `sort: "desc"` reverses (blank still last); `order` still wins. |
| Fiscal years | `fiscalYearStartMonth` (1–12, default 1) moves year, quarter and year-quarter keys. Fiscal years are named by the **year they end in** (Nov 2025 – Oct 2026 is `2026`, labelled `FY26`). Months and days stay calendar keys. |
| Settings | `fiscalYearStartMonth`, `timeZoneOffsetMinutes` and `monthNames` (12 labels) go on the source field's catalogue entry and apply to every grouping of it; a derived entry can override them. They are part of `pivotSpecDataKey` except `monthNames` (labels only). |
| Gap filling | `keepEmpty: true` on a date-grouped column dimension fills every period between the first and last period with data (all 12 months / 4 quarters for `month` / `quarter`), at most `PIVOT_MAX_DATE_FILL` (10,000) keys. Nested levels only get keys inside their parent (`2025-Q1 › Jan, Feb, Mar`), when both group the same source with the same settings. Row dimensions do not fill gaps. |
| Cost | Each source is parsed **once per record** per offset (`encoding.days(field, offset)`), and each (source, group, fiscal start, offset) gets one period id per record and one key string per distinct period (`encoding.dateCodes(def)`), both cached on the row encoding, so aggregation never re-parses and `createPivotModelBuilder` reuses them across filter changes. |

**Field list.** `resolvePivotFields(spec, rows)` gives a `date` field `dateGroups` (its "Group by…" choices) when its
sampled values parse as dates (≥ 90 %; `usePivotGrid` passes the rows), or from its catalogue entry (`dateGroups: []`
turns grouping off). Derived fields are listed under their source as `Year (Order date)`. A date chip's menu shows
**Group by** toggles (Years, Year-Quarter, Quarters, Year-Month, Months, Weeks, Days) and Ungroup, applied with
`setPivotDateGrouping(spec, source, groups, { area })`: the source and its groupings in that area are replaced in place by
the chosen groups (coarse to fine), groups placed elsewhere move here, fields leaving the layout lose their filters, and
`[]` puts the raw date back. **Default grouping on drop:** a date field with `dateGroups` dragged from the field list into
Columns becomes **Year → Quarter**, into Rows **Year → Month**, into Filters **Year** (`PIVOT_DEFAULT_DATE_GROUPING`),
skipping groups already placed elsewhere, so dragging the same date into Rows after Columns adds just Month. Year →
Quarter keeps a two-year column layout narrow and collapsible; override per call with `{ dateGrouping: { columns:
["yearMonth"] } }`, or `dateGrouping: false` for the raw field.

```ts
import { setPivotDateGrouping, pivotDateGroupingOf, pivotDayOf, pivotDateLabel, resolvePivotDateField } from "@nqlib/nqgrid/core";

spec = setPivotDateGrouping(spec, "orderDate", ["year", "month"], { fields, area: "columns" });
pivotDateGroupingOf(spec, "orderDate", { fields });   // { area: "columns", groups: ["year", "month"], raw: false }
pivotDayOf("2026-01-15T23:30:00-02:00");               // UTC day number of 2026-01-16
```

`usePivotGrid` adds `setDateGrouping(field, groups, area?)`.

## Calculated measures, show values as, subtotals, distinct count, drill-through (Excel parity, step 4)

The golden example is `contract/pivot/v1/examples/planning-calc.*` (rows of `planning-dates`): a calculated measure
that is also the heat measure, a KPI and a sort key, % difference from the previous fiscal year, % running total along
Line, a distinct count of regions, and department subtotals at the bottom.

```jsonc
{
  "rows": [
    { "field": "department", "subtotal": "end" },                       // "start" (default) | "end" | "none"
    { "field": "line", "sortBy": { "measure": "vsPlan", "direction": "desc" } }
  ],
  "columns": { "field": "orderDate:year" },
  "measures": [
    { "id": "actual", "field": "actual" },
    { "id": "plan", "field": "plan" },                                   // referenced, not shown
    { "id": "vsPlan", "label": "vs Plan", "calculate": "actual / plan - 1", "format": { "style": "percent", "decimals": 1 } },
    { "id": "yoy", "field": "actual", "showAs": "percentDifferenceFrom", "showAsBase": { "field": "orderDate:year", "position": "previous" } },
    { "id": "cumShare", "field": "actual", "showAs": "percentRunningTotal", "showAsBase": { "field": "line" } },
    { "id": "regions", "field": "region", "aggregate": "distinctCount" }
  ],
  "values": ["actual", "vsPlan", "yoy", "cumShare", "regions"],
  "heat": { "measure": "vsPlan", "scope": "column" },
  "kpis": [{ "id": "vsPlan", "measure": "vsPlan" }]
}
```

### Calculated measures

**Design.** A calculated measure is `{ id, label?, calculate, format? }` with no `field` / `aggregate`. Its expression
references **other measure ids**, never raw record fields: Excel calculated fields compute over sums of fields, and an
explicit measure (`{ "id": "plan", "field": "plan" }`, not necessarily in `values`) says how each operand aggregates,
including `avg`, distinct counts or ratios. Each cell evaluates the expression over the referenced measures' values in
the same bucket, so leaves, subtotals, the grand total and KPIs all use aggregated values (`sum(actual) / sum(plan) - 1`,
never a sum of ratios). Calculated measures can reference other calculated measures (no cycles), and work everywhere a
measure id goes: `values`, `showAs`, `heat`, `headerCharts`, `kpis`, `sortBy`, `topN`.

**Grammar** (`parsePivotCalc`; keywords and function names are case-insensitive, ids are case-sensitive):

| Element | Syntax |
|---------|--------|
| References | `actual`, `prior_year` (`[A-Za-z_][A-Za-z0-9_]*`), any other id in brackets: `[prior year]`, `[Plan-2026]` |
| Literals | `12`, `1.5`, `.5`, `1e3`, `null` |
| Operators (low → high) | `or` / `\|\|`, `and` / `&&`, `not` / `!`, `= == != <> < <= > >=` (do not chain), `+ -`, `* / %`, unary `- +`, `^` (right-associative; `-2^2` = -4, math convention, unlike Excel) |
| Functions | `abs(x)`, `sqrt(x)`, `floor(x)`, `ceil(x)`, `round(x, digits = 0)` (half away from zero), `min(…)`, `max(…)`, `if(cond, a, b?)`, `coalesce(…)`, `ifnull(a, b)` |

| Rule | Result |
|------|--------|
| A referenced measure has no value, or the bucket has no records | null (empty cell); null propagates through arithmetic, comparisons and `abs` / `round` / … |
| Division or remainder by zero, overflow, `sqrt` of a negative | null |
| `%` | remainder with the sign of the dividend (`-7 % 3` = -1, like JS / C) |
| Comparisons, `and`, `or`, `not` | `1` / `0`; null and `0` are false (`not null` = 1); comparisons with null are null |
| `if(c, a, b)` | `a` when `c` is true, else `b` (null when omitted) |
| `min` / `max` | skip nulls; null when all are null. `coalesce` / `ifnull`: first non-null |

**Safety** (specs may come from AI agents): no `eval` / `Function`; the parser never throws (errors are values with a
stable `code` and a UTF-16 `position`); at most `PIVOT_CALC_MAX_LENGTH` (1000) code units, nesting depth
`PIVOT_CALC_MAX_DEPTH` (64: parentheses, calls, unary operators and operator chains), `PIVOT_CALC_MAX_ARGS` (32)
arguments; only the whitelisted functions; `__proto__`, `constructor` and `prototype` are reserved; references resolve
through a `Map`, never object properties; only ASCII outside brackets; control, zero-width, bidi override / isolate
characters and the BOM are rejected everywhere. Error codes: `notAString`, `empty`, `tooLong`, `tooDeep`,
`invalidCharacter`, `invalidNumber`, `unterminatedReference`, `emptyReference`, `unexpectedToken`, `unexpectedEnd`,
`unknownFunction`, `arity`, `reservedName`, `unknownReference`. The expression is compiled once per build into closures
(`compilePivotCalc`); a cell reads its references and calls the closure.

`validatePivotSpec` reports grammar errors (`measures[2].calculate: unknown measure "plann" (at 9)`), reference cycles
(`reference cycle a → b → a`) and `calculate` combined with `field` / `aggregate`. The shared vectors in
`contract/pivot/v1/calc-expressions.json` (valid expressions with values and results, invalid ones with codes and
positions) run in both the TypeScript and the Python test suites.

### Show values as along a field

`showAs` / `groupShowAs` also take `percentOf`, `differenceFrom`, `percentDifferenceFrom`, `runningTotal`,
`percentRunningTotal`, `rankAscending` and `rankDescending`, with `showAsBase: { field, item?, position?, scope? }`
naming a **row or column field** (validated). `percentOf` needs `item`; differences use `item` (a key of that field) or
`position` (`previous`, the default, or `next`); running totals and ranks use the field only. `percentOf` and
`scope: "all"` are described under [Financial statements](#financial-statements).

| Topic | Rule |
|-------|------|
| Siblings | Along a row field at level L, a cell's row maps to its ancestor at L; its siblings (same parent, display order: `sortBy`, `order`, …; "Other" last) are the items. Rows deeper than L compare with the descendant of the same relative key path under each sibling (`Footwear › Boots` vs `Camp › Boots`). Along a column field, the same over the column tree (leaves, subtotal and collapsed columns at or below the level, `keepEmpty` columns included). |
| Differences | `value - base` / `(value - base) / base`. Empty for the first item with `previous`, the last with `next`, the base item itself (like Excel), a missing base (no such key, or no data), a base of 0 (percent), and cells without data. |
| Running totals | Sum of the siblings' values up to and including the item (missing ones count as nothing); `percentRunningTotal` divides by the sum over all siblings. Cells without data stay empty. |
| Ranks | Competition ranking (1, 2, 2, 4) among siblings with a value; integer format (`PIVOT_RANK_FORMAT`, Excel `0`). |
| Outside the field | Rows above the base level (groups, grand total) and columns outside a column base (subtotals above it, the grand total column): running totals show the value itself (`percentRunningTotal` 100 %), differences and ranks are empty. |
| Formats | Differences and running totals use the measure's `format`, the percent kinds its `percentFormat`, ranks `PIVOT_RANK_FORMAT` (`pivotShowAsFormatKind`); `pivotModelToSheet` picks the matching Excel `numFmt`. |
| Layout changes | A base field that leaves Rows / Columns resets that measure to plain values (move helpers), like Excel. |

### Row subtotal positions

`rows[i].subtotal` sets where the subtotals of that field's groups go (every level but the innermost; ignored there):
`start` (default; the group row carries them — Excel's "at top"), `end` (Excel's "at bottom": the expanded group row is
blank, marked `subtotal: "end"`, and a row `{ kind: "subtotal", depth, path, label: "Camp Total" }` with id
`pivotSubtotalRowId(path)` follows its last descendant) or `none` (the expanded group row is blank, `subtotal: "none"`).
A collapsed group always shows its totals. Labels follow `totals.subtotalLabel` (shared with column subtotals).
`totals.grandTotal` / `grandTotalPosition` still control the grand total row. Subtotal rows belong to their group:
`model.spans` cover them, `pivotBodyGroups` ends the group's `<tbody>` with them, and `pivotModelToSheet` prints the label
in the group's column outside the group's merge. View-only: the cube is reused. `setPivotSubtotal(spec, field, position)`
works for row and column fields (the area's default removes the key), and `subtotal` travels between Rows and Columns in
the move helpers.

### Distinct count

`aggregate: "distinctCount"` with a `field` counts distinct non-blank keys (compared as strings like dimension keys;
date-derived fields such as `orderDate:month` work too). Group rows, subtotal columns and the grand total count the
distinct keys of **all their records**, not the sum of their children's counts. Implementation: no per-bucket sets.
After the record pass, records are counting-sorted by key code once per distinct-count measure; each record visits its
leaf and ancestors and its column bucket and column groups, and a stamp array (nodes × buckets, `Int32Array`) counts
each key once per bucket. Memory is that stamp array plus two record-sized arrays, independent of cardinality; specs
without a distinct count allocate nothing.

### Drill-through

```ts
import { pivotDrillThrough, pivotCellDrillTarget, createPivotModelBuilder } from "@nqlib/nqgrid/core";

const target = pivotCellDrillTarget(model, model.rows[3], 6);   // { path, columnPath, measureId }
const { records, indices, total, truncated, fields } = pivotDrillThrough(spec, rows, target, { limit: 500, offset: 0 });
builder.drillThrough(spec, rows, target);                         // same, on the builder's cached encoding
```

Records are those that pass the report / label filters and Top N, whose row keys start with `target.path` and column keys
with `target.columnPath` (date-grouped fields match their derived keys). Group rows, subtotal rows (same path as their
group), subtotal / collapsed columns (group key paths) and totals (`path: []`, `columnPath: []`) get the broader sets;
an "Other" row lists the records of the keys it folds, and keys cut by Top N without "Other" match nothing. `total`
counts every match (equals the row's `sourceRowCount` for whole rows), `records` are in data order up to `limit`
(default 1000). `fields` suggests display columns: row and column fields (the source of date-derived ones), then the
source fields of `measureId` (calculated measures: of the measures they reference), else of every value. With a
`measureId` whose measure has a `filter`, only the records that pass it are listed (the records the cell counted; a
calculated measure lists the records of any measure it references, every record when one of them is unfiltered). A
semi-additive cell (closing balance) lists all of the cell's records, not only the latest period's. It costs one
filter pass plus one partial aggregation per Top-N level, and nothing for specs that never drill.

### React

```tsx
const grid = usePivotGrid(spec, rows);
const [drill, setDrill] = useState<PivotDrillThroughTarget | null>(null);
const result = useMemo(() => (drill ? grid.drillThrough(drill, { limit: 500 }) : null), [drill, grid]);

<PivotTable model={grid.model} onDrillThrough={setDrill} />          {/* double-click a value cell */}
{result ? (
  <PivotDrillThroughPanel result={result} title={pivotDrillThroughTitle(grid.model, drill!)}
    {...pivotDrillThroughFieldInfo(grid.spec, grid.fields)} onClose={() => setDrill(null)} />
) : null}
<PivotFieldList {...pivotFieldListProps(grid)} />                  {/* calc measures, show values as, subtotals */}
```

| Export | Purpose |
|--------|---------|
| `PivotTable.onDrillThrough(target, context)` | Double-click on a value cell (interactive mode; no handlers in static mode). `context`: row, column, indices, cell. |
| `PivotDrillThroughPanel` | Records table with a sticky header, one column per field (`fields`, default `result.fields`), numbers right-aligned in `formats`, "Showing 500 of 4,210 records", close button; `renderCell`, `classNames`, `labels`. `pivotDrillThroughFieldInfo(spec, fields)` gives labels and formats, `pivotDrillThroughTitle(model, target)` a heading (`Camp › Tents · FY26 · Actual`). |
| `PivotCalculatedMeasureForm` | Name, formula (validated as you type with `checkPivotCalculatedMeasure`: the message and position show inline, Add stays disabled), insert-measure picker (`pivotCalcReference` brackets ids when needed), format; edit / delete an existing one with `measureId` / `onRemove`. |
| `PivotShowAsMenu` | The show-as kind, base field (row / column fields), base item ((previous), (next) or a key from `getFacet`; % of needs a key) and, for a key on a row field, "Compare with" (same group / across all groups = `scope`). |
| `PivotFieldList` | "Calculated measure…" button under the checklist; on value chips "Show values as" (and "Edit formula…" for calculated measures, which skip "Summarize values by"); "Subtotals" At top / At bottom / Off on group-level row chips (Before / After / Off on column chips); Distinct Count, Closing balance, Opening balance and Average over time (with an "Over" time-field picker) in "Summarize values by"; "Filter this measure…" (field + values → a measure filter). |
| `usePivotGrid` / `reducePivotGridSpec` | `setCalculatedMeasure(input)`, `removeMeasure(id)`, `setMeasureShowAs(id, showAs, base?, scope?)`, `setSubtotal(field, position)`, `setMeasureSignField(id, field \| null)`, `setMeasureFilter(id, filter \| null)`, `setMeasureAggregate(id, aggregate)` (also `{ type, timeField }`), `drillThrough(target, options?)`. |

**Exports.** Static HTML / PDF and both XLSX writers render calculated measures and the new show-as kinds as numbers
with their formats. Subtotal rows ("Camp Total" in the Department column of the sheet) are bold in both XLSX writers.
In static HTML / PDF the default `report` profile prints them like the app's group rows (grey band, weight 500,
values in the muted text colour); `renderPivotHtml(model, { profile: "statement" })` (export option `profile`) prints
them bold in the full text colour with a rule above, and the grand total with a double rule below (see
[Static HTML](#static-html-nqlibnqgridrender-static)).

### Formatting is deterministic

`formatPivotNumber` does not use `Intl`. WebKit (macOS Tauri), WebView2 (Windows Tauri) and Node
can disagree on compact notation; core always prints `$302k`, `$4.76M`, `+5.5%` the same way.
`toExcelNumFmt` gives the Excel format so XLSX cells stay numeric: exact for plain, currency, percent and `scale`
formats (sign display and parentheses included). `compact` is best effort, because an Excel format allows only two
conditions: the XLSX abbreviates thousands for both signs (`[>=1000]"$"#,##0,"k";[<=-1000]("$"#,##0,"k");"$"#,##0`),
so `$4.76M` in the PDF reads `$4,760k` in Excel and `-$500` keeps a minus where the PDF prints `($500)`. Use
`scale` when a column must read in one unit everywhere.

### Scaling (`format.scale`) and units

`format.scale: 1000 | 1000000 | 1000000000` divides the **displayed** value before the usual decimals, currency,
sign and parentheses rules; aggregation, sorting, Top N, heat, `showAs` and the numbers in XLSX cells are unchanged.
Excel gets its scaling commas, so the cell still holds the real value:

| Format | 12,345 | -629 | Excel numFmt |
|--------|-------:|-----:|--------------|
| `{ style: "currency", currency: "USD", scale: 1000, decimals: 1, negative: "parentheses" }` | `$12.3` | `($0.6)` | `"$"#,##0.0,;("$"#,##0.0,)` |
| `{ scale: 1000000, decimals: 2, suffix: "m" }` | `0.01m` | `0.00m` | `#,##0.00,,"m"` |
| `{ compact: true }` (for comparison: units vary per cell) | `12.3k` | `-629` | see above |

`scale` cannot be combined with `compact` or with `style: "percent"` (`validatePivotSpec` rejects both). Name the
unit with the spec-level `units` (free text, printed verbatim): `"units": "USD thousands"` or `"($ in thousands)"`.
Static HTML / PDF print it under the title (and subtitle); the XLSX writers put it in the printed page header (title
left, units right) and on the hidden `Spec` sheet; `model.units` / `PivotSheet.units` carry it. nqgrid never derives
the note from the formats: keep `units` and `scale` consistent.

## Validation and diagnostics

**Strict validation.** `validatePivotSpec` (used by `buildPivotModel`, `createPivotModelBuilder`, `usePivotGrid`,
`renderPivotHtmlFromSpec` and `nqgrid-export`) checks everything the JSON Schema checks, so the engine, the CLI /
HTTP service and the Python validator accept and reject the same specs:

- unknown keys everywhere the schema says `additionalProperties: false` (the spec, dimensions, measures, formats,
  `sortBy`, `topN`, `showAsBase`, aggregates, totals, heat, header charts, KPIs, filters, label matches, facets,
  catalogue fields, measure filters, semi-additive aggregates), with the Python validator's message:
  `measures[0].filter: unknown key(s) ('where' was unexpected)`;
- enums, types and ranges (`layout`, `totals.*`, `heat.applyTo` / `domain`, `headerCharts.type`, `kpiLevels`, every
  number-format key, labels, `attributes`, `topN.otherLabel`, …);
- keys the engine would ignore: `keepEmpty` on a row dimension (`rows[0].keepEmpty is only supported on column
  dimensions`), `showAsBase` on a measure whose `showAs` / `groupShowAs` never reads it;
- a calculated measure that references a measure whose `showAs` is not `value` (it would read the value *before* the
  show-as, e.g. a "YTD variance" over two running totals gives the monthly variance; a `groupShowAs` alone is fine,
  group rows then read the group's aggregate, as Excel calculated fields do). Put the show-as on the calculated
  measure instead: `{ "id": "ytdVar", "calculate": "actual - budget", "showAs": "runningTotal", "showAsBase": { "field":
  "PERIOD:month" } }`;
- `format.scale` with `compact` or percent style;
- a measure `filter` on a calculated measure (`measures[1]: filter cannot be combined with calculate (filter the
  measures it references)`), a semi-additive aggregate without `timeField`;
- calculated items: `calculatedItems` / `itemFormats` on a column dimension (`columns.calculatedItems is only supported
  on row dimensions`), a duplicate item key, more than one of `after` / `before` / `position`, an item placed relative
  to itself, an item formula that does not parse (`rows[0].calculatedItems[0].formula: unexpected end of expression
  (at 11)`) and reference cycles among a field's items (`… reference cycle EBITDA → Gross margin → EBITDA`). Keys of
  the data are unknown to a validator, so references to keys are **not** checked here: a key the data does not have
  is an `itemKeyNotFound` diagnostic at build time.

`contract/pivot/v1/invalid-specs.json` holds the shared vectors: both test suites assert that every invalid spec is
rejected, with identical messages where listed (unknown keys and the checks above) or at the same path (schema
enums and types, where the Python message comes from jsonschema), and that every valid one is accepted. Messages of
the older referential checks name the same path but quote values per language (`"nope"` vs `'nope'`).

`buildPivotModel` validates by default (`validate: false` skips it for specs you built and validated yourself);
validation costs about 0.01–0.02 ms for the bench specs, i.e. well under 0.1 % of a 10k-row build
([pivot-performance.md](./pivot-performance.md#batch-a-strict-validation-diagnostics-print-profile)).

**Diagnostics.** `model.diagnostics` (present only when there is something to report) lists data and spec problems
that leave cells empty or totals short, gathered while the records are encoded (no extra pass), one entry per field
and problem, with at most 5 samples:

| `code` | When | Example message |
|--------|------|-----------------|
| `unparsedNumbers` | Non-blank measure (or weight / numerator / denominator) values that are not numbers or plain numeric strings: `"1,234.50"`, `"(500)"`, `"$12"`, `"5%"`, `true`, `"0x10"` | `3 values of "AMOUNT" (measures[0].field) are not numbers and left out of every total, e.g. "1,234.50" (row 1), …` |
| `missingField` | No record has a field the spec reads (a typo) | `No record has the field "regionn" (filters[0].field); check the spelling.` |
| `invalidDates` | Values of a date-grouped field that are not ISO 8601 / epoch ms (grouped as `(blank)`) | `2 values of "d" (rows[0].field) are not dates …, e.g. "31/12/2026" (row 1)` |
| `mixedKeyTypes` | A key field mixes JS types (`2024` and `"2024"` are one key, `1` and `"1.0"` two) | `"k" (rows[0].field) mixes number and string values …` |
| `filterItemsNotFound` | `filters[].include` / `exclude` (or a measure filter's) items no record has (case-sensitive) | `filters[0].include: "x" is not a value of "a" …`, `measures[0].filter.include: "actual" is not a value of "SCENARIO" …` |
| `baseItemNotFound` | `showAsBase.item` is not a key of its field | `measures[0].showAsBase.item "Revenue " is not a value of "LINE" …` |
| `itemKeyNotFound` | A key named by a calculated item formula, its `after` / `before`, `subtotalLabels` or `itemFormats` that is neither a value of the field nor a calculated item | `rows[1].calculatedItems[0].formula names "Berlinn", which is not a value of "CITY" nor calculated items …; they read as no value.` |
| `itemKeyConflict` | A calculated item's `key` is also a value of its field (formulas and anchors naming it mean the item) | `rows[0].calculatedItems[0].key "constructor" is also a value of "K" …` |

Each entry has `code`, `field`, `path`, `message` and, by code, `count`, `samples` (`[{ row, value }]`, 0-based input
row), `types` or `items`. Accounting and locale formats are **reported, not parsed**: guessing whether `"1.234"` is
one thousand or 1.234 would silently change totals, so send plain numbers (Python `Decimal` → string is fine). Radix
literals (`"0x10"`) no longer parse as numbers (they summed as 16 before).

Where diagnostics surface: `model.diagnostics` (also in the `model` export); `nqgrid-export serve` sends them in the
`x-nqgrid-diagnostics` response header (JSON, ≤ 8 KB) and the CLI as one `{"level":"warn","diagnostics":[…]}` line
on stderr (exit code 0); the hidden `Spec` sheet of the XLSX lists their messages; the PDF body never shows them. The
Python client returns them from `export_report(...)` and the MCP tool's `export_pivot_report` result
(`diagnostics`).

## Financial statements

Additions for P&L / income statements (Secolab's "Statement" report). The complete recipe — data shape, spec,
result table and an honest list of what does not work — is [pivot-recipes.md](./pivot-recipes.md#financial-statement-pl--income-statement);
the golden examples are `contract/pivot/v1/examples/planning-income.*` (calculated items) and
`planning-statement.*` (section subtotals, sign field, % of Revenue).

```jsonc
{
  "rows": [
    { "field": "SECTION", "subtotal": "end", "subtotalLabel": "{label}", "sortBy": { "measure": "ord", "direction": "asc" } },
    { "field": "LINE", "sortBy": { "measure": "ord", "direction": "asc" } }
  ],
  "measures": [
    { "id": "amount", "field": "AMOUNT", "signField": "SIGN" },
    { "id": "pctRevenue", "field": "AMOUNT", "signField": "SIGN", "showAs": "percentOf",
      "showAsBase": { "field": "LINE", "item": "Revenue", "scope": "all" } },
    { "id": "ord", "field": "LINE_SORT", "aggregate": "min" }               // hidden: not in values
  ],
  "values": ["amount", "pctRevenue"],
  "totals": { "grandTotalLabel": "Operating income" }
}
```

### % Of (`percentOf`) and `showAsBase.scope`

`showAs: "percentOf"` is Excel's "% Of": the value divided by the base item's value, as a ratio formatted with
`percentFormat` (`pivotShowAsFormatKind` → `percent`; `pivotModelToSheet` uses the percent numFmt). `showAsBase.item`
is required (`validatePivotSpec`: `showAsBase.item is required by percentOf`).

| `scope` | Base of a cell | Rows above the base field, other parents |
|---|---|---|
| `parent` (default, Excel) | The sibling with key `item` under the same parent, at the same relative path, same column (exactly like `differenceFrom` with an item). The base item itself is 100 %. Along a column field: the same row's value in the `item` column. | Empty. |
| `all` | The aggregate of **every record whose `field` key is `item`** in the cell's column bucket (leaf, subtotal or grand-total column), after filters and Top N, whatever the row's parent. | Every row — group, subtotal, collapsed and grand-total rows — gets value / base. |

`scope: "all"` needs `item` and a **row** field (a column field is rejected: the base would be a different column), and
applies to `percentOf`, `differenceFrom` and `percentDifferenceFrom` (value − base, (value − base) / base; there the
base item's own rows show 0 / 0 %, unlike Excel's blank). Running totals and ranks reject it (`setPivotMeasureShowAs`
drops it for them). A base of 0, a missing base (no such key, no data in that column, or filtered out) and cells without
data are empty. Moving the base field out of Rows resets the measure to plain values (move helpers), like any show-as
whose base field leaves the layout.

**Cost.** View-only: the cube is unchanged (`pivotSpecDataKey` ignores show-as), so toggling it in the app reuses the
aggregated cube. `PivotCube.keyTotal(depth, key)` returns the base once per (level, key): the node itself when the key
occurs under one parent (exact for every aggregate), otherwise the accumulators of every node with that key merged once
and memoized (O(nodes at that level × buckets × slots)). Each cell is then one accumulator read — no sibling scans, so
the "no O(k²) show-as" property of the [performance review](./pivot-performance.md#performance-review) holds. Distinct
counts and custom aggregates cannot be merged: when the item occurs under several parents their base is empty (null).

### Sign field (`measures[i].signField`)

Each record's value is multiplied by that record's `signField` value before aggregation (a P&L sign column on unsigned
amounts). Numbers and numeric strings (`"-1"`) are read like measure values; a missing, blank or non-numeric sign counts
as `1`. Any finite number is used as the multiplier, so use `1` / `-1`.

| Aggregate | What is signed |
|---|---|
| `sum`, `avg`, `min`, `max`, `first`, `last` | the value (`min` / `max` compare signed values) |
| `weightedAvg` | the value, not the weight |
| `ratio` | the numerator only (`sum(sign × numerator) / sum(denominator)`) |
| `count`, `distinctCount`, `custom`, calculated measures | rejected by `validatePivotSpec` (counts have no values; a calculated measure uses the signs of its references) |

Implementation: the signed column (`value × sign`) is computed once per (value column, sign column) of an encoding and
memoized, so the record pass reads one `Float64Array` as for any other measure; measures without `signField` do not
touch it. `signField` is part of `pivotSpecDataKey` (only when set, so other specs keep their cache keys), so cubes are
cached correctly. Drill-through returns raw records and lists the sign field in `fields`. Helpers:
`setPivotMeasureSignField(spec, id, field | null)` (refused for counts / calculated measures), and
`setPivotMeasureAggregate` drops `signField` when switching to a count. The field list has no sign control (spec only).

### Per-level subtotal labels (`rows[i].subtotalLabel`, `columns[i].subtotalLabel`)

Same `{label}` template as `totals.subtotalLabel`, for that field's `subtotal: "end"` rows (row dimensions) or subtotal
columns (column dimensions) only; `totals.subtotalLabel` (default `{label} Total`) stays the fallback for the other
levels. `"{label}"` names a P&L section's subtotal row after the section (`Gross margin`). View-only; travels with the
dimension between Rows and Columns.

**Per group:** `rows[i].subtotalLabels` / `columns[i].subtotalLabels` maps a group key to its label (same `{label}`
template), overriding `subtotalLabel` for that group only: `{ "Revenue": "Total revenue", "Operating expenses":
"Total operating expenses" }`. Keys compare as case-sensitive strings and are looked up in a `Map` (any key, also
`__proto__`); keys the data does not have are an `itemKeyNotFound` diagnostic. `setPivotSubtotalLabel(spec, field,
key, label | null)` / `grid.setSubtotalLabel` edit one entry.

**Not added:** hiding the blank expanded group row of `subtotal: "end"` (it carries the expand / collapse toggle, the
row spans and the virtualized row index; a hidden-row mode would complicate all three). It reads as the section heading.

### Calculated items (`rows[i].calculatedItems`)

Excel's "Calculated Item…" (a Power BI visual-calculation row): extra rows of a row field computed by a formula over
other keys of the **same field**, per column bucket and per measure, from the aggregated values.

```jsonc
{
  "rows": [
    { "field": "SECTION", "subtotal": "end",
      "subtotalLabels": { "Revenue": "Total revenue", "Operating expenses": "Total operating expenses" },
      "calculatedItems": [
        { "key": "Gross margin", "formula": "[Revenue] + [Cost of sales]", "after": "Cost of sales" },
        { "key": "Gross margin %", "formula": "[Gross margin] / [Revenue]", "after": "Gross margin",
          "format": { "style": "percent", "decimals": 1 } },
        { "key": "EBITDA", "formula": "[Gross margin] + [Operating expenses]", "after": "Operating expenses" }
      ] },
    { "field": "LINE" }
  ]
}
```

| Concern | Behaviour |
|---|---|
| Item keys (`key`, `label`) | `key` is the row's `path` entry and its name in other items' formulas; unique per dimension (`validatePivotSpec`). `label` (default `key`) is what the row shows. |
| References | Keys of the field in brackets (`[Cost of sales]`) or as bare names (`Revenue`). They resolve **under the item's parent row**: other calculated items of the same dimension (cascading totals; an item key shadows a data key of the same name, reported as `itemKeyConflict`) and sibling keys (at the outermost level any key of the field, e.g. P&L section totals). Keys are opaque, case-sensitive strings looked up in `Map`s — `[__proto__]`, `[constructor]` and `[toString]` are plain keys (the parser runs with `allowReservedNames`). Keys of another field or deeper levels (`[Revenue › Product revenue]`) are not supported. |
| Grammar | `parsePivotCalc`: the same operators, functions, null rules and limits (1000 characters, depth 64, 32 arguments) as calculated measures; no `eval`. Validation checks grammar, duplicate keys, placement and cycles; unknown keys are diagnostics. |
| Values | Per (item, column bucket, measure): a plain measure evaluates the formula over the referenced keys' aggregated values of that measure; the total column is the formula over the totals (year Gross margin % = year margin / year revenue, not an average). Distinct counts, balances and averages work the same way (the formula over the items' values — well defined, though a sum of two distinct counts is what it says). |
| Missing keys | A key without a node under the parent (filtered out, cut by Top N, no record) or without data in a bucket reads as no value, and null propagates as in calculated measures: `[Revenue] + coalesce([Cost of sales], 0)` when a key may be missing. |
| Where it shows | Under every parent where at least one key it reads (directly or through other items) is a child; items reading no key (constants) under every parent. An item whose keys are all filtered out disappears instead of showing an empty row. Items of a collapsed parent are hidden with its children. |
| Placement | `after` / `before` a key (a data key or another item; the item follows that key's whole block — group row, children and subtotal row), else `position: "start"` / `"end"` (default `end`); several items on one anchor keep spec order. Items keep their anchor whatever `sortBy`, `order` or Top N do to the data keys; a missing anchor sends the item to the end (and an `itemKeyNotFound` diagnostic). |
| Totals (`includeInTotals`) | Default **false**: an item is not added to its parent's subtotal nor to the grand total. Excel adds calculated items into totals, which double counts statement rows (Operating income would include Gross margin and EBITDA a second time). `true` adds the item's value to its parent and every total above (subtotal rows, collapsed group rows, the grand total, KPIs, header bars and show-as denominators); plain measures add whatever their aggregate, calculated measures re-evaluate over the adjusted totals. Sorting and Top N never see items. |
| Calculated measures | Evaluated over the **item's values of the measures they reference**: a margin % on the Gross margin row is Gross margin's margin / its revenue — consistent with calculated measures at totals (aggregates first, then the expression), and right for ratios, where applying the item formula to the measure's results (Excel's order for some intersections) would add two percentages. |
| `showAs` | Applied to the item's values where an item has a base: % of column / row / grand total, % of parent row (the parent's value) and parent column, `percentOf` / differences with `scope: "all"` (Gross margin as % of Revenue), and every kind along a **column** field (YoY, running total over months — along the item's own values). Along a **row** field the item has no position among the data keys, so its cells are empty at or below the base level (above it, running totals show the value as for groups). Leaf-level items use `showAs`, group-level items `groupShowAs ?? showAs`. Combining a ratio item (Gross margin %) with a percentage column gives a ratio of ratios: leave such measures out of `values` or accept the cell. A calculated item cannot be a `showAsBase.item` (the base is read from the cube: `baseItemNotFound`, empty cells). |
| Formats | `format` on the item (wins), else `itemFormats[key]` of the dimension, replaces the column format of cells shown as values (and differences / running totals); percentage show-as cells keep `percentFormat`, ranks the rank format. The row carries `format` and `excelNumFmt`, so both XLSX writers write the right number format. |
| Heat, KPIs, facets, sort | Items get no heat level and are not part of heat domains, KPI levels, facets / slicers, `sortBy` or Top N. |
| Drill-through | `pivotDrillThrough` with a path ending in an item key lists the records of every key the item reads under the same parent (through other items too): Gross margin → Revenue and Cost of sales records. A constant item lists none. `total` then differs from the row's `sourceRowCount`, which is 0. |
| Model | Body rows of `kind: "calculated"` (`id` `i:<path>` via `pivotCalculatedItemRowId`, `depth` = the field's level, `expandable: false`, `childCount` 0, `formula`, optional `format` / `excelNumFmt`). Tabular slots (`pivotDimensionSlots` → `calculated`), spans, virtualization, `PivotTable` (styled like subtotal rows, the formula as a tooltip), static HTML / PDF (statement profile: bold with a rule above, the CSS is appended only when the model has items, so other statements stay byte-identical) and sheets (bold, statement rule, the item's `numFmt`) handle them. |
| `subtotalFormulas` | Item rows keep values, and so does any group / grand total whose `SUBTOTAL` range would contain an item row (the formula would add the item; with `includeInTotals` the cached value already includes it). |
| Cost | View stage only: items are not part of `pivotSpecDataKey`, so adding or editing an item reuses the cached cube, and specs without items skip all of it. Each (item instance, measure, bucket) is evaluated once on first read and memoized; no record is read. See [pivot-performance.md](./pivot-performance.md#batch-c-calculated-items). |

Helpers: `setPivotCalculatedItem(spec, field, item, replaceKey?)` (adds, replaces, and on a rename rewrites references
and anchors in the field's other items), `removePivotCalculatedItem` (refused while another item's formula reads it),
`checkPivotCalculatedItem` for inline validation, `pivotItemReferencers`; reducer actions `setCalculatedItem` /
`removeCalculatedItem` / `setSubtotalLabel` (`usePivotGrid` exposes them). In the field list, a Rows chip lists the
field's calculated items and opens `PivotCalculatedItemForm` (name, formula validated as you type, insert-item picker
fed by the field's facet, position, format, "Add to totals"). Moving the field into Columns drops its items and
`itemFormats` (row-only).

### Per-key formats (`rows[i].itemFormats`)

`{ "Headcount": { "decimals": 1, "suffix": " FTE" } }` formats every row of that key at that level (its group or leaf
row and its subtotal row) for cells shown as values, replacing the column's format as a whole (repeat
`"negative": "parentheses"` if the column had it); percentages from `showAs` keep `percentFormat`. Calculated items
take their own `format` first. Rows only; unknown keys are `itemKeyNotFound` diagnostics. This covers per-line formats
in a statement without a format column in the data.

## Planning: measure filters and semi-additive aggregates

Two additions for FP&A data, where scenarios arrive as a column of a long table and balances and headcount are not
additive over time. Recipes with tested result tables: [Budget vs actual (long format)](./pivot-recipes.md#budget-vs-actual-long-format),
[Balance sheet](./pivot-recipes.md#balance-sheet) and [Headcount](./pivot-recipes.md#headcount); golden examples
`contract/pivot/v1/examples/planning-fpa.*` and `planning-fpa-bs.*`.

### Measure filters (`measures[i].filter`)

```jsonc
"measures": [
  { "id": "actual", "field": "AMOUNT", "filter": { "field": "SCENARIO", "include": ["Actual"] } },
  { "id": "budget", "field": "AMOUNT", "filter": { "field": "SCENARIO", "include": ["Budget"] } },
  { "id": "py",     "field": "AMOUNT", "filter": [{ "field": "SCENARIO", "include": ["Actual"] },
                                                  { "field": "PERIOD:year", "include": ["2025"] }] },
  { "id": "var",    "calculate": "actual - budget" }
]
```

A measure filter is one filter or a list (ANDed), with the same shape and rules as `spec.filters` (`include`,
`exclude`, `match`; any record field, including derived date fields such as `PERIOD:year`). Semantics are DAX's
`CALCULATE` / Excel's `SUMIFS`:

- The measure aggregates only records that pass the report filters **and** its own filter.
- Rows, columns, totals, facets, `sourceRowCount` and Top N come from every record that passes the report filters, so a
  line with budget records only still shows (empty `actual`, `count` 0), and Actual and Budget are never added together
  in the row total or in outer subtotals.
- A measure filter only narrows: a prior-year measure needs the report filters to let 2025 through (filter the current
  year inside the measures instead of in `spec.filters`).
- Calculated measures over filtered measures work (`actual - budget`, `(actual - budget) / abs(budget)`); a calculated
  measure itself cannot have a filter (`validatePivotSpec`: `filter cannot be combined with calculate`).
- Every aggregate honours it: values outside the filter count as no value (`sum`, `avg`, `min`, `max`, `first`,
  `last`, `weightedAvg`, `ratio`, the semi-additive ones), `count` counts the records that pass, `distinctCount` the
  distinct keys among them, custom aggregators receive only them. A cell whose records all fail is empty (`count`: 0).
- Show-as, sort by value, Top N, heat and KPIs read the filtered values like any other measure.
- `pivotSpecDataKey` includes the filter (only when set); drill-through with the measure's id lists only the records it
  counted; `diagnostics` report filter items that match no record (`path: "measures[0].filter.include"`).

**Cost.** Nothing for specs without measure filters: the filter is folded into the measure's columns when the cube is
built (values outside it become `NaN`, presence and distinct-key columns are masked), so the record pass is unchanged.
A filtered measure costs one filter pass plus one masked column copy per build (about +10 ms per measure at 500k
records); the copies are released once the cube is built. See [pivot-performance.md](./pivot-performance.md#batch-b-measure-filters-semi-additive-aggregates-analyst-xlsx).

**Period-relative measures** have no preset; build them from measure filters and show-as:

| Measure | Spec |
|---|---|
| Current year (with the year in the measure, not in `spec.filters`) | `filter: [{ field: "SCENARIO", include: ["Actual"] }, { field: "PERIOD:year", include: ["2026"] }]` |
| Prior year, side by side by month or quarter | the same with `"2025"`, and columns on `PERIOD:month` / `PERIOD:quarter` (month of any year), so both years share a column |
| YTD | `showAs: "runningTotal", showAsBase: { field: "PERIOD:month" }` (resets per year under a year column), or `groupShowAs` for subtotals too |
| YoY % | a calculated measure `(cy - py) / abs(py)`, or `percentDifferenceFrom` along `PERIOD:year` with `position: "previous"` |
| Month vs YTD vs full-year budget in one table | three measures; full-year budget = a budget measure without a month filter, read in the row-total column |

### Semi-additive aggregates (`closingBalance`, `openingBalance`, `averageOverTime`)

```jsonc
{ "id": "balance", "field": "BALANCE", "aggregate": { "type": "closingBalance", "timeField": "PERIOD" } }
{ "id": "fte",     "field": "FTE",     "aggregate": { "type": "averageOverTime", "timeField": "PERIOD" } }
```

`timeField` is a date field (`PERIOD`), a derived date field (`PERIOD:yearMonth`) or any field whose keys sort in time
order (numbers, ISO dates, `2026-01`). Derived date fields order chronologically; other fields by `comparePivotKeys`
(numbers numerically, else as text, which is chronological for ISO dates). Records without a value or without a time
key are skipped.

- **`closingBalance`** (Power BI's `LASTNONBLANK`, Excel's "last" per item): in every cell, each **series** — one
  combination of the layout's non-time row and column keys, e.g. an account (or account × region) — contributes the
  sum of its records at the **latest time key it has in that cell**; series are then added up. A quarter shows its last
  month's balance, a year its last month, a group adds its accounts' balances, the grand total all accounts'. Because
  the latest period is taken per series, an account without a March record counts with its February balance in Q1 (and
  is absent from the March column). Time levels are the `timeField`, its source date field and every other grouping of
  that source (`PERIOD:year`, `PERIOD:yearQuarter` for `timeField: "PERIOD"`), wherever they sit (rows or columns).
  Accounts that are not in the layout are not separate series: keep the account as the innermost row level (collapse it
  with `expanded` if needed) so that sparse accounts are carried forward.
- **`openingBalance`**: the same with the earliest time key.
- **`averageOverTime`**: the cell's sum divided by the number of distinct time keys with a value in the cell, i.e. the
  average over periods of the per-period total (headcount: Jan 31, Feb 32, Mar 33 FTE → Q1 32, not the average record).
  Periods without data in the cell are not counted (as `AVERAGEX` over the periods present).

They are correct at every level the cube computes — leaves, groups (expanded or collapsed), `subtotal: "end"` rows,
column subtotals and collapsed column groups, the row-total column and the grand total — and work with report filters,
measure filters, `signField` (the value is signed before the period is picked), show-as, calculated measures, heat,
`sortBy` and Top N ("Other" adds its folded series). `showAsBase.scope: "all"` over a key that occurs under several
parents cannot merge them, so such a base is empty (as for distinct counts). The `aggregatePivotRows` reference treats
its rows as one series.

**Cost.** Nothing for specs without them. A semi-additive measure adds one pass over the records sorted by time key
(and series, for balances) after the tree is built, like a distinct count: +40 % (closing) / +20 % (average over time)
on a 500k-record cold build in the benchmark layout, with transient `Int32Array`s of the record count, released once
the cube is built.

**`first` / `last`** keep their meaning: the first / last record **in input order**; a group takes one record of all
its records. Use them for attributes, not balances.

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
| `examples/planning-fields.{spec,rows,model,sheet}.json` + `.html` | Rows with `region`, `channel`, `units`; a field catalogue, three row levels, Σ Values outermost and a report filter on a non-dimension field (the documented move sequence from `planning.spec.json`). |
| `examples/planning-fields.catalog.json` | `inferPivotFields(rows)`, `resolvePivotFields(spec, rows)` and `pivotFieldListState` for that spec (Python checks its inference against it). |
| `examples/planning-multicol.{spec,model,sheet}.json` + `.html` | Rows of `planning-fields`; Region → Channel in Columns with Σ Values between them, region subtotals, a grand total column, `percentOfParentColumn` and column-scoped heat (4 PDF chunks, one per region). |
| `examples/planning-dates.{spec,rows,model,sheet}.json` + `.html` | Two fiscal years of rows with an ISO `orderDate`; `orderDate:year` → `orderDate:quarter` (fiscal year from November), FY25 collapsed, FY26 with a subtotal. |
| `examples/planning-calc.{spec,model,sheet}.json` + `.html` | Rows of `planning-dates`; a calculated measure (`actual / plan - 1`, also heat, KPI and sort key), % difference from the previous fiscal year, % running total along Line, a distinct count of regions and department subtotals at the bottom. |
| `examples/planning-statement.{spec,rows,model,sheet}.json` + `.html` | The [P&L recipe](./pivot-recipes.md#financial-statement-pl--income-statement): sign field, % of Revenue with `scope: "all"`, section subtotals labelled with the section. |
| `examples/planning-fpa.{spec,rows,model,sheet}.json` + `.html` | A long-format FP&A table (`SCENARIO`, `KIND`, `SIGN`): Actual / Budget / prior year as measure filters, variance and Var %, YTD, USD thousands. |
| `examples/planning-fpa-bs.{spec,model,sheet}.json` + `.html` | Rows of `planning-fpa`: balance sheet with `closingBalance` (Q1 collapsed = March) and headcount with `averageOverTime`. |
| `calc-expressions.json` | Shared calculated-measure test vectors: valid expressions with values and expected results, invalid ones with error codes and positions (TypeScript and Python tests). |
| `export-request.schema.json` + `examples/planning.request.json` | The export request `{ spec, rows \| dataset, format?, options? }` (CLI / `POST /export`, and app → backend with a `dataset` reference). TS: `buildPivotExportRequest`, `PIVOT_EXPORT_REQUEST_JSON_SCHEMA`; Python: [`integrations/python`](../integrations/python/README.md). |

The golden files are regenerated by `src/core/pivot/contract.test.ts` and `src/render-static/render-static.test.ts` (`pnpm test -u`);
any diff is a contract change and should bump the spec `version` if it is breaking.
`validatePivotSpec` checks everything the schema checks (see [Validation and diagnostics](#validation-and-diagnostics))
plus references the schema cannot express
(unknown measure ids in `values`, `heat`, `headerCharts`, `kpis`, `sortBy`, `topN`; duplicate measure ids, facets and
catalogue fields; `sortBy` / `topN` only on row dimensions; calculated-measure grammar, references and cycles, and no
references to show-as measures; `showAsBase` on a row or column field and only where it is read; `keepEmpty` only on
column dimensions; `format.scale` not with `compact` / percent). `invalid-specs.json` holds the shared validation
vectors for both languages.

### Workbooks (XLSX) and the sheet shape

`pivotModelToSheet(model, options)` is the one layout both XLSX writers paint (exceljs in `nqgrid-export`, openpyxl
in the Python package), and `buildPivotSheet(spec, rows, options)` is how the exporters call it. A workbook is meant
for an analyst who filters, sorts, regroups and prints it:

| Sheet field / option | Workbook |
|---|---|
| `preamble`, `tableRow` | Title (bold), subtitle, units and one `Filters: …` line above the table on the report sheet, then a blank row; panes are frozen below the header rows. Options `title` / `subtitle` / `units` override them (`null` drops one), like the PDF options. |
| `bodyRows[].outlineLevel`, `summaryBelow`, `outlineLevels` | Excel row outline (+ / − buttons): the number of groups a row is detail of. With subtotals at the top a group row is the summary of the rows below it; with `subtotal: "end"` the group's heading row collapses with its children and the subtotal row below stays (one level up). Excel has one summary position per sheet: below when the sheet has `subtotal: "end"` rows, else above. At most 7 levels. |
| `bodyRows[].hidden`, `collapsed`; option `detail` | Groups collapsed in the view (`expanded`) are written **with** their rows, hidden, so the recipient can expand them; `buildPivotSheet` builds the expanded report from the same cube (view stage only). The row carrying the outline button gets Excel's `collapsed` flag. A collapsed `subtotal: "none"` group shows the view's totals on its row. |
| `cells[].indent` | Compact layout: indent levels (Excel alignment indent) instead of leading spaces, so labels stay exact for filters and lookups. `pivotSheetToMatrix` re-adds two spaces per level for text output; option `indent: "  "` restores the old spaces. |
| option `rowLabels` | Tabular layout: `repeat` (default) writes a group's label on every row of the group (Excel's "Repeat all item labels"), so AutoFilter and sort keep each row's context; `first` writes it once (Excel's pivot default); `merge` merges the cells like the PDF (filtering and sorting then fail in Excel). No body merges unless `merge` (the grand-total label is merged only then). |
| option `profile: "statement"` → `profile`, `cells[].border` | Thin rule above subtotal values, thin rule above and double rule below the grand total, totals bold, no grey bands. |
| option `subtotalFormulas` (needs `spec`) → `cells[].f` | Opt-in `SUBTOTAL(9, C5:C9)` formulas on group, subtotal and grand-total cells of plain `sum` / `count` measures without show-as (others keep values). `SUBTOTAL` skips nested `SUBTOTAL` cells, so each range spans all of a group's detail rows and still adds each leaf once; function 9 includes rows hidden by the outline (collapsed groups keep their totals) and drops rows hidden by an AutoFilter (Excel's behaviour). The computed value stays cached in the Node workbook; openpyxl cannot store cached values, so a Python-written workbook shows them after Excel / LibreOffice recalculates on open (readers with `data_only=True` see `None`). Off by default because a reader that does not calculate would see empty totals, and because rows the analyst deletes would change them. Both writers' formulas were checked against a LibreOffice recalculation (all equal). |
| print setup (writers) | Landscape, fit to one page wide (any height), header rows repeated on every page (print titles), title left / units right in the page header, generated-at left and "Page N of M" right in the footer. |
| unchanged | Numeric cells with Excel `numFmt` (percent values are ratios, `format.scale` as scaling commas), heat fills, bold subtotals, column widths, the `KPIs` sheet and the hidden `Spec` sheet. |

Export options: `profile`, `title`, `subtitle`, `units` and `xlsx: { rowLabels, subtotalFormulas }` apply to
`format=xlsx` and to `format=sheet` (so the Python writer paints the same rows). PDF still goes through the Node
renderer (below) so it matches the app.

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
| `PivotTable` | Semantic `<table>` (memoized): header chart band, row-dimension columns, outer-dimension span cell with `PivotKpiPanel`, heat cells, sort / filter indicators, multi-row column headers. Props: `mode`, widths, `headerChart`, `headerSummary`, `kpiHeadlineId`, `kpiCaptionAttribute`, `renderSpanCell` (KPI side-panel slot), `renderDimensionHeader` (filter-menu slot), `onToggleColumnGroup`, `renderColumnHeader`, and the design props ([Customize the design](#customize-the-design-050)). |
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
  `useLayoutEffect` / `ResizeObserver`. (The design handles measure only on a double-click auto-fit,
  and design work is cached per model in `WeakMap`s, not hooks.) `mode="static"` additionally drops buttons and sticky classes.
- **Inline geometry, tokenized chrome.** Widths, offsets, bar paths and data colors are inline styles;
  surfaces and typography are class tokens in `@nqlib/nqgrid/styles` (`pivot*Class`). Each token starts with a
  stable semantic class (`nqg-pivot`, `nqg-pivot-cell`, `nqg-pivot-kpi`, …) that the static stylesheet targets. Colors resolve via
  `--nqg-heat-0 … --nqg-heat-8` (default: `--nqg-heat-color` mixed over the surface, so one ramp works in
  light and dark) and `--nqg-series-0 … --nqg-series-7` (`pivotThemeVars("dark")` for dark steps).
- No `@nqlib/nqui` dependency — the playground's "Pivot showcase" adds nqui controls (Select, Button, ScrollArea, Popover) around it.

## Customize the design (0.5.0)

`PivotTable` takes design props so a host can let a person change the look of a pivot. The grid stays a
**controlled component**: it keeps no design state. Each change comes out through a callback, and the
host stores it (secolab keeps it in the chart params) and renders again with the new props. Every prop
is optional; with none set the markup is byte-identical to 0.4.0 (`src/pivot/pivot-table-baseline.test.ts`
checks this against snapshots written by the 0.4.0 renderer).

```tsx
import { PivotTable, type PivotBarSpec, type PivotHeatSpec } from "@nqlib/nqgrid/pivot";

function DesignedPivot({ model, design, onDesignChange }: Props) {
  const patch = (p: Partial<Design>) => onDesignChange({ ...design, ...p });
  return (
    <PivotTable
      model={model}
      valueWidths={design.valueWidths}
      dimensionWidths={design.dimensionWidths}
      rowHeight={design.rowHeight}
      measureOrder={design.measureOrder}
      // Called every animation frame while dragging (info.final === false) and once at the end.
      onValueWidthChange={(key, width, info) => patch({ valueWidths: { ...design.valueWidths, [key]: width } })}
      onDimensionWidthChange={(index, width) => patch({ dimensionWidths: withIndex(design.dimensionWidths, index, width) })}
      onRowHeightChange={(rowHeight) => patch({ rowHeight })}
      onMeasureOrderChange={(measureOrder) => patch({ measureOrder })}
      freezeHeader={design.freezeHeader}
      freezeDimensions={design.freezeDimensions}
      heat={design.heat}
      bars={design.bars}
      measureLayout={design.measureLayout}
      bandedRows={design.bandedRows}
      dataAttributes
      cellClassName={(ctx) => (ctx.column.measureId === "variance" ? "font-medium" : undefined)}
    />
  );
}
```

Persist on `info.final` if saving is expensive; the `final: false` calls exist so the column follows the
pointer. A resize only changes widths: the measure order, heat levels and bar lengths are cached per
model object (a `WeakMap`), so a drag never recomputes them, and the model itself is never rebuilt.

### Props

| Prop | Type | What it does |
|---|---|---|
| `valueWidths` | `Readonly<Record<string, number>>` | Width per value column, keyed by `PivotValueColumn.id` (measure id + column path, e.g. `c:Nov:actual`). Falls back to `valueWidth`. |
| `onValueWidthChange` | `(key, width, info) => void` | Interactive mode: a `role="separator"` handle on the right edge of each column's bottom header cell (`aria-label="Resize column Nov Actual"`, `aria-valuenow`). Drag (48–800 px), double-click to fit the widest **rendered** cell (header included), or focus it: ArrowLeft / ArrowRight 8 px, Shift 32 px, Home / End to the limits. Escape during a drag restores the start width (sent with `final: true`). |
| `onDimensionWidthChange` | `(index, width, info) => void` | The same for the row-label columns (`index` into `dimensionWidths`; one column in compact layout). |
| `onRowHeightChange` | `(height, info) => void` | A handle on the bottom edge of the first body row (in its first value cell): 20–96 px, ArrowUp / ArrowDown 4 px, Shift 16 px. `rowHeight` / `headRowHeight` stay the props they were. |
| `measureOrder` | `readonly string[]` | Order of the value measures. Within each run of sibling measure headers (all measures of one column group, or the outer Σ Values row) the measures and everything under them trade places. Ids not listed keep their place after the listed ones; unknown ids are ignored. Column-dimension members never move: their order comes from the model sort. Same as rendering `pivotOrderMeasures(model, order)`. |
| `onMeasureOrderChange` | `(order) => void` | Interactive mode: measure headers become draggable (`cursor: grab`; a 4 px threshold, then an inset line and `data-nq-drop="before\|after"` on the target; Escape cancels) and focusable (`tabindex="0"`, `aria-keyshortcuts`): Alt+ArrowLeft / Alt+ArrowRight move the focused measure, and focus follows it. Called with the full new order. Clicks on buttons, handles and field-list drag handles inside a header keep their own gesture. |
| `freezeHeader` | `boolean` | Interactive (default on): sticky header rows and header chart band. Off: they scroll away. Static: `false` prints the header once instead of on every page (`<thead style="display:table-row-group">`). |
| `freezeDimensions` | `boolean` | Interactive (default on): sticky row-label columns. Both work with `virtualize` and `pagination`. |
| `cellClassName` | `(ctx: PivotCellContext) => string \| undefined` | Extra class on a value cell. |
| `rowClassName` | `(row, { kind, index }) => string \| undefined` | Extra class on a body row; `kind` is `leaf` (leaf and calculated rows), `subtotal` (group and subtotal rows) or `total`. |
| `headerClassName` | `(ctx: PivotColumnHeaderContext) => string \| undefined` | Extra class on a value header cell. |
| `bandedRows` | `boolean` | `data-nq-band="odd\|even"` on body rows (first row `odd`, by index in `model.rows`, so bands stay put when virtualized). |
| `dataAttributes` | `boolean` | `data-nq-row-kind` on every body cell, `data-nq-measure` and `data-nq-negative` (displayed value below 0) on every value cell. Off by default so 0.4.0 markup stays byte-identical. |
| `heat` | `PivotHeatSpec \| readonly PivotHeatSpec[]` | Heat from one spec or several (e.g. one per measure; a later spec on the same cells wins), computed from the displayed values (`cell.value`) of the rendered model. Replaces the model's own heat (`spec.heat`); `[]` removes it. Cells get `data-nq-heat="<step 0–8>"`, `data-nq-heat-scale="sequential\|diverging"` and `background-color: var(--nq-pivot-heat-N)` (diverging: `var(--nq-pivot-heat-diverging-N)`). |
| `bars` | `readonly PivotBarSpec[]` | Data bars: `{ measure, applyTo?: "leaf" \| "group" \| "all", domain?: [min, max], negative?: "left" \| "hide" }`. One domain per spec over the measure's leaf columns (not subtotal or row-total columns), always including 0. An empty `aria-hidden` span (`data-nq-bar`, `data-nq-bar-negative`) is placed absolutely behind the number at `z-index: -1` inside the cell's own stacking context, so it paints above the heat background and below the text. Width and offset are percentages; the color is `var(--nq-pivot-bar)` / `var(--nq-pivot-bar-negative)`. |
| `measureLayout` | `Readonly<Record<string, { align?, wrap? }>>` | Per measure: `align` (`start` / `end` / `center`) for its value cells and bottom header cells, `wrap` (`wrap` lets text wrap; `clip` keeps one line and cuts it). |

To **rename a header**, use the existing `renderColumnHeader`: return your own label for the cell
(`ctx.kind === "measure" && ctx.cell.measureId === "plan" ? "Budget" : ctx.label`). Keep the callback
stable (`useCallback`), since `PivotTable` is memoized.

`PivotHeatSpec` (also in `spec.heat`) gains `scale?: "sequential" | "diverging"` and `midpoint?: number`
(default 0). A diverging ramp puts the midpoint on the middle level (`floor(levels / 2)`, step 4 of 9),
values below it on lower levels and values above on higher ones; any value off the midpoint is at least
one level away from the middle. Without `domain` both sides share the larger distance from the
midpoint, so equal distances get equal colors. Use an odd `levels` for a symmetric ramp. The JSON
schema and `validatePivotSpec` accept both keys.

### Colors

The grid writes no color values, only references to CSS variables. Define them on any ancestor and
map them to your tokens:

| Variable | Used by |
|---|---|
| `--nq-pivot-heat-0` … `--nq-pivot-heat-8` | sequential `heat` (low → high) |
| `--nq-pivot-heat-diverging-0` … `--nq-pivot-heat-diverging-8` | diverging `heat` (4 is the midpoint) |
| `--nq-pivot-bar`, `--nq-pivot-bar-negative` | `bars` (negative falls back to `--nq-pivot-bar`) |
| `--nq-pivot-drop-indicator` | measure drag indicator (default `currentColor`) |

The model's own heat (`spec.heat`, without the `heat` prop) still uses `--nqg-heat-N` as in 0.4.0. The
resize handles carry `pivotResizeHandleClass` (`nqg-pivot-resize`, visible on hover and focus).

### Export the same design (XLSX)

`pivotTableGeometry(model, options)` takes the design options and returns what an exporter needs:

```ts
const ordered = pivotOrderMeasures(model, design.measureOrder);   // the model PivotTable renders
const g = pivotTableGeometry(ordered, {
  dimensionWidths: design.dimensionWidths,
  valueWidth: design.valueWidth,
  valueWidths: design.valueWidths,
  freezeHeader: design.freezeHeader,
  freezeDimensions: design.freezeDimensions,
  heat: design.heat,
  bars: design.bars,
});
g.columnWidths;   // px, dimension columns then value columns
g.frozenRows;     // header rows (ySplit under your title rows); 0 with freezeHeader: false
g.frozenColumns;  // row-label columns (xSplit); 0 with freezeDimensions: false
g.cells?.[r]?.[c]; // { heat?: { level, levels, step, scale }, bar?: { start, width, negative } }
```

`cells` is present when `heat` or `bars` is passed (`heat: undefined` with `bars` reports the model's
own heat levels). The new fields are optional on the `PivotTableGeometry` type, so code that builds its
own geometry objects keeps compiling; `pivotTableGeometry` always sets them.

### Limits

- `@nqlib/nqgrid/render-static` (HTML / PDF) does not pass the design props through yet; it splits wide
  pivots into column chunks, so heat and bar domains would be per chunk.
- Auto-fit measures the rendered cells only (virtualized rows outside the window are not measured).
- The row handle lives in the first body row; when that row is scrolled out of a virtualized window,
  use the keyboard on it after scrolling back, or set `rowHeight` from your own control.

## Static HTML (`@nqlib/nqgrid/render-static`)

```ts
import { renderPivotHtml, renderPivotHtmlFromSpec, PIVOT_STATIC_CSS } from "@nqlib/nqgrid/render-static";

const html = renderPivotHtml(model, {
  theme: "light",                                   // or "dark"
  page: { size: "A4", orientation: "landscape", margins: { top: 16, right: 10, bottom: 14, left: 10 } }, // mm
  title: "FY26 Sales Plan", subtitle: "Actuals",    // default: model.title / model.subtitle
  generatedAt: "2026-10-30 09:00 UTC",              // passed in (string or Date) → byte-identical output
  maxColumnsPerPage: 6,                             // default: fit at minScale (0.7), else balanced chunks
  locale: { lang: "de", continued: "(Forts.)" },     // also repeated on continuation pages of long groups
  kpiPanel: true,
  profile: "statement",                             // "report" (default) or finance-statement emphasis
  units: "EUR thousands",                           // default: model.units (spec.units); null hides it
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
| Column paging | Beyond that (or with `maxColumnsPerPage`), value columns split into **balanced chunks** that never split a top-level header (12 at 5/page → 4 + 4 + 4). With several column fields, a top-level group wider than a page is split along its next header level instead (`pivotColumnUnits(model, maxColumns)`). Each chunk is its own table starting on a new page, repeats the dimension columns and the full-year band summary, keeps one header-bar scale, and is titled "… (cont.)" with "Month May – Oct · Columns 7–12 of 12". |
| Rows | `<thead>` (header chart band + column headers) repeats on every page. Rows are paginated from their fixed heights (`pivotPageBodySegments`): a top-level group that fits the rest of the page stays there, one that fits a fresh page starts one, and a group taller than a page is split, filling the current page first (so a long first section never leaves page 1 with only the title), with "Section 0 (cont.)" repeated at the top of each continuation page (`locale.continued`) and at least two rows (last line + subtotal) carried over. Page breaks are explicit (`break-before: page` on the first row); each segment is a `<tbody>` with `break-inside: avoid`. |
| Print affordances | No child-count badges and no sort / filter icons in static output (`PivotTable` `countBadges` / `headerIndicators` turn them back on); `aria-sort` stays. |
| Profile | `profile: "report"` (default) prints like the app. `profile: "statement"` appends `PIVOT_STATIC_STATEMENT_CSS`: subtotal, group and grand-total rows bold in the full text colour on the page surface (no grey band), a rule above subtotal values, a rule above and a double rule below the grand total, no hairlines between lines, 28 px rows unless `table.rowHeight`. |
| Tall KPI panels | When a department's KPI panel is taller than its rows (`pivotKpiPanelHeight` vs `rowSpan × rowHeight`), static mode adds a blank filler row covered by the span cell, so data rows keep their height. |

Pure helpers: `pivotStaticLayout`, `resolvePivotStaticPage`, `pivotColumnChunks`, `slicePivotModelColumns`,
`pivotColumnsPerPage`, `pivotHeatFillHex` / `pivotHeatLevelFillHex` (also used for XLSX fills).

## Export CLI & service (`packages/nqgrid-export`)

`@nqlib/nqgrid-export` (bin `nqgrid-export`) turns `{ spec, rows, options? }` into PDF (Playwright Chromium:
`setContent` + `page.pdf`, running header with the title and "Page X of Y" footer), XLSX (exceljs from
`buildPivotSheet`: preamble lines, row outline with collapsed groups hidden, values + numFmt, frozen panes, print
setup, statement rules, optional `SUBTOTAL` formulas, heat fills, widths, `KPIs` sheet, hidden `Spec` sheet; see
[Workbooks](#workbooks-xlsx-and-the-sheet-shape)), HTML, or the model / sheet JSON. Full reference: [`packages/nqgrid-export/README.md`](../packages/nqgrid-export/README.md).

```bash
nqgrid-export --input req.json --format pdf --out report.pdf          # or --input - / --out -
nqgrid-export --spec spec.json --rows rows.json --out report.xlsx     # format from the extension
nqgrid-export serve --port 8787                                       # 127.0.0.1, one warm Chromium
```

- **Validation** — `validatePivotSpec` (as strict as the JSON Schema: unknown keys and bad enums are errors) plus
  request/option checks (unknown option keys too); errors print as JSON on stderr. Exit `2` = invalid input (HTTP
  400), `1` = internal error. Data diagnostics do not fail an export: the CLI prints them as one JSON line on stderr
  with exit `0`, serve mode in the `x-nqgrid-diagnostics` header.
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
   KPI side-panel slot; static render mode; playground "Pivot showcase".
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
   ([pivot-performance.md](./pivot-performance.md)).
7. **Excel parity, step 2 — done.** Field catalogue (`fields`, `fieldLabels`, inference), `valuesIndex` (Σ Values
   position), pure move helpers with documented rules, `PivotFieldList` with dependency-free pointer and keyboard
   drag-and-drop, draggable grid headers, "Defer layout update", MCP field catalogues per dataset.
8. **Excel parity, step 3 — done.** Several column fields (`columns` as a list, `oneOf` in the schema, version 1),
   subtotal columns per level (`end` / `start` / `none`), the generalized grand total column, collapsible column groups
   (`columnsExpanded`, `togglePivotColumnGroup`), `percentOfParentColumn`, multi-row headers in React / HTML / PDF /
   XLSX, `renderColumnHeader` with draggable column headers, one shared deferred-layout draft
   (`usePivotLayoutDraft`), and Excel-style date grouping (`orderDate:year` …, UTC parsing, fiscal years, chronological
   keys, gap filling, "Group by…" in the field list, default Year → Quarter on drop).
9. **Excel parity, step 4 — done.** Calculated measures (`calculate`, a safe tokenizer + recursive-descent parser with
   bounded length / depth, whitelisted functions and shared test vectors mirrored in Python), "show values as"
   differences / running totals / ranks along a row or column field (`showAsBase`), row subtotals at top / bottom / off
   (`subtotal` rows), distinct count without per-bucket sets, drill-through to source records (`pivotDrillThrough`,
   `PivotTable.onDrillThrough`, `PivotDrillThroughPanel`), and their editors in the field list
   (`PivotCalculatedMeasureForm`, `PivotShowAsMenu`, subtotal positions, Distinct Count).
10. **Financial statements — done.** `percentOf` (Excel "% Of") with `showAsBase.scope: "all"` (one base item for every
   row, also for differences), `measures[i].signField`, per-level `subtotalLabel`, "% of" and "Compare with" in
   `PivotShowAsMenu`, the `planning-statement` golden and the [P&L recipe](./pivot-recipes.md).
11. **Planning (analyst review, batches A and B) — done.** Strict validation with shared vectors, `diagnostics`,
   `format.scale` / `units`, the statement print profile; measure-level filters, `closingBalance` / `openingBalance` /
   `averageOverTime`, analyst workbooks (outline, print setup, preamble, statement rules, optional `SUBTOTAL`
   formulas) and the `planning-fpa` goldens.
12. **Calculated items (analyst review, batch C) — done.** `rows[i].calculatedItems` (formula rows over keys, cascading
   totals, anchored placement, `includeInTotals`), per-group `subtotalLabels`, per-key `itemFormats`, the `calculated`
   row kind in every renderer, `PivotCalculatedItemForm`, diagnostics for unknown keys, the `planning-income` golden.
   Next: row-level computed fields (latest estimate = actual where closed, else budget), references to keys of
   other fields / deeper levels in item formulas, calculated items on column fields, hiding the section heading row
   of bottom subtotals, Σ Values in Rows, "% of parent" with a chosen base field, grouping of numeric fields into
   ranges, sentiment (favourable / unfavourable) flags.
