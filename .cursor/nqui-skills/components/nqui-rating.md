# nqui Rating

> Star rating. Half-star, maxRating, tooltipContent. Injects style.

## Import

```tsx
import { Rating } from "@nqlib/nqui"
```

## Basic

```tsx
<Rating value={3.5} onChange={setVal} />
```

## maxRating / starSize

```tsx
<Rating value={val} onChange={setVal} maxRating={10} starSize={24} />
```

## tooltipContent

```tsx
<Rating
  value={val}
  onChange={setVal}
  tooltipContent={(v) => `${v} stars`}
/>
```

## Notes

- Injects inline style for SVG mask. Client-only in SSR.
