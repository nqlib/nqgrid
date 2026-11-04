---
name: engine-only
description: nqgrid's shipping contract and design direction — ship a headless ENGINE (logic + geometry), let consuming apps own all style tokens. Use when adding exports, reviewing the public API, deciding whether something belongs in nqgrid, or planning the path to an engine-only release.
---

# nqgrid: Engine-Only

**nqgrid replaces nqui table/grid components, not nqui itself.** Use
`@nqlib/nqgrid/engine` + `@nqlib/nqgrid/grid` for table behavior and DOM; import
only **primitives** from published `@nqlib/nqui` (`ScrollArea`, `Button`, `Input`,
`Combobox`, `cn`, …). **Do not** use nqui `Table`, `TableRow`, `TableCell`, or
`DataTable` in nqgrid-based products — customize engine and grid UI here before
shipping.

The engine owns *logic and geometry*. The **grid** layer owns semantic table/grid
DOM (unstyled primitives today; shells and virtual rows over time). The consuming
app owns *style tokens* (colors, borders, density, radius).

> Reference consumer: BECO defines its own `src/lib/grid-styles.ts` and composes
> it with `@nqlib/nqgrid/engine`. It does **not** import `@nqlib/nqgrid/styles`.
> That is the target shape for every consumer.

## The contract

| Layer | Ships in nqgrid? | Owner |
|-------|------------------|-------|
| Sorting / paging state + logic | ✅ `engine` | nqgrid |
| Pinned layout + cell sticky geometry | ✅ `engine` | nqgrid |
| Row selection, keyboard, clipboard, grouping, virtualization, reorder | ✅ `engine` | nqgrid |
| Select-cell press-hold drag intent (`useSelectCellDragIntent`) | ✅ `engine` | nqgrid |
| TanStack defaults / table factory | ✅ `engine` | nqgrid |
| Table/grid DOM (`GridTable`, …) | ✅ `grid` | nqgrid — **replaces nqui Table/DataTable** |
| ScrollArea, Button, Input, overlays | ❌ | **nqui** (primitives only) |
| Class-string style tokens (colors, padding, borders, radius) | ⚠️ **deprecated** `styles` | **consumer app** (fork `@nqlib/nqgrid/tokens`) |
| Typed table color starter | ✅ `tokens` | nqgrid — fork/customize in app |
| Pre-styled sheet/spreadsheet | ⚠️ legacy `sheet`/`spreadsheet`/`advanced` | TBD |

The engine must stay **renderer-agnostic**: it returns numbers, styles-as-data
(`CSSProperties` for geometry only — `left`, `width`, `zIndex`, `position`),
state, and hooks. It must never decide a color, a border, a font size, or a
radius. Those are the consumer's.

## Rules for changes

1. **New feature → goes in `engine`** as a hook or pure function. No JSX, no
   className, no color/spacing decision.
2. **Geometry styles are OK** — `getPinnedTableCellStickyStyle` returns
   `position/left/width/zIndex/top`. That's layout math, not theming. The line:
   if a designer would tweak it, it belongs to the consumer; if it's required
   for the feature to *function*, it can ship.
3. **Never add to `styles`.** `@nqlib/nqgrid/styles` is deprecated. New visual tokens go in
   `@nqlib/nqgrid/tokens` (typed starter consumers fork) or the app's own copy.
4. **Document the composition**, not a stylesheet. Show consumers how to wire
   `withCoreSorting` + `computePinnedLayout` + `getPinnedTableCellStickyStyle`
   into *their* tokens via `buildTableClasses`. See `docs/table-design-tokens.md`,
   `docs/scroll-table-shell.md`, and `.cursor/skills/nqgrid-scroll-table-shell/SKILL.md`.

## Engine surface (`@nqlib/nqgrid/engine`)

Logic: `withCoreSorting`, `withCoreSortingRowSelection`, paging, selection,
group-by tree, master/detail, infinite/virtual rows, keyboard + a11y, clipboard
TSV, row reorder, imperative handle.

Pinned / freeze geometry (consumers compose with app tokens):
- Columns: `resolvePinnedLeftPrefix`, `computePinnedLayout`, `getPinnedTableCellStickyStyle`, `usePinnedTableColumns` / `useFrozenTableColumns`.
- Rows (Excel prefix): `computeFrozenTopLayout`, `useFrozenTopRows`, `getFreezePaneCellStickyStyle`, `freezePanesFromExcelCell`.
- Bands + virtualizer: `useTableRowSections`, `useTableRowVirtualizer({ rows: centerRows, bandOffsetPx })`, `getVirtualTableRowStyle(..., { bandOffsetPx })`.
- Row pin by id: `withFreezePanesSupport`, TanStack `rowPinning`, `pinRowTop` / `getTopRows` (render bands — not flat row model).
- Outlines: `getOutlineRowIndentStyle`, `columnOutlineToVisibility`, `flattenOutlineHeaderRows`.
- See `docs/engine-freeze-panes.md`.

Consumers must drive `getWidthPx` from authoritative widths (e.g. `table-fixed`
+ `<colgroup>` + TanStack `getSize()`), or the offsets drift.

## Path to an engine-only release

The end state: nqgrid publishes `engine` (+ `fixtures` for tests, `configurator`
for tooling) and drops bundled style/component entry points.

1. **Now** — treat `styles` as frozen/deprecated. Ship typed tokens at
   `@nqlib/nqgrid/tokens`; playground configures via `playground-table-tokens.ts`.
2. **Migration** — consumers import `@nqlib/nqgrid/tokens` or copy `src/tokens/`
   into their app and override via `createTableTokens` (BECO `grid-styles.ts` pattern).
3. **Deprecate** — mark `./styles` (and pre-styled `./sheet` / `./spreadsheet` /
   `./advanced` if they bake in look) as deprecated in `package.json` /
   CHANGELOG; warn on import.
4. **Remove** — in the next major, drop the style entry points. `engine` (and
   `fixtures`/`configurator`) is the shipped surface.

When adding or reviewing exports, ask: *"Could two apps with different design
systems both use this unchanged?"* If yes → engine. If it encodes a look → it's
the consumer's, keep it out.
