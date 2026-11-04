# nqui Item

> List item layout. Media, content, actions. ItemGroup, ItemSeparator, ItemHeader, ItemFooter.

## Import

```tsx
import {
  Item, ItemMedia, ItemContent, ItemActions, ItemTitle, ItemDescription,
  ItemGroup, ItemSeparator, ItemHeader, ItemFooter
} from "@nqlib/nqui"
```

## Basic

```tsx
<Item>
  <ItemMedia><Avatar /></ItemMedia>
  <ItemContent>
    <ItemTitle>Title</ItemTitle>
    <ItemDescription>Desc</ItemDescription>
  </ItemContent>
  <ItemActions><Button>...</Button></ItemActions>
</Item>
```
