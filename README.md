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
| `@nqlib/nqgrid/engine` | Table engine utilities |
| `@nqlib/nqgrid/sheet` | Virtual sheet / viewport |
| `@nqlib/nqgrid/spreadsheet` | Spreadsheet-style commands / formats |
| `@nqlib/nqgrid/advanced` | Rich schema, `buildRichColumnFromDef`, formatters, the `compareKey` sort layer + `toInterval` time-axis seam |
| `@nqlib/nqgrid/fixtures` | Mock datasets for examples |
| `@nqlib/nqgrid/configurator` | Typed import plan + feature flags |

## Sibling packages

`nqgrid` is the **table** member of a `table · gantt · board` family that all render over one
shared `ColumnType` contract (value/format/style kept separate; sort/group on parsed
`compareKey`, never the display string).

| Package | Purpose |
|---------|---------|
| **[`@nqlib/nqgantt`](./packages/nqgantt)** | Headless gantt/timeline engine — projects the same nqgrid schema + rows onto a time axis (`toInterval`) with drag-to-reschedule, milestones, dependencies, and swimlanes. See the **Gantt** tab in the playground. |

## Documentation

- **[CHANGELOG.md](./CHANGELOG.md)** — release history (start at **0.1.0**).
- **[docs/RELEASE-0.1.0.md](./docs/RELEASE-0.1.0.md)** — v0.1.0 release notes + GitHub release snippet.
- **`docs/configurator.md`** — configurator usage (in `docs/`).

## Playground & Cursor skills

Reference implementations live under **`apps/playground/src/demos/`**. To have an agent rebuild the same **shell + scroll + rich columns + people picker** patterns, use the project skills:

1. **`.cursor/skills/nqgrid-table-design/SKILL.md`** — tokens, ScrollArea composition, hover/selection rules.
2. **`.cursor/skills/nqgrid-playground-starter/SKILL.md`** — end-to-end starter (TanStack, nqui, inline edit patterns, people column).

Copy those skill folders to `~/.cursor/skills/` if you want them globally.

## Scripts

```bash
pnpm run build    # tsup → dist/
pnpm test         # vitest
pnpm run lint     # eslint
```

## License

MIT — see [package.json](./package.json).
