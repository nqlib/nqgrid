# @nqlib/nqgrid

Headless **TanStack Table** engine, **nqgrid-owned grid/table DOM** (`@nqlib/nqgrid/grid`), optional **rich column** schema, demo **fixtures**, and a **configurator** import planner.

**nqui is primitives only** — `ScrollArea`, `Button`, `Input`, etc. Do **not** use nqui `Table` / `DataTable`; nqgrid engine + grid replace them. See **[docs/composition-architecture.md](./docs/composition-architecture.md)**.

## Install

```bash
pnpm add @nqlib/nqgrid @tanstack/react-table react react-dom
```

## Subpath exports

| Import | Purpose |
|--------|---------|
| `@nqlib/nqgrid` | Main barrel (engine + components used by demos) |
| `@nqlib/nqgrid/styles` | Tailwind class tokens for table shells and scroll |
| `@nqlib/nqgrid/core` | Framework-free engine (no React/DOM): pivot model, filters / facets / Top N / sort by value (`setPivotFilter`, `togglePivotFilterValue`, `setPivotSort`, `setPivotTopN`), field catalogue and layout moves (`inferPivotFields`, `pivotFieldListState`, `movePivotField`, `addPivotMeasure`, `setPivotMeasureAggregate`, `swapPivotRowsColumns`), several column fields with subtotals and collapsible column groups (`togglePivotColumnGroup`, `setPivotColumnsExpandedAll`, `pivotColumnFields`), Excel-style date grouping in UTC with fiscal years (`orderDate:year`, `setPivotDateGrouping`, `pivotDayOf`, `pivotDateLabel`), calculated measures with a safe expression parser (`calculate: "actual / plan - 1"`, `setPivotCalculatedMeasure`, `parsePivotCalc`), "show values as" differences / running totals / ranks along a field (`setPivotMeasureShowAs`), row subtotals at top / bottom / off (`setPivotSubtotal`), distinct count, drill-through to source records (`pivotDrillThrough`), formatting, layout math — runs in Node for exports |
| `@nqlib/nqgrid/pivot` | React pivot renderer: `usePivotGrid`, `PivotTable` (pinned dimensions, KPI panel, heat, header chart band, sort / filter indicators; static mode for HTML/PDF), `PivotSlicer`, `PivotFilterMenu`, `PivotHeaderMenu`, `PivotFieldList` (Excel-style field list with dependency-free pointer + keyboard drag-and-drop: `startPivotFieldDrag`, `pivotFieldDragHandleProps`, `pivotDropZoneProps`; date "Group by…" menu), `usePivotLayoutDraft` (one "Defer layout update" draft for the field list and header drags), multi-row column headers with group toggles (`onToggleColumnGroup`) and a `renderColumnHeader` slot (`pivotColumnHeaderRole`), drill-through (`onDrillThrough`, `PivotDrillThroughPanel`), `PivotCalculatedMeasureForm` and `PivotShowAsMenu` (also in the field list, with subtotal positions and Distinct Count), TanStack adapter |
| `@nqlib/nqgrid/render-static` | Standalone print-ready HTML for pivot models (`renderPivotHtml`, inline CSS, light/dark, paging) — feeds the `nqgrid-export` PDF/XLSX CLI |
| `@nqlib/nqgrid/engine` | Table engine utilities (TanStack / React hooks; re-exports the pure helpers from `core`) |
| `@nqlib/nqgrid/grid` | Table/grid DOM primitives (`GridTable`, …) — replaces nqui Table |
| `@nqlib/nqgrid/sheet` | Virtual sheet / viewport |
| `@nqlib/nqgrid/spreadsheet` | Spreadsheet-style commands / formats |
| `@nqlib/nqgrid/advanced` | Rich schema, `buildRichColumnFromDef`, formatters |
| `@nqlib/nqgrid/fixtures` | Mock datasets for examples |
| `@nqlib/nqgrid/configurator` | Typed import plan + feature flags |

## Documentation

