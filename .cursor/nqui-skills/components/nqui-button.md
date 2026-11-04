# nqui Button

> Default **Button** is the enhanced variant (gradients, depth, active scale). Implemented in **`ui/button.tsx`** with **`CoreButton`** for the plain primitive.

## Import

```tsx
import { Button } from "@nqlib/nqui"
```

## Basic

```tsx
<Button>Click</Button>
<Button variant="destructive">Delete</Button>
```

## Variants

| variant | Notes |
|---------|-------|
| default, destructive, secondary | Enhanced 3D |
| success, warning, info | Semantic |
| outline, ghost, link | Core fallback |
| sm, default, lg, icon | size |

```tsx
<Button variant="success">Save</Button>
<Button variant="warning">Caution</Button>
<Button variant="info">Info</Button>
<Button size="icon"><Icon /></Button>
```

## asChild

Render as `<a>` or custom element:

```tsx
<Button asChild>
  <a href="/page">Link</a>
</Button>
```

## Loading

```tsx
<Button disabled>
  <Spinner className="mr-2 size-4" />
  Loading...
</Button>
```

## Notes

- **Shape:** full pill (`rounded-full`) for all sizes.
- **Bounded label:** string/number children are wrapped so **`truncate`** + **`min-w-0`** apply in narrow layouts. Same pattern is used across **Toggle**, **Tabs**, **Badge**, **Combobox** chips; **Select** value uses **line-clamp**. Custom markup with one long inner node may still need its own `min-w-0 truncate` or a **`title`**.
- Active state uses `scale-95`; avoid parent `transform` overrides.
- Use `CoreButton` from `@nqlib/nqui` for base shadcn style.
