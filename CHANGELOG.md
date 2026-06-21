# Changelog

All notable changes to `@nqlib/nqgrid` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) from **1.0.0** onward. Prior to 1.0, minor releases may include API adjustments.

## [Unreleased]

### Added

- **Contract: `compareKey` sort/group layer** — rich columns now attach a `sortingFn`
  derived from the parsed value, not the display string. `status`/`tag` columns sort by
  **workflow order** (their `choiceOrder` / option order) instead of alphabetically;
  numbers/percent/currency sort numerically; dates and timelines by timestamp. New exports
  from `@nqlib/nqgrid/advanced`: `richCompareKey`, `richSortingFn`.
- **Contract: `toInterval` time-axis seam** — a new `timeline` column kind (raw
  `{ start, end }`, a `[start, end]` tuple, or a single date ⇒ milestone) plus
  `richToInterval`, `isTimelineCapable`, `findTimelineColumn`, `readRichAccessor`, and
  `parseTimelineRaw` / `formatTimelineValue`. `date` columns project as zero-width
  intervals (milestones). The table renders a `start – end` label; time-axis engines read
  the interval.
- **`@nqlib/nqgantt` (new sibling package)** — a headless gantt/timeline engine that
  projects the SAME nqgrid schema + rows onto a time axis with zero data duplication:
  invertible `createTimeScale` (day/week/month/quarter), `buildGanttModel`
  (interval-positioned bars, status-colored, swimlanes by `compareKey`),
  drag-to-reschedule (`rescheduleInterval` commits raw dates), milestones, and
  finish-to-start dependency routing. Includes a `<Gantt>` React renderer and a
  playground demo (Gantt tab) sharing one task store with a grid.

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
