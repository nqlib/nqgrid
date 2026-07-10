# Changelog

All notable changes to `@nqlib/nqgrid` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) from **1.0.0** onward. Prior to 1.0, minor releases may include API adjustments.

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
