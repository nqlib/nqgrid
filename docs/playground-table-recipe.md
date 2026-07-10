# Playground table recipe (Virtual Data lab UI)

Copy this stack into consumer apps. The **engine** ships on npm; the **look + shell** live in the playground and are meant to be forked.

## Layer separation

| Layer | Location | npm import |
|-------|----------|------------|
| Behavior | `src/engine/` | `@nqlib/nqgrid/engine` |
| Token starters | `src/tokens/` | `@nqlib/nqgrid/tokens` |
| Reference UI | `apps/playground/src/lib/`, `parity/` | Copy files (not published) |
| Golden demo | `apps/playground/src/demos/virtual-data-demo.tsx` | Copy pattern |

## Files to copy (minimum Virtual Data lab)

1. `apps/playground/src/lib/playground-table-tokens.ts` — fork tokens from `@nqlib/nqgrid/tokens`
2. `apps/playground/src/lib/grid-styles.ts` — class strings for `<table>`
3. `apps/playground/src/lib/playground-neutral-table.tsx` — row fills + `useNeutralPlaygroundTable`
4. `apps/playground/src/lib/playground-row-index-gutter.ts` — **single pinning recipe**
5. `apps/playground/src/lib/playground-data-table-shell.tsx` + `nqui-table-shell.ts` — ScrollArea card shell
6. `apps/playground/src/parity/engine-scroll-table-shell.tsx` + `use-engine-scroll-viewport.ts`

Optional by feature: `playground-canonical-select-column.tsx`, `sortable-column-header.tsx`, `playground-canonical-header-cell.tsx`.

## Pinning (one recipe)

**Never** call `getPinnedTableCellStickyStyle` or `mergePinnedCellStyle` in app/demo table JSX.

```tsx
import {
  pinPlaygroundCell,
  pinPlaygroundFreezeCell, // Excel freeze panes only
  usePlaygroundPinnedLayout,
} from "./lib/playground-row-index-gutter";

const pinnedLayout = usePlaygroundPinnedLayout({
  table,
  dataPinnedLeftIds: ["id", "name"],
  selectColumnMode: "index", // auto-pins row-index gutter when applicable
});

// Header
const pin = pinPlaygroundCell({ pinnedLayout, columnId: id, variant: "head", scrolledX });
<th className={cn(gridHeadCellClass, pin.className, !pin.style && "bg-card")} style={pin.style} />

// Body (match zebra on pinned data cells)
const pin = pinPlaygroundCell({
  pinnedLayout,
  columnId: id,
  variant: "body",
  scrolledX,
  rowFillTokens: tokens,
  rowIndex: row.index,
});
<td className={cn(gridCellClass, pin.className)} style={pin.style} />
```

TanStack `columnPinning` state: `usePlaygroundPinnedLayout({ table, fromColumnPinning: true })`.

Excel freeze (row + column): `pinPlaygroundFreezeCell({ columnLayout, rowLayout, columnId, rowId, variant, headerOffsetPx, scrolledX, rowFillTokens, rowIndex })`.

SSOT demos: `virtual-data-demo.tsx` (column + gutter), `pipeline-reference-demo.tsx` (data columns), `freeze-panes-virtual-demo.tsx` (freeze).

## Skills

- `.cursor/skills/nqgrid-playground-starter/SKILL.md` — full table build
- `.cursor/skills/nqgrid-scroll-table-shell/SKILL.md` — scroll + opaque sticky
- `.cursor/skills/consumer-table-design/SKILL.md` — pinning on top of virtual-data look

## Imports to avoid in new products

- `@nqlib/nqgrid/styles` (deprecated)
- nqui `Table` / `DataTable` for spreadsheet grids (use native `<table>` + `grid-styles`)
- Direct engine pin helpers in JSX (use `playground-row-index-gutter.ts` instead)
