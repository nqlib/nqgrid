# Changelog

All notable changes to `@nqlib/nqgrid` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) from **1.0.0** onward. Prior to 1.0, minor releases may include API adjustments.

## [0.6.0] - 2026-11-19

A **minor** release: it only adds API. Every new prop and field is optional. With none set, the markup is the same as 0.5.0
(`src/pivot/pivot-table-baseline.test.ts`, `src/pivot/pivot-table-style-slots.test.ts`). No export was
removed or renamed. `PivotSpec` stays `version: 1`.

### Added

- **`PivotTable` `cellTone`** (`@nqlib/nqgrid/pivot`): a tone key for one value cell, for example the
  color key of a conditional rule. The cell gets `data-nq-tone="<key>"` and
  `background-color: var(--nq-pivot-tone-<key>)`. A toned cell draws no heat; its data bar stays.
- **`PivotTable` `toneColors`**: optional map of tone key → colour (`isPivotToneColor`: hex,
  `transparent`, `color-mix(...)`, `var(--token)`). Written as `--nq-pivot-tone-<key>` on that table
  root. Omitting the map leaves host-stylesheet variables as they were. Not part of `PivotSpec`.
- **`PivotHeatSpec.palette`**: 2 or 3 tone keys (`[low, high]` or `[low, middle, high]`), in the `heat`
  prop and in `spec.heat` (model, `validatePivotSpec`, JSON schema). The steps come from
  `var(--nq-pivot-tone-<key>)` and an oklab `color-mix` between two stops. With 3 stops, the middle key
  is the `midpoint` of a diverging spec. `PivotModel.heat.palette` and
  `PivotCellHeat.palette` (`pivotTableGeometry` cells) carry it.
- **`pivotTableGeometry` `cellTone`** (and `pivotCellDesigns`): a toned cell reports
  `cells[r][c].tone` and no `heat`, as `PivotTable` draws it, so an exporter writes the same rule colors.
- **`renderPivotHtml` `table.cellTone` / `table.toneColors`**: forwarded onto the static `PivotTable`.
- **`writePivotXlsx` `cellTone` / `toneColors`**: Excel fills from `#rgb` / `#rrggbb` only. A toned cell
  wins over heat; a `model.heat.palette` blends stop hexes (`pivotPaletteFillHex`). A palette stop
  with no usable hex paints no fill (no built-in-ramp fallback). Wire: `options.xlsx.toneColors` and
  `options.table.toneColors`.
- New exports: `PivotCellTone`, `PivotHeatPalette`, `pivotModelCellHeat` (`/pivot`);
  `pivotToneVar`, `pivotHeatPaletteColor`, `isPivotToneKey`, `isPivotToneColor`, `isPivotHeatPalette`
  (`/core`, also re-exported from `/pivot`); `pivotPaletteFillHex`, `isPivotToneHex` (`/render-static`).

### Changed

- `pivotHeatPaletteStep` is now defined in `@nqlib/nqgrid/core`, so a Node bridge that imports only
  `/core` can map heat levels to palette steps. `/pivot` still exports it; no import changes.

### Playground

- Pivot showcase → **Design**: the stories "Cell tone" and "Heat palette".

### Notes

- The host owns light / dark colour tokens (`--chart-*`, `--destructive`, and any product keys).
  nqgrid stores tone **keys** and paints `var(--nq-pivot-tone-<key>)` or the values in `toneColors`.
  Point those at the same tokens as nqchart so one theme drives chart, grid and UI. Excel still needs
  concrete `#rgb` / `#rrggbb` at export time.

## [0.5.0] - 2026-11-18

A **minor** release: a host app can let a person customize the design of a `PivotTable`. Every new
prop is optional, and with none set the markup is byte-identical to 0.4.0 (checked against snapshots
of the 0.4.0 renderer). No default changed, and no export was removed or renamed. `PivotSpec` stays
`version: 1`.

### Added

- **`PivotTable` design props** (`@nqlib/nqgrid/pivot`). The grid keeps no design state: each change
  comes out through a callback and the host passes it back as a prop. See
  [Customize the design](docs/pivot-headless.md#customize-the-design-050) and the README section.
  - **Column widths:** `valueWidths` (by `PivotValueColumn.id`), `onValueWidthChange(key, width, info)`,
    `onDimensionWidthChange(index, width, info)`. A `role="separator"` handle on the right edge of each
    header: drag (48–800 px), double-click to fit the widest rendered cell, ArrowLeft / ArrowRight
    (8 px, Shift 32 px). `info` says the source and whether the gesture ended (`final`).
  - **Row height:** `onRowHeightChange(height, info)`, a handle on the first body row (20–96 px).
  - **Measure order:** `measureOrder`, `onMeasureOrderChange(order)`. Drag a measure header (drop
    indicator, Escape cancels) or press Alt+ArrowLeft / Alt+ArrowRight on it. Column-dimension members
    keep the model's sort.
  - **Freeze:** `freezeHeader`, `freezeDimensions` (on by default in interactive mode, as before; work
    with `virtualize` and `pagination`).
  - **Style hooks:** `cellClassName`, `rowClassName`, `headerClassName`, `bandedRows`
    (`data-nq-band`), `dataAttributes` (`data-nq-measure`, `data-nq-row-kind`, `data-nq-negative`).
  - **Heat on several measures:** `heat` takes one `PivotHeatSpec` or a list. Cells get
    `data-nq-heat`, `data-nq-heat-scale` and a `var(--nq-pivot-heat-N)` /
    `var(--nq-pivot-heat-diverging-N)` background.
  - **Data bars:** `bars: PivotBarSpec[]` (`measure`, `applyTo`, `domain`, `negative: "left" | "hide"`),
    colored by `--nq-pivot-bar` / `--nq-pivot-bar-negative`; the number stays selectable text.
  - **Per-measure layout:** `measureLayout` (`align`, `wrap`) by measure id.
  - **Per-measure widths:** `measureWidths` and `onMeasureWidthChange` (one width for every column
    of a measure; `valueWidths` entries win).
  - **Resize look:** `data-nq-resizing` on the handle and the table while dragging, an opt-in
    `resizeGuide` line (`--nq-pivot-resize-guide`, `--nq-pivot-resize-guide-size`) and
    `--nq-pivot-resize-size` for the grab area.
  - **Number formats:** `numberFormats: PivotFormatRule[]` — Excel's "Format Cells" (digits,
    currency, percent, scale, compact, prefix / suffix, negatives) for a measure, column, row, row
    kind or one cell, most specific first; display only. `onCellClick` reports a clicked value cell.
