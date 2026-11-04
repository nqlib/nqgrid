# nqui Card

> Container. Header, content, footer. Optional stickyHeader.

## Import

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@nqlib/nqui"
```

## Basic

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Body</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>
```

## Sticky Header

```tsx
<Card stickyHeader className="h-[400px]">
  <CardHeader>...</CardHeader>
  <CardContent>Scrollable content</CardContent>
</Card>
```

## Notes

- **Layout / bounds:** Root **Card**, **CardHeader**, **CardContent**, and **CardFooter** include **`min-w-0`** so nested flex/grid layouts can shrink and children are less likely to spill horizontally. **Card** stays **`overflow-visible`** on purpose so popovers, menus, and focus rings are not clipped—pair with bounded components (buttons, carousel insets, `truncate`, etc.) instead of `overflow-hidden` on the card by default.
- **stickyHeader:** Use `stickyHeader` prop on Card for scrollable content with sticky header. The header uses `--z-sticky-content` (z-index: 15).
- **Z-index layering:** Card sticky headers (15) are below page headers (20). If using in a page with sticky header, ensure proper z-index layering.
- **Height required:** Card needs a bounded height (e.g., `h-[400px]`, `h-80`, or `h-full` inside a fixed-height parent). **`max-h-*` alone is not enough**—the card still grows with content, so the scroll body will not overflow. Clip frosted glass with an outer `overflow-hidden rounded-*` wrapper if needed; avoid `overflow-hidden` on the Card root with `stickyHeader` (it can break Radix ScrollArea).
- **Content scroll:** The CardContent becomes scrollable when Card has `stickyHeader` and a defined height.
