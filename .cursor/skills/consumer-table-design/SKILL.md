---
name: consumer-table-design
description: >-
  Spreadsheet grid styling and pinning for nqgrid playground. Default table builds
  use nqgrid-playground-starter (virtual-data look + table-selection interactions).
  Use this skill for pinned-column geometry, grid-styles tokens, and pipeline/BECO labs.
---

# Playground spreadsheet table design (BECO-aligned)

**Default:** follow **[nqgrid-playground-starter](../nqgrid-playground-starter/SKILL.md)** first.

Use **this skill** when you add **pinned left columns** on top of the virtual-data look.

## The contract

| Concern | Owned by | Source |
|---------|----------|--------|
| Look (colors, borders, density) | **playground** | `playground-table-tokens.ts` → `grid-styles.ts` |
| Sorting / selection / resize / order | TanStack + nqgrid | `withCoreSorting*`, `withCoreSortingRowSelection` |
| Pinned column geometry + opaque fills | **playground SSOT** | `playground-row-index-gutter.ts` only |
| Engine math (internal) | nqgrid | `getPinnedTableCellStickyStyle` — never in demo JSX |

**Never import `@nqlib/nqgrid/styles`** in playground consumer tables — see [engine-only](../../.claude/skills/engine-only/SKILL.md).

## Pinning — single recipe (no dual paths)

Copy [`playground-row-index-gutter.ts`](../../apps/playground/src/lib/playground-row-index-gutter.ts) into your app, or keep it in the monorepo playground.

| API | When |
|-----|------|
| `usePlaygroundPinnedLayout({ table, dataPinnedLeftIds, selectColumnMode? })` | Column prefix pin + optional row-index gutter |
| `usePlaygroundPinnedLayout({ table, fromColumnPinning: true })` | TanStack `columnPinning.left` drives pins |
| `pinPlaygroundCell({ pinnedLayout, columnId, variant, scrolledX, rowIndexGutter?, rowFillTokens?, rowIndex? })` | Every pinned `th` / `td` |
| `pinPlaygroundFreezeCell({ columnLayout, rowLayout?, …, scrolledX, rowFillTokens?, rowIndex? })` | Excel freeze panes demo only |

**Do not** call `getPinnedTableCellStickyStyle`, `mergePinnedCellStyle`, or `computePinnedLayout` in demos — those are encapsulated in the helpers above.

SSOT demos:

- [`virtual-data-demo.tsx`](../../apps/playground/src/demos/virtual-data-demo.tsx) — gutter + data columns
- [`pipeline-reference-demo.tsx`](../../apps/playground/src/demos/pipeline-reference-demo.tsx) — wide pipeline, data columns only
- [`freeze-panes-virtual-demo.tsx`](../../apps/playground/src/demos/freeze-panes-virtual-demo.tsx) — `pinPlaygroundFreezeCell`

**Terminology:** unqualified **column** = **data column** (not the row-index `#` gutter). List only data ids in `dataPinnedLeftIds`.

## Four geometry rules

1. `table-fixed` + `<colgroup>` + `style={{ width: table.getTotalSize() }}` (or full-width dashboard pattern — see nqgrid-table-full-width)
2. Pinned cells only via `pinPlaygroundCell` / `pinPlaygroundFreezeCell`
3. Opaque fills come from pin helpers (`gridSticky*`, `gridRowHeaderPinned*`, `buildPinnedBodyCellFill` for striped body)
4. `useEngineScrollViewport(true)` for `scrolledX` edge shadow on last pinned column
5. **Virtual rows + pins** — `getVirtualTableRowStyle(vr.start)` on `<tr>`; never `transform: translateY`

## Token reference

`nquiSpreadsheetPreset()` + `buildTableClasses()` from `@nqlib/nqgrid/tokens`, or `grid-styles.ts` exports. See [docs/table-design-tokens.md](../../docs/table-design-tokens.md) and [docs/playground-table-recipe.md](../../docs/playground-table-recipe.md).

## Don't

- Don't call engine pin helpers directly in table JSX.
- Don't use `VirtualSheet` or div-grid for new app tables.
- Don't use translucent backgrounds on sticky cells.
- Don't use `transform: translateY` on virtualized `<tr>` when pinning.