- **Saved views:** `PivotTableDesign` (the whole design as JSON) and `pivotDesignProps(design,
  onDesignChange, { widthScope })`, which returns the props and the callbacks that produce the next
  design. `pivotCellFormats`, `pivotCellBaseFormat`; `pivotTableGeometry` takes `measureWidths` and
  `numberFormats` (each cell's `numberFormat`: format, Excel format, text).
- **`PivotHeatSpec.scale`** (`"sequential" | "diverging"`) and **`midpoint`**, in `spec.heat` too
  (model, `validatePivotSpec`, JSON schema). `PivotModel.heat` carries `scale` / `midpoint` for a
  diverging spec. New `pivotDivergingHeatLevel`, `pivotScaledHeatLevel` (`@nqlib/nqgrid/core`).
- **`pivotTableGeometry` for export:** new options `valueWidths`, `freezeHeader`, `freezeDimensions`,
  `heat`, `bars`; new result fields `valueWidths`, `columnWidths`, `frozenRows`, `frozenColumns` and
  `cells` (heat / bar level of each cell), so a host can write the same design to XLSX. The new
  fields are optional on the `PivotTableGeometry` type.
- New exports: `PivotBarSpec`, `PivotMeasureLayout`, `PivotResizeInfo`, `PivotValueWidthChangeHandler`,
  `PivotDimensionWidthChangeHandler`, `PivotRowHeightChangeHandler`, `PivotMeasureOrderChangeHandler`,
  `PivotCellClassName`, `PivotRowClassName`, `PivotHeaderClassName`, `PivotRowClassContext`,
  `PivotCellDesign(s)`, `PivotHeatScale` (also re-exported with `PivotHeatSpec` from `/pivot`),
  `pivotCellDesigns`, `pivotOrderMeasures`, `pivotMeasureOrder`, `pivotMoveMeasure`,
  `pivotHeaderLayout`, `pivotRowDesignKind`, `pivotHeatPaletteStep`, `pivotClampColumnWidth`,
  `pivotClampRowHeight`, `PivotFormatRule`, `PivotCellNumberFormat`, `PivotTableDesign`,
  `PivotDesignChangeInfo`, `PivotDesignProps`, `PivotMeasureWidthChangeHandler`, the `PIVOT_COLUMN_WIDTH_*` / `PIVOT_ROW_HEIGHT_*` limits, and
  `pivotResizeHandleClass` (`@nqlib/nqgrid/styles`).
- `PivotHeaderChartBand` props `stickyTop` / `stickyLeft` (default true).
- `bench/pivot-render.bench.ts`: 10,000 visible cells with heat + bars + `virtualize` render in 44 ms
  at best and 49–53 ms on average (budget 50 ms, borderline; results in `docs/pivot-performance.md`).

### Playground

Playground only (`apps/playground`); not in the npm package.

- Pivot showcase → **Design** (`?pivot=design:<story>`): one story per design feature (column widths,
  row height, measure order, freeze, style hooks, heat, data bars, per-measure layout, number formats,
  saved view) plus "All together", with the page acting as the host that stores the design.

### Notes

- `@nqlib/nqgrid/render-static` does not pass the design props through yet, and it (like the Python
  XLSX writer) colors a diverging `spec.heat` with the sequential ramp.

## [0.4.0] - 2026-11-14

A **minor** release: calculated items, measure filters, semi-additive aggregates, analyst
workbooks and financial statements for the pivot. `PivotSpec` stays `version: 1`.

### Breaking

Check these before you upgrade from 0.3. Details are under each "Changed (behaviour)" below.

- **Stricter validation.** `validatePivotSpec` rejects unknown keys and invalid values that 0.3.0
  accepted and half-ignored, and some referential cases (`keepEmpty` on a row dimension, an unused
  `showAsBase`, a calculated measure over a shown-as measure). `nqgrid-export` rejects unknown
  `options` keys. Validate your stored specs before you deploy.
- **Sheet and XLSX layout.** Compact labels carry `indent` instead of leading spaces (option
  `indent: "  "` restores the old cells), tabular labels repeat and the body has no merges
  (`rowLabels: "merge"` restores them), and the table starts below the title rows, so cell
  addresses move.
- **New row kind.** `PivotBodyRow["kind"]` gains `"calculated"` and `PivotDimensionSlot` a
  `calculated` variant: an exhaustive `switch` needs a case.
- **Interfaces gained members.** `PivotRowEncoding` has `stats` and the nqgrid-export
  `PivotExporter` has `exportDetailed`: a custom implementation must add them.
- **Number parsing.** `"0x10"`, `"0b11"` and `"0o7"` are no longer numbers; they are reported as
  `unparsedNumbers`.

No public export was removed or renamed.

### Playground: pivot showcase

Playground only (`apps/playground`); no engine or public API change.

- The "Planning pivot" tab is now **Pivot showcase**: three examples that together exercise every pivot feature, each
  feature linked to its section in `docs/pivot-headless.md` / `docs/pivot-recipes.md` (the docs explain them one by
  one). **Sales workbench**: one spec with slicers, filter menus, sort, Top N, the field list, column groups, fiscal date
  grouping, calculated measures, show values as, distinct count, KPI panel, heat and drill-through. **Finance
  reports**: one long-format ledger read as budget vs actual (measure filters, scale and units), an income statement
  (calculated items, % of revenue, sign field, subtotal labels) and a balance sheet with headcount (closing / opening
  balance, average over time). **Scale**: 100k–500k generated rows with row virtualization and live build times.
- Shared panels under every example: **Spec** (the live spec, with the keys changed since load), **Validate**
  (editable JSON through `validatePivotSpec`, "Try a bad spec"), **Diagnostics** (`model.diagnostics`, with a switch
  that injects unparsable values) and **Export** (request JSON, `renderPivotHtml` preview with the report / statement
  profile, PDF / XLSX through `VITE_NQGRID_EXPORT_URL`).
- `?pivot=<id>` deep links keep working (`planning`, `dates`, `calc`, `statement`, `income`, `fpa`, `balance`) and open
  the pivot tab, on the example that now covers them.
- The playground resolves `@nqlib/nqgrid/core`, `/pivot`, `/render-static` and `/styles` to the library sources, like
  the other entry points, so it no longer needs a fresh `dist/` build.

### Analyst review, batch C: calculated items, cascading totals, per-group subtotal labels

`PivotSpec` stays `version: 1`; the schema changes are additive (`rows[i].calculatedItems`, `subtotalLabels`,
`itemFormats`, the `calculatedItem` definition). Specs without them produce byte-identical models, sheets and HTML
(every existing golden unchanged).

#### Added

- **Pivot core** — `rows[i].calculatedItems` (`PivotCalculatedItem`: `key`, `formula`, `label`, `after` / `before` / `position`, `format`, `includeInTotals`): Excel calculated items, rows computed by a formula over keys of the same field (siblings under the same parent; at the outermost level the field's groups, e.g. P&L sections) per column bucket and measure from aggregated values — the total column is the formula over the totals. Items may reference other items (cascading totals: EBITDA = `[Gross margin] + [Operating expenses]`); the calc grammar and limits are reused, any key may be referenced (`__proto__` included: keys resolve through `Map`s). Anchored placement that survives `sortBy` / `order` / Top N; shown only under parents with at least one key they read; left out of totals unless `includeInTotals: true` (Excel's behaviour, which double counts statement rows). Calculated measures on an item row evaluate over the item's values of their references; `showAs` applies where an item has a base (row-field bases leave the cells empty); no heat, sorting, Top N, KPIs or facets. View-only: not part of `pivotSpecDataKey`, zero cost for specs without items.
- **Pivot core** — `rows[i].subtotalLabels` / `columns[i].subtotalLabels` (per-group subtotal labels, `{label}` template) and `rows[i].itemFormats` (number format per key; also covers per-line formats in statements). Body rows of `kind: "calculated"` with `formula`, and `format` / `excelNumFmt` on rows with a format override; `pivotCalculatedItemRowId`. Diagnostics `itemKeyNotFound` (keys named by items, anchors, labels or formats that the data does not have) and `itemKeyConflict` (an item key that is also a data key).
- **Pivot core** — drill-through of an item cell lists the records of every key it reads; sheets write item rows bold with the statement rule and the item's `numFmt`, and keep values instead of `SUBTOTAL` over ranges that contain an item; tabular slots get a `calculated` slot. Helpers `setPivotCalculatedItem` (rename rewrites references and anchors), `removePivotCalculatedItem`, `checkPivotCalculatedItem`, `pivotItemReferencers`, `pivotItemReference`, `parsePivotItemFormula`, `setPivotSubtotalLabel`; `ParsePivotCalcOptions.allowReservedNames`.
- **`@nqlib/nqgrid/pivot`** — `PivotCalculatedItemForm` (formula validated as you type, insert-item picker, position, format, "Add to totals") opened from a Rows chip, which lists the field's items; reducer actions `setCalculatedItem`, `removeCalculatedItem`, `setSubtotalLabel` and the matching `usePivotGrid` functions; `PivotTable` renders calculated rows like subtotal rows (formula tooltip in interactive mode).
- **render-static** — `PIVOT_STATIC_STATEMENT_CALCULATED_CSS` (statement profile: item rows bold with a rule above), appended only when the model has calculated rows.
- **Contract** — schema `calculatedItem`, dimension keys `calculatedItems` / `subtotalLabels` / `itemFormats`; shared validation vectors (placement, duplicates, cycles, oversized / deeply nested formulas, `__proto__` / `constructor` keys) and item-formula calc vectors (`calc-expressions.json` `items`); golden `examples/planning-income.*` (income statement with Gross margin, Gross margin %, EBITDA, per-section labels); fixture `generateIncomePivotRows` / `incomePivotSpec`.
- **Python** — validation mirror with identical messages, `parse_calc(..., allow_reserved=True)`, `check_calculated_item`, `income_example_spec()` (also in `describe_pivot_spec`), regenerated Pydantic models (`CalculatedItem`), authoring guide section "Calculated items" and a rewritten "Financial statements" section, e2e tests through `nqgrid-export serve` (golden model / sheet / HTML, statement PDF, XLSX with exceljs and openpyxl).
- **Docs / playground** — the financial-statement recipe now uses calculated items (section subtotals only stays as the simpler variant; Limits table updated); `docs/pivot-headless.md` "Calculated items" and per-key formats; performance notes; `?pivot=income`.

#### Changed (behaviour)

- `stripColumnOnly` (moving a row field into Columns, swapping rows and columns) also drops `calculatedItems` and `itemFormats`, which are row-only.
- `PivotBodyRow["kind"]` gains `"calculated"`, and `PivotDimensionSlot` a `calculated` variant: exhaustive `switch`es over them in consumer code need a case. `PivotBodyGroup.kind` is now `PivotBodyRow["kind"]`. No public export was removed or renamed.

### Analyst review, batch B: measure filters, semi-additive aggregates, analyst workbooks

`PivotSpec` stays `version: 1`; the schema changes are additive (`measures[].filter`, the `TimeAggregate` variant, export
option `xlsx`). Existing specs produce identical models and HTML; the **sheet shape** (`pivotModelToSheet`, `format=sheet`)
and the **XLSX layout** changed (see "Changed (behaviour)").

#### Added

- **Pivot core** — `measures[i].filter`: one filter or a list (same shape as `filters[]`, derived date fields included) restricting the records **that measure** aggregates (DAX `CALCULATE`): rows, columns and totals still come from every record passing the report filters. Long-format Actual / Budget / prior year side by side, variance calculations over them, drill-through with `measureId` lists only the records the measure counted, `filterItemsNotFound` diagnostics for measure filters. Folded into the measure's columns at compile time: zero cost for specs without measure filters. `setPivotMeasureFilter`, `pivotMeasureFilters`, `pivotFilterMask`.
- **Pivot core** — semi-additive aggregates `{ type: "closingBalance" | "openingBalance", timeField }` (per series — the layout's non-time row / column keys — the sum at its latest / earliest time key in the cell, then summed: Q1 = March balance, groups add accounts) and `{ type: "averageOverTime", timeField }` (cell sum / distinct periods: headcount (31 + 32 + 33) / 3 = 32). Correct for groups (expanded and collapsed), subtotal rows, column subtotals, collapsed column groups and totals; work with filters, measure filters, `signField`, show-as, calculated measures, heat, `sortBy` and Top N. `PivotTimeAggregateType`, `pivotTimeAggregateField`, `PivotSummarizeAggregate`, `pivotSummarizeAggregateOf`; `setPivotMeasureAggregate` accepts them (labels "Closing balance of …").
- **Pivot core (sheet)** — `PivotSheet.preamble` / `tableRow` (title, subtitle, units, filters line above the table), `subtitle`, `bodyRows` (Excel outline level, `hidden` rows of collapsed groups, `collapsed` button rows), `summaryBelow`, `outlineLevels`, `profile`, cell `indent`, `border` (statement rules) and `f` (formulas); options `rowLabels`, `detail`, `profile`, `subtotalFormulas` + `spec`, `title` / `subtitle` / `units`; `buildPivotSheet(spec, rows, options)` (model + sheet with collapsed rows from one aggregation), `pivotSheetColumnLetter`, `pivotSheetToMatrix(sheet, { includeHidden })`.
- **nqgrid-export / Python XLSX** — analyst workbooks from both writers: preamble rows, frozen panes below the header, row outline with collapsed groups hidden (not dropped), alignment indent, repeated tabular labels, statement rules and no grey bands with `profile: "statement"`, print setup (landscape, fit to width, print titles, title / units header, generated-at and "Page N of M" footer), opt-in `SUBTOTAL(9, …)` formulas (`options.xlsx.subtotalFormulas`; Node keeps cached values, openpyxl cannot). Export options `xlsx.rowLabels` / `xlsx.subtotalFormulas` (schema, TS and Python validation, models); `writePivotXlsx(model, { sheet, profile })`; `write_xlsx_from_sheet(..., generated_at=)`.
- **`@nqlib/nqgrid/pivot`** — field list: Closing balance / Opening balance / Average over time in "Summarize values by" with an "Over" time-field picker, and "Filter this measure…" (field + values); reducer action `setMeasureFilter`, `usePivotGrid().setMeasureFilter`, `setMeasureAggregate` with semi-additive aggregates.
- **Contract** — goldens `examples/planning-fpa.{spec,rows,model,sheet}.json` + `.html` (long-format budget vs actual with measure filters, variance, YTD, prior year, USD thousands) and `examples/planning-fpa-bs.*` (closing balance, average over time); fixture `generateFpaPivotRows` / `fpaPivotSpec` / `fpaBalancePivotSpec`; new shared validation vectors. Python: `fpa_example_spec()`, `fpa_balance_example_spec()` (also in `describe_pivot_spec`), validation mirror (`filter` on calculated measures, measure filter / time fields in `check_fields`), JSON-type branch errors for `anyOf` (a measure filter's own path and message), e2e tests through `nqgrid-export serve` (PDF, XLSX, openpyxl parity).
- **Docs** — recipes "Budget vs actual (long format)", "Balance sheet", "Headcount", "Analyst workbook (XLSX)" with tested tables; `docs/pivot-headless.md` "Planning" and "Workbooks" sections; authoring-guide sections for measure filters and semi-additive aggregates.
- **Playground** — `?pivot=fpa` and `?pivot=balance` presets.

#### Changed (behaviour)

- **Sheet shape** (`pivotModelToSheet`, `format=sheet`, both XLSX writers): compact labels carry `indent` instead of leading spaces (`v: "Tents"`, `indent: 2`; `pivotSheetToMatrix` re-adds the spaces; option `indent: "  "` restores the old cells); tabular labels repeat on every row of their group and the body has no merges by default (`rowLabels: "merge"` restores them); the sheet always has `tableRow`, `bodyRows`, `summaryBelow`, `outlineLevels`. Golden `*.sheet.json` files changed accordingly; `format=sheet` / `format=xlsx` (via `buildPivotSheet`) now include the rows of collapsed groups, marked `hidden` (`pivotModelToSheet(model)` alone still writes only visible rows). Models and HTML goldens are unchanged.
- **XLSX layout**: the table starts below the preamble rows (`sheet.tableRow`, e.g. row 3 with a title), so cell addresses moved; the page header always carries the title (units on the right when set) and the footer the page numbers.
- `setPivotMeasureAggregate` takes `PivotSummarizeAggregate` (a superset of `PivotBuiltInAggregate`; the reducer action and `usePivotGrid().setMeasureAggregate` too). No public export was removed or renamed.

### Analyst review, batch A: strict validation, diagnostics, scaling, statement print

`PivotSpec` stays `version: 1` and the schema changes are additive (`units`, `format.scale`, export option
`profile` / `units`), but validation is now strict: **specs that were accepted and silently half-ignored are now
rejected** (see "Changed (behaviour)"). No golden spec, row or fixture file needed changing.

#### Added

- **Pivot core** — `format.scale: 1000 | 1000000 | 1000000000` (display in thousands / millions / billions; aggregation and XLSX values unchanged, Excel scaling commas `#,##0.0,`), spec-level `units` (unit note; `model.units`, `PivotSheet.units`), `PIVOT_FORMAT_SCALES`.
- **Pivot core** — `model.diagnostics` (`PivotDiagnostic`: `unparsedNumbers`, `missingField`, `invalidDates`, `mixedKeyTypes`, `filterItemsNotFound`, `baseItemNotFound`; one per field and problem, ≤ 5 samples), gathered while records are encoded (`PivotRowEncoding.stats`, `PivotFieldStats`, `PivotCube.diagnostics` / `hasKey`). Accounting / locale number formats are reported, not parsed.
- **Pivot core** — `pivotUnknownKeysMessage`, `pivotCalcShowAsMessage`, `pivotUnusedShowAsBaseMessage` (the messages shared with Python), `pivotCalcReferencers`.
- **Contract** — `contract/pivot/v1/invalid-specs.json`: shared validation vectors run by the TypeScript and Python suites (identical messages for unknown keys and referential checks, identical paths for schema enums / types).
- **`@nqlib/nqgrid/render-static`** — `profile: "statement"` (`PIVOT_STATIC_STATEMENT_CSS`, `PIVOT_STATIC_STATEMENT_ROW_HEIGHT`): bold totals in the full text colour, a rule above subtotals, a double rule under the grand total, no grey bands, 28 px rows; `units` option (default `model.units`) printed under the title; print pagination of long groups with the label repeated on continuation pages.
- **`@nqlib/nqgrid/pivot`** — `pivotPageBodySegments` / `PivotBodySegment`; `PivotTable` props `pagination`, `continuedLabel`, `countBadges`, `headerIndicators`.
- **nqgrid-export** — `exporter.exportDetailed()` → `{ data, diagnostics }`, `x-nqgrid-diagnostics` response header (`PIVOT_DIAGNOSTICS_HEADER`, `pivotDiagnosticsHeaderValue`), CLI diagnostics line on stderr (exit 0), export options `profile` and `units`, units in the XLSX page header and units / diagnostics on the hidden `Spec` sheet.
- **Python** — `PivotExporter.export_report()` / `ExportOutput` (sync, async, subprocess), `ExportPivotReportResult.diagnostics`, the validation mirror of the new checks, regenerated models (`units`, `scale`, `profile`), units in the openpyxl writer's page header, and an authoring-guide "Traps" section (balances, `avg`, calc at totals, `compact` vs `scale`, scenario columns, variance % on negative bases, currencies, FP&A data shape).

#### Changed (behaviour)

- **`validatePivotSpec` rejects unknown keys and invalid values everywhere the JSON Schema does** (`additionalProperties: false` on the spec, dimensions, measures, formats, `sortBy`, `topN`, `showAsBase`, aggregates, totals, heat, header charts, KPIs, filters, label matches, facets, catalogue fields; enums / types / ranges such as `layout: "outline"`, `format.decimals: 21`, `kpiLevels: [-1]`). `buildPivotModel`, `createPivotModelBuilder`, `usePivotGrid` and `renderPivotHtmlFromSpec` throw, and `nqgrid-export` answers 400 / exit 2, for specs it used to accept and ignore in part (e.g. `measures[].filter`, `rows[].formats`, `format.thousands`).
- **Newly rejected referential cases**: `keepEmpty` on a row dimension; `showAsBase` on a measure whose `showAs` / `groupShowAs` never reads it (e.g. `percentOfParentRow`); a calculated measure that references a measure whose `showAs` is not `value` (it read the value before the show-as: put the show-as on the calculated measure; a `groupShowAs` alone stays allowed). `setPivotMeasureShowAs` / `checkPivotCalculatedMeasure` (and the field-list menus through them) refuse the same combination instead of producing an invalid spec; `format.scale` with `compact` or percent style. The Python validator mirrors all of them.
- `movePivotField` / `swapPivotRowsColumns` drop `keepEmpty` from a dimension that moves into Rows (like `sortBy` / `topN` on the way into Columns).
- `nqgrid-export` rejects unknown `options` keys (`options: unknown key(s) (…)`), as the export-request schema already did.
- Number parsing: strings with radix prefixes (`"0x10"`, `"0b11"`, `"0o7"`) are no longer numbers (they summed as 16, 3, 7); they are reported as `unparsedNumbers`.
- `toExcelNumFmt` for `compact` formats: `[>=1000]…,"k";[<=-1000](…,"k");…` — negatives are scaled and keep their sign / parentheses; millions read `4,760k` in Excel (two conditions per Excel format). Goldens `*.model.json` / `*.sheet.json` changed in `excelNumFmt` / `numFmt` only.
- Static HTML / PDF: no child-count badges and no sort / filter icons (interactive affordances; `aria-sort` stays), explicit page breaks from fixed row heights (a long first group no longer leaves page 1 empty; "Section (cont.)" on continuation pages). Goldens `*.html`: one CSS line (`tr[data-nqg-page-break]`) and the badge / icon markup removed; page counts of every golden PDF unchanged.
- `PivotRowEncoding` (new `stats`) and the nqgrid-export `PivotExporter` interface (new `exportDetailed`) gained members: custom implementations of these interfaces must add them. No public export was removed or renamed.

### Financial statements (P&L / income statement)

Additive: `PivotSpec` stays `version: 1`, existing specs produce identical models (goldens unchanged).

#### Added

- **Pivot core** — `showAs: "percentOf"` (Excel "% Of": value / the base item's value; `showAsBase.item` required) with Excel sibling semantics, and `showAsBase.scope: "parent" | "all"`: `"all"` takes the base from every record whose row-field key is `item` in the same column, so every row — groups, subtotals, the grand total — compares with one base (a P&L's "% of Revenue"); also for `differenceFrom` / `percentDifferenceFrom`. View-only (the cube is reused); the base is merged once per cube (`PivotCube.keyTotal`), one read per cell.
- **Pivot core** — `measures[i].signField`: each record's value is multiplied by a sign column (numbers or numeric strings; missing = 1) before aggregation (`sum` / `avg` / `min` / `max` / `first` / `last` / `weightedAvg` sign the value, `ratio` the numerator; rejected for counts, custom aggregates and calculated measures). Signed columns are memoized per encoding; part of `pivotSpecDataKey`; drill-through lists the sign field. `setPivotMeasureSignField`.
- **Pivot core** — per-level `subtotalLabel` on row and column dimensions (same `{label}` template, overrides `totals.subtotalLabel` for that level).
- **`@nqlib/nqgrid/pivot`** — `PivotShowAsMenu` offers "% of" with base item and "Compare with" (same group / across all groups); `usePivotGrid().setMeasureSignField` and the `setMeasureSignField` reducer action.
- **Contract** — schema additions (`percentOf`, `showAsBase.scope`, `signField`, dimension `subtotalLabel`) and the golden `examples/planning-statement.{spec,rows,model,sheet}.json` + `.html` (fixture `statementPivotSpec` / `generateStatementPivotRows`). Python: regenerated models, `validation.py` mirror (incl. `signField` in `check_fields`), `statement_example_spec()`, a "Financial statements" section in the MCP authoring guide, e2e tests through `nqgrid-export serve`.
- **Docs** — [docs/pivot-recipes.md](docs/pivot-recipes.md): a complete, tested P&L recipe with an honest limits table (no calculated items, per-level labels, in-memory pivoting, …).
- **Playground** — `?pivot=statement` preset (income statement).

#### Changed

- `setPivotMeasureAggregate` drops `signField` when switching to `count` / `distinctCount`; move helpers reset a measure whose `showAsBase.scope: "all"` field leaves Rows.

## [0.3.0] - 2026-11-04

Pivot tables with Excel parity, a framework-free core and print/export tooling. Additive: every 0.2.0 export is still available.

### Added

- **`@nqlib/nqgrid/core`** — framework-free entry (no React, TanStack or DOM) that runs in browsers, Tauri webviews and Node.
- **Pivot core** — `buildPivotModel(spec, rows)` turns a JSON `PivotSpec` into a serializable `PivotModel`: multi-level collapsible groups with subtotals, Excel-style "show values as", heat levels by scope, header chart series, group/grand KPIs with deltas, row spans and formatted text. Plus `validatePivotSpec` / `assertPivotSpec`, `togglePivotGroup`, `setPivotExpandedAll`, `computePivotRowSpans`, `aggregatePivotRows` (incl. weighted average, ratio and named custom aggregators).
- **Deterministic formatting** — `formatPivotNumber` (compact `$302k` / `$4.76M`, percent, sign display, separators) without `Intl`, and `toExcelNumFmt` for matching XLSX number formats.
- **Sheet export shape** — `pivotModelToSheet` / `pivotSheetToMatrix` (cells, merges, frozen panes, numFmt) for XLSX/CSV writers in Node or Python.
- **Contract** — `contract/pivot/v1/pivot-spec.schema.json` (also `PIVOT_SPEC_JSON_SCHEMA`) and golden example spec/rows/model/sheet files.
- **Fixtures** — `planningPivotSpec`, `generatePlanningPivotRows`, `PLANNING_FISCAL_MONTHS`.
- **Configurator** — `core.pivot` and `pivot.react` features.
- **`@nqlib/nqgrid/pivot`** — React renderer for pivot models (also re-exported from the main barrel): `usePivotGrid(spec, rows, { onSpecChange })` (controlled / uncontrolled spec state, memoized model, `toggleGroup` / `expandAll` / `collapseAll` / `setHeatScope`), pure `reducePivotGridSpec`; `PivotTable` with CSS-sticky pinned dimension columns, real `rowSpan` department cells hosting `PivotKpiPanel`, heat cells and a stacked inline-SVG `PivotHeaderChartBand`; `mode="static"` for `renderToStaticMarkup` (no handlers, effects or measurement); `pivotModelToTanstack` adapter; `pivotHeatCellProps` and pure layout helpers.
- **Pivot core** — `setPivotHeatScope(spec, scope)`; `PivotKpiValue.compareLabel` (e.g. `Plan`, for "vs Plan" deltas; golden `planning.model.json` updated additively).
- **Styles** — `pivot*Class` tokens, `pivotHeatColorVar` / `pivotSeriesColorVar` / `pivotThemeVars`, and the `--nqg-heat-0 … --nqg-heat-8` / `--nqg-series-0 … --nqg-series-7` CSS variables.
- **Playground** — "Planning pivot" demo.
- **`@nqlib/nqgrid/render-static`** — `renderPivotHtml(model, options)` / `renderPivotHtmlFromSpec(spec, rows, options)`: standalone, deterministic HTML (no scripts, fonts or URLs) from the pivot components in static mode plus the inlined `PIVOT_STATIC_CSS` (light, dark via `data-theme` / `.dark` with dark series steps). Options: `theme`, `page` (`size`, `orientation`, `margins` in mm), `title`, `subtitle`, `generatedAt`, `maxColumnsPerPage`, `minScale`, `locale` labels, `kpiPanel`, `table`. Print: landscape A4 default, repeated header band + column headers, one `<tbody>` per top-level group with `break-inside: avoid`, zoom-to-fit, balanced column chunks with "(cont.)" titles, filler rows for KPI panels taller than their group. Helpers `pivotStaticLayout`, `resolvePivotStaticPage`, `pivotColumnChunks`, `slicePivotModelColumns`, `pivotHeatFillHex`.
- **`@nqlib/nqgrid-export`** (`packages/nqgrid-export`, bin `nqgrid-export`) — `{ spec, rows, options? }` → PDF (Playwright Chromium, title header + "Page X of Y" footer), XLSX (exceljs: numFmt, merges, frozen panes, heat fills, `KPIs` and hidden `Spec` sheets), HTML, model or sheet JSON. CLI (`--input` / `--spec --rows`, exit 2 = invalid input, 1 = internal, JSON errors on stderr), `exportPivot` / `createPivotExporter` API, `serve` mode (`GET /healthz`, `POST /export?format=…`, warm Chromium, 127.0.0.1, body cap) and a Dockerfile.
- **Contract** — golden `contract/pivot/v1/examples/planning.html`.
- **Pivot** — `PivotTable` `kpiPanel` and `fillSpanHeight` props; static mode renders one `<tbody>` per top-level group; `pivotBodyGroups`, `pivotKpiPanelHeight`, `PIVOT_KPI_PANEL_METRICS`.
- **Configurator** — `pivot.renderStatic` feature.
- **Export request contract** — `contract/pivot/v1/export-request.schema.json` (`{ spec, rows | dataset, format?, options? }`, JSON-only options, no `css`) with golden `examples/planning.request.json`; core `buildPivotExportRequest`, `sanitizePivotExportOptions`, `pivotExportFilename`, `PIVOT_EXPORT_FORMATS`, `PivotExportRequest` / `PivotExportOptions` types and `PIVOT_EXPORT_REQUEST_JSON_SCHEMA`. `nqgrid-export` now takes its formats from core, and its tests check that the schema and the CLI validator agree.
- **Pivot** — `pivotExportRequestFromGrid(grid, { format, options, includeRows, dataset })` ("export what I see": spec + `dataset` reference by default); `usePivotGrid` also returns `rows`.
- **Python integration** (`integrations/python`, distribution `nqgrid-export-client`, import `nqgrid_export`) — sync / async httpx client for `nqgrid-export serve`, `SubprocessExporter`, typed errors (`NqgridInvalidInput` with `details`, `NqgridPayloadTooLarge`, `NqgridInternalError`, `NqgridUnavailable`), Pydantic v2 models generated from the JSON Schemas (`scripts/generate_models.sh`), schema + referential validation, `write_xlsx_from_sheet` (openpyxl), report email with injectable senders, and a reference MCP server (`export_pivot_report`, `describe_pivot_spec`, schema / guide resources) with pluggable row providers. Pytest suite incl. end-to-end tests against the real service.
- **Playground** — the Planning pivot Export button shows / downloads the export request JSON and, with `VITE_NQGRID_EXPORT_URL` (dev proxy `/nqgrid-export`), downloads the PDF / XLSX.
- **Docs / CI** — `docs/integrations/secolab.md` (architecture, deployment, security, timeouts, Tauri snippet, adoption checklist); `.github/workflows/ci.yml`.
- **Pivot filters, sort by value, Top N (Excel parity, step 1)** — additive `PivotSpec` v1 keys: `filters` (report / slicer filters on any field: `include`, `exclude`, label `match` with `contains | notContains | beginsWith | endsWith | equals | notEquals`), `facets` (slicer-ready fields), and per row dimension `sortBy` (`{ measure, direction?, columnKey? }`, wins over `order` / `sort`) and `topN` (`{ measure, count, direction?, columnKey?, other?, otherLabel? }`, per parent group, outermost first; `other` folds the rest into a `PIVOT_OTHER_KEY` row). Filters apply to records before aggregation, so totals, "% of total" and KPIs reflect them. New optional model fields (only when used): `filters` (printable `PivotActiveFilter`s), `recordCount`, `facets` (cross-filtered counts, `selected`, `hasData`), `rowDimensions[].sort / sortBy / topN / filtered`, `PivotBodyRow.otherCount`. Existing specs produce identical models (goldens unchanged).
- **Pivot core** — `setPivotFilter`, `togglePivotFilterValue` (Excel slicer semantics: `only` / `toggle`), `setPivotFilterValues`, `pivotFilterForSelection`, `getPivotFilter`, `clearPivotFilter`, `clearPivotFilters`, `setPivotSort` (`PivotSortRequest`), `setPivotTopN`; `describePivotFilters`, `pivotFieldLabel`, `pivotMatchesLabel`, `pivotFilterAccepts`; `buildPivotCube` / `pivotModelFromCube` / `pivotSpecDataKey` (aggregate vs. view split), `createPivotModelBuilder` (memoizing builder), `createPivotRowEncoding`; `validatePivotSpec` checks filters, facets, `sortBy` / `topN` (measure references, row dimensions only).
- **`@nqlib/nqgrid/pivot`** — `PivotSlicer` (button-grid slicer: multi-select listbox, Ctrl/⌘-click or multi-select toggle, clear, greyed "no data" items listed last, arrow / Home / End / Enter / Space / Delete keys), `PivotFilterMenu` (sort A→Z / Z→A / by value, Top / Bottom N with "Other", searchable checkbox list with tri-state select-all; native inputs, class slots, no portal), `PivotHeaderMenu` (inline disclosure), `PivotHeaderIndicator` + `pivotDimensionStatus` / `pivotAriaSort` (sort / filter indicator and `aria-sort` on dimension headers), `pivotSlicerProps` / `pivotFilterMenuProps` grid bindings, `pivotFacetOf`; `PivotTable` `renderDimensionHeader` slot; `usePivotGrid` actions `setFilter`, `setFilterValues`, `toggleFilterValue`, `clearFilter`, `clearFilters`, `setSort`, `setTopN` (and matching `reducePivotGridSpec` actions). Style tokens `pivotSlicer*Class`, `pivotFilterMenu*Class`, `pivotHeaderMenu*Class`, `pivotHeaderIndicatorClass`, `pivotHeadLabelClass`.
- **Exports** — static HTML / PDF prints "Filters: …" under the report title (`PivotStaticLabels.filters`, `pivotFiltersText`); `PivotSheet.filters`; the `nqgrid-export` XLSX lists filters under the KPIs and on the `Spec` sheet; the Python openpyxl writer records them on the `Spec` sheet.
- **Contract** — golden `examples/planning-filtered.{spec,model,sheet}.json` + `.html` (fixture `planningFilteredPivotSpec`); schema `$defs` `filter`, `labelMatch`, `facet`, `sortBy`, `topN`. Python: regenerated models, `validation.py` mirror (incl. filter / facet fields in `check_fields`), `filtered_example_spec()`, `describe_pivot_spec` guide section on filtering and a `filtered_example_spec`, e2e tests on the new golden.
- **Performance** — `pnpm bench` (`bench/pivot.bench.ts`, 10k / 100k / 500k rows) and [docs/pivot-performance.md](docs/pivot-performance.md): column encoding, one-pass filters + cross-filtered facets, leaf-only typed-array accumulation with roll-up, cube reuse for view-only changes. At 500k rows, a cold build drops from ~1.8 s to ~0.18 s, and an expand / heat-scope change in `usePivotGrid` from ~1.5 s to ~3.5 ms.
- **Playground** — Department / Line slicers, active-filter badges, record counts and an nqui-popover filter menu on the Line header.
- **Pivot field list (Excel parity, step 2)** — additive `PivotSpec` v1 keys: `fields` (field catalogue: `field`, `label`, `type` = `dimension | text | date | number | measure`, allowed `areas`, default `aggregate`, `format`, `description`; metadata only, never changes the model), `fieldLabels`, and `valuesIndex` (Σ Values position among the column fields: `0` = measures outermost, headers `Actual › Nov`). Existing specs produce identical models (goldens unchanged).
- **Pivot core** — `inferPivotFields(rows, { sample })`, `resolvePivotFields`, `humanizePivotField`, `pivotFieldListState`, `pivotFilterAreaFields`, `pivotColumnFields`, `pivotValueIds`; pure moves `movePivotField` / `planPivotFieldMove` (`{ spec, changed, reason, displaced, measureId }`) / `canMovePivotField`, `reorderPivotField`, `removePivotField`, `togglePivotField`, `addPivotMeasure`, `setPivotMeasureAggregate`, `setPivotValuesPosition`, `swapPivotRowsColumns`, `ensurePivotFilterField`, `withCleanExpanded`; `PIVOT_VALUES_FIELD`, `PIVOT_MAX_COLUMN_FIELDS`, `PIVOT_FIELD_AREAS`. Rules: `sortBy` / `topN` travel with row fields and are stripped in Columns, stale `expanded` paths are dropped, heat / header charts repoint and unreferenced measures are deleted when a measure leaves Values, a second column field swaps or replaces the first, and moves never produce an invalid spec (seeded property test). `buildPivotFacet` / `computePivotFacet` and `PivotModelBuilder.facet` (facet of any field without aggregating); `validatePivotSpec` checks `fields`, `fieldLabels`, `valuesIndex`.
- **`@nqlib/nqgrid/pivot`** — `PivotFieldList` (searchable checklist, Filters / Columns / Rows / Values zones with chips, chip menu with move / remove / "Summarize values by" / filter menu, transpose button, "Defer layout update"; class slots, labels, render props, no portal, no nqui), dependency-free pointer drag-and-drop (`startPivotFieldDrag`, `pivotFieldDragHandleProps`, `pivotDropZoneProps`: mouse, pen and touch, preview, insertion line, auto-scroll, Escape cancels, no re-render while dragging) and keyboard moves with live announcements (`pivotKeyboardDragStep`, `pivotKeyboardDropIndex`); `pivotFieldListProps(grid)`; `usePivotGrid` `fields`, `facet(field)`, `moveField`, `reorderField`, `removeField`, `toggleField`, `addMeasure`, `setMeasureAggregate`, `setValuesPosition`, `swapRowsColumns` (and matching `reducePivotGridSpec` actions); `pivotFilterMenuProps` works for any field. Style tokens `pivotFieldList*Class`, `pivotFieldChip*Class`, `pivotDragPreviewClass`, `pivotDropIndicatorClass`.
- **Exports** — Σ Values outermost renders measure-spanning header cells (left-aligned), header bars under the series measure, and chunk titles named by measure in static HTML / PDF; a `nqgrid-export` test exports PDF / XLSX / HTML after a sequence of field moves.
- **Contract** — golden `examples/planning-fields.{spec,rows,model,sheet,catalog}.json` + `.html`; schema `$defs.field` (`PivotFieldSpec`). Fixtures: `generatePlanningPivotRows(seed, { extraFields: true })` adds `region`, `channel`, `units` from a separate PRNG (other fields byte-identical), `planningFieldCatalog`, `planningFieldsPivotSpec`. Python: regenerated models (`PivotFieldSpec`), `validation.py` mirror (duplicate catalogue fields), `infer_pivot_fields` / `humanize_pivot_field` (same results as core, checked against the golden), `fields_example_spec()`; MCP `describe_pivot_spec(dataset=…)` returns that dataset's `field_catalog` via the new optional `FieldCatalog` provider protocol (`JsonDirectoryRowProvider` reads `<dataset>.fields.json`, otherwise inference).
- **Performance** — `pnpm bench` "move field" (Line ↔ Columns) and "add measure" scenarios: about 80 ms / 65 ms per drop at 500k rows (encoding reused); existing scenarios unchanged within noise ([docs/pivot-performance.md](docs/pivot-performance.md)).
- **Playground** — collapsible "Fields" panel with `PivotFieldList`, draggable row headers (drop on the field list, or on another header to reorder levels), filter menus on every row header, layout summary in the title.
- **Several column fields, collapsible column groups (Excel parity, step 3)** — `PivotSpec.columns` accepts a list of dimensions (schema `oneOf`, still `version: 1`; the single-object form stays valid and existing goldens are byte-identical). The cube builds a column tree (one accumulator bucket per leaf and group, leaves accumulated per record, groups rolled up), with per-level subtotal columns (`subtotal: "end" | "start" | "none"` on column dimensions, `totals.subtotalLabel`), the grand total column (`totals.rowTotal`, generalized), multi-row `headerRows` with `rowSpan`s and the Σ Values level anywhere (`valuesIndex`), and collapsible column groups (`columnsExpanded`: `"all" | "none" | paths`; a collapsed group shows its total column). New `showAs: "percentOfParentColumn"`; `percentOfColumnTotal` uses the column's own total; heat `scope: "column"` is per leaf column and other scopes skip subtotals; `sortBy` / `topN` `columnKey` accept group keys; header series per leaf / collapsed group plus `headerSeries.groups` for the outer level. Model additions only with 2+ column fields: `columnDimensions`, `PivotValueColumn.columnPath / subtotal / collapsed`, `PivotHeaderCell.rowSpan / columnPath / columnLevel / expanded / subtotal`.
- **Date grouping (Excel parity, step 3)** — derived key fields `<date>:year | quarter | month | week | day | yearMonth | yearQuarter` (or catalogue entries with `source` + `dateGroup`) work in rows, columns, filters and facets; one date can feed Year in Columns and Month in Rows. Deterministic UTC parsing of ISO strings, `Date`s and epoch ms (optional fixed `timeZoneOffsetMinutes`), fiscal years (`fiscalYearStartMonth`, named by their end year: `FY26`), chronological key order, `Intl`-free labels (`Q1 FY26`, `Jan 2026`, `monthNames` overrides), `(blank)` for invalid dates, and `keepEmpty` gap filling nested under date parents. Dates are parsed once per record and keyed once per distinct period, cached on the row encoding (`encoding.days`, `encoding.dateCodes`, `pivotSpecEncoding`).
- **Pivot core** — `pivotColumnFields` (moved to `columns.ts`), `withPivotColumnFields`, `pivotColumnKeyOf`, `pivotDimensionOf`; `togglePivotColumnGroup`, `setPivotColumnsExpandedAll`, `pivotExpandedColumnGroups`, `withCleanColumnsExpanded`; `setPivotDateGrouping`, `pivotDateGroupingOf`, `pivotDateGroupField`, `pivotFieldHasDates`, `PIVOT_DEFAULT_DATE_GROUPING`; date helpers `pivotDayOf`, `parsePivotIsoDay`, `pivotDateKeyOfDay`, `pivotDateLabel`, `pivotDateKeyComparator`, `pivotDateFillKeys`, `pivotDateKeyWithin`, `resolvePivotDateField`, `pivotDateFieldLabel`, `pivotKeyLabeler`, `PIVOT_DATE_GROUPS`; `PivotCube.columnRoot` / `valueAt`. `PIVOT_MAX_COLUMN_FIELDS` is now 4; dropping a date field from the field list groups it (Year → Quarter in Columns, Year → Month in Rows, Year in Filters; `plan.grouped`, `dateGrouping` option); `resolvePivotFields(spec, rows)` adds `dateGroups` to date fields whose values parse and lists derived date fields under their source. `validatePivotSpec` checks column lists, `subtotal` (column dimensions only), a field used twice across rows and columns, `columnsExpanded` and the date catalogue properties.
- **`@nqlib/nqgrid/pivot`** — `PivotTable` multi-row column headers with `rowSpan`s, column-group toggles (`onToggleColumnGroup`) and a `renderColumnHeader` slot (`PivotColumnHeaderContext`: role, column field, `areaIndex` for drop zones, default toggle; `pivotColumnHeaderRole`, `pivotModelColumnDimensions`), so column headers can be dragged to the field list and reordered; header bands follow column runs. `usePivotLayoutDraft` shares one "Defer layout update" draft between `PivotFieldList` (controlled `draft` / `onDraftChange`, `pivotFieldListProps(grid, layout)`) and header drags. `PivotFieldList` chip menus offer "Group by…" for date fields. `usePivotGrid` / `reducePivotGridSpec`: `toggleColumnGroup`, `expandAllColumns`, `collapseAllColumns`, `setDateGrouping`.
- **Exports** — static HTML / PDF print multi-row headers (an ellipsis rule is appended only for nested headers) and split column chunks along inner levels when a top-level group is wider than a page (`pivotColumnUnits(model, maxColumns)`, `pivotHeaderCellPositions`); `pivotModelToSheet` places cells around row spans and emits `rowSpan` merges (exceljs and openpyxl writers merge them as is).
- **Contract** — goldens `examples/planning-multicol.{spec,model,sheet}.json` + `.html` and `examples/planning-dates.{spec,rows,model,sheet}.json` + `.html`; schema: `columns` `oneOf`, `columnsExpanded`, `dimension.subtotal`, `totals.subtotalLabel`, `showAs` `percentOfParentColumn`, `$defs.dateGroup`, `field.source / dateGroup / fiscalYearStartMonth / timeZoneOffsetMinutes / monthNames / dateGroups`. Fixtures: `generatePlanningPivotRows(seed, { orderDates: true })` (two fiscal years with ISO `orderDate`), `planningDateFieldCatalog`, `planningDatesPivotSpec`, `planningMultiColumnPivotSpec`. Python: regenerated models, schema copies, `validation.py` mirror (column lists, `subtotal`, duplicate fields, date entries, `check_fields` maps `orderDate:year` to `orderDate`), `date_field_source`, `dates_example_spec()` / `multicol_example_spec()`, `describe_pivot_spec` guide sections on several column fields and date grouping, e2e tests on the new goldens through `nqgrid-export serve`.
- **Performance** — `pnpm bench` scenarios for 2 / 3 column fields, date grouping from ISO strings (cold and with the encoding reused) and column-group toggles at 100k / 500k rows ([docs/pivot-performance.md](docs/pivot-performance.md)).
- **Playground** — preset switch with an "Order date: Year → Quarter" view over two fiscal years (collapsible years, Expand / Collapse columns), draggable column headers, and header drags routed through the shared deferred draft.
- **Calculated measures (Excel parity, step 4)** — `PivotMeasure.calculate` (e.g. `"actual / plan - 1"`, `"[prior year] * 1.05"`): an expression over other measure ids, evaluated per cell over their aggregated bucket values, so totals are `sum(actual) / sum(plan) - 1` (Excel calculated fields). Safe parser in core (`parsePivotCalc`, `compilePivotCalc`, `evaluatePivotCalc`, `findPivotCalcCycles`): tokenizer + recursive descent → AST → closures compiled once per build, no `eval` / `Function`; `+ - * / % ^`, comparisons, `and / or / not`, `null`, whitelisted `abs sqrt floor ceil round min max if coalesce ifnull`; at most 1000 UTF-16 units, nesting depth 64, 32 arguments; reserved names (`__proto__`, `constructor`, `prototype`), control / zero-width / bidi characters and unknown functions are rejected with stable error codes and positions. Division by zero, overflow and null operands give empty cells. Calculated measures feed `showAs`, heat, header charts, KPIs, `sortBy` and `topN` (the Top-N rank tree compiles a calculated measure with its references). `validatePivotSpec` reports grammar errors, unknown references, cycles and `calculate` combined with `field` / `aggregate`.
- **Show values as along a field** — `showAs` / `groupShowAs` `differenceFrom`, `percentDifferenceFrom`, `runningTotal`, `percentRunningTotal`, `rankAscending`, `rankDescending` with `showAsBase: { field, item?, position?: "previous" | "next" }` on a row or column field (siblings in display order; deeper rows / columns map by their relative key path). First item / base item / missing base → empty; cells above the base level and total columns outside it show the value (running totals) or nothing (differences, ranks). Ranks use competition ranking and the integer format (`PIVOT_RANK_FORMAT`, Excel `0`); `pivotShowAsFormatKind`.
- **Row subtotal positions** — `rows[i].subtotal: "start"` (default: the group row carries the totals) | `"end"` (a new `PivotBodyRow.kind: "subtotal"` row after the group's children, label from `totals.subtotalLabel`, id `pivotSubtotalRowId(path)`, the expanded group row blank with `subtotal: "end"`) | `"none"`; collapsed groups always show their totals. Previously rejected on rows; `subtotal` now travels between Rows and Columns in the move helpers. View-only (the cube is reused).
- **Distinct count** — `aggregate: "distinctCount"` counts distinct non-blank keys of `field` (date-derived fields included); group, subtotal-column and grand totals count distinct keys of all their records. One counting-sort pass per measure with a per-(node, bucket) stamp array, no per-bucket sets; specs without distinct counts allocate nothing extra.
- **Drill-through** — `pivotDrillThrough(spec, rows, { path, columnPath, measureId }, { limit, offset })` → `{ records, indices, total, truncated, fields }`: the source records behind a cell after filters and Top N ("Other" rows list their folded keys), matching date-grouped keys; group, subtotal and total cells get the broader sets. `pivotCellDrillTarget(model, row, columnIndex)`, `PivotModelBuilder.drillThrough` (encoding reused). Filters + Top N moved into a shared selection stage of the cube (same results).
- **Pivot core** — `setPivotCalculatedMeasure` / `planPivotCalculatedMeasure` / `checkPivotCalculatedMeasure`, `removePivotMeasure`, `setPivotMeasureShowAs`, `setPivotSubtotal`, `PIVOT_SHOW_AS_WITH_BASE`; field-list state lists calculated measures with their expression (`calculate`); calculated measures stay in `measures` when unchecked (with everything they reference); a show-as base field leaving Rows / Columns resets that measure to plain values; `setPivotMeasureAggregate` offers `distinctCount` (formats dropped like `count`) and leaves calculated measures alone.
- **`@nqlib/nqgrid/pivot`** — `PivotTable` `onDrillThrough(target, context)` (double-click a value cell, interactive mode) and subtotal rows (tabular slot `subtotal`, compact indentation; static output closes each group's `<tbody>` with its subtotal row); `PivotDrillThroughPanel` (records table with sticky header, field labels / formats, count, close; `pivotDrillThroughFieldInfo`, `pivotDrillThroughTitle`, `pivotDrillThroughCellText`); `PivotCalculatedMeasureForm` (name, formula with inline validation message and position, insert-measure picker, format) and `PivotShowAsMenu` (kind, base field, base item); `PivotFieldList` gets a "Calculated measure…" button, "Edit formula…" / delete for calculated values, "Show values as" on every value chip, "Subtotals" (top / bottom / off; before / after / off for column groups) on group-level chips, and Distinct Count in "Summarize values by". `usePivotGrid` / `reducePivotGridSpec`: `setCalculatedMeasure`, `removeMeasure`, `setMeasureShowAs`, `setSubtotal`, `drillThrough`. Style tokens `pivotCalcInputClass`, `pivotCalcErrorClass`, `pivotDrill*Class`; the primary menu button now dims when disabled.
- **Exports** — `pivotModelToSheet` prints subtotal rows' labels in the group column outside the group's merge (Excel), and picks the percent / measure / `0` number format per show-as kind; static HTML / PDF render calculated measures, the new show-as kinds and subtotal rows; `nqgrid-export` tests cover the new golden (model / sheet / html / xlsx / pdf).
- **Contract** — schema (still `version: 1`, additive): `measure.calculate`, `measure.showAsBase` (`$defs.showAsBase`), six `showAs` kinds, `distinctCount` in the aggregate and catalogue enums, row `subtotal` description, a `dependentSchemas` rule (no `field` / `aggregate` with `calculate`). New golden `examples/planning-calc.{spec,model,sheet}.json` + `.html` (fixture `planningCalcPivotSpec`, rows of `planning-dates`) and shared expression test vectors `calc-expressions.json` (49 valid with expected values, 71 invalid with error codes / positions) consumed by the TypeScript and Python tests. Existing goldens are byte-identical.
- **Python** — `nqgrid_export.calc` (`parse_calc`, `evaluate_calc`, `find_cycles`, `CalcError`): a line-by-line port of the TS parser working on UTF-16 code units, so codes and positions match; `validate_pivot_spec` mirrors the new checks (calculated measures, cycles, `showAsBase`, row subtotals allowed) with the same messages; `check_calculated_measure` for formula editors; `calc_example_spec()`; regenerated models (`ShowAsBase`, `Measure.calculate`); `describe_pivot_spec` guide section "Calculated measures, show values as, subtotals, distinct count" and `calc_example_spec`; end-to-end tests of the new golden and of calculated measures through `nqgrid-export serve`.
- **Performance** — `bench/pivot-step4.bench.ts`: calculated measure (plain, and as sort / Top N / heat / KPI), distinct count (20k and 6 keys), running total, view-only show-as / subtotal changes and drill-through at 100k / 500k rows ([docs/pivot-performance.md](docs/pivot-performance.md)); existing scenarios unchanged within noise.
- **Playground** — "Calculated · show as · subtotals" preset (`?pivot=calc`) and a drill-through panel on double-click.
- **Performance review** ([docs/pivot-performance.md](docs/pivot-performance.md#performance-review)) — `PivotTable` row virtualization (`virtualize`: `"auto"` by default above 10,000 body cells, `true`, `false`; `overscan`; spans clipped at the window edges, rendered rows measured; static mode unchanged; `pivotVirtualRowWindow`, `PIVOT_VIRTUALIZE_AUTO_CELLS`): a 29k-row × 39-column body mounts in about 0.1 s instead of 23 s. "Show values as" along a field no longer scans every sibling per cell (running total, % running total, rank, difference from: O(k log k) per sibling group instead of O(k²); 2,000 items per group 2.2–6.5 s → 0.2 s, identical values). `createPivotModelBuilder({ maxCubeBytes })` (default 256 MiB) with `PivotCube.byteSize`, so very large cubes are not cached four times. Cheaper cube construction for trees with many row nodes (shared accumulator blocks, dense leaf table; −14 to −20 % at 1M records, about −30 % with ~190k leaves). `nqgrid-export`: warm print-page pool (`createPivotPdfPagePool`; PDF throughput about 2×, p50 170 → 90 ms) and XLSX exports share the serve-mode concurrency limit. `bench/pivot-review.bench.ts`.

### Changed

- Pivot style tokens (`pivot*Class`) now start with a semantic `nqg-pivot-*` class; the Tailwind utilities are unchanged.
- Pure helpers (`pinned-layout`, `col-span-frozen`, `row-reorder`, `paging`, `clipboard-tsv`, `group-by-tree`, rich value formatting and format option types) moved to `src/core`; `engine`, `advanced` and the main barrel re-export them, so existing imports keep working.
- `buildGroupedFlatRows` key type no longer depends on React's `Key` (`GroupRowKey = string | number | bigint`, structurally identical).
- `contract/pivot/v1/pivot-spec.schema.json`: `title`s on the aggregate variants (`WeightedAvgAggregate`, `RatioAggregate`, `CustomAggregate`) for code generators; validation unchanged.
- `buildPivotModel` runs on the new engine (see Performance); results are identical for the goldens. Group totals are sums of leaf partials, so non-integer data can differ from before in the last floating-point bit.
- `usePivotGrid` caches aggregation separately from view state (`createPivotModelBuilder`), and several dispatches before the next render now chain instead of each starting from the rendered spec (no lost updates).
- `PivotTable` is wrapped in `React.memo`; `PivotModel.rowDimensions` entries are typed `PivotModelDimension`.
- `formatPivotNumber` is faster (no regexes per call); output unchanged.
- Field-list moves allow up to four column fields: a second field moved into Columns now nests instead of swapping (the innermost one is displaced only when Columns are full), and `swapPivotRowsColumns` transposes whole hierarchies (with `expanded` / `columnsExpanded`). Specs with one column field still write `columns` as an object.
- Header drags in the playground used to apply immediately while "Defer layout update" was on, and Update then overwrote them with the field list's draft; they now join the draft (`usePivotLayoutDraft`).
- Interactive value headers truncate with an ellipsis (`pivotHeadValueCellClass`); subtotal headers spanning rows wrap.
- **`@nqlib/nqgrid/styles` is back** as an opt-in entry point (removed in 0.2.0). It holds the class tokens and CSS-variable helpers the pivot renderer uses (`pivot*Class`, `pivotThemeVars`, heat / series colors) plus the table-shell tokens. The engine entries (`.`, `./engine`, `./core`) stay headless; only `./styles`, `./pivot` and `./render-static` carry class strings.

### Fixed

- `tsvToMatrix` parses Excel / Sheets clipboard text as a stream: quoted cells may span lines and contain tabs or doubled quotes, CRLF line endings work, and the trailing newline Excel appends no longer adds an empty row.

## [0.2.0] - 2026-07-10

### Added

- **ColumnType registry contract** (`@nqlib/nqgrid/engine` → `src/engine/column-types/`). The shared data-model seam from `columntype-contract.md`: a pluggable `ColumnType<TRaw, TParsed>` (`parse` → `format` → `style` → `compareKey`, declarative `editor`, optional `toInterval`), a `TypeRegistry` + `createDefaultRegistry()`, and five core plugins (`text`, `number`, `select`/status, `date`, `dateRange`). `style` returns **data** (`CellStyle`: colors, align, bar ratio), never class strings — fully headless.
- **Cell pipeline** — `renderCell`, `compareCells`, `groupKey`, `cellInterval`. Sort/filter/group run on `compareKey(parse(raw))`, never on display text; `select` sorts/groups by option `order` (workflow order), not alphabetically.
- **View-mode helpers** — `groupRowsByColumn` (board / grouped-list placement in option order, empty option columns preserved) and `sortRowsByColumn` (stable, compareKey-based). Table, list, and board are render modes over **one** row model, not separate engines.
- **`toInterval` seam** — `date`/`dateRange` expose intervals so the same column schemas feed a future nqgantt; non-time types leave it undefined and time-views ignore them.
- **Playground "Projects" tab** — one schema + one row set rendered as table / list / board (+ a `toInterval` timeline strip), proving the contract end to end. A locally-registered `person` type shows the registry extends with zero engine edits.
- **Rich-union → contract migration bridge** (`@nqlib/nqgrid/advanced`): `createRichRegistry()` (status/tag/people/formula + parity-preserving number/date/text that delegate to the existing `rich-value-format` formatters), `richDefToColumnSchema(def)` and `richSchemaToColumns(defs)` to convert legacy rich defs into contract `ColumnSchema` + accessors. `status`/`tag` sort by `choiceOrder` (workflow order); `date` exposes `toInterval`. `kind: "custom"` has no headless equivalent and is reported separately (render it in the app).

### Deprecated

- **The `RichSchemaColumnDef` union, `RichColumnKind`, and `normalizeRichSchemaColumnDef`** are deprecated in favor of authoring a `ColumnSchema` and rendering through a registry (`createDefaultRegistry()` / `createRichRegistry()`). They remain fully functional for back-compat and the demo's styled builders; migrate mechanically with `richDefToColumnSchema`. No runtime change.

### Removed (breaking)

- **`@nqlib/nqgrid/styles` and `@nqlib/nqgrid/tokens` entry points** are gone. The engine no longer ships any styling — it is headless (logic + geometry only). All design tokens, class builders, and styled cells (`buildTableClasses`, presets, `TablePercentBattery`, `RichColumnCell`, `RichStatusCell`, `buildRichColumnFromDef`) moved into the reference app. **Migration:** fork the token starter into your app (the `nqgrid-styling` / BECO `grid-styles.ts` pattern) and compose with `createTableTokens` + your own cell renderers; import engine helpers from `@nqlib/nqgrid` / `@nqlib/nqgrid/engine` as before.

### Changed

- **Engine is now strictly headless.** A lint guard (`eslint.config.mjs`) fails the build if anything under `src/` imports `@nqlib/nqui` or contains design-system class strings.
- **`src/engine` reorganized** into feature subfolders (`pinning/`, `freeze/`, `virtualization/`, `selection/`, `reorder/`, `outline/`, `data/`) behind one curated barrel.
- **`freezePanesFromExcelCell`** now takes the real ordered leaf-column ids and slices the frozen prefix from them (previously fabricated `col-${i}` ids that never matched real columns).

### Fixed

- TSV clipboard parser no longer mis-merges columns on a literal `"` inside an unquoted cell.
- Multi-row column-outline header `colSpan` now respects collapsed descendant groups.
- Virtual data cache stats/eviction count only successfully-loaded pages (no premature eviction from in-flight/errored pages).

## [0.1.0] - 2026-05-15

### Added

- **Published entrypoints** — `main` / `module` / `types` plus subpath exports: `@nqlib/nqgrid/styles`, `/fixtures`, `/engine`, `/sheet`, `/spreadsheet`, `/advanced`, `/configurator`.
- **Engine** — TanStack-oriented helpers (pinned layout, frozen columns, clipboard TSV, row reorder, col-span, grouping/master-detail hooks, etc.).
- **Sheet** — `VirtualSheet` and viewport utilities for constrained scroll layouts.
- **Spreadsheet** — command/menu wiring and cell-format helpers for spreadsheet-style UIs.
- **Advanced / rich schema** — `buildRichColumnFromDef`, `buildRichColumnsFromDefs`, `RichColumnCell`, typed column defs for text, number, currency, percent, date, status, tag, formula, people, and custom cells; locale-aware formatters in `rich-value-format`.
- **People column** — `richPersonOptionKey`, `resolveRichPeopleByOptionKeys`, `reconcileRichPeopleWithRoster`, and roster reconciliation on `onValueChange` when `pickerOptions` is set; `RenderRichPeoplePicker` / `RichPeoplePickerRenderArgs` for headless UI composition.
- **Styles** — `tableShellClass`, scroll/viewport tokens, dense typography, numeric/battery helpers (`TablePercentBattery`), nested panel classes (see `src/styles/index.ts`).
- **Fixtures** — demo datasets (`mockProjects`, `mockFlights`, `demoAssigneePerson`, etc.) for examples and tests.
- **Configurator** — import planner and library config merge (`docs/configurator.md`).
- **Tests** — Vitest coverage for engine, advanced rich columns, configurator resolution, and people reconciliation.

### Notes

- **Peers:** `react`, `react-dom`, `@tanstack/react-table` (UI libraries such as `@nqlib/nqui` are not peer dependencies of the package).
- **Playground** (`apps/playground`) is a **reference app**, not shipped in the npm tarball; use repo skills (`.cursor/skills/`) to reproduce its UI patterns.
