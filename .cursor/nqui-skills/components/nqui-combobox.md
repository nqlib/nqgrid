# nqui Combobox

> **Searchable** select (Radix Popover + cmdk). Type in `**ComboboxInput`** to filter; a hidden cmdk input stays in sync. Single or multiple selection.

## When to Use

- **Selection:** Single (default) or multiple (`multiple` on root — items toggle; popover stays open until dismissed)
- **Filter:** Type in the **trigger field** while the list is open (same `search` state as cmdk)
- **Icons:** Put icons (or other nodes) inside `**ComboboxItem`**; use `**keywords**` if the visible label text is not enough for matching
- **Options:** Many rows; use `**items`** on `Combobox` + render prop on `ComboboxList` for built-in filtering

**Choose Combobox when:** Users need search. Use **Select** when a plain dropdown is enough.

## Import

```tsx
import {
  Combobox,
  ComboboxInput,
  ComboboxBadgeTrigger,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxSeparator,
  ComboboxCollection,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxTrigger,
  ComboboxValue,
  ComboboxClear,
  useComboboxAnchor,
} from "@nqlib/nqui"
```

## Single selection + type-to-filter (recommended)

Pass `**items**` to `Combobox` and use a **render function** on `ComboboxList`. Put `**ComboboxEmpty`** first inside `**ComboboxList**` (cmdk empty state).

```tsx
const fruits = ["Apple", "Banana", "Cherry", "Date", "Elderberry"]

<Combobox items={fruits} searchPlaceholder="Filter…">
  <ComboboxInput placeholder="Pick a fruit…" />
  <ComboboxContent>
    <ComboboxList>
      <ComboboxEmpty>No results found.</ComboboxEmpty>
      {(item) => (
        <ComboboxItem key={item} value={item}>
          {item}
        </ComboboxItem>
      )}
    </ComboboxList>
  </ComboboxContent>
</Combobox>
```

## Static list (no `items` filter)

You can still render `ComboboxItem` children manually when you control filtering yourself.

```tsx
<Combobox>
  <ComboboxInput placeholder="Search..." />
  <ComboboxContent>
    <ComboboxList>
      <ComboboxItem value="a">A</ComboboxItem>
      <ComboboxItem value="b">B</ComboboxItem>
    </ComboboxList>
  </ComboboxContent>
</Combobox>
```

## Clear button

```tsx
<ComboboxInput showClear placeholder="Search..." />
```

## Multiple selection (badge trigger)

Use `**ComboboxBadgeTrigger**` as the anchor (outline button, badges, **maxShownItems** truncation, **+N more** / **Show less**). Pair with `**ComboboxContent showPanelSearch`** so users type in the **panel** search field (matches typical multi-select combobox UX).

```tsx
<Combobox multiple items={ids} value={value} onValueChange={setValue} searchPlaceholder="Search…">
  <ComboboxBadgeTrigger placeholder="Select…" maxShownItems={2} />
  <ComboboxContent showPanelSearch>
    <ComboboxList>
      <ComboboxEmpty>No results.</ComboboxEmpty>
      {(id) => (
        <ComboboxItem key={id} value={id}>
          {resolveLabel(id)}
        </ComboboxItem>
      )}
    </ComboboxList>
  </ComboboxContent>
</Combobox>
```

For a custom chip row, you can still use `**ComboboxChips**`, `**ComboboxChip**`, and `**ComboboxChipsInput**` inside `**ComboboxContent**`.

## Development-only diagnostics

Pass `**debug**` on `**Combobox**` to log open state, value, search, and list id (only when `**import.meta.env.DEV**` is true, e.g. Vite dev). No logging in production builds.

```tsx
<Combobox debug defaultValue="us">
  ...
</Combobox>
```

## Architecture (internal)

The public API is unchanged; the implementation composes:


