# nqui Table

> Semantic table layout. Shadcn Table primitives; use DataTable for sorting/filtering/pagination.

## Import

```tsx
import {
  Table, TableHeader, TableBody, TableFooter,
  TableHead, TableRow, TableCell, TableCaption
} from "@nqlib/nqui"
```

## Basic

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {data.map((row) => (
      <TableRow key={row.id}>
        <TableCell>{row.name}</TableCell>
        <TableCell>{row.status}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

## Use Case

- Static/simple data tables
- Layout structure for custom table logic
- When you need semantic `<table>` without DataTable features

## Core vs Enhanced

Table is core shadcn only. For sorting, filtering, pagination, row selection, use DataTable (requires `@tanstack/react-table`).
