# nqgrid Cursor agent skills

## Build any data table

Start here — single canonical recipe:

**[nqgrid-playground-starter](skills/nqgrid-playground-starter/SKILL.md)** — TanStack + virtual-data look (`grid-styles`, `EngineScrollTableShell`) + table-selection interactions (column/row drag, resize, `select` column with # / checkbox / row drag). Checklist: [reference.md](skills/nqgrid-playground-starter/reference.md).

## Supporting skills (load as needed)

| Order | Skill | When |
|-------|-------|------|
| 1 | [engine-only](../.claude/skills/engine-only/SKILL.md) | Public API / what ships in `@nqlib/nqgrid` |
| 2 | [nqgrid-scroll-table-shell](skills/nqgrid-scroll-table-shell/SKILL.md) | Gap, header bleed, pin leak ([docs/scroll-table-shell.md](../docs/scroll-table-shell.md)) |
| 3 | [nqgrid-table-full-width](skills/nqgrid-table-full-width/SKILL.md) | Empty space right of columns; table must fill card |
| 4 | [nqgrid-table-design](skills/nqgrid-table-design/SKILL.md) | Token map; legacy card tables (portfolio / flights) |
| 5 | [consumer-table-design](skills/consumer-table-design/SKILL.md) | Pinned-column geometry (pipeline / BECO) |
| 6 | [nqui-skills/SKILL.md](nqui-skills/SKILL.md) | nqui hub → **nqui-data-tables** for generic dashboard scroll |

## SSOT demos

| Demo | File |
|------|------|
| Visual + virtualizer + async | `apps/playground/src/demos/virtual-data-demo.tsx` |
| Select + DnD + resize | `apps/playground/src/demos/table-selection-demo.tsx` |
| Full-width dashboard | `apps/playground/src/demos/task-delivery-table.tsx` |
| Pinning | `apps/playground/src/demos/pipeline-reference-demo.tsx` |

## Bundles

| Path | Source |
|------|--------|
| `nqui-skills/` | Copied from BECO consumer; refresh via `npx @nqlib/nqui init-skills` when needed |
| `skills/nqgrid-*` | nqgrid-specific |
| `.claude/skills/engine-only` | nqgrid publish contract |
