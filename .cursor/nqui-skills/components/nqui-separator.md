# nqui Separator

> Horizontal or vertical divider with multiple visual variants.

## Import

```tsx
import { Separator } from "@nqlib/nqui"
```

## Basic

```tsx
<Separator />
<Separator orientation="vertical" />
```

## Variants

Single component with `variant` prop. No separate Enhanced/Core—use `variant="solid"` for plain style.

| Variant | Description |
|---------|-------------|
| `default` | Fade at ends (gradient) |
| `solid` | Solid line |
| `shadow-outset` | Outset shadow |
| `shadow-inset` | Inset shadow |
| `dotted` | Dotted line |
| `dashed` | Dashed line |
| `double` | Double line |
| `glow` | Glow effect |
| `thick` | 2px line |
| `gradient` | Primary→accent gradient |
| `fade-strong` | Stronger fade, reduced opacity |
| `arrow-down` | Decorative arrow center |
| `tab-down` | Rounded tab center |
| `stopper` | Rectangular stopper center |
| `dot` | Circular dot center |
| `text-decoration` | Text in center (use `textContent`) |
| `shiny-corner` | Lighting on edges |
| `shiny-edge` | Softer edge highlight |

```tsx
<Separator variant="default" />
<Separator variant="solid" />
<Separator variant="shadow-outset" />
<Separator variant="text-decoration" textContent="OR" />
```
