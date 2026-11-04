# nqdg (react-data-grid fork) vs nqgrid — feature matrix

Reference tree: **`/Users/bnguyen/Downloads/react-data-grid-main`** (package name `nqdg`, CSS `--nqdg-*`, `@nqlib/nqui`).

nqgrid target shape: **headless engine + TanStack Table + consumer/playground tokens** — see [composition-architecture.md](./composition-architecture.md), [playground-table-recipe.md](./playground-table-recipe.md).

## Status legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Comparable capability (engine or playground proves it) |
| 🔶 | Partial — subset, demo-only, or app must wire more |
| ❌ | Not in nqgrid today |
| 🔀 | Intentionally different architecture |

## Summary

| Area | nqdg | nqgrid |
|------|------|--------|
| **Delivery** | Single `<DataGrid>` + `styles.css` | `@nqlib/nqgrid/engine` + forked `grid-styles` |
| **Layout** | CSS Grid, `display: contents` rows | Native `<table>`, `colgroup`, sticky cells |
| **Row virtual** | `useViewportRows` (built-in) | `useTableRowVirtualizer` + TanStack rows |
| **Column virtual** | `useViewportColumns` + col-span overscan | ❌ (all visible columns rendered) |
| **Pinning UX** | `column.frozen` + `lastFrozenColumnIndex` | `pinPlaygroundCell` / `pinPlaygroundFreezeCell` |
| **Rich columns** | `advanced/columnFactory.tsx` | `@nqlib/nqgrid/advanced` + rich demos |

---

## Matrix

### Core rendering & shell

| Feature | nqdg (RDG fork) | nqgrid engine | Playground / consumer | Status | Notes |
|---------|-----------------|---------------|------------------------|--------|-------|
| All-in-one grid component | `DataGrid.tsx` (~2k LOC) | — | Demos compose TanStack + shell | 🔀 | nqgrid avoids second column/grid model |
| Tree-shakeable, no runtime deps | Yes (README) | Yes (`sideEffects: false` on pkg) | — | ✅ | |
| Shipped default theme | `lib/styles.css`, `--nqdg-*` | `@nqlib/nqgrid/tokens` (starter) | `grid-styles.ts` fork | 🔀 | New apps: fork tokens, not `styles` |
| Light / dark mode | Built into CSS vars | — | Playground table settings + nqui theme | 🔶 | Consumer owns theme switch |
| CSS Grid layout | `Row` / `Cell` `display: contents` | — | Native `<table>` | 🔀 | RDG: unified virtual grid; nqgrid: table semantics |
| Custom cell renderers | `Column.renderCell` | TanStack `columnDef.cell` | All demos | ✅ | |
| Custom header renderers | `Column.renderHeaderCell` | TanStack `header` + `SortableColumnHeader` | virtual-data, portfolio | ✅ | |
| No-rows empty state | `renderers.noRowsFallback` | — | Per-demo copy | 🔶 | Not engine-level |
| RTL | Documented feature | `a11y.ts` RTL offset hint | — | 🔶 | RDG first-class; nqgrid geometry hook only |

**RDG files:** `src/DataGrid.tsx`, `src/Row.tsx`, `src/Cell.tsx`, `src/style/core.ts`

**nqgrid:** [playground-table-recipe.md](./playground-table-recipe.md), `apps/playground/src/demos/virtual-data-demo.tsx`

---

### Virtualization & performance