- **[CHANGELOG.md](./CHANGELOG.md)** — release history (start at **0.1.0**).
- **[docs/RELEASE-0.1.0.md](./docs/RELEASE-0.1.0.md)** — v0.1.0 release notes + GitHub release snippet.
- **[docs/playground-table-recipe.md](./docs/playground-table-recipe.md)** — copy Virtual Data lab UI (engine vs playground separation).
- **[docs/rdg-nqgrid-feature-matrix.md](./docs/rdg-nqgrid-feature-matrix.md)** — nqdg / react-data-grid fork vs nqgrid engine + gaps.
- **[docs/composition-architecture.md](./docs/composition-architecture.md)** — engine / grid / nqui / app layers.
- **[docs/engine-tanstack-matrix.md](./docs/engine-tanstack-matrix.md)** — TanStack vs engine ownership + playground shells.
- **`docs/configurator.md`** — configurator usage (in `docs/`).
- **[docs/pivot-headless.md](./docs/pivot-headless.md)** — pivot core, filters / slicers / sorting / Top N, field list & drag-and-drop, several column fields, date grouping, calculated measures, show values as, subtotal positions, distinct count, drill-through, cross-language contract (`contract/pivot/v1`), static HTML, export roadmap.
- **[docs/pivot-performance.md](./docs/pivot-performance.md)** — `pnpm bench` results (10k–500k rows) and how the engine stays fast.
- **[packages/nqgrid-export](./packages/nqgrid-export/README.md)** — `nqgrid-export` CLI / HTTP service: pivot → PDF, XLSX, HTML (Docker image).
- **[integrations/python](./integrations/python/README.md)** — Python client for `nqgrid-export` (HTTP + subprocess), Pydantic models of the pivot contract, openpyxl writer and an MCP tool that emails reports. Integration guide: **[docs/integrations/secolab.md](./docs/integrations/secolab.md)**.

## Python backends

Pivot reports for Python services and MCP agents live in **[`integrations/python`](./integrations/python/README.md)**
(`nqgrid-export-client`). The app sends its spec, the backend loads the rows and calls `nqgrid-export`, and the PDF / XLSX
matches the grid:

```python
from nqgrid_export import NqgridExportClient

pdf = NqgridExportClient("http://127.0.0.1:8787").export(spec, rows, format="pdf")
```

```ts
import { pivotExportRequestFromGrid } from "@nqlib/nqgrid/pivot";
const request = pivotExportRequestFromGrid(grid, { format: "pdf" }); // { spec, dataset, format } for the backend
```

**Imports for new products:** use `@nqlib/nqgrid/engine` (+ optional `@nqlib/nqgrid/tokens`). Fork playground `lib/` for look and pinning — do not rely on the main barrel for UI. Pinning in apps: copy `playground-row-index-gutter.ts` (`pinPlaygroundCell` only — no direct `getPinnedTableCellStickyStyle` in JSX).

Default spreadsheet tables use **virtual-data** look + **table-selection** interactions (see [`.cursor/README.md`](./.cursor/README.md)). Legacy dashboard demos (portfolio / flights) use card ScrollArea shells. Agent skills live under [`.cursor/`](./.cursor/README.md).

## Playground & Cursor skills

Reference implementations live under **`apps/playground/src/demos/`**. To rebuild the same table every time:

1. **`.cursor/skills/nqgrid-playground-starter/SKILL.md`** — **start here**: canonical TanStack table (virtual-data design, select column, row/column drag, resize, virtualizer).
2. **`.cursor/skills/nqgrid-table-design/SKILL.md`** — tokens; card-table variant when spec names portfolio/flights.
3. **`.cursor/skills/consumer-table-design/SKILL.md`** — pinned-column geometry (pipeline reference).

Copy those skill folders to `~/.cursor/skills/` if you want them globally.

## Playground: `@nqlib/nqui` source

The playground depends on **`@nqlib/nqui`** for all UI (`Table`, `ScrollArea`, `Button`, …). Default is the **latest published** version in `apps/playground/package.json` (currently `^0.6.2`).

| Mode | Command |
|------|---------|
| Published (default) | `pnpm dev` from repo root, or `pnpm dev` in `apps/playground` |
| Local nqui `dist` (Vite alias) | `USE_LOCAL_NQUI=true pnpm dev` — expects sibling `../nqui` with `dist/` after `npm run build:lib` |
| Custom nqui path | `NQUI_DIR=/path/to/nqui USE_LOCAL_NQUI=true pnpm dev` |
| npm link workflow | `pnpm --filter nqgrid-playground toggle-nqui` with `USE_LOCAL_NQUI=true` / `false` |

Check what is active: `pnpm --filter nqgrid-playground nqui:status`.

## Scripts

```bash
pnpm run build    # tsup → dist/
pnpm test         # vitest (library)
pnpm -r test      # workspace packages (nqgrid-export); `pnpm test:all` runs both
pnpm run lint     # eslint
make login        # npm web login
make verify       # pre-publish gate
make publish      # verify + publish to npm
```

See `.cursor/commands/publish.md` for the full release checklist.

## License

MIT — see [package.json](./package.json).
