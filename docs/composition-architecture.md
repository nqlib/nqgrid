# Composition architecture

nqgrid is **not** a skin on top of nqui `Table` / `DataTable`. The **grid engine + nqgrid grid UI** replace those; **nqui** supplies only generic UI primitives you need to build cells, toolbars, and scroll chrome.

Scroll layout (edge-to-edge card tables, opaque sticky header, pinned columns): see **[scroll-table-shell.md](./scroll-table-shell.md)**.

## Three layers

```
┌─────────────────────────────────────────────────────────────┐
│  Your app (tokens, product chrome, cell editors)            │
├─────────────────────────────────────────────────────────────┤
│  @nqlib/nqgrid/grid   — table/grid DOM you own & ship       │
│  @nqlib/nqgrid/engine — TanStack glue, pin math, keyboard…  │
├─────────────────────────────────────────────────────────────┤
│  @nqlib/nqui (published) — Button, Input, ScrollArea, …   │
│  NOT: Table, TableRow, DataTable, nqui grid/table shells  │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Package | Owns | Do not use for tables |
|-------|---------|------|------------------------|
| **Engine** | `@nqlib/nqgrid/engine` | Row models, selection, pinning geometry, virtual rows, clipboard, keyboard | — |
| **Grid UI** | `@nqlib/nqgrid/grid` | Semantic `<table>` primitives, future shells (`GridScrollShell`, pinned header row) | — |
| **Primitives** | `@nqlib/nqui` | ScrollArea, Button, Input, Combobox, Badge, Tabs, `cn`, theme CSS | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `TableHead`, `DataTable` |
| **Look** | Your app | Class strings / CSS variables (copy or fork playground `grid-styles.ts`) | `@nqlib/nqgrid/styles` for **new** products (deprecated) |

## Why

- **Customize engine and UI before shipping** — both live in nqgrid (or your fork), not in nqui’s table components.
- **Same TanStack Table** — engine presets replace nqui DataTable’s bundled row-model wiring; you keep full control of column defs and renderers.
- **nqui stays a design system** — buttons, forms, overlays; not the data-grid product surface.

## Playground today

| Status | Detail |
|--------|--------|
| Spreadsheet demos | Native `<table className={gridTableClass}>` + `colgroup` (virtual-data SSOT) |
| Pinning in demos | **Only** `pinPlaygroundCell` / `pinPlaygroundFreezeCell` via `playground-row-index-gutter.ts` |
| Scroll shell | nqui `ScrollArea` inside `EngineScrollTableShell` |
| Optional DOM kit | `@nqlib/nqgrid/grid` `GridTable*` — unstyled; playground does not require it yet |
| Look | Fork `grid-styles.ts` + `@nqlib/nqgrid/tokens` — not `@nqlib/nqgrid/styles` |

See **[playground-table-recipe.md](./playground-table-recipe.md)** for files to copy.

## Minimal consumer sketch

```tsx
import { flexRender, useReactTable } from "@tanstack/react-table";
import { withCoreSorting } from "@nqlib/nqgrid/engine";
import { ScrollArea } from "@nqlib/nqui";
import { gridTableClass, gridHeadCellClass, gridCellClass, gridHeaderClass, gridBodyHoverClass } from "./grid-styles";
import { pinPlaygroundCell, usePlaygroundPinnedLayout } from "./playground-row-index-gutter";
import { useEngineScrollViewport } from "./engine-scroll-table-shell";

export function PipelineTable() {
  const { viewportRef, scrolledX } = useEngineScrollViewport(true);
  const table = useReactTable({ ...withCoreSorting(), /* data, columns, getRowId */ });
  const pinnedLayout = usePlaygroundPinnedLayout({ table, dataPinnedLeftIds: ["id", "name"] });

  return (
    <ScrollArea viewportRef={viewportRef}>
      <table className={gridTableClass} style={{ width: table.getTotalSize() }}>
        <thead className={gridHeaderClass}>
          <tr>
            {table.getHeaderGroups()[0]!.headers.map((h) => {
              const pin = pinPlaygroundCell({ pinnedLayout, columnId: h.column.id, variant: "head", scrolledX });
              return (
                <th key={h.id} className={cn(gridHeadCellClass, pin.className)} style={pin.style}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className={gridBodyHoverClass}>{/* pinPlaygroundCell per td */}</tbody>
      </table>
    </ScrollArea>
  );
}
```

## nqui install for consumers

- **Published:** `@nqlib/nqui` at latest semver — primitives only.
- **Local:** `USE_LOCAL_NQUI=true` in nqgrid playground (see README) when developing nqui + nqgrid together.
- **Peer:** nqgrid does not bundle nqui; apps declare both packages.

## Export map (direction)

| Import | Status |
|--------|--------|
| `@nqlib/nqgrid/engine` | Shipped — SSOT for behavior |
| `@nqlib/nqgrid/grid` | Shipped — SSOT for table/grid DOM (grows over time) |
| `@nqlib/nqgrid/styles` | Deprecated — copy tokens into your app |
| `@nqlib/nqui` Table / DataTable | **Avoid** when using nqgrid |