| Feature | nqdg | nqgrid engine | Playground | Status | Notes |
|---------|------|---------------|------------|--------|-------|
| Row virtualization | `useViewportRows` | `useTableRowVirtualizer` | virtual-data, sheet-virtual, freeze-panes | ✅ | nqgrid uses `top` on `<tr>` — not `transform` |
| Column virtualization | `useViewportColumns` | — | — | ❌ | Learn: col-span-aware overscan (`useViewportColumns.ts`) |
| Uniform row height fast path | In `useViewportRows` | `estimateSize` constant | `NEUTRAL_TABLE_ROW_HEIGHT_PX` | ✅ | |
| Variable row heights | `rowHeight` fn + `rowHeights` map + `gridTemplateRows` | `estimateSize` + measure (limited) | — | 🔶 | RDG stronger for dynamic heights |
| Overscan | Row/col overscan indices in `DataGrid` | `overscan` on virtualizer | demos | ✅ | |
| Async / paged data | App-driven `rows` prop | `VirtualDataManager` | virtual-data-demo | ✅ | nqgrid has explicit cache + latency demo |
| Infinite scroll (append) | App pattern | `useInfiniteVisibleRows` | flights, projects | ✅ | |
| Keep focused cell in DOM when off-screen | `DataGrid` row render loop | — | — | 🔶 | RDG re-includes selected row/column outside viewport |
| Measuring cells for auto width | `renderMeasuringCells` | — | — | ❌ | |

**Learn from nqdg:** Always merge **frozen row indices** into the virtual window (`DataGrid.tsx` ~1526); same as `useTableRowSections` + `centerRows`.

---

### Freeze, pin, scroll

| Feature | nqdg | nqgrid engine | Playground | Status | Notes |
|---------|------|---------------|------------|--------|-------|
| Frozen columns | `column.frozen`, sticky CSS | `computePinnedLayout`, `getPinnedTableCellStickyStyle` | `pinPlaygroundCell` | ✅ | App applies opaque fills via playground SSOT |
| Last frozen column shadow | CSS `:nth-last-child(1 of &)` | — | `mergePinnedCellStyle` in pin helper | ✅ | |
| TanStack `columnPinning` | Internal calculated columns | `usePinnedTableColumns` / `usePlaygroundPinnedLayout` | tanstack-pinning-demo | ✅ | |
| Row-index `#` gutter pin | `ROW_NUMBER_COLUMN_KEY` | `leadingGutterColumnId` | virtual-data, portfolio | ✅ | |
| Excel freeze (top rows + cols) | `fixedRowsTop` / `fixedRowsBottom` in render | `useTableRowSections`, `getFreezePaneCellStickyStyle` | freeze-panes-virtual-demo | ✅ | |
| Row pin by id (star row) | — | `rowPinning`, `pinRowTop`, `useRowPinningTable` | freeze-panes-virtual-demo | 🔶 | TanStack 8 + band offset |
| Scroll into view (selection) | `ScrollToCell` | — | — | 🔶 | RDG built-in; nqgrid partial via viewport hooks |
| Horizontal scroll edge on shell | Grid scroll container | `useEngineScrollViewport` | all scroll tables | ✅ | |

**Docs:** [engine-freeze-panes.md](./engine-freeze-panes.md), [scroll-table-shell.md](./scroll-table-shell.md)

---

### Selection & clipboard

| Feature | nqdg | nqgrid engine | Playground | Status | Notes |
|---------|------|---------------|------------|--------|-------|
| Row selection | `selectedRows`, checkbox column | TanStack `rowSelection` + presets | task-delivery, support-queue, portfolio | ✅ | |
| Cell / range selection | `SelectionRange`, overlay | `SelectionRange`, `useGridKeyboard` | grid-keyboard-demo | ✅ | Parallel APIs in `utils/selection.ts` vs `engine/selection.ts` |
| Column selection | Mode in selection utils | `ColumnSelectionRange` type | — | 🔶 | Types exist; thinner UX |
| Select all header | `SELECT_COLUMN_KEY` | `createSelectColumn` | table-selection-demo | ✅ | |
| Copy / paste TSV | `selectionToTSV`, `tsvToSelection` | `clipboard-tsv`, matrix helpers | spreadsheet-chrome, grid-keyboard | ✅ | |
| Fill handle / drag fill | `FillEvent`, `draggedOverRange` | — | — | ❌ | High-value RDG spreadsheet UX to port |
| Selection drag intent | In `DataGrid` mouse handlers | `useSelectCellDragIntent` | grid-keyboard | 🔶 | Intent hook; not full fill |

---

### Sort, filter, group, page

