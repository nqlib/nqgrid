---
name: nqgrid-table-design
description: >-
  Design rules for @nqlib/nqgrid table shells, scroll layout, typography tokens,
  nested panels, and TanStack + @nqlib/nqui composition. Use when building or
  refactoring data tables in this repo, when importing tableShellClass or
  related exports from @nqlib/nqgrid, or when matching nqgrid playground demos
  (portfolio, projects, flights).
---

# nqgrid table design system

Authoritative token strings live in `src/styles/index.ts` (published as `@nqlib/nqgrid` / `@nqlib/nqgrid/styles`). For a **typed config + import planner**, use `@nqlib/nqgrid/configurator` (`docs/configurator.md`). Demos in `apps/playground/src/demos/` are the reference implementations.

## Composition stack (order matters)

1. **Shell** — `tableShellClass` on the outer card: flex column, `min-h` / `max-h` caps, `rounded-2xl`, border, `bg-card`. Gives ScrollArea a finite block height.
2. **Scroll** — `ScrollArea` from `@nqlib/nqui` with:
   - `className={tableScrollAreaRootClass}` (`h-0 min-h-0 flex-1 …`) so flex children do not blow through `min-height: auto`.
   - `viewportStyle={tableScrollViewportStyle}` so the viewport binds height in deep flex layouts (absolute inset + `minHeight: 0`).
   - `fadeMask={false}` in playground unless product needs fades.
3. **Content pad** — inner wrapper `tableScrollAreaContentClass` (`px-4 pt-0`) around the `<table>`.
4. **Table element** — `<table className={tableDenseTypography}>` for shared thead/tbody typography (sizes, weights, `border-separate border-spacing-0`).
5. **Sections** — `TableHeader` + `tableHeaderClass`; `TableBody` + `tableBodyClass`; rows `tableRowClass`; cells `tableHeadClass` / `tableCellClass` as appropriate.
6. **Footer** — `tableFooterClass` as a sibling **below** ScrollArea (not inside the scroll viewport).

Do not drop `tableScrollAreaRootClass` or `tableScrollViewportStyle` when copying demos; scroll and sticky headers break without them.

## Numeric columns

- Header: `header: () => <span className="w-full text-right">…</span>` and `TableHead` with `text-right` where needed.
- Cell: wrap in `text-right` + `tableNumericStrongClass` (primary), `tableNumericMutedClass` (secondary), or `tableNumericClass` with semantic color (e.g. P&L).

## Row hover and selection

`tableBodyClass` applies `[&_tr:hover_td]:bg-accent` and selected row accent on **every** body row in that `tbody`.

**Detail / expanded rows** that span a single `colSpan` cell still receive `tr:hover td` rules. Override on that row, for example:

`"[&>td]:bg-card/40 hover:[&>td]:!bg-card/40"` on the detail `TableRow` so padding and empty areas do not flash accent.

**Nested mini-tables** inside a panel should **not** reuse `tableBodyClass` if full-row hover on wide cells is undesirable. Use a slimmer class that keeps borders and opaque `bg-muted` on cells but **omits** `[&_tr:hover_td]:bg-accent` (see `subtasksMiniTableBodyClass` in `projects-table.tsx`).

## Nested panels

- Wrapper: `tableNestedPanelClass` (`rounded-xl border … bg-card/55`).
- Header block: `tableNestedHeaderClass` on nested `TableHeader`.
- **Radius clipping:** add `overflow-hidden` on the panel wrapper so nested `thead` / `th` corners follow the card radius (avoids square “Done” corners poking past `rounded-xl`).

## Ops / flights shell

Merge `cn(tableShellClass, flightsTableShellExtraClass)` when a taller cap and higher `max-h` are required; do not fork shell strings ad hoc.

## UI primitives

Use `@nqlib/nqui` for controls (Button, Checkbox, ScrollArea, Tabs, ToggleGroup, etc.). For app-wide theme, follow playground `ThemeProvider` + `ToggleGroup` pattern.

## When editing tokens

If you change class strings in `src/styles/index.ts`, run `pnpm run build` so `dist/` and `.d.ts` stay aligned for consumers.

## More detail

- Token checklist and anti-patterns: [reference.md](reference.md)
- **Playground-style app composition** (TanStack + nqui + rich columns + inline edit): [../nqgrid-playground-starter/SKILL.md](../nqgrid-playground-starter/SKILL.md)
