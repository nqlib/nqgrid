# nqui Select

> **1 selection** from options. Dropdown. Use when 5+ options or no space for inline.

## When to Use

- **Selection:** Single
- **Options:** 5+ (or any count when space is limited)
- **Layout:** Dropdown (collapsed until open)

**Choose Select when:** Too many options for ToggleGroup, or UI space is tight. User picks from a list that opens on click.

**Use ToggleGroup instead** when 2–4 options and space for inline display. **Use Combobox** when user needs to search/filter options.

## Import

```tsx
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectSeparator } from "@nqlib/nqui"
```

## Basic

```tsx
<Select value={value} onValueChange={setValue}>
  <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
  <SelectContent>
    <SelectItem value="a">A</SelectItem>
    <SelectItem value="b">B</SelectItem>
  </SelectContent>
</Select>
```

## Grouped

```tsx
<SelectContent>
  <SelectGroup>
    <SelectLabel>Fruits</SelectLabel>
    <SelectItem value="apple">Apple</SelectItem>
  </SelectGroup>
  <SelectSeparator />
  <SelectGroup>
    <SelectLabel>Veggies</SelectLabel>
    <SelectItem value="carrot">Carrot</SelectItem>
  </SelectGroup>
</SelectContent>
```

## Notes

- **Content:** FrostedGlass + popover surface; **items** use relaxed row spacing (hover `accent`, margins) for dropdown parity with **Combobox** list items.
- Use `SelectScrollUpButton` / `SelectScrollDownButton` for long lists.
- **`CoreSelect*`** for the same primitives without the enhanced trigger chrome (re-exported from the same `ui/select` module).
