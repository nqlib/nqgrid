# @nqlib/nqgrid

Headless **TanStack Table** helpers, **layout tokens**, optional **rich column** schema (formatting + cell wiring), demo **fixtures**, and a **configurator** import planner. Compose UI with your design system (the official playground uses **[@nqlib/nqui](https://www.npmjs.com/package/@nqlib/nqui)** — not a peer of this package).

## Install

```bash
pnpm add @nqlib/nqgrid @tanstack/react-table react react-dom
```

## Subpath exports

| Import | Purpose |
|--------|---------|
| `@nqlib/nqgrid` | Main barrel (engine + components used by demos) |
| `@nqlib/nqgrid/styles` | Tailwind class tokens for table shells and scroll |
| `@nqlib/nqgrid/core` | Framework-free engine (no React/DOM): pivot model, formatting, layout math — runs in Node for exports |
| `@nqlib/nqgrid/pivot` | React pivot renderer: `usePivotGrid`, `PivotTable` (pinned dimensions, KPI panel, heat, header chart band; static mode for HTML/PDF), TanStack adapter |
| `@nqlib/nqgrid/render-static` | Standalone print-ready HTML for pivot models (`renderPivotHtml`, inline CSS, light/dark, paging) — feeds the `nqgrid-export` PDF/XLSX CLI |
| `@nqlib/nqgrid/engine` | Table engine utilities (TanStack / React hooks; re-exports the pure helpers from `core`) |
| `@nqlib/nqgrid/sheet` | Virtual sheet / viewport |
| `@nqlib/nqgrid/spreadsheet` | Spreadsheet-style commands / formats |
| `@nqlib/nqgrid/advanced` | Rich schema, `buildRichColumnFromDef`, formatters |
| `@nqlib/nqgrid/fixtures` | Mock datasets for examples |
| `@nqlib/nqgrid/configurator` | Typed import plan + feature flags |

## Documentation

- **[CHANGELOG.md](./CHANGELOG.md)** — release history (start at **0.1.0**).
- **[docs/RELEASE-0.1.0.md](./docs/RELEASE-0.1.0.md)** — v0.1.0 release notes + GitHub release snippet.
- **`docs/configurator.md`** — configurator usage (in `docs/`).
- **[docs/pivot-headless.md](./docs/pivot-headless.md)** — pivot core, cross-language contract (`contract/pivot/v1`), static HTML, export roadmap.
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

## Playground & Cursor skills

Reference implementations live under **`apps/playground/src/demos/`**. To have an agent rebuild the same **shell + scroll + rich columns + people picker** patterns, use the project skills:

1. **`.cursor/skills/nqgrid-table-design/SKILL.md`** — tokens, ScrollArea composition, hover/selection rules.
2. **`.cursor/skills/nqgrid-playground-starter/SKILL.md`** — end-to-end starter (TanStack, nqui, inline edit patterns, people column).

Copy those skill folders to `~/.cursor/skills/` if you want them globally.

## Scripts

```bash
pnpm run build    # tsup → dist/
pnpm test         # vitest (library)
pnpm -r test      # workspace packages (nqgrid-export); `pnpm test:all` runs both
pnpm run lint     # eslint
```

## License

MIT — see [package.json](./package.json).
