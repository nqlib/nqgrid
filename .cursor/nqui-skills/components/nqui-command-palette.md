# nqui CommandPalette

> Global command palette (Cmd+K). Wraps Command with shortcut.

## Import

```tsx
import { CommandPalette } from "@nqlib/nqui"
```

## Basic

```tsx
<CommandPalette open={open} onOpenChange={setOpen} shortcutEnabled>
  <CommandInput placeholder="Search..." />
  <CommandList>...</CommandList>
</CommandPalette>
```

## Programmatic Only

```tsx
<CommandPalette shortcutEnabled={false} ... />
```

## Row highlight (Cmd+K list)

`CommandItem` uses `floatingListItemInteractive` with **`aria-selected:bg-accent`** (nqui ≥ 0.6.1). Do not add `data-selected:bg-accent` on custom rows — React 19 sets `data-selected="false"` on unselected cmdk items, and `[data-selected]` would highlight every row.

If an older nqui version still shows all rows filled: upgrade to **0.6.1+** or see `nqui-command.md` for a temporary `CommandItem` className override.

## Notes

- Keyboard listener on window. May conflict with other global shortcuts.
- Custom title/description for accessibility.
- Prefer plain `CommandList` in the showcase; wrap in `ScrollArea` only when you need a bounded height — scroll behavior is separate from row highlight.
