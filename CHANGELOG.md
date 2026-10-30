# Changelog

All notable changes to `@nqlib/nqgrid` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) from **1.0.0** onward. Prior to 1.0, minor releases may include API adjustments.

## [Unreleased]

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

### Changed

- Pivot style tokens (`pivot*Class`) now start with a semantic `nqg-pivot-*` class; the Tailwind utilities are unchanged.
- Pure helpers (`pinned-layout`, `col-span-frozen`, `row-reorder`, `paging`, `clipboard-tsv`, `group-by-tree`, rich value formatting and format option types) moved to `src/core`; `engine`, `advanced` and the main barrel re-export them, so existing imports keep working.
- `buildGroupedFlatRows` key type no longer depends on React's `Key` (`GroupRowKey = string | number | bigint`, structurally identical).

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
