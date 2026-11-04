# nqui Slider

> Range slider. Supports single and range values.

## Import

```tsx
import { Slider } from "@nqlib/nqui"
```

## Basic

```tsx
<Slider value={[50]} onValueChange={([v]) => setVal(v)} />
<Slider value={[20, 80]} onValueChange={setRange} />
```

## Sizes

```tsx
<Slider size="sm" defaultValue={[40]} />
<Slider size="default" defaultValue={[40]} />
<Slider size="lg" defaultValue={[40]} />
```

## Notes

- **Thumb:** white, rounded-full, subtle shadow (aligned with **Switch** thumb language).
- **`size`:** `sm` | `default` | `lg` (control scale heights).
