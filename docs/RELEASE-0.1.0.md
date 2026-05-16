# Release v0.1.0 — @nqlib/nqgrid

**Tag:** `v0.1.0`  
**npm:** `@nqlib/nqgrid@0.1.0`  
**Date:** 2026-05-15

## Summary

First public **0.x** release of **nqgrid**: headless TanStack Table helpers, layout tokens, optional **rich column** schema (numbers, dates, status, people, formula, etc.), demo fixtures, and a **configurator** subpath for import planning. UI (e.g. `@nqlib/nqui`) is composed **by the consumer**; the package stays free of design-system peers.

## Install

```bash
pnpm add @nqlib/nqgrid @tanstack/react-table react react-dom
```

Optional style tokens:

```ts
import { tableShellClass } from "@nqlib/nqgrid/styles";
```

## Highlights

| Area | What you get |
|------|----------------|
| **Engine** | Pinned columns, frozen boundaries, TSV clipboard, row reorder, grouping hooks, spreadsheet commands |
| **Advanced** | `buildRichColumnFromDef`, formatters, editable status/people hooks via `renderPeoplePicker` |
| **People** | Stable roster keys via `reconcileRichPeopleWithRoster`; app implements picker UI |
| **Styles** | Table shell, ScrollArea-friendly viewport classes, numeric emphasis, percent battery cell |
| **Fixtures** | `mockProjects`, `mockFlights`, assignee helpers for demos |
| **Configurator** | `@nqlib/nqgrid/configurator` — merge config, resolve import graph |

## Semver

**0.1.x** may still evolve APIs (especially `advanced` and rich-schema field names). Pin versions in production; follow `CHANGELOG.md` for breaking notes when we move toward 1.0.

## Starter UI

To replicate **playground-style** tables (shell, scroll, TanStack + nqui, rich inline tasks, people combobox patterns), install the repo skill **`nqgrid-playground-starter`** (see `.cursor/skills/nqgrid-playground-starter/SKILL.md`) alongside **`nqgrid-table-design`**.

## GitHub release body (paste)

```markdown
## @nqlib/nqgrid v0.1.0

First npm release: TanStack-oriented table **engine** + **style tokens** + **rich column** builders + **fixtures** + **configurator**.

- **Docs:** [CHANGELOG](https://github.com/nqlib/nqgrid/blob/main/CHANGELOG.md)
- **Starter UI:** Cursor skills `nqgrid-playground-starter` + `nqgrid-table-design` in this repo (`.cursor/skills/`)

**Peers:** `react`, `react-dom`, `@tanstack/react-table`
```
