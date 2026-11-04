# nqui Switch

> Toggle switch. **Radix** primitive with **size** variants and **capsule thumb** (white, shadow). Sizes align with control scale: `sm` / `default` / `lg`.

## Import

```tsx
import { Switch } from "@nqlib/nqui"
```

## Basic

```tsx
<Switch checked={checked} onCheckedChange={setChecked} />
```

## Sizes

```tsx
<Switch size="sm" />
<Switch size="default" />
<Switch size="lg" />
```

## Hit area

The switch root has no `::before` styling, so you can add [hit-area utilities](https://bazza.dev/craft/2026/hit-area) on the same element:

```tsx
<Switch className="hit-area-4" id="notifications" />
```

Use sparingly in dense toolbars so expanded targets do not overlap.

## Notes

- Thumb travel and track sizes are fixed per `size`; overriding height on the root without matching thumb classes may look off.