| Feature | nqdg | nqgrid engine | Playground | Status | Notes |
|---------|------|---------------|------------|--------|-------|
| Column sort | `sortColumns` state | `withCoreSorting`, TanStack | virtual-data, portfolio | ✅ | |
| Multi-column sort (Ctrl+click) | Yes (README) | TanStack `enableMultiSort` | — | 🔶 | Possible via TanStack; not showcased |
| Column resize | `useColumnWidths`, drag handle | TanStack `enableColumnResizing` | portfolio, table-selection | ✅ | |
| Column reorder (drag) | `column.draggable` | — | portfolio, support-queue (Sortable) | 🔶 | nqui Sortable in playground, not engine |
| Row reorder | Drag handle on row | `row-reorder`, `useRowKeyboardReorder` | portfolio, flights, projects | 🔶 | Engine helpers + Sortable |
| Global filter | App / column filters | `createGlobalFilterFn`, `withCoreSortingFiltered` | tanstack-filter, dashboard tables | ✅ | |
| Faceted filter | — | `withCoreSortingFaceted` | — | 🔶 | Preset only |
| Pagination | App-driven slice | `withCoreSortingPaginated`, paging helpers | tanstack-pagination, task-delivery | ✅ | |
| Row grouping | `TreeDataGrid`, group rows | `group-by-tree`, TanStack grouped model | grouping-demo, tanstack-grouping | ✅ | Two paths documented |
| Column grouping (header bands) | `ColumnGroup`, `GroupedColumnHeaderRow` | `column-outline`, `flattenOutlineHeaderRows` | column-outline-demo | 🔶 | nqgrid: outline collapse; RDG: multi-row header |
| Column spanning | `colSpan` on column | `colSpanCrossesFrozenBoundary` | engine-utilities-demo | 🔶 | Freeze boundary guard; not full colspan render |
| Master / detail | `useMasterDetail` hook | `useMasterDetail` | master-detail-demo | ✅ | Both export hook |
| Summary rows (top/bottom) | `SummaryRow`, `SummaryCell` | — | — | ❌ | Common in RDG dashboards |

---

### Edit & keyboard

| Feature | nqdg | nqgrid engine | Playground | Status | Notes |
|---------|------|---------------|------------|--------|-------|
| Inline cell edit | `renderEditCell`, `EditCell` | — | rich-inline-tasks (custom) | 🔶 | TanStack + app editors |
| Commit on outside click | `editorOptions` | — | — | 🔶 | RDG built-in policy |
| Keyboard navigation | Large `DataGrid` keydown | `useGridKeyboard`, `useCellKeyboardTable` | grid-keyboard, keyboard-cell | ✅ | |
| Roving tabindex in cell | `useRovingTabIndex` | — | — | ❌ | Worth porting for a11y inside editors |
| Shortcut SSOT | `GRID_SHORTCUTS` (partial stubs) | Scattered in hooks | — | 🔶 | RDG pattern: one table |

---

### Rich columns & formatting

| Feature | nqdg | nqgrid | Playground | Status | Notes |
|---------|------|--------|------------|--------|-------|
| Column type factory | `advanced/columnFactory.tsx` | `advanced/build-rich-column.tsx` | rich-inline-tasks, rich-number-formats | ✅ | Compare schemas |
| Text / number / currency / date | Yes | `RichNumberCell`, formatters | rich-number-formats-demo | ✅ | |
| Status pills | Yes | `RichStatusCell` | rich-inline-tasks | ✅ | |
| Tags | `TagCellWithAdd` | `TagRichColumn` | — | 🔶 | |
| People / avatars | `PeopleCell`, picker modal | `PeopleRichColumn`, reconcile | playground people combobox | ✅ | |
| Progress / percent battery | Slider in factory | `table-percent-battery` component | projects-table | 🔶 | |
| Formula presentation | — | `RichFormulaPresentationCell` | — | 🔶 | nqgrid-only lean |
| Filter by value panel | `FilterByValuePanel` | — | — | ❌ | RDG advanced UI |

---

### Spreadsheet product chrome

