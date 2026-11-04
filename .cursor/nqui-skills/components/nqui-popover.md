# nqui Popover

> Floating panel. PopoverAnchor decouples trigger from anchor position.

## Import

```tsx
import { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from "@nqlib/nqui"
```

## Basic

```tsx
<Popover>
  <PopoverTrigger asChild><Button>Open</Button></PopoverTrigger>
  <PopoverContent>Content</PopoverContent>
</Popover>
```

## PopoverAnchor

Position relative to anchor, not trigger:

```tsx
<Popover>
  <PopoverAnchor asChild><div ref={anchorRef}>Anchor area</div></PopoverAnchor>
  <PopoverTrigger asChild><Button>Open</Button></PopoverTrigger>
  <PopoverContent>Content</PopoverContent>
</Popover>
```

## Notes

- PopoverAnchor: content positions by anchor, not trigger.
