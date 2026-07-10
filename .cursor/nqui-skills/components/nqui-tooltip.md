# nqui Tooltip

> Supplemental hint on **hover or focus** — not a substitute for visible labels or critical instructions.

## Import

```tsx
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@nqlib/nqui"
```

## Basic

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild><Button>Hover</Button></TooltipTrigger>
    <TooltipContent>Tooltip text</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

## Provider

Place **`TooltipProvider`** once at app root (or layout) so delays and portals work consistently.

## UX & accessibility

- **Do not** put **required** information only in a tooltip. Users who don’t hover (keyboard, touch, screen reader) may miss it. Repeat critical copy in the visible UI or **Dialog** / **Sheet** / inline help.
- **Keyboard:** Triggers should be focusable; tooltips typically show on **focus** as well as hover (Radix Tooltip behavior). Don’t rely on hover-only for anything mandatory.
- **Touch:** There is **no hover** on phones. Treat tooltip content as **nice-to-have**; use **Popover** or inline text for essential mobile copy.
- **Screen readers:** Tooltip content is exposed when the trigger is focused; keep text **short** and **non-semantic** for critical structure (don’t use tooltips as the only form label).

## When to use something else

| Need | Use instead |
|------|-------------|
| Rich content, tap to open | **Popover** (`nqui-popover.md`) |
| Long preview on hover | **HoverCard** (`nqui-hover-card.md`) |
| Blocking message | **Alert** or **Dialog** |
