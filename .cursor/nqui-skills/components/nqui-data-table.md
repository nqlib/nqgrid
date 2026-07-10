# nqui DataTable

> Full-featured data table: sorting, filtering, pagination, row selection, inline editing.

## Import

DataTable is in `packages/nqui/src/components/table/`. For app usage: `import { DataTable } from "@/components/table"`. Requires `@tanstack/react-table` peer. Not currently exported from main `@nqlib/nqui` entry.

## Peer Dependency

```bash
pnpm add @tanstack/react-table
```

## Basic

```tsx
const columns: ColumnDef<User>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "email", header: "Email" },
]
<DataTable columns={columns} data={users} />
```

## Props

| Prop | Default | Use |
|------|---------|-----|
| enableSorting | true | Column header sort |
| enableFiltering | true | Global search |
| enablePagination | true | Page controls |
| enableRowSelection | false | Checkboxes |
| enableEditing | false | Inline edit |
| pageSize | 10 | Rows per page |

## Use Case

- Admin panels, dashboards
- Tabular data with sort/filter/paginate
- When Table primitives aren't enough

## Notes

- DataTable lives in `components/table/`; may require path alias.
- Uses createColumnHelper, createSelectColumn from data-table-helpers.
- Keyboard: Arrow keys, Enter for navigation.
