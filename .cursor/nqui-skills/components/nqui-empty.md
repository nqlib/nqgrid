# nqui Empty

> Empty state. Header, title, description, media, content.

## Import

```tsx
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia } from "@nqlib/nqui"
```

## Basic

```tsx
<Empty>
  <EmptyHeader>
    <EmptyTitle>No items</EmptyTitle>
    <EmptyDescription>Add something to get started</EmptyDescription>
  </EmptyHeader>
  <EmptyMedia>{/* icon */}</EmptyMedia>
  <EmptyContent><Button>Add</Button></EmptyContent>
</Empty>
```
