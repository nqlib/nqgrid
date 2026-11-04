# nqui Tracker

> GitHub-style block strip. Activity/status visualization. Tooltips.

## Import

```tsx
import { Tracker } from "@nqlib/nqui"
import type { TrackerBlockProps } from "@nqlib/nqui"
```

## Basic

```tsx
<Tracker
  data={[
    { color: "bg-emerald-600", tooltip: "Active" },
    { color: "bg-red-600", tooltip: "Error" },
    { tooltip: "No data" }
  ]}
/>
```

## Options

```tsx
<Tracker
  data={data}
  hoverEffect
  defaultBackgroundColor="bg-muted"
/>
```

## Notes

- `color` must be Tailwind class (e.g. `bg-emerald-600`), not hex.
- Wrap in `TooltipProvider` for tooltips.
- Blocks without `color` use `defaultBackgroundColor`.
