# nqui DropdownMenu

> Context menu. Checkbox/radio items, submenus, shortcuts.

## Import

```tsx
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem,
  DropdownMenuRadioGroup, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
  DropdownMenuShortcut
} from "@nqlib/nqui"
```

## Basic

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild><Button>Open</Button></DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Item</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Another</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## Checkbox / Radio

```tsx
<DropdownMenuCheckboxItem checked={x} onCheckedChange={setX}>
  Toggle
</DropdownMenuCheckboxItem>
<DropdownMenuRadioGroup value={v} onValueChange={setV}>
  <DropdownMenuRadioItem value="a">A</DropdownMenuRadioItem>
</DropdownMenuRadioGroup>
```

## Submenu

```tsx
<DropdownMenuSub>
  <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
  <DropdownMenuSubContent>
    <DropdownMenuItem>Sub item</DropdownMenuItem>
  </DropdownMenuSubContent>
</DropdownMenuSub>
```

## Shortcut

```tsx
<DropdownMenuItem>Save<DropdownMenuShortcut>⌘S</DropdownMenuShortcut></DropdownMenuItem>
```
