# nqui ColorPicker

> OKLCH color picker. Popover or inline. Value is OKLCH string.

## Import

```tsx
import { ColorPicker } from "@nqlib/nqui"
```

## Basic

```tsx
<ColorPicker
  value={color}
  onChange={setColor}
  variant="popover"
/>
```

## Inline

```tsx
<ColorPicker value={color} onChange={setColor} variant="inline" />
```

## Value Format

OKLCH string: `"oklch(0.75 0.15 240)"` (L, C, H). Not hex/RGB.

```tsx
const [color, setColor] = useState("oklch(0.5 0.15 240)")
```

## Notes

- Store/pass OKLCH. Convert to hex for APIs if needed.
- Component includes hex display and copy.
