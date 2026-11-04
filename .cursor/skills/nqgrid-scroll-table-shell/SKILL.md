---
name: nqgrid-scroll-table-shell
description: >-
  ScrollArea + Card table shell rules for @nqlib/nqgrid + @nqlib/nqui: edge-to-edge
  layout (no px-4 gap), opaque sticky headers, opaque pinned columns, viewport
  pinning. Use when building or fixing scroll tables, card/table gaps, header
  bleed-through, or pinned column leak-through in playground or consumer apps.
---

# nqgrid scroll table shell

Read **`docs/scroll-table-shell.md`** first — it is the canonical contract for engine consumers.

**New tables:** use **`EngineScrollTableShell`** via [nqgrid-playground-starter](../nqgrid-playground-starter/SKILL.md) (virtual-data SSOT), not a one-off ScrollArea wiring.

## When this skill applies

- Table does not fill the card (horizontal gap / “letterbox” padding).
- Table columns cluster left with **empty dead space** inside the scroll viewport (wrong table `width` / fixed widths on all cells — see **[nqgrid-table-full-width](../nqgrid-table-full-width/SKILL.md)**).
- Body rows visible **through** the sticky header while scrolling.
- Scrolling columns visible **through** pinned (frozen) columns.
- Row-index `#` gutter sticks in header but **not** in body rows (virtualizer used `transform: translateY` on `<tr>`).
- Wiring `PlaygroundDataTableShell`, `EngineScrollTableShell`, or copying playground demos.

## Required pattern

1. **Shell** — nqui `Card` + bounded height + `ScrollArea` with `tableScrollViewportStyle` (from `@nqlib/nqgrid`).
2. **Edge-to-edge** — inner wrapper `tableScrollAreaEdgeClass` (`min-h-0 min-w-0 w-full pt-0`). Never default to `px-4` inside the scroll viewport.
3. **Sticky header** — `tableHeaderClass` on `TableHeader` / `thead`; **`bg-card` on every `th` / `TableHead`**.
4. **Opaque body** — `tableBodyClass` or `tableBodyStripedClass` on `TableBody` / `tbody` (not an empty class).
5. **Pins** — **`pinPlaygroundCell` only** (`playground-row-index-gutter.ts`); never `getPinnedTableCellStickyStyle` in demos. Pass `scrolledX` from `useEngineScrollViewport(true)`.
6. **Row-index gutter pins** — `pinPlaygroundCell({ rowIndexGutter: true })` (opaque `gridRowHeaderPinned*FillClass`).
7. **Virtual rows + pins** — `getVirtualTableRowStyle(vr.start)` on `<tr>`; **never** `transform: translateY` (breaks body sticky).

## Playground files (copy, don’t reinvent)

| File | Role |
|------|------|
| `apps/playground/src/lib/playground-data-table-shell.tsx` | Card + ScrollArea; `edgeToEdge` default **true** |
| `apps/playground/src/lib/nqui-table-shell.ts` | Layout tokens + re-exports `tableHeaderClass`, `tableBodyClass*` |
| `apps/playground/src/lib/playground-table-chrome.tsx` | `PlaygroundStickyTableHeader`, pinned fill class names |
| `apps/playground/src/lib/grid-styles.ts` | Raw `<table>` spreadsheet: opaque `gridSticky*FillClass`, `gridRowHeaderPinned*FillClass` |
| `apps/playground/src/lib/playground-row-index-gutter.ts` | Row-index gutter pinning + `pinPlaygroundCell` |
| `apps/playground/src/lib/pinned-cell-helpers.ts` | Internal to pinning SSOT — do not import from demos |

## Anti-patterns (reject in review)

- `tableScrollAreaContentClass` (`px-4`) on wide/data tables inside ScrollArea.
- Sticky `thead` without `bg-card` on **each** header cell.
- Pinned cells with `bg-muted/40`, `bg-card/55`, or no background.
- Pinned row-index gutter using `gridRowHeaderHeadClass` / `gridRowHeaderCellClass` fills instead of **`gridRowHeaderPinned*FillClass`**.
- `transform: translateY(...)` on virtualized `<tr>` when any column is pinned — use `getVirtualTableRowStyle`.
- `tableBodyClassFor` returning only zebra stripes with no solid fill for `"solid"`.
- Footer or pagination inside the scroll viewport.
- Colors in engine `getPinnedTableCellStickyStyle` (geometry only).

## Engine-only reminder

`@nqlib/nqgrid/engine` returns `left`, `width`, `zIndex`, `position` — not colors. App tokens live in consumer `grid-styles` or nqui composition. See `.claude/skills/engine-only/SKILL.md`.

## After changes

Run `pnpm --filter nqgrid-playground run build`. Smoke: Pipeline reference, Flights (pins), Portfolio (sort header), Virtual data (edge-to-edge + sticky `#` gutter on horizontal scroll).
