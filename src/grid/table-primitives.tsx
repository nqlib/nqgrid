import * as React from "react";

/**
 * Unstyled semantic table primitives — nqgrid-owned replacements for
 * `@nqlib/nqui` `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`.
 * Apply your own className tokens; wire cells with `@nqlib/nqgrid/engine` geometry.
 */

export const GridTable = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(function GridTable({ className, ...props }, ref) {
  return <table ref={ref} className={className} {...props} />;
});

export const GridTableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function GridTableHeader({ className, ...props }, ref) {
  return <thead ref={ref} className={className} {...props} />;
});

export const GridTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function GridTableBody({ className, ...props }, ref) {
  return <tbody ref={ref} className={className} {...props} />;
});

export const GridTableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function GridTableFooter({ className, ...props }, ref) {
  return <tfoot ref={ref} className={className} {...props} />;
});

export const GridTableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(function GridTableRow({ className, ...props }, ref) {
  return <tr ref={ref} className={className} {...props} />;
});

export const GridTableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(function GridTableHead({ className, ...props }, ref) {
  return <th ref={ref} className={className} {...props} />;
});

export const GridTableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(function GridTableCell({ className, ...props }, ref) {
  return <td ref={ref} className={className} {...props} />;
});

export const GridTableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(function GridTableCaption({ className, ...props }, ref) {
  return <caption ref={ref} className={className} {...props} />;
});