| Feature | nqdg | nqgrid | Playground | Status | Notes |
|---------|------|--------|------------|--------|-------|
| Menu bar / commands | `spreadsheet/` (`MenuBar`, commands) | `spreadsheet/use-spreadsheet-commands` | spreadsheet-chrome-demo | 🔶 | Headless commands; no full menu UI in engine |
| Formula bar | `FormulaBar.tsx` | — | — | ❌ | |
| Format toolbar | `FormatToolbar.tsx` | `useCellFormats` | spreadsheet-chrome (toggle bold) | 🔶 | |
| Export CSV/PDF hooks | — | command ids in spreadsheet | spreadsheet-chrome | 🔶 | |

---

### DnD, menus, parity extras

| Feature | nqdg | nqgrid engine | Playground | Status | Notes |
|---------|------|---------------|------------|--------|-------|
| Column header menu | `columnMenuUtils`, `ColumnMenuDropdown` | — | — | ❌ | Pin/sort/hide menu |
| Context menu on cell | `ContextMenu` component | — | — | ❌ | |
| Sortable drop indicator | — | `useSortableDropIndicator` | portfolio, flights | 🔶 | Engine geometry for nqui Sortable |
| Tree grid | `TreeDataGrid.tsx` | `group-by-tree` (flat) | — | 🔶 | Different model |

---

## Playground demo index (nqgrid)

| Demo | Covers |
|------|--------|
| `virtual-data-demo.tsx` | Async rows, row virtualizer, gutter, pin cols — **SSOT look** |
| `engine-lab-demo.tsx` | Ribbon toggles on Virtual Data canvas |
| `freeze-panes-virtual-demo.tsx` | Excel freeze + virtual center band |
| `column-outline-demo.tsx` | Column outline collapse |
| `grouping-demo.tsx` / `tanstack-grouping-table-demo.tsx` | Row grouping |
| `grid-keyboard-demo.tsx` | Range selection + keyboard |
| `table-selection-demo.tsx` | Full select column + DnD parity |
| `pipeline-reference-demo.tsx` | Wide pinned pipeline |
| `sheet-virtual-demo.tsx` | 4k×80 sheet |
| `portfolio-table.tsx` / `flights-table.tsx` | Dashboard + resize + reorder |
| `task-delivery-table.tsx` / `support-queue-table.tsx` | Bulk select dashboards |
| `rich-inline-tasks-demo.tsx` / `rich-number-formats-demo.tsx` | Advanced columns |
| `spreadsheet-chrome-demo.tsx` | Commands + formats |
| `tanstack-pinning-demo.tsx` | `columnPinning` API |

---

## Recommended port order (gaps → engine/playground)

Priority if nqgrid should close spreadsheet parity with nqdg:

1. **Fill handle / drag-fill** — RDG `FillEvent`; nqgrid has range selection but no fill extension.
2. **Column virtualization** — optional for `sheet-virtual` scale; study `useViewportColumns` + col-span expansion.
3. **Summary rows** — footer aggregates; needs TanStack footer model + engine row bands.
4. **Roving tabindex** — `useRovingTabIndex` for editable cells with keyboard nav.
5. **Scroll-to-cell** — selection-driven scroll into view (RDG `ScrollToCell`).
6. **Variable row height virtualizer** — RDG `useViewportRows` variable path vs fixed `estimateSize`.
7. **Column header menu / context menu** — product chrome; keep out of engine or ship as optional `@nqlib/nqgrid` module.

---

## What not to port (stay engine-only)

- Monolithic `DataGrid` replacing TanStack column definitions
- CSS Grid `display: contents` row model (conflicts with table sticky + virtual `top` strategy)
- Bundled `styles.css` as the primary consumer API
- Duplicating RDG `Column` / `ColumnGroup` types alongside TanStack

---

## Cross-links

- [engine-tanstack-matrix.md](./engine-tanstack-matrix.md)
- [engine-freeze-panes.md](./engine-freeze-panes.md)
- [playground-table-recipe.md](./playground-table-recipe.md)
- nqdg source highlights: `src/hooks/useViewportRows.ts`, `src/hooks/useViewportColumns.ts`, `src/utils/selection.ts`, `src/style/cell.ts`
