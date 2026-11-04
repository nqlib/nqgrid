---
name: nqgrid-table-design
description: >-
  Design rules for @nqlib/nqgrid table shells, scroll layout, typography tokens,
  and TanStack + @nqlib/nqui composition. Default new tables follow the canonical
  virtual-data look + table-selection interactions — see nqgrid-playground-starter.
  Use for tokens, scroll/pin fixes, or legacy dashboard card tables (portfolio/flights).
---

# nqgrid table design system

**Building a new table?** Start with **[nqgrid-playground-starter](../nqgrid-playground-starter/SKILL.md)** — it defines the single canonical recipe (virtual-data visual SSOT + table-selection drag/checkbox SSOT). For tables that must fill the card width, also read **[nqgrid-table-full-width](../nqgrid-table-full-width/SKILL.md)**.

Authoritative **typed** tokens: `@nqlib/nqgrid/tokens` ([docs/table-design-tokens.md](../../docs/table-design-tokens.md)). Playground config: [`playground-table-tokens.ts`](../../apps/playground/src/lib/playground-table-tokens.ts). Deprecated flat strings in `src/styles/index.ts` are back-compat only.

## Default vs legacy shells

| Pattern | When | SSOT |
|---------|------|------|
| **Canonical spreadsheet** (default) | Any new data grid, ops desk, virtualized or selectable table | [nqgrid-playground-starter](../nqgrid-playground-starter/SKILL.md) — `virtual-data-demo.tsx` + `table-selection-demo.tsx`, `grid-styles.ts`, `EngineScrollTableShell` |
| **Dashboard card + nqui Table** | Portfolio, projects, flights, rich inline tasks only when spec says “card table” | This doc + [nqgrid-scroll-table-shell](../nqgrid-scroll-table-shell/SKILL.md) + `PlaygroundDataTableShell` |
| **Pinned BECO parity lab** | Frozen left columns, wide pipeline mock | [consumer-table-design](../consumer-table-design/SKILL.md) — `pipeline-reference-demo.tsx` |

Do not default new work to nqui `Table` + `tableDenseTypography` unless the task names a dashboard demo explicitly.

## Canonical visual tokens (virtual-data)

Import from `apps/playground/src/lib/grid-styles.ts` (composed from `nquiSpreadsheetPreset()`):

| Class | Role |
|-------|------|
| `gridTableClass` | `table-fixed`, dense typography |
| `gridHeaderClass` | Sticky thead |
| `gridHeadCellClass` | Opaque header cells |
| `gridBodyHoverClass` | Body hover + selection fills |
| `gridRowClass` | Row transition |
| `gridCellClass` | Body cell padding |
| `gridNumericClass` | Right-aligned numbers |
| `gridStickyHeadFillClass` / `gridStickyCellFillClass` | Pinned **data column** opaque fills |
| `gridRowHeaderPinnedHeadFillClass` / `gridRowHeaderPinnedBodyFillClass` | Pinned **row-index gutter** opaque fills (`rowHeader.pinned*Fill`) |
| `gridRowHeaderHeadClass` / `gridRowHeaderCellClass` | Unpinned gutter only — translucent OK |

Row stripe: `neutralTanStackRowFillClass(tokens, rowIndex)` from `playground-neutral-table.tsx`. Row height for virtualizer: `NEUTRAL_TABLE_ROW_HEIGHT_PX` (28).

## Scroll composition (mandatory for scroll tables)

Read [docs/scroll-table-shell.md](../../docs/scroll-table-shell.md) and [nqgrid-scroll-table-shell](../nqgrid-scroll-table-shell/SKILL.md).

1. **Shell** — `EngineScrollTableShell` or `PlaygroundDataTableShell` (Card + ScrollArea + `tableScrollViewportStyle`).
2. **Edge-to-edge** — `tableScrollAreaEdgeClass`; no `px-4` inside scroll viewport.
3. **Footer** — below ScrollArea, not inside viewport.
4. **Pins** — engine geometry + opaque fills (`gridSticky*` for data columns; `gridRowHeaderPinned*` for sticky `#` gutter).
5. **Virtual rows + pins** — `getVirtualTableRowStyle(startPx)` on `<tr>`; never `transform: translateY` when pinning.

## Card-table stack (legacy dashboard only)

1. `tableShellClass` + ScrollArea + `tableScrollAreaEdgeClass`
2. nqui `Table` + `tableHeaderClass` + `bg-card` on every `th`
3. `tableBodyClass` / configurator zebra via `usePlaygroundTableBodyClass`

## Numeric columns

- Header: `() => <span className="w-full text-right">…</span>` (spreadsheet: `gridNumericClass` in cell).
- Card tables: `tableNumericStrongClass` / `tableNumericMutedClass`.

## Row hover and selection

- Spreadsheet: `gridBodyHoverClass` + `data-state="selected"` on `<tr>` (table-selection-demo).
- Card `tableBodyClass`: full-row hover; override on expanded detail rows (`[&>td]:bg-card/40 hover:[&>td]:!bg-card/40`).
- Nested mini-tables: do not reuse full `tableBodyClass` hover (see `projects-table.tsx` `subtasksMiniTableBodyClass`).

## Nested panels

`tableNestedPanelClass` + `overflow-hidden` on wrapper; `tableNestedHeaderClass` on nested thead.

## UI primitives

`@nqlib/nqui` for Checkbox, Button, ScrollArea, Sortable (`@nqlib/nqui/sortable`). Theme: playground `ThemeProvider` + `ToggleGroup`.

## When editing tokens

Edit `src/tokens/` or `playground-table-tokens.ts`; run `pnpm run build`. Do not add new flat strings to `src/styles/index.ts`.

When adding row-index gutter or pinned column surfaces:
- Add **separate opaque** `rowHeader.pinnedHeadFill` / `pinnedBodyFill` (or `pinned.headFill` / `bodyFill`) — never reuse translucent `bg-muted/…` on sticky cells.
- Export composed classes via `buildTableClasses` → `grid-styles.ts`.

## More detail

- Token checklist: [reference.md](reference.md)
- Canonical build steps: [../nqgrid-playground-starter/reference.md](../nqgrid-playground-starter/reference.md)
