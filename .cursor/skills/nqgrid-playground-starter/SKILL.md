---
name: nqgrid-playground-starter
description: >-
  Builds TanStack React tables with @nqlib/nqgrid engine + @nqlib/nqui that match
  the nqgrid playground: table shell/scroll tokens, flexRender, rich columns
  (status, people with renderPeoplePicker, percent battery), optional inline edit
  (double-click + Input), and configurator-driven table body classes. Use when
  scaffolding a data table like apps/playground demos, wiring buildRichColumnFromDef,
  PlaygroundPeopleComboboxCell-style pickers, or replicating portfolio/projects/flights/rich-inline-tasks UI.
---

# nqgrid playground starter (TanStack + nqui)

Use this skill with **`nqgrid-table-design`** (tokens + scroll layout). The **library** ships headless helpers; **this skill** encodes how the **playground** composes `@nqlib/nqui` so you can reproduce the same starter UI.

## Stack

| Layer | Package / location |
|-------|---------------------|
| Table logic | `@tanstack/react-table` (`useReactTable`, `getCoreRowModel`, `flexRender`) |
| Engine + tokens + rich schema | `@nqlib/nqgrid`, `@nqlib/nqgrid/styles`, `@nqlib/nqgrid/advanced` |
| UI primitives | `@nqlib/nqui` (`ScrollArea`, `Table*`, `Input`, `Combobox`, `ToggleGroup`, …) |
| Reference source | Repo `apps/playground/src/demos/*.tsx` |

## Minimal table skeleton

1. **Imports** — `tableShellClass`, `tableScrollAreaRootClass`, `tableScrollViewportStyle`, `tableScrollAreaContentClass`, `tableDenseTypography`, `tableHeaderClass`, `tableHeadClass`, `tableRowClass`, `tableCellClass`, `tableBodyClass` from `@nqlib/nqgrid` (or `@nqlib/nqgrid/styles` where you split styles-only).
2. **Shell** — Outer `div` with `tableShellClass` (card, flex column, bounded height).
3. **Scroll** — `ScrollArea` with `orientation="horizontal"`, `fadeMask={false}`, `className={tableScrollAreaRootClass}`, `viewportStyle={tableScrollViewportStyle}`.
4. **Table** — Inner `div` with `tableScrollAreaContentClass` → `<table className={tableDenseTypography}>`.
5. **Body class** — Prefer `usePlaygroundTableBodyClass` pattern from `apps/playground/src/playground-table-settings.tsx` **or** static `tableBodyClass`; the hook merges **configurator** `tableBodyClassFromLibraryConfig` for zebra/hover variants.
6. **Rows** — `table.getRowModel().rows.map` → `TableRow` + `TableCell` + `flexRender(cell.column.columnDef.cell, cell.getContext())`.

Do **not** omit `tableScrollAreaRootClass` / `tableScrollViewportStyle` (see `nqgrid-table-design`).

## Rich columns (`@nqlib/nqgrid/advanced`)

1. Build **`RichColumnFactoryConfig`** with `locale` / `defaultLocale` and **`renderPeoplePicker`** when using `kind: "people"` with `editable: true`.
2. Use **`buildRichColumnFromDef`** / **`buildRichColumnsFromDefs`** for `kind: "status"`, `"people"`, custom cells, etc.
3. **People** — Column def: `pickerOptions` (roster), `onValueChange`, `max`, `avatarSizePx`. Row field values must reconcile with roster keys (`richPersonOptionKey`); use **`reconcileRichPeopleWithRoster`** in the app if you build keys from names. Engine reconciles on commit when roster exists.
4. **Reference pickers** — `apps/playground/src/demos/playground-people-combobox-cell.tsx`: controlled `Combobox` `multiple`, draft keys while popover open, commit on close, suppress duplicate `onValueChange` from nqui item mouseDown+select; filter **`pickableOptions`** (hide already-assigned) optional.
5. **Status** — `buildRichColumnsFromDefs` with `editable: true`, `map`, `choiceOrder`, `onValueChange` (see `rich-inline-tasks-demo.tsx`).
6. **Percent / battery** — `TablePercentBattery` + double-click to edit pattern in same demo.

## Inline edit (playground pattern)

- **Not** enforced by the library: implement in **`cell`** for `kind: "custom"` or alongside rich columns.
- **Pattern** — Local `editing: { rowId, columnId } | null`; on double-click set editing; render `<Input autoFocus />` with `onKeyDown` (Enter commit, Escape cancel), `onBlur` commit; read **`row.original`** for stable identity (`getRowId: (r) => r.id`).
- **Rich columns** stay declarative; only **custom** columns need this imperative shell unless you wrap a generic hook.

## Configurator (optional)

From `@nqlib/nqgrid/configurator`: `defaultNqgridLibraryConfig`, `mergeNqgridLibraryConfig`, `tableBodyClassFromLibraryConfig`, `resolveNqgridImportPlan` — see `playground-table-settings.tsx` + `docs/configurator.md`.

## Demos file map

| Demo | File | Use for |
|------|------|---------|
| Rich inline tasks | `rich-inline-tasks-demo.tsx` | Status + people + percent + inline title/progress |
| Projects | `projects-table.tsx` | Leads avatars, nested subtasks panel |
| Portfolio | `portfolio-table.tsx` | Dense financial columns |
| Flights | `flights-table.tsx` | `flightsTableShellExtraClass`, ops density |

## Rules on disk

- **`.cursor/rules/nqgrid-rich-people-column.mdc`** — engine contract vs UI replication for people columns.

## Anti-patterns

- Importing **nqui** inside `@nqlib/nqgrid` src — keep DS in the app.
- Passing **`items={[...options]}`** every render without memo — can destabilize controlled comboboxes; memoize roster-derived arrays.
- Using **`RadioGroup`** for toolbar density — nqui projects use **`ToggleGroup`** (see playground settings sheet).

## Checklist

See [reference.md](reference.md) for a copy-paste checklist.