| Layer                              | Role                                                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `**radix-ui` Popover**             | Same primitives as `popover.tsx` (`Root`, `Anchor`, `Portal`, `Content`) — one Radix entrypoint for positioning and focus. |
| `**Command` (cmdk)**               | Panel search + list; order matches the command palette: `**CommandInput`** then list children.                             |
| `**ComboboxList` → `CommandList**` | Ref reads the **real** list node id after mount for `**aria-controls`** on the trigger (see cmdk constraints below).       |
| `**ComboboxItem` → `CommandItem**` | Shared row styles and checkmark behavior with `**CommandPalette**` / cmdk.                                                 |


When `**showPanelSearch**` is false, the panel `**CommandInput**` is wrapped in `**sr-only**` (not `hidden` / `display: none`) so cmdk filtering stays consistent.

## cmdk constraints

- **List `id`:** cmdk **overwrites** the `id` on `Command.List`. Do not assume `useId()` matches the DOM — the combobox mirrors the mounted list element’s id into context for `**aria-controls`**.
- **Panel input:** Keep the cmdk input **mounted** when filtering (see `**sr-only`** branch above).

### Row selection styling (React 19 + cmdk)

cmdk sets `data-selected` / `aria-selected` on **every** row. **React 19** renders booleans as strings (`data-selected="false"`, `aria-selected="false"`), not absent attributes.

| Tailwind utility | Compiled selector | Safe with React 19? |
| ---------------- | ----------------- | ------------------- |
| `data-selected:bg-accent` | `[data-selected]` | **No** — matches `"false"` too → all rows highlighted |
| `data-[selected=true]:bg-accent` | `[data-selected=true]` | Yes — selected row only |
| `data-[selected=false]:bg-transparent` | `[data-selected=false]` | Yes — reset unselected rows when overriding CommandItem |
| `aria-selected:bg-accent` | `[aria-selected=true]` | **Yes** — preferred (used by `ComboboxItem` in source) |

nqui **ComboboxItem** and **CommandItem** (≥ 0.6.1) use `aria-selected:bg-accent` via `floatingListItemInteractive`.

## Troubleshooting


| Symptom                                                      | What to check                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trigger `**aria-controls**` missing or wrong                 | `**ComboboxList**` must mount while the popover is open so the list ref can read `**id**`.                                                                                                                                                                                                                                                                         |
| **Every row** has muted/accent background (looks all selected) | DevTools: unselected rows have `data-selected="false"`. Bare `data-selected:` / `[data-selected]` CSS matches them. Use `aria-selected:bg-accent` or `data-[selected=true]:` + `data-[selected=false]:bg-transparent`. See `nqui-command.md`. |
| Row highlight / keyboard selection looks wrong               | Not only `data-[selected=true]` — with React 19, also avoid `data-selected:bg-accent`. Prefer `aria-selected:bg-accent`. |
| **Mouse hover / click on rows does nothing; keyboard works** | Row styles must not use a broad `**data-[disabled]:pointer-events-none`** (can match any `data-disabled` value). Use `**aria-disabled:**` (or `**data-[disabled=true]:**`) so only disabled items drop pointer events. Hidden panel search is wrapped with `**sr-only**` + `**pointer-events-none**`; the cmdk `**CommandInput**` keeps `**pointer-events-auto**`. |
| Filter feels out of sync                                     | Avoid hiding the panel `**CommandInput**` with `**display: none**`.                                                                                                                                                                                                                                                                                                |


## Implementation

- **Source:** `packages/nqui/src/components/ui/combobox.tsx`
- **Public API:** exported from `@nqlib/nqui` (same as `CoreCombobox*` aliases in the barrel if you need the unprefixed base re-exports)
- **Styling:** Input group uses injected CSS once per page (`nqui-combobox-styles-v1`) for trigger depth/shadow; component is `"use client"`.
- **Docs location:** In-repo `packages/nqui/docs/components/`; in apps, `node_modules/@nqlib/nqui/docs/components/` (docs ship with the npm package). Skill: **nqui-components** (`.cursor/skills/nqui-components/SKILL.md`).

## Notes

- `**useComboboxAnchor`:** returns a ref to pass to `**PopoverAnchor`** (from `@nqlib/nqui`) wrapping the chips row so the dropdown positions correctly when using `**ComboboxChips**` / custom layout.
- **Dropdown items:** spacing/hover treatment aligns with **Select** (`SelectItem`-style density).

