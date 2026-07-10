# TanStack Table vs nqgrid engine

## Ownership

| Concern | Owner |
|---------|--------|
| Row/column state, sort, filter, group, page, select, expand, pin state | **TanStack Table** via row models + controlled state |
| Sticky pin geometry (`left`, `width`, `zIndex`, `top`) | **nqgrid engine** (`computePinnedLayout`, `computeFrozenTopLayout`, `getFreezePaneCellStickyStyle`) |
| Excel freeze panes + row bands | **nqgrid engine** (`useTableRowSections`, `useFrozenTopRows`) — see [engine-freeze-panes.md](./engine-freeze-panes.md) |
| Row pin by id (`rowPinning`) | **TanStack Table** + **nqgrid** section split / virtualizer `bandOffsetPx` |
| Column/row outline collapse | **nqgrid engine** (`column-outline`, `row-outline`) + TanStack visibility / grouping |
| Spreadsheet keyboard, cell ranges, clipboard | **nqgrid engine** |
| Async page cache (server matrices) | **nqgrid engine** (`VirtualDataManager`) |
| Table/grid DOM (`GridTable`, rows, cells) | **nqgrid grid** (`@nqlib/nqgrid/grid`) — not nqui `Table` / `DataTable` |
| Visual tokens (colors, borders) | **Consumer app** (`grid-styles.ts` in playground; not `@nqlib/nqgrid/styles` for new work) |
| nqui primitives (ScrollArea, Button, Input, …) | **@nqlib/nqui** only — see [composition-architecture.md](./composition-architecture.md) |

## Row model presets (`@nqlib/nqgrid/engine`)

| Preset | Row models |
|--------|------------|
| `withCoreRowModel` | core |
| `withCoreSorting` | core + sorted |
| `withCoreSortingRowSelection` | core + sorted + selection defaults |
| `withCoreSortingExpanded` | core + sorted + expanded |
| `withCoreSortingFiltered` | core + filtered + sorted |
| `withCoreSortingPaginated` | core + sorted + pagination |
| `withCoreSortingGroupedExpanded` | core + grouped + sorted + expanded |
| `withCoreSortingFaceted` | core + filtered + sorted + faceted |
| `withCoreDataTable` | filter → group → sort → expand → page + selection |
| `withFreezePanesSupport` | core + sorted + column/row pinning defaults |

Discovery list: `TANSTACK_ROW_MODEL_PRESETS`.

Helpers: `createGlobalFilterFn`, `usePinnedTableColumns` / `useFrozenTableColumns`, `useTableRowSections`, `useTableRowVirtualizer` with `rows: centerRows` + `bandOffsetPx` (peer: `@tanstack/react-virtual`).

## Playground shells

| Shell | Skill | Use when |
|-------|-------|----------|
| ScrollArea + nqui tokens | `nqgrid-table-design` | Portfolio, projects, flights ops card |
| Spreadsheet `grid-styles.ts` | `consumer-table-design` | Pipeline reference, pinning, TanStack labs |

## Grouping

| Approach | When |
|----------|------|
| TanStack `getGroupedRowModel` | Standard tables with `grouping` state |
| `buildGroupedFlatRows` | Legacy nqdg flat group rows before `useReactTable` |

## Freeze panes + virtualization

When prefix-frozen rows or TanStack row pinning is active, virtualize **`sections.centerRows` only** and pass `bandOffsetPx: sections.topBandHeightPx`. See [engine-freeze-panes.md](./engine-freeze-panes.md).

## Virtualization

| Approach | When |
|----------|------|
| `useTableRowVirtualizer` | Windowed DOM for large row counts (TanStack Virtual); with freeze, pass `rows` + `bandOffsetPx` |
| `useInfiniteVisibleRows` | Append rows on sentinel intersection |
| `VirtualDataManager` | Async fetch/cache by offset (sheet-style data) |
