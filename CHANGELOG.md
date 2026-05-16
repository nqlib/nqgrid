# Changelog

All notable changes to `@nqlib/nqgrid` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) from **1.0.0** onward. Prior to 1.0, minor releases may include API adjustments.

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
