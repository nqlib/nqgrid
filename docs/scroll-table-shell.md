# Scroll table shell — layout, gaps, sticky header, pinned columns

Use this when composing **@nqlib/nqgrid/engine** with **@nqlib/nqui** (`Card`, `ScrollArea`, `Table*`) or a raw `<table>` inside a bounded card. These rules prevent the bugs seen in the playground: horizontal gap inside the card, body rows painting through the sticky header, and scroll columns bleeding through pinned cells.

## Shell stack (order matters)

1. **Outer** — nqui `Card` with a **bounded height** (`flex` column, `min-h-*`, `max-h-*`, `overflow-hidden`, `py-0`). The card must not grow unbounded or ScrollArea never gets a finite viewport.
2. **Scroll** — nqui `ScrollArea` with:
   - `className` = flex shrink contract (`h-0 min-h-0 flex-1 overflow-hidden w-full`).
   - `viewportStyle` = absolute inset + `minHeight: 0` + `overscrollBehavior: contain` (see `tableScrollViewportStyle` in `@nqlib/nqgrid`).
   - `fadeMask={false}` unless product needs edge fades.
3. **Content wrapper** — **edge-to-edge** by default (`min-h-0 min-w-0 w-full pt-0`). Do **not** wrap the table in `px-4` inside the scroll viewport; that creates visible side gaps between the table and the card border.
4. **Table** — nqui `Table` or `<table>` with `tableLayout: fixed` + `colgroup` when using column sizes / pinning.
5. **Footer** — pagination / actions in `CardFooter` **below** ScrollArea, not inside the viewport.

Playground reference: `apps/playground/src/lib/playground-data-table-shell.tsx`, `apps/playground/src/lib/nqui-table-shell.ts`.

## Edge-to-edge (no card/table gap)

| Do | Don't |
|----|--------|
| `tableScrollAreaEdgeClass` (no horizontal padding) | `tableScrollAreaContentClass` (`px-4 pt-0`) inside scroll tables |
| Default `edgeToEdge={true}` on the shared shell | Padding “for breathing room” on wide grids — pad the page, not the viewport |

Virtual data and pipeline demos use the same rule: the grid width is `w-full min-w-full` inside an edge-to-edge wrapper.

## Sticky header (opaque, no scroll bleed)

Scrolling happens on the **ScrollArea viewport**, not on `window`. The header row must be sticky **inside that viewport** and **opaque**.

| Layer | Requirement |
|-------|-------------|
| `<thead>` / `TableHeader` | `sticky top-0 z-20 bg-card` + suppress thead row hover (`tableHeaderClass` from `@nqlib/nqgrid`) |
| Every `<th>` / `TableHead` | **`bg-card` on each cell**, not only on pinned columns. Transparent `th` lets body rows show through while scrolling. |
| Body | Opaque cell backgrounds (`tableBodyClass` / `tableBodyStripedClass`). An empty tbody class lets rows show through the header. |

Playground helpers: `PlaygroundStickyTableHeader`, `tableOpaqueHeadClass` in `apps/playground/src/lib/playground-table-chrome.tsx`.

**Z-index:** sticky thead ≈ `z-20`. Pinned header cells use engine `getPinnedTableCellStickyStyle` with `headZBase` ≥ 40 so pins stack above unpinned header cells but remain opaque.

## Pinned columns (opaque, no horizontal bleed)

**Playground / forked apps:** use the single recipe in `apps/playground/src/lib/playground-row-index-gutter.ts` — `usePlaygroundPinnedLayout` + `pinPlaygroundCell` (or `pinPlaygroundFreezeCell` for Excel freeze). See [playground-table-recipe.md](./playground-table-recipe.md).

Engine geometry (called inside those helpers only):

- `usePinnedTableColumns` / `computePinnedLayout`
- `getPinnedTableCellStickyStyle` — `left`, `width`, `zIndex` only
- `mergePinnedCellStyle` — GPU layer + last-pin edge shadow when `scrollLeft > 0`

**Consumer must supply opaque fills** on every pinned `th`/`td` (via `pinPlaygroundCell` classNames):

- `bg-card` (or your app’s solid surface token — **never** `bg-muted/40` or `bg-card/55` on sticky/pinned cells).
- Pinned body cells: add `hover:!bg-card` if row hover uses `[&_tr:hover>td]:bg-muted` so hover does not turn pins translucent.

Spreadsheet demos: `gridStickyHeadFillClass`, `gridStickyCellFillClass` in `apps/playground/src/lib/grid-styles.ts` (both `bg-card`). Row-index gutter pins use opaque `gridRowHeaderPinned*FillClass` (`bg-muted`).

### Row virtualizer + pinned columns

TanStack row virtualizers usually position rows with `transform: translateY(…)`. **Do not use transform on the row when any column is pinned** — it breaks `position: sticky` on body cells (header still sticks).

Use engine `getVirtualTableRowStyle(startPx)` instead (`top`, not `transform`). SSOT: `virtual-data-demo.tsx`, `sheet-virtual-demo.tsx`.

### Row virtualizer + freeze panes / row pinning

When prefix-frozen body rows or TanStack `rowPinning` is active:

- Virtualize **`useTableRowSections().centerRows` only** (not `getRowModel().rows`).
- Pass `bandOffsetPx: sections.topBandHeightPx` into `getVirtualTableRowStyle` / `useTableRowVirtualizer`.
- Render frozen + top-pinned rows outside the virtual window; bottom-pinned rows after `bandOffset + centerTotalSize`.

See [engine-freeze-panes.md](./engine-freeze-panes.md) and `freeze-panes-virtual-demo.tsx`.

## Engine vs styles package

| Package | Owns |
|---------|------|
| `@nqlib/nqgrid/engine` | Pin offsets, widths, `zIndex`, `position: sticky`, `left`, `top` |
| Consumer app / nqui | `bg-card`, borders, typography, hover, zebra |

Do not put colors in engine geometry. Do not expect `@nqlib/nqgrid/styles` `tableShellClass` padding to fix layout — prefer nqui `Card` + edge-to-edge scroll.

## Checklist (copy before shipping a table)

- [ ] Card has finite `max-h` and `overflow-hidden`.
- [ ] ScrollArea uses `tableScrollViewportStyle` (or equivalent absolute viewport pin).
- [ ] Inner wrapper is edge-to-edge (no `px-*` on scroll content).
- [ ] `TableHeader` / `thead` uses `tableHeaderClass` (sticky + `bg-card`).
- [ ] Every header cell has `bg-card`.
- [ ] `TableBody` uses opaque `tableBodyClass` (solid or striped).
- [ ] Pinned cells: engine sticky style + opaque `bg-card` on head and body.
- [ ] Footer outside ScrollArea.

## Related docs

- `docs/composition-architecture.md` — engine / grid / nqui layers
- `docs/engine-tanstack-matrix.md` — which hooks apply per feature
- `.cursor/skills/nqgrid-scroll-table-shell/SKILL.md` — agent skill (triggers on scroll/gap/pinned/header bleed)
