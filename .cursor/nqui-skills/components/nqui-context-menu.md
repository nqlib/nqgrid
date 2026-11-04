# nqui ContextMenu

> Right-click menu. Checkbox, radio, submenus, shortcuts.

## Import

```tsx
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuCheckboxItem, ContextMenuRadioGroup,
  ContextMenuRadioItem, ContextMenuSub, ContextMenuSubTrigger,
  ContextMenuSubContent, ContextMenuShortcut
} from "@nqlib/nqui"
```

## Basic

```tsx
<ContextMenu>
  <ContextMenuTrigger>Right-click here</ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem>Copy</ContextMenuItem>
    <ContextMenuCheckboxItem checked={x} onCheckedChange={setX}>Option</ContextMenuCheckboxItem>
    <ContextMenuRadioGroup value={v} onValueChange={setV}>
      <ContextMenuRadioItem value="a">A</ContextMenuRadioItem>
    </ContextMenuRadioGroup>
    <ContextMenuSub>
      <ContextMenuSubTrigger>More</ContextMenuSubTrigger>
      <ContextMenuSubContent>...</ContextMenuSubContent>
    </ContextMenuSub>
  </ContextMenuContent>
</ContextMenu>
```
