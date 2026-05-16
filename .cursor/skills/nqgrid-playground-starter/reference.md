# nqgrid playground starter — checklist

Copy this when scaffolding a new table screen.

## Dependencies

- [ ] `@nqlib/nqgrid` + `@nqlib/nqgrid/styles` (or main barrel that re-exports tokens)
- [ ] `@tanstack/react-table`
- [ ] `@nqlib/nqui` (ScrollArea, Table, Input, Combobox, Button, Sheet/ToggleGroup as needed)
- [ ] `react` / `react-dom` peers satisfied

## Layout

- [ ] Outer `tableShellClass`
- [ ] `ScrollArea` + `tableScrollAreaRootClass` + `tableScrollViewportStyle` + `fadeMask={false}` (unless product wants fades)
- [ ] Inner `tableScrollAreaContentClass` around `<table>`
- [ ] `<table className={tableDenseTypography}>`
- [ ] `TableHeader` / `TableBody` with `tableHeaderClass` + `tableBodyClass` (or configurator-derived body class)
- [ ] `TableFooter` **below** ScrollArea if needed (`tableFooterClass`)

## TanStack

- [ ] `useReactTable({ data, columns, getCoreRowModel, getRowId })`
- [ ] `flexRender` for header and body cells
- [ ] Column `size` + `header.getSize()` on `TableHead` / `TableCell` style where fixed layout matters

## Rich schema (optional)

- [ ] `buildRichColumnFromDef` / `buildRichColumnsFromDefs` with `RichColumnFactoryConfig`
- [ ] **`renderPeoplePicker`** implemented for editable `kind: "people"` (see `playground-people-combobox-cell.tsx`)
- [ ] Roster keys aligned with row data (`reconcileRichPeopleWithRoster` / stable ids)
- [ ] Status column: `map`, `choiceOrder`, `onValueChange`

## Inline edit (optional)

- [ ] `editing` state `{ rowId, columnId } | null`
- [ ] Double-click affordance on read-only cell
- [ ] `Input` with Enter / Escape / blur behavior
- [ ] `getRowId` matches your `row.id`

## QA

- [ ] Horizontal scroll works inside flex parent (viewport `minHeight: 0` chain)
- [ ] Sticky / pinned columns still behave if you add pinning later
- [ ] `pnpm exec tsc --noEmit` clean in app after wiring imports
