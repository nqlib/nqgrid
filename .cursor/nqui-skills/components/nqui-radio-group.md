# nqui RadioGroup

> **1 selection** from options. Form context. Stacked or horizontal.

## When to Use

- **Selection:** Single
- **Context:** Form (settings, preferences)
- **Layout:** Stacked list or horizontal row

**Choose RadioGroup when:** Form with single-choice question. Traditional form UX. **Do not use RadioGroup for toolbars or inline UI** — use ToggleGroup instead. Use Select for 5+ options or tight space.

## Import

```tsx
import { RadioGroup, RadioGroupItem } from "@nqlib/nqui"
```

## Basic

RadioGroupItem now automatically wraps the radio button with a label when children are provided:

```tsx
const [value, setValue] = useState("a")

<RadioGroup value={value} onValueChange={setValue}>
  <RadioGroupItem value="a">Option A</RadioGroupItem>
  <RadioGroupItem value="b">Option B</RadioGroupItem>
</RadioGroup>
```

**Do not** pair an empty `RadioGroupItem` with a separate `Label` in the same row: the item’s outer wrapper is meant to include the text (as children) or stand alone without a sibling label. Putting `Label` beside a control-only item can create a wide empty flex region and push the label to the far edge. Prefer the pattern above; if you must use a separate label, use `CoreRadioGroupItem` from `@nqlib/nqui` (see package exports) or ensure the item is not wrapped in a full-width row that fights the layout.

## With Complex Content

```tsx
<RadioGroup value={value} onValueChange={setValue}>
  <RadioGroupItem value="email">
    <div>
      <div className="font-medium">Email</div>
      <div className="text-sm text-muted-foreground">Receive notifications via email</div>
    </div>
  </RadioGroupItem>
  <RadioGroupItem value="sms">
    <div>
      <div className="font-medium">SMS</div>
      <div className="text-sm text-muted-foreground">Receive notifications via SMS</div>
    </div>
  </RadioGroupItem>
</RadioGroup>
```

## Spacing

Control the gap between radio items with the `gap` prop on RadioGroup:

```tsx
<RadioGroup gap={0}>No gap</RadioGroup>
<RadioGroup gap={1}>4px gap</RadioGroup>
<RadioGroup gap={2}>Compact (8px)</RadioGroup>
<RadioGroup gap={3}>Default (12px)</RadioGroup>
<RadioGroup gap={4}>Loose (16px)</RadioGroup>
```

Control the gap between radio button and label with the `spacing` prop on RadioGroupItem:

```tsx
<RadioGroupItem value="a" spacing="compact">Tight spacing (8px)</RadioGroupItem>
<RadioGroupItem value="b" spacing="default">Default spacing (12px)</RadioGroupItem>
<RadioGroupItem value="c" spacing="comfortable">Loose spacing (16px)</RadioGroupItem>
```

## Variants

```tsx
<RadioGroup variant="animated" />
<RadioGroup variant="sliding" />
<RadioGroup variant="bar-left" />
<RadioGroup variant="bar-right" />
```

## Orientation / Disabled

```tsx
<RadioGroup orientation="horizontal" />
<RadioGroupItem value="a" disabled />
```
