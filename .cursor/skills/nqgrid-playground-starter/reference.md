# nqgrid canonical table — build checklist

Use this on **every** new table. SSOT: `virtual-data-demo.tsx` (look + **`index`** column) + persona-specific demo (see SKILL §2).

## Before coding

- [ ] Pick **interaction persona**: analytics (`index` + range borders), dashboard (`checkbox` / `index+checkbox`), or parity lab (`full`)
- [ ] Confirm row count / server-backed → plan `useTableRowVirtualizer` and/or `VirtualDataManager`
- [ ] Confirm bulk ops → `checkbox` or `index+checkbox`; confirm analytics row # → **`index`** (default for data grids)
- [ ] Confirm pinned columns → pipeline-reference (else skip)

## Dependencies

- [ ] `@nqlib/nqgrid`, `@tanstack/react-table`, `@nqlib/nqui`, `@nqlib/nqui/sortable`
- [ ] `@remixicon/react` (`RiDraggable`) when using drag affordances
- [ ] Peers: `react`, `react-dom`

## Visual (virtual-data)

- [ ] `EngineScrollTableShell` + `useEngineScrollViewport()` → `viewportRef`, `scrollRoot`
- [ ] Table width per **[nqgrid-table-full-width](../nqgrid-table-full-width/SKILL.md)**:
  - Dashboard / ≤8 columns: `width: "100%"`, `minWidth: table.getTotalSize()`, one flex label column
  - Wide grid: `width: table.getTotalSize()` (+ optional `min-w-[…]` on table)
- [ ] `<colgroup>` — fixed `width` on compact columns; `minWidth` only on flex column(s)
- [ ] `th`/`td` — omit fixed `width` on flex column cells
- [ ] `thead` → `gridHeaderClass`; `th` → `gridHeadCellClass`
- [ ] `tbody` → `gridBodyHoverClass`
- [ ] `tr` → `gridRowClass` + `neutralTanStackRowFillClass(tokens, rowIndex)` from `useNeutralPlaygroundTable()`
- [ ] `td` → `gridCellClass`; numeric columns right-aligned + `gridNumericClass`
- [ ] Virtualizer: `estimateSize: NEUTRAL_TABLE_ROW_HEIGHT_PX` (28), `scrollElement: scrollRoot`
- [ ] Virtual rows: `getVirtualTableRowStyle(vr.start)` when pinning; **never** `transform: translateY` on `<tr>`
- [ ] Async cells: skeleton `animate-pulse` when `getCell` / `getRow` is null

## TanStack core

- [ ] `createColumnHelper<Row>()`
- [ ] `useReactTable` + `getCoreRowModel` (or `withCoreSorting*` preset from `@nqlib/nqgrid`)
- [ ] `getRowId: (r) => r.id` (stable string ids)
- [ ] `flexRender` for all header and body cells
- [ ] Column `size` / `minSize` / `maxSize` set on defs that resize

## First column mode

- [ ] Mode chosen: `index` | `checkbox` | `index+checkbox` | `full` (parity) | `none` (range-only)
- [ ] Analytics / data grid → default **`index`** unless spec forbids first column
- [ ] Dashboard bulk edit → **`checkbox`** or **`index+checkbox`**; not **`full`** unless reorder required
- [ ] Column id `"select"`; first in `columnOrder`; excluded from horizontal Sortable (`dataColumnOrder`)
- [ ] Row-index modes (`index`, `index+checkbox`): gutter sticky at index 0 via `usePlaygroundPinnedLayout`
- [ ] Pinned gutter: `pinPlaygroundCell({ rowIndexGutter: true })` + `gridRowHeaderPinned*FillClass` (opaque)
- [ ] Unqualified **column** = **data column** (not the `#` gutter) — see `playground-row-index-gutter.ts`
- [ ] `createSelectColumn(helper, { mode: "…" })` — see `playground-canonical-select-column.tsx`

## QA

- [ ] Scroll works in flex parent (`min-h-0` chain, `tableScrollViewportStyle` via shell)
- [ ] Table fills card width — no empty zone right of last column ([nqgrid-table-full-width](../nqgrid-table-full-width/SKILL.md))
- [ ] Analytics: `#` column shows stable ordinals; spreadsheet: range borders visible on select
- [ ] Dashboard: bulk bar on checkbox selection; task column has no completion checkbox
- [ ] Sticky header opaque (no body bleed-through)
- [ ] Pinned columns / row-index gutter opaque (no horizontal bleed-through); gutter uses `gridRowHeaderPinned*FillClass`
- [ ] Parity **`full`** only: drag/resize QA from `table-selection-demo.tsx`
- [ ] `pnpm exec tsc --noEmit` clean in app

## File map

| Need | File |
|------|------|
| Canonical look + row `#` | `virtual-data-demo.tsx` |
| Spreadsheet range select | `grid-keyboard-demo.tsx` |
| Dashboard bulk select | `task-delivery-table.tsx`, `support-queue-table.tsx` |
| Shell wrapper | `engine-scroll-table-shell.tsx`, `playground-neutral-table.tsx` |
| Classes | `grid-styles.ts`, `playground-table-tokens.ts` |
| Rich columns | `rich-inline-tasks-demo.tsx`, `playground-people-combobox-cell.tsx` |
| Pinning | `pipeline-reference-demo.tsx`, `virtual-data-demo.tsx`, `playground-row-index-gutter.ts` |
