---
name: nqgrid-playground-starter
description: >-
  Canonical TanStack table recipe for @nqlib/nqgrid + @nqlib/nqui: virtual-data
  spreadsheet look (grid-styles, EngineScrollTableShell, row virtualizer), configurable
  first-column modes (# / checkbox / drag), and spreadsheet range selection. Use for ANY
  new playground or consumer data table unless the spec explicitly asks for a different shell.
---

# nqgrid canonical table (TanStack + nqui)

**Read this skill first** whenever you add or refactor a data table. Pair with **`nqgrid-table-design`** (tokens), **`nqgrid-scroll-table-shell`** (scroll/pin fixes), and **`nqgrid-table-full-width`** (no dead space right of columns).

## Golden references (copy, don’t improvise)

| Concern | SSOT file | What to copy |
|---------|-----------|--------------|
| **Look & scroll** | `apps/playground/src/demos/virtual-data-demo.tsx` | `EngineScrollTableShell`, `useEngineScrollViewport`, `grid-styles.ts` classes, `<table>` + `colgroup`, `neutralTanStackRowFillClass`, row virtualizer + skeleton cells |
| **Row index (`#` only)** | `apps/playground/src/demos/virtual-data-demo.tsx` | Analytics default — first column row count, no checkbox/drag |
| **Bulk select (checkbox)** | `apps/playground/src/demos/task-delivery-table.tsx`, `support-queue-table.tsx` | Dashboard bulk bar + `createSelectColumn` |
| **Spreadsheet range select** | `apps/playground/src/demos/grid-keyboard-demo.tsx` | `useGridKeyboard`, `SelectionRange`, border fills — no select column |
| **Full parity (# + checkbox + drag)** | `apps/playground/src/demos/table-selection-demo.tsx` | Parity lab only |
| **Pinned wide grids** | `apps/playground/src/demos/pipeline-reference-demo.tsx` | `usePlaygroundPinnedLayout` + `pinPlaygroundCell` |
| **Full-width dashboard** | `apps/playground/src/demos/task-delivery-table.tsx` | `width: 100%` + flex column — **`nqgrid-table-full-width`** |

**Default new table** = virtual-data **shell + markup** + the **interaction persona** below. Do not mix random shells unless the task is explicitly a dashboard card table (portfolio / projects / flights).

## Stack

| Layer | Package / location |
|-------|---------------------|
| Table logic | `@tanstack/react-table` — always `useReactTable` + `flexRender` |
| Engine presets | `@nqlib/nqgrid` — `withCoreSorting`, `withCoreSortingRowSelection`, `useTableRowVirtualizer`, `VirtualDataManager`, pinning, `useGridKeyboard`, `SelectionRange` |
| Spreadsheet look | `apps/playground/src/lib/grid-styles.ts` — from `playground-table-tokens` / `nquiSpreadsheetPreset()` |
| Scroll shell | `apps/playground/src/parity/engine-scroll-table-shell.tsx` → `NeutralTableShell` → `PlaygroundDataTableShell` |
| Row chrome | `apps/playground/src/lib/playground-neutral-table.tsx` — `NEUTRAL_TABLE_ROW_HEIGHT_PX` (28), `neutralTanStackRowFillClass` |
| First column | `apps/playground/src/lib/playground-canonical-select-column.tsx`, `select-cell-chrome.tsx` |
| Pinning (SSOT) | `apps/playground/src/lib/playground-row-index-gutter.ts` | `usePlaygroundPinnedLayout`, `pinPlaygroundCell` — never raw engine pin helpers in demos |
| DnD (parity only) | `@nqlib/nqui/sortable`, `@remixicon/react` `RiDraggable` |
| Rich columns (optional) | `@nqlib/nqgrid/advanced` |

## 1. Visual contract (virtual-data design)

1. **Shell** — `EngineScrollTableShell` + `viewportRef` from `useEngineScrollViewport()`.
2. **Table width** — see **`nqgrid-table-full-width`**. Dashboard: `width: "100%"`, `minWidth: table.getTotalSize()`, one flex label column. Wide spreadsheet: `width: table.getTotalSize()` + optional `min-w-[…]`.
3. **Table markup** — native `<table className={gridTableClass} …>` + `<colgroup>` (fixed `width` on compact columns; `minWidth` only on flex column).
4. **Header** — `gridHeaderClass` on `thead`; `gridHeadCellClass` on each `th`.
5. **Body** — `gridBodyHoverClass` on `tbody`; `gridRowClass` + `neutralTanStackRowFillClass(tokens, rowIndex)` on each `tr`.
6. **Cells** — `gridCellClass`; numbers use `gridNumericClass` + right-aligned header.
7. **Density** — `text-xs`, row height **28px** for virtualizer `estimateSize`.
8. **Large row counts** — `useTableRowVirtualizer` + skeleton cells (virtual-data-demo).
9. **Async/server rows** — `VirtualDataManager` stub rows (virtual-data-demo).

Do **not** use deprecated `@nqlib/nqgrid/styles` flat strings for new spreadsheet grids.

## 2. Interaction personas (pick one)

**Keep both models** — they serve different products. Do not cram spreadsheet range-select and dashboard bulk-select into one first column unless the spec is the parity lab.

| Persona | When | First column mode | Selection chrome | Drag |
|---------|------|-------------------|------------------|------|
| **Analytics / spreadsheet** | Data grids, virtualized rows, copy/paste, cell edit | **`index`** (`#` only) — **default for analytics** | Range borders/fills: `useGridKeyboard` + `SelectionRange` | Ghost overlay while dragging; no persistent grip icon |
| **Dashboard / bulk ops** | Task boards, support queues, bulk assign/status | **`checkbox`** or **`index+checkbox`** | Row `data-state="selected"` + bulk bar | Drag selected row / edge only if reorder needed |
| **Parity lab** | table-selection-demo only | **`full`** | TanStack `rowSelection` + all DnD | Explicit `RiDraggable` + Sortable |

### First column modes (`id: "select"`)

Pick **one mode** per table. Column stays first in `columnOrder`; never inside horizontal column Sortable.

| Mode | Width | Header | Cell | Use when |
|------|-------|--------|------|----------|
| **`index`** | 40–44px | `#` (row-header gutter) | `row.index + 1` | **Analytics default** — Excel-style gutter via `gridRowHeader*` tokens |
| **`checkbox`** | 32–40px | Select-all | Checkbox only | Bulk edit; row numbers not needed |
| **`index+checkbox`** | 44–52px | `#` ↔ select-all | `#` ↔ checkbox (no drag lane) | Bulk edit **and** row count |
| **`full`** | 44–52px | `#` ↔ select-all | `SelectCellChrome` (# + checkbox + grip) | Parity demo only |
| **`none`** | — | omit | — | Pure spreadsheet range-select (`grid-keyboard-demo`) |

**Rule:** Analytics tables **default to `index`**. Dashboard tables **default to `checkbox`**. Upgrade to **`index+checkbox`** when a dashboard also needs visible row ordinals. Use **`full`** only for `table-selection-demo`.

Configure via `createSelectColumn({ mode: … })`. Row-index modes use `gridRowHeaderHeadClass` / `gridRowHeaderCellClass` from `grid-styles.ts` and `data-row-header` on `<td>` so hover skips the gutter.

### Terminology + sticky gutter

| Term | Meaning |
|------|---------|
| **row-index gutter** | Left `#` column (`ROW_INDEX_GUTTER_ID` / TanStack id `"select"`). Not a data column. |
| **data column** | Any other visible leaf column. Unqualified **column** in docs/skills means this. |
| **select column** | Implementation id for the first TanStack column (gutter, checkbox, or full chrome). |

When mode is **`index`** or **`index+checkbox`**, the row-index gutter is **always sticky at inline-start (index 0)** — use `usePlaygroundPinnedLayout` (`playground-row-index-gutter.ts`) with `leadingGutterColumnId`. Pin additional **data columns** via `dataPinnedLeftIds`; never list the gutter in that array.

**Pinned gutter fills:** apply `gridRowHeaderPinnedHeadFillClass` / `gridRowHeaderPinnedBodyFillClass` via `pinPlaygroundCell({ rowIndexGutter: true })` — not the translucent `gridRowHeaderHeadClass` / `gridRowHeaderCellClass` alone.

**Virtualizer + pins:** position rows with `getVirtualTableRowStyle(vr.start)` (`top`). **Never** `transform: translateY` on `<tr>` when pinning — body cells will not stick (header still will, which looks like a header-only bug).

### Spreadsheet selection (mode `none` + range chrome)

Excel/Sheets-style — **no checkboxes in column 0**:

1. Omit `select` column (or use **`index`** alongside range-select if row # still needed for analytics).
2. `useGridKeyboard` + `SelectionRange` (`cell` | `row` | `column`).
3. Selected cells: token fill/border on `td` (`cellRangeFill`, `data-state="selected"`).
4. Drag-to-select: `useSelectCellDragIntent({ mode: "select-range" })`.
5. Copy: `copyMatrixToClipboard`.

SSOT: `grid-keyboard-demo.tsx`.

**Analytics with row #:** use **`index`** first column **plus** range borders on data cells — row count and cell selection coexist without checkboxes.

### Dashboard bulk select

1. TanStack `rowSelection` + bulk action bar.
2. First column **`checkbox`** or **`index+checkbox`** — not **`full`** unless reorder is primary.
3. Row highlight via `data-state="selected"`.
4. ⌘/Ctrl-click row to toggle.

SSOT: `task-delivery-table.tsx`, `support-queue-table.tsx`.

## 3. Parity contract (resize / reorder / `full` column)

Use **only** when spec requires column resize, column reorder, row reorder, or **`full`** select column.

### TanStack state

```tsx
withCoreSortingRowSelection({
  data,
  columns,
  state: { sorting, rowSelection, columnSizing, columnOrder },
  onSortingChange: setSorting,
  onRowSelectionChange: setRowSelection,
  onColumnSizingChange: setColumnSizing,
  onColumnOrderChange: setColumnOrder,
  getRowId: (r) => r.id,
  enableColumnResizing: true,
  columnResizeMode: "onChange",
  defaultColumn: { minSize: 72, maxSize: 560, size: 160 },
});
```

### `full` mode cell (`SelectCellChrome`)

Parity lab only — product tables use **`index`**, **`checkbox`**, or **`index+checkbox`**:

- **Idle** — `row.index + 1`.
- **Hover** — grip visible (no persistent icon at rest in product tables).
- **Selected** — checkbox; grip lane separate from checkbox hit target.
- **Drag-ready** — hold ~220ms or move >10px on grip strip.

### Column / row drag (parity)

- Horizontal `Sortable` on data headers; vertical `Sortable` on `<tr>`.
- `SortableOverlay` for ghost preview — **this** is the Sheets-style drag affordance.
- Header `RiDraggable` on `group-hover/col` — parity only; product tables use cursor + overlay.
- `stopSortableChain` on checkbox, sort, resize handlers.

## 4. Minimal skeleton

When spec needs only data display + optional sort:

1. `useReactTable({ data, columns, getCoreRowModel, getRowId })` (+ `withCoreSorting`).
2. First column **`index`** for analytics unless spec says otherwise.
3. `EngineScrollTableShell` + `grid-*` classes + virtualizer when row count is large.

## 5. Optional features

| Feature | Demo | Hook / API |
|---------|------|------------|
| Rich status / people / percent | `rich-inline-tasks-demo.tsx` | `buildRichColumnFromDef` |
| Inline edit | same | double-click `Input` |
| Pinned columns | `pipeline-reference-demo.tsx` | `usePlaygroundPinnedLayout`, `pinPlaygroundCell` |
| Row-index gutter + virtualizer | `virtual-data-demo.tsx` | `usePlaygroundPinnedLayout`, `getVirtualTableRowStyle`, `pinPlaygroundCell` |
| Dashboard card + nqui `Table` | `portfolio-table.tsx` | legacy card shell only |

## Anti-patterns

- Using **`full`** first column on product dashboards (task delivery, support queue).
- Omitting **`index`** on analytics grids that need row ordinals.
- Checkboxes **and** spreadsheet range borders as dual selection models on the same table.
- Persistent drag icons on product tables (use ghost overlay only).
- `select` column inside horizontal column Sortable.
- `transform: translateY` on virtualized `<tr>` when any column is pinned — use `getVirtualTableRowStyle`.
- Translucent `gridRowHeader*Class` on pinned gutter cells without `gridRowHeaderPinned*FillClass`.
- `width: table.getTotalSize()` only on short-column dashboard tables (**`nqgrid-table-full-width`**).

## Checklist

See [reference.md](reference.md).
