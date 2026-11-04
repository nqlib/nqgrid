---
name: engine-only
description: >
  How to build with @nqlib/nqgrid — a headless table/grid ENGINE that ships
  logic and geometry only, while the consuming app owns all style tokens.
  Load when adding or reviewing nqgrid exports, composing pinned columns,
  styling pinned/sticky cells, wiring selection/keyboard/reorder, or theming a
  grid. Teaches the engine-vs-consumer boundary and the failure modes that look
  correct but break (transparent sticky cells, pinned-prefix violations,
  pointer-capture vs dnd-kit).
metadata:
  version: '0.1'
  category: core
---

# nqgrid: Engine-Only

`@nqlib/nqgrid` replaces nqui's table/grid components, not nqui itself. It ships
**logic + geometry**; the consuming app owns **style** (colors, borders,
density, radius). Never decide a color, border, font-size, or radius inside the
engine — return numbers, `CSSProperties` for layout only, state, and hooks.

## The boundary

| Concern | Lives in | Owner |
|---|---|---|
| Sorting / paging / selection / grouping / clipboard / virtualization / reorder | `@nqlib/nqgrid/engine` | nqgrid |
| Pinned layout + cell sticky geometry | `@nqlib/nqgrid/engine` | nqgrid |
| Semantic table/grid DOM | `@nqlib/nqgrid/grid` | nqgrid |
| `ScrollArea`, `Button`, `Input`, overlays (primitives only) | `@nqlib/nqui` | nqui |
| Color / spacing / border / radius class tokens | app (fork `@nqlib/nqgrid/tokens`) | consumer |

Do **not** use nqui `Table`, `TableRow`, `TableCell`, or `DataTable` in
nqgrid-based products. `@nqlib/nqgrid/styles` is **deprecated** — new visual
tokens go in `@nqlib/nqgrid/tokens` (typed starter the consumer forks) or the
app's own copy. Geometry styles (`position/left/width/zIndex/top`) are fine to
ship; if a designer would tweak it, it's the consumer's.

Test when adding an export: *"Could two apps with different design systems both
use this unchanged?"* Yes → engine. Encodes a look → consumer's; keep it out.

## Pinned columns (the part consumers compose most)

```
resolvePinnedLeftPrefix(visibleIds, pinnedIds)        // longest valid prefix
computePinnedLayout(visibleIds, pinnedIds, getWidthPx) // cumulative left + widths
getPinnedTableCellStickyStyle(layout, columnId, { variant })  // per-cell sticky CSS
isPinnedColumn / isLastPinnedColumn
```

**Invariant:** pinned ids MUST be a prefix of the visible leaf columns, in
order. Calling `computePinnedLayout` with non-prefix ids throws — run
`resolvePinnedLeftPrefix` first. For a leading row-index gutter that stays
frozen at index 0, use `resolvePinnedLeftWithLeadingGutter`.

Drive `getWidthPx` from **authoritative** widths (`table-fixed` + `<colgroup>` +
TanStack `getSize()`), or the cumulative `left` offsets drift.

## Pinned-cell backgrounds (failure mode)

A sticky cell renders ON TOP of cells scrolling underneath it. Therefore it
must be **opaque** (a transparent sticky cell shows ghosted bleed-through) AND
the **same color as its row** per state. Two wrong fixes:

- Transparent / translucent fill → content bleeds through on horizontal scroll.
- A single flat opaque base → mismatches striped/hover/selected rows.

Correct: the sticky cell uses an **opaque per-row fill** matching the `<tr>` for
rest+stripe, and the consumer supplies opaque hover/selected overlays equal to
the body's translucent ones. In an oklch theme, the opaque equivalent of a
`bg-muted/40` overlay over base `B` is `color-mix(in oklab, var(--muted) 40%,
B)` — pixel-identical, because Tailwind's `/40` opacity *is* an oklab mix.
Mark sticky cells with `data-pinned` so one CSS rule covers columns, rows, and
the corner.

## Selection, keyboard, reorder

- `useGridKeyboard({ selectionMode: 'row', onToggleRowSelection, onSelectAllRows })`
  → Space toggles the focused row, Ctrl/Cmd+A selects all rows (cell mode
  selects a cell range instead).
- Row reorder: pure `moveRowBefore / moveRowUp / moveRowDown / moveRowToIndex`;
  `useRowKeyboardReorder` adds a11y parity (Enter grab → Arrow move → Enter drop).
- `useSelectCellDragIntent` is press-hold drag *intent* (returns
  `intent: 'idle'|'holding'|'drag-ready'` + modifiers), not the drag itself.
  **Failure mode:** do NOT enable its `capturePointer` when the drag is
  delegated to a parent dnd-kit handle (`asHandle`) — pointer capture starves
  the sensor and the drag never starts. Default is off; keep it off there.
- ARIA: `getRowAria`, `getCellAria`, `getDragHandleAria` emit
  `aria-rowindex/colindex/selected/grabbed`.

## Theming

Fork a preset and compose — never hardcode classes in the engine:

```
const tokens = createTableTokens(nquiCardTablePreset(), { /* overrides */ });
const classes = buildTableClasses(tokens);   // shell, header, cell, pinned*, select* ...
```

Presets: `card` (dashboard), `spreadsheet` (dense pinned), `pmo` (project).
A row-index gutter is a distinct, **solid uniform** panel (`rowHeader` tokens),
never striped — keep its fill off the per-row stripe path.

## Engine-only release — done & enforced

The split is complete. `@nqlib/nqgrid` ships **no styling**: the `./styles` and
`./tokens` entry points are removed, and all tokens, class builders, and styled
cells now live in the reference app (`apps/playground/src/lib/nqgrid-styling/`).
The shipped surface is `engine` (+ `grid`, `sheet`, `spreadsheet`, `advanced`,
`configurator`, `fixtures`). Consumers fork the token starter and supply their
own cell renderers (the BECO `grid-styles.ts` pattern).

**This is enforced, not just documented:**
- An ESLint guard on `src/**` (`eslint.config.mjs`) fails the build if engine
  code imports `@nqlib/nqui` or contains design-system class strings.
- The demo resolves nqgrid through anchored aliases (public entry points only),
  so it cannot deep-import engine internals — proving the curated barrel is the
  whole consumer surface.

**Workflow:** develop the engine and the demo separately. Engine = headless
logic/geometry, tested under `src/**/*.test.ts`. Demo = owns all look/feel,
tested under `apps/playground` (`pnpm --filter nqgrid-playground test`). A change
that puts a class string or nqui import in `src/` is a boundary violation.
