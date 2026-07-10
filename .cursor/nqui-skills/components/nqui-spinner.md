# nqui Spinner

> Dual-arc loader (primary **`linearGradient`** strokes, rotating shell). Keyframes live in **`packages/nqui/src/index.css`** (`.nqui-spinner-*`).

## Import

```tsx
import { Spinner } from "@nqlib/nqui"
```

## Basic

```tsx
<Spinner />
<Spinner className="size-6" />
```

## Notes

- Root is a `div` with `role="status"` and `aria-label="Loading"`.
- Strokes use `var(--primary)` and `color-mix(in oklch, var(--primary) …, white)` so light/dark themes stay on-brand.
