# nqgrid table design — reference

## Token map (import from `@nqlib/nqgrid`)

| Export | Role |
|--------|------|
| `tableShellClass` | Card shell; flex column; viewport-bounded height |
| `flightsTableShellExtraClass` | Optional taller `min-h` / `max-h` merge for ops desks |
| `tableScrollAreaRootClass` | ScrollArea root flex shrink contract |
| `tableScrollViewportStyle` | Object: absolute viewport pin + `overscrollBehavior: contain` |
| `tableScrollAreaContentClass` | Horizontal padding wrapper around table |
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

- [ ] Root: `tableShellClass` (plus `flightsTableShellExtraClass` only if spec says ops height).
- [ ] `ScrollArea` + `tableScrollAreaRootClass` + `tableScrollViewportStyle`.
- [ ] Inner div: `tableScrollAreaContentClass`.
- [ ] `<table className={tableDenseTypography}>`.
- [ ] `TableBody` uses `tableBodyClass` **unless** nested mini-table needs no row-hover (custom body class).
- [ ] Expanded/detail rows: hover override if single wide `td`.
- [ ] Nested `tableNestedPanelClass` panels: `overflow-hidden` for radius.
- [ ] Footer outside ScrollArea: `tableFooterClass`.

## Anti-patterns

- Putting `tableFooterClass` inside the scroll viewport (footer scrolls away).
- Omitting `tableScrollViewportStyle` then debugging “random” scroll height bugs.
- Nesting a second `<table>` with `tableBodyClass` when hover should not fill empty cell padding—strip hover rules for that inner `tbody`.
- Duplicating shell `min-h` / `max-h` strings instead of merging `flightsTableShellExtraClass`.

## File pointers

- Tokens: `src/styles/index.ts`
- Infinite scroll hook: `src/` exports `useInfiniteVisibleRows` (see flights / projects demos)
- Reference UIs: `apps/playground/src/demos/*.tsx`
