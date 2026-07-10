# nqui ColorSlider

> Slider for hue/saturation/lightness. Used by ColorPicker; usable standalone.

## Import

```tsx
import { ColorSlider } from "@nqlib/nqui"
```

## Types

Built on **`Slider`** from `ui/slider` (white thumb + shadow). For **non-controlled** demos, prefer **`defaultValue`** so the thumb stays draggable.

```tsx
<ColorSlider sliderType="hue" defaultValue={[240]} onValueChange={setVal} min={0} max={360} />
<ColorSlider sliderType="saturation" defaultValue={[0.5]} onValueChange={setVal} min={0} max={1} step={0.01} />
<ColorSlider sliderType="lightness" defaultValue={[0.6]} onValueChange={setVal} min={0} max={1} step={0.01} />
```

## Custom

```tsx
<ColorSlider sliderType="custom" gradientBackground="..." value={[50]} onValueChange={...} />
```
