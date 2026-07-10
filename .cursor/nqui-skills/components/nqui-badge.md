# nqui Badge

> Status labels. 9 variants; ghost/link use CoreBadge.

## Import

```tsx
import { Badge } from "@nqlib/nqui"
```

## Basic

```tsx
<Badge>New</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="secondary">Draft</Badge>
```

## All Variants

```tsx
<Badge variant="default" />
<Badge variant="secondary" />
<Badge variant="destructive" />
<Badge variant="success" />
<Badge variant="warning" />
<Badge variant="info" />
<Badge variant="outline" />
<Badge variant="ghost" />
<Badge variant="link" />
```

## asChild

```tsx
<Badge asChild><a href="#">Link badge</a></Badge>
```

## Notes

- Implementation: **`packages/nqui/src/components/ui/badge.tsx`** (enhanced + core in one module).
- ghost/link route to CoreBadge (different styling).
- Use `CoreBadge` for plain shadcn badge.
