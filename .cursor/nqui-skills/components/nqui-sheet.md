# nqui Sheet

> Side panel (Radix **Dialog** pattern). **SheetContent** uses an **inset card** panel: transparent outer shell + `before:bg-card` block inset with **rounded corners** (matches drawer-style “card floating in the viewport”). **No edge borders** on the sheet shell (divider lines removed in favor of the card shape).

## Import

```tsx
import {
  Sheet, SheetTrigger, SheetContent, SheetHeader,
  SheetTitle, SheetDescription, SheetFooter
} from "@nqlib/nqui"
```

## Basic

```tsx
<Sheet>
  <SheetTrigger asChild><Button>Open</Button></SheetTrigger>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Title</SheetTitle>
      <SheetDescription>Desc</SheetDescription>
    </SheetHeader>
    ...
  </SheetContent>
</Sheet>
```
