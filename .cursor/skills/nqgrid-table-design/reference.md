# nqgrid table design — reference

## Token map

**Preferred:** `@nqlib/nqgrid/tokens` — `buildTableClasses(nquiCardTablePreset())` → `TableClassBundle`.

**Deprecated back-compat:** `@nqlib/nqgrid/styles` flat exports (re-composed from card preset).

| Export | Role |
|--------|------|
| `buildTableClasses` / `nquiCardTablePreset` | Typed token engine (preferred) |
| `tableShellClass` | Card shell; flex column; viewport-bounded height |
| `flightsTableShellExtraClass` | Optional taller `min-h` / `max-h` merge for ops desks |
| `tableScrollAreaRootClass` | ScrollArea root flex shrink contract |
| `tableScrollViewportStyle` | Object: absolute viewport pin + `overscrollBehavior: contain` |
| `tableScrollAreaEdgeClass` | Edge-to-edge wrapper (default for scroll tables) |
| `tableScrollAreaContentClass` | Legacy `px-4` pad — avoid inside scroll data tables |
| `tableDenseTypography` | Apply on `<table>` |
| `tableHeaderClass` | Sticky thead chrome |
| `tableHeadClass` | Header cell padding, uppercase rhythm |
| `tableBodyClass` | Body cell borders, corners, **row hover**, selection |
| `tableRowClass` | Row border/transition baseline |
| `tableCellClass` | Default body cell padding |
| `tableNumericClass` / `tableNumericMutedClass` / `tableNumericStrongClass` | Numbers + alignment helpers |
| `tableFooterClass` | Footer strip below scroll |
| `tableNestedPanelClass` | Bordered inset panel for nested tables or threads |
| `tableNestedHeaderClass` | Nested thead row borders |

## Checklist for a new table screen

**Default (spreadsheet):** use [nqgrid-playground-starter/reference.md](../nqgrid-playground-starter/reference.md) instead of this card-table list.

**Card-table only (portfolio / flights / projects):**

- [ ] Root: `tableShellClass` (plus `flightsTableShellExtraClass` only if spec says ops height).
- [ ] `ScrollArea` + `tableScrollAreaRootClass` + `tableScrollViewportStyle`.
- [ ] Inner div: `tableScrollAreaEdgeClass` (not `px-4` pad).
- [ ] Sticky header: `tableHeaderClass` + `bg-card` on each `th`.
- [ ] Pinned cells: engine style + opaque `bg-card`.
- [ ] `<table className={tableDenseTypography}>`.
- [ ] `TableBody` uses `tableBodyClass` **unless** nested mini-table needs no row-hover (custom body class).
- [ ] Expanded/detail rows: hover override if single wide `td`.
- [ ] Nested `tableNestedPanelClass` panels: `overflow-hidden` for radius.
- [ ] Footer outside ScrollArea: `tableFooterClass`.

## Anti-patterns

- Putting `tableFooterClass` inside the scroll viewport (footer scrolls away).
- Omitting `tableScrollViewportStyle` then debugging “random” scroll height bugs.
- Using `px-4` inside ScrollArea (card/table gap).
- Sticky thead without opaque `bg-card` on every header cell (body bleeds through).
- Pinned cells without solid background (horizontal bleed).
- Nesting a second `<table>` with `tableBodyClass` when hover should not fill empty cell padding—strip hover rules for that inner `tbody`.
- Duplicating shell `min-h` / `max-h` strings instead of merging `flightsTableShellExtraClass`.

## File pointers

- Tokens: `src/tokens/` (ship `@nqlib/nqgrid/tokens`)
- Playground config: `apps/playground/src/lib/playground-table-tokens.ts`
- Deprecated flat re-exports: `src/styles/index.ts`
- Infinite scroll hook: `src/` exports `useInfiniteVisibleRows` (see flights / projects demos)
- Reference UIs: `apps/playground/src/demos/*.tsx`
