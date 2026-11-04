# nqui Carousel

> Carousel. CarouselContent, CarouselItem, CarouselPrevious, CarouselNext.

## Import

```tsx
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@nqlib/nqui"
```

## Basic

```tsx
<Carousel>
  <CarouselContent>
    <CarouselItem>Slide 1</CarouselItem>
    <CarouselItem>Slide 2</CarouselItem>
  </CarouselContent>
  <CarouselPrevious />
  <CarouselNext />
</Carousel>
```

## Notes

- **Prev/Next** are positioned **inside** the carousel region (`left-2` / `right-2`, or `top-2` / `bottom-2` when vertical) so arrows stay within parents like **Card** instead of using negative offsets that sat outside the viewport (`-left-12` / `-right-12` previously).
- **Visibility:** Arrows are **dim by default** (`opacity-35`), ramp up on **carousel hover** (`group-hover/carousel`), and go **full opacity** on **button** `:hover`, `:focus-visible`, and `:active` (tap). Disabled controls stay faint.
- Override with `className` on `CarouselPrevious` / `CarouselNext` if you need edge-aligned or external controls.
