# Table design tokens

Typed table color system aligned with **@nqlib/nqui** semantic tokens. Ship as `@nqlib/nqgrid/tokens`; fork or override in your app.

## Why

Table colors were scattered across flat class strings (`@nqlib/nqgrid/styles`, playground `grid-styles.ts`, ad hoc demo overrides). The token engine gives you:

- One **schema** for every table surface and interaction state
- **Presets** for card dashboards vs dense spreadsheet grids
- A **compositor** that builds consistent `className` bundles
- **Playground** as a configured reference instance consumers can copy

`@nqlib/nqgrid/engine` stays geometry-only. Colors live here or in your fork.

## Quick start

```tsx
import {
  buildTableClasses,
  createTableTokens,
  nquiCardTablePreset,
} from "@nqlib/nqgrid/tokens";

const tokens = createTableTokens(nquiCardTablePreset(), {
  body: { rowHover: "[&_tr:hover_td]:bg-accent" },
});

const { body, header, headCell, pinnedBodyFill, cellFocus } = buildTableClasses(tokens);

// <TableHeader className={header}>
//   <TableHead className={cn(headCell, pinned && pinnedHeadFill)} />
// <TableBody className={body}>
```

## Presets

| Preset | Function | Use when |
|--------|----------|----------|
| **Virtual Data** | `nquiVirtualDataGridPreset()` | **Default** — analytics grids, virtualizer, row-index gutter (`virtual-data-demo.tsx`) |
| **Card** | `nquiCardTablePreset()` | Portfolio, flights, projects — Card + ScrollArea |
| **Spreadsheet** | `nquiSpreadsheetPreset()` | Alias of `nquiVirtualDataGridPreset()` (back-compat) |

Key differences:

- **Virtual Data**: `bg-card` shell, dense grid, row-index gutter tokens, muted row hover on data cells only, column borders
- Card: `bg-card` shell, `bg-accent` hover/selection, corner radius on body rows

## Token groups

| Group | Examples |
|-------|----------|
| `shell` | `bg`, `border`, `text`, `shadow` |
| `header` | sticky row, opaque `cell`, `cellText`, `hoverSuppress` |
| `body` | `fillMode` (solid/striped/none), `rowHover`, `rowSelected`, `rowExpanded`, `rowGroup`, `rowDisabled` |
| `pinned` | `headFill`, `bodyFill`, `bodyHoverLock` — always **opaque** |
| `rowHeader` | Excel-style `#` gutter: `headFill` / `bodyFill` (translucent OK when unpinned), **`pinnedHeadFill` / `pinnedBodyFill` (must be opaque when sticky)** |
| `cell` | `focus`, `active`, `rangeFill`, `rangeActive` |
| `border` | row dividers, corner radius, column rules |
| `footer` / `nested` | footer strip, inset panels, nested tbody without row hover |
| `chrome` | column resize hover/active |
| `text` / `pill` | numeric emphasis, status chips |

See `src/tokens/schema.ts` for the full typed interface.

## Compose API

| Export | Returns |
|--------|---------|
| `buildTableClasses(tokens)` | Full `TableClassBundle` (shell, header, body, pinned fills, cell states, …) |
| `buildBodyClass(tokens)` | Card tbody: borders + hover + selection + fill |
| `buildGridBodyClass(tokens)` | Spreadsheet tbody: hover + selection (+ fill if not `none`) |
| `withBodyFillMode(tokens, fill)` | Copy tokens with `body.fillMode` changed |
| `createTableTokens(base, overrides)` | Deep-merge partial overrides |

## Configurator bridge

`@nqlib/nqgrid/configurator` resolves runtime options:

```tsx
import { tableBodyClassFromLibraryConfig, tableClassBundleFromLibraryConfig } from "@nqlib/nqgrid/configurator";

const config = {
  styles: {
    tablePreset: "card",
    tableBodyFill: "striped",
    tableColorOverrides: { body: { rowHover: "[&_tr:hover_td]:bg-accent" } },
  },
};

const bodyClass = tableBodyClassFromLibraryConfig(config);
const bundle = tableClassBundleFromLibraryConfig(config);
```

## Playground reference

[`apps/playground/src/lib/playground-table-tokens.ts`](../apps/playground/src/lib/playground-table-tokens.ts) is the configured instance:

- `playgroundVirtualDataGridTokens` / `playgroundVirtualDataGridBundle` — **canonical** (`virtual-data-demo.tsx`, `grid-styles.ts`)
- `playgroundCardTokens` / `playgroundCardBundle` — card demos
- `playgroundSpreadsheetTokens` — alias of virtual-data grid tokens (legacy name)
- `grid-styles.ts` and `nqui-table-shell.ts` re-export composed classes

Tweak overrides in `playground-table-tokens.ts` to experiment; consumers copy that file or import presets directly.

## Consumer fork workflow

1. Import `@nqlib/nqgrid/tokens` **or** copy `src/tokens/` into `src/lib/table-tokens/`
2. Pick `nquiCardTablePreset()` or `nquiSpreadsheetPreset()`
3. Override only what you need via `createTableTokens`
4. Call `buildTableClasses` once; wire bundle into JSX
5. After nqui theme changes (`--accent`, `--muted`), audit hover/selection contrast

## Rules

- **Opaque sticky/pinned fills** — use `bg-card` (or solid semantic), never translucent sticky backgrounds
- **Row-index gutter** — unpinned cells may use `rowHeader.headFill` / `bodyFill` (`bg-muted/…`); when pinned apply `rowHeader.pinnedHeadFill` / `pinnedBodyFill` or `gridRowHeaderPinned*FillClass` from the bundle
- **Virtual rows + pins** — never `transform: translateY` on virtualized `<tr>`; use engine `getVirtualTableRowStyle(startPx)` (`top` positioning) or body pins will not stick
- **No colors in engine** — pin geometry only (`getPinnedTableCellStickyStyle`)
- **`@nqlib/nqgrid/styles`** — deprecated flat strings; re-exported from tokens for back-compat only

## Related

- [scroll-table-shell.md](./scroll-table-shell.md) — layout + opaque header/pin rules
- [composition-architecture.md](./composition-architecture.md) — engine vs nqui vs app-owned look
