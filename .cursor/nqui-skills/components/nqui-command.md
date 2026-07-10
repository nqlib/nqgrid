# nqui Command

> Command palette filter list. CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator, CommandShortcut. CommandDialog for modal.

## Import

```tsx
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup,
  CommandItem, CommandSeparator, CommandShortcut, CommandDialog
} from "@nqlib/nqui"
```

## Basic

```tsx
<Command>
  <CommandInput placeholder="Search..." />
  <CommandList>
    <CommandEmpty>No results</CommandEmpty>
    <CommandGroup heading="Suggestions">
      <CommandItem>Item</CommandItem>
    </CommandGroup>
    <CommandSeparator />
    <CommandGroup heading="Other">
      <CommandItem>Other<CommandShortcut>⌘K</CommandShortcut></CommandItem>
    </CommandGroup>
  </CommandList>
</Command>
```

## CommandDialog

```tsx
<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput />
  <CommandList>...</CommandList>
</CommandDialog>
```

## CommandItem selection styling (cmdk + React 19)

Default `CommandItem` classes come from `floatingListItemInteractive` in `lib/floating-surface.ts`:

- `data-selected:bg-accent` → CSS **`[data-selected]`** (any value)
- `data-[highlighted]:bg-accent` — Radix pointer highlight
- `focus:bg-accent` — keyboard focus

cmdk sets **`data-selected` and `aria-selected` on every row**. With **React 19**, unselected rows render as `data-selected="false"` / `aria-selected="false"` (strings), not omitted attributes.

### Symptom

Every list row has a muted/accent pill background; hover/keyboard should highlight **one** row only.

### What to check

1. Inspect an idle row: `data-selected="false"` present → bare `data-selected:` utilities will still match.
2. Only **one** row should have `aria-selected="true"` (unless two items share the same cmdk `value`).
3. Do not assume “only one selected” in the DOM means correct CSS — check computed `background-color`.

### Do / don't (Tailwind)

| Do | Don't |
| -- | ----- |
| `aria-selected:bg-accent` | `data-selected:bg-accent` |
| `data-[selected=true]:bg-accent` | `data-[selected]:bg-accent` |
| `data-[selected=false]:bg-transparent` when overriding defaults | `bg-muted` on every row “to match design” |

**nqui ≥ 0.6.1:** `floatingListItemInteractive` uses `aria-selected:bg-accent` (same as ComboboxItem).

### Consumer override (nqui &lt; 0.6.1 only)

```tsx
<CommandItem
  className="bg-transparent data-[selected=false]:!bg-transparent aria-selected:bg-accent aria-selected:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
  ...
>
```

See `nqui-command-palette.md` for Cmd+K-specific notes.
