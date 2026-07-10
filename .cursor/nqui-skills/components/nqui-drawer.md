# nqui Drawer

> **Vaul** drawer. **DrawerContent** keeps an **inset rounded card** (`before:bg-card`, `before:inset-2`, `before:rounded-xl`) so the panel does not read as a full-bleed slab—surface follows **`card`** tokens in both themes.

## Import

```tsx
import {
  Drawer, DrawerTrigger, DrawerContent, DrawerHeader,
  DrawerTitle, DrawerDescription, DrawerFooter
} from "@nqlib/nqui"
```

## Basic

```tsx
<Drawer>
  <DrawerTrigger asChild><Button>Open</Button></DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Title</DrawerTitle>
      <DrawerDescription>Desc</DrawerDescription>
    </DrawerHeader>
    <DrawerFooter><Button>Save</Button></DrawerFooter>
  </DrawerContent>
</Drawer>
```
