# nqui Checkbox

> Enhanced checkbox. Variants: square (default), round (circular).

## Import

```tsx
import { Checkbox } from "@nqlib/nqui"
```

## Basic

```tsx
const [checked, setChecked] = useState(false)

<Checkbox checked={checked} onCheckedChange={setChecked}>Accept terms</Checkbox>
```

## With Label

Checkbox automatically wraps in a label when children are provided:

```tsx
<Checkbox>Accept terms</Checkbox>
```

## Gap

Control the gap between checkbox and label:

```tsx
<Checkbox gap={2}>Compact gap (8px)</Checkbox>
<Checkbox gap={3}>Default gap (12px)</Checkbox>
<Checkbox gap={4}>Loose gap (16px)</Checkbox>
```

Options: `0`, `1`, `2`, `3`, `4` (maps to Tailwind gap-0 through gap-4).

## Variants

```tsx
<Checkbox variant="square" />
<Checkbox variant="round" />
```

## Indeterminate

```tsx
<Checkbox checked="indeterminate" onCheckedChange={...} />
```

## Hit area (expanded pointer target)

nqui ships [Bazza **hit-area** utilities](https://bazza.dev/craft/2026/hit-area) in library CSS (`hit-area-*`, `hit-area-x-*`, `hit-area-debug`, etc.). They extend the clickable region with a `::before` layer without changing layout.

**Enhanced checkbox:** The checkmark is drawn with `::after` on the control root so `::before` stays free for `hit-area-*` on the **same** element. Add a class when you want a larger target (e.g. padded table cells):

```tsx
<Checkbox className="hit-area-6" checked={rowSelected} onCheckedChange={...} aria-label="Select row" />
```

**Label hover pill:** `.checkbox-animated-label::before` is on the **label** wrapper only; it does not conflict with `hit-area-*` on the checkbox button.

**Without hit-area:** You can still wrap the control in `<span className="relative hit-area-6">` if you prefer the expanded area on a wrapper.

## Notes

- Implementation: **`packages/nqui/src/components/ui/checkbox.tsx`** (enhanced + core in one module).
- Injects `<style>` at mount. Use client-only guard for SSR.
- Square and round share the same animation (pulse + checkmark scale); round has no SVG filters.
- Use `CoreCheckbox` for plain Radix checkbox.
