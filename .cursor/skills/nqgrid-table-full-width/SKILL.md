---
name: nqgrid-table-full-width
description: >-
  Prevent empty space to the right of TanStack tables inside EngineScrollTableShell /
  PlaygroundDataTableShell. Use when a table looks narrower than its card, columns
  cluster on the left, or the scroll viewport shows a dead zone after the last column.
---

# nqgrid table full-width contract

**Symptom:** table columns sit on the left; a large empty dark area fills the rest of the scroll shell (see `task-delivery-table.tsx` before fix).

**Cause:** `<table style={{ width: table.getTotalSize() }}>` with fixed pixel widths on **every** column. TanStack sums column `size` values (~880px for six columns) and the table element stops there — the shell is wider.

Pair with **[nqgrid-playground-starter](../nqgrid-playground-starter/SKILL.md)** (markup) and **[nqgrid-scroll-table-shell](../nqgrid-scroll-table-shell/SKILL.md)** (shell edge-to-edge — a different “gap” bug).

## Golden reference

| Concern | SSOT |
|---------|------|
| Product table, few columns, fill card | `apps/playground/src/demos/task-delivery-table.tsx` |
| Wide spreadsheet, horizontal scroll | `apps/playground/src/demos/portfolio-table.tsx`, `flights-table.tsx` |
| Many fixed columns + resize | `apps/playground/src/demos/table-selection-demo.tsx` |

## Decision tree

```
Does the table have fewer columns than fill a typical laptop viewport?
├─ YES → use FILL CONTAINER (below) — default for dashboard / task / queue tables
└─ NO  → use MIN-WIDTH SCROLL (below) — default for wide ops / portfolio grids
```

| Mode | When | Table style |
|------|------|-------------|
| **Fill container** | ≤8 columns, product UI, task lists, support queue | `width: "100%"`, `minWidth: table.getTotalSize()`, `tableLayout: "fixed"` |
| **Min-width scroll** | Many columns, pinning, column resize, matrix wider than viewport | `width: table.getTotalSize()` **or** `className="min-w-[960px]"` + `width: getTotalSize()` |

Never use **`width: table.getTotalSize()` alone** on a short-column dashboard table.

## Fill-container pattern (required for dashboard tables)

### 1. Pick one flexible column

Usually the primary text column: `task`, `title`, `name`, `ticket`, `description`.

```tsx
const FLEX_COLUMN_IDS = new Set(["task"]); // primary label column(s)
const FIXED_COLUMN_IDS = new Set(["status", "assignee", "priority", "project", "actions"]);
```

- Flexible column: set `size` + `minSize` in TanStack def (sizing hint only).
- Fixed columns: explicit `size`; keep narrow (status, actions, dates, avatars).

### 2. Table element

```tsx
<table
  className={gridTableClass}
  style={{
    width: "100%",
    minWidth: table.getTotalSize(),
    tableLayout: "fixed",
  }}
>
```

- `width: "100%"` — table stretches to the scroll viewport.
- `minWidth` — when viewport is narrower than column minimums, horizontal scroll appears.
- `tableLayout: "fixed"` — predictable distribution of leftover space.

### 3. colgroup — flex vs fixed

```tsx
<colgroup>
  {table.getVisibleLeafColumns().map((col) => (
    <col
      key={col.id}
      style={
        FLEX_COLUMN_IDS.has(col.id)
          ? { minWidth: col.getSize() }
          : { width: col.getSize() }
      }
    />
  ))}
</colgroup>
```

Do **not** set `width` on the flexible column in `colgroup`.

### 4. th / td — no fixed width on flex column

```tsx
<th
  style={
    FIXED_COLUMN_IDS.has(header.column.id)
      ? { width: header.getSize() }
      : undefined
  }
>

<td
  style={
    FIXED_COLUMN_IDS.has(cell.column.id)
      ? { width: cell.column.getSize() }
      : undefined
  }
  className={cn(gridCellClass, cell.column.id === "task" && "min-w-0")}
>
```

Applying `width: getSize()` on **every** cell blocks the flexible column from growing — this is the most common mistake after the table-level width.

### 5. Cell content

Flexible column inner wrapper must truncate:

```tsx
<div className="flex min-w-0 items-center …">
  <span className="min-w-0 truncate">…</span>
</div>
```

## Min-width scroll pattern (wide spreadsheets)

When total column width should **exceed** the card and scroll horizontally:

```tsx
<table
  className={cn(gridTableClass, "min-w-[960px]")} // optional floor
  style={{ width: table.getTotalSize() }}
>
  <colgroup>
    {columns.map((col) => (
      <col key={col.id} style={{ width: col.getSize() }} />
    ))}
  </colgroup>
```

All columns may keep fixed `width` on `th`/`td`. Empty right space should **not** appear unless the viewport is wider than `getTotalSize()` — if it does, you still need one flex column or `width: "100%"` with the same flex/fixed split.

## With column resize enabled

When `enableColumnResizing: true`:

- User-resized widths come from `column.getSize()` — flex column still omits fixed `width` on cells.
- Keep `minSize` on the flex column def so it never collapses below readable width.
- `table.getTotalSize()` updates as users drag — keep `minWidth: table.getTotalSize()` on the table.

## With `select` column (# / checkbox)

Treat `select` as **fixed** (44px):

```tsx
const FIXED_COLUMN_IDS = new Set(["select", "status", "assignee", …]);
const FLEX_COLUMN_IDS = new Set(["ticket", "name", …]); // first data column after select
```

## QA checklist (run before declaring done)

- [ ] Table visually spans the full card width at 1280px+ viewport.
- [ ] No dead zone between last column and scroll shell right edge.
- [ ] Primary text column grows; status/actions stay compact.
- [ ] Long titles truncate (`min-w-0 truncate`), not overflow under neighbors.
- [ ] Narrow viewport (~768px): horizontal scroll appears; no layout crush.
- [ ] Sticky header row spans same width as body (no header/body width mismatch).

## Anti-patterns (reject in review)

- `style={{ width: table.getTotalSize() }}` only — on dashboard tables with ≤8 columns.
- Fixed `width: col.getSize()` on **every** `th` and `td` including the primary label column.
- `colgroup` with fixed `width` on all columns when the table should fill the shell.
- Wrapping the `<table>` in a `max-w-*` or `w-fit` container inside the scroll viewport.
- Confusing this with scroll-shell **padding** gap — that is `px-4` / missing edge-to-edge (see nqgrid-scroll-table-shell).

## After changes

`pnpm --filter nqgrid-playground run build`. Smoke **Task delivery** (fill) and **Portfolio** or **Support queue** (resize + many columns).
