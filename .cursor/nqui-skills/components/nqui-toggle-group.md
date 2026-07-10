# nqui ToggleGroup

> **Single or multiple selection** from 2–5 options. Inline. **Default for toolbar/inline UI** (view mode, format bar, size picker).

## When to Use

- **Selection:** Single (`type="single"`) or Multiple (`type="multiple"`)
- **Options:** 2–5
- **Layout:** Inline

**Design is inferred from type:**
- `type="single"` – Segmented style (primary fill on selected). E.g. view mode, scale type (Linear/Log).
- `type="multiple"` – Outline style (muted fill on selected). E.g. format toolbar (bold, italic, underline).

**Examples:**
- Single: view mode, scale type (Linear/Log), size (Small/Medium/Large)
- Multiple: format toolbar (bold, italic, underline)

**Use Select** when 5+ options or no space.

## Import

```tsx
import { ToggleGroup, ToggleGroupItem, ToggleGroupSeparator } from "@nqlib/nqui"
```

## Basic

```tsx
{/* Single (segmented, primary fill) */}
<ToggleGroup type="single" value={v} onValueChange={setV}>
  <ToggleGroupItem value="linear">Linear</ToggleGroupItem>
  <ToggleGroupItem value="log">Log</ToggleGroupItem>
</ToggleGroup>

{/* Multiple (outline) */}
<ToggleGroup type="multiple" value={vals} onValueChange={setVals}>
  <ToggleGroupItem value="bold"><BoldIcon /></ToggleGroupItem>
  <ToggleGroupItem value="italic"><ItalicIcon /></ToggleGroupItem>
</ToggleGroup>
```

## With manual separators

Dividers are shown via item borders by default (using `foreground/20` for theme-safe visibility). Use `ToggleGroupSeparator` (nqui Separator) when `separator={false}` or `spacing>0` for explicit separator placement:

```tsx
<ToggleGroup type="single" variant="outline" separator={false}>
  <ToggleGroupItem value="left">Left</ToggleGroupItem>
  <ToggleGroupSeparator />
  <ToggleGroupItem value="center">Center</ToggleGroupItem>
  <ToggleGroupSeparator />
  <ToggleGroupItem value="right">Right</ToggleGroupItem>
</ToggleGroup>
```

## Context

Place in realistic app context (document toolbar, chart settings panel). Never show in isolation. Reference: `src/pages/ComponentShowcase.tsx` → Toggle & ToggleGroup section (document editor, chart settings).

## Notes

- `spacing={0}` (default) = shared border, no gap, dividers between items (border using `foreground/20`). `spacing={2}` = gap between items, no dividers.
- Selected: default/outline → `bg-secondary` + gradient + shadow; segmented → `bg-primary` + gradient + shadow. Ensures visibility on card, sidebar, varied backgrounds.
- Pass `variant="outline"` to override single’s default segmented style.
