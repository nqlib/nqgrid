# Engine freeze panes, row pinning, and outlines

Excel-style **freeze** (prefix rows + columns), TanStack **row pin by id**, and **column/row outline** helpers live in `@nqlib/nqgrid/engine`. Geometry only — consumers supply opaque fills and chrome.

## Freeze vs pin

| Feature | Model | Engine API |
|---------|--------|------------|
| Freeze columns | Prefix of visible leaf columns | `useFrozenTableColumns` / `usePinnedTableColumns`, `getFreezePaneCellStickyStyle` |
| Freeze rows | Prefix of body row ids | `useFrozenTopRows`, `computeFrozenTopLayout` |
| Pin row by id | TanStack `rowPinning` | `useTableRowSections`, `pinRowTop` / `pinRowBottom` |
| Excel cell B3 | 2 rows + 1 column frozen | `freezePanesFromExcelCell(3, 2)` |

**Do not** render `table.getRowModel().rows` alone when row pinning or prefix freeze is active. Use `useTableRowSections()` bands.

## Render bands (virtualizer)

```tsx
const sections = useTableRowSections({ table, freezePanes, rowHeightPx: 26 });
const columnLayout = useFrozenTableColumns({ table, freezePanes, fromColumnPinning: true });

const { virtualRows, totalSize, totalSizeWithBandOffset } = useTableRowVirtualizer({
  table,
  scrollElement,
  rows: sections.centerRows,
  bandOffsetPx: sections.topBandHeightPx,
  estimateSize: 26,
});

// tbody height ≈ totalSizeWithBandOffset + bottomPinnedHeight
// 1. frozenTopRows + topPinnedRows → sticky <tr>
// 2. virtualRows → getVirtualTableRowStyle(vr.start, width, { bandOffsetPx })
// 3. bottomPinnedRows → getBottomPinnedRowStyle(frozenTop + totalSize + i * rowH, rowH)
```

Rules:

- Never `transform: translateY` on rows when freeze/pin is on — use `top` ([`getVirtualTableRowStyle`](../src/engine/virtual-table-row-styles.ts)).
- Bottom-pinned rows sit **after** the full center virtual height.

Reference: [`freeze-panes-virtual-demo.tsx`](../apps/playground/src/demos/freeze-panes-virtual-demo.tsx).

## TanStack preset

```ts
useReactTable(withFreezePanesSupport({ data, columns, state: { columnPinning, rowPinning } }));
```

Enables `enableRowPinning`, `enableColumnPinning`, `keepPinnedRows`.

## Row outline (grouping)

TanStack owns `grouping` + `expanded`. Engine adds indent geometry:

- `getOutlineRowIndentStyle(depth)` → `paddingInlineStart`
- `getOutlineRowMeta(row)`
- `useOutlineRowExpansion` for expand/collapse all / by level

## Column outline

```ts
const groups = buildColumnOutlineGroups(tree);
const visibility = columnOutlineToVisibility(allLeafIds, groups, collapsedIds);
// or applyColumnOutlineVisibility(table, groups, collapsedIds) in an effect
const headerRows = flattenOutlineHeaderRows(tree, collapsedIds);
```

Reference: [`column-outline-demo.tsx`](../apps/playground/src/demos/column-outline-demo.tsx).

## Keyboard

```ts
isRowNavigableForFreeze(rowIndex, sections) // skip frozen / pinned bands
```

## Related

- [scroll-table-shell.md](./scroll-table-shell.md) — sticky header + pinned column fills
- [engine-tanstack-matrix.md](./engine-tanstack-matrix.md) — feature ownership table
