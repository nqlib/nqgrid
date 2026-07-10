# nqui Sortable

> Drag-and-drop reorder. Import from `@nqlib/nqui` or `@/components/ui/sortable`.

## Import

```tsx
import {
  Sortable, SortableContent, SortableItem, SortableItemHandle, SortableOverlay
} from "@/components/ui/sortable"
// Or if exported: import { ... } from "@nqlib/nqui"
```

## Basic

```tsx
<Sortable value={items} onValueChange={setItems} orientation="vertical">
  <SortableContent asChild>
    <div>
      {items.map((item) => (
        <SortableItem key={item} value={item} asChild>
          <div>
            <SortableItemHandle asChild><button>⋮⋮</button></SortableItemHandle>
            {item}
          </div>
        </SortableItem>
      ))}
    </div>
  </SortableContent>
  <SortableOverlay>
    {({ value }) => <div>Dragging: {value}</div>}
  </SortableOverlay>
</Sortable>
```

## Object Array

```tsx
<Sortable value={objects} onValueChange={setObjects} getItemValue={(o) => o.id}>
  ...
</Sortable>
```

## orientation

`vertical` | `horizontal` | `mixed`
