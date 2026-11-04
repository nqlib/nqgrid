---
name: nqui-components
description: Component implementation guide for nqui. Use when building UI, designing app layouts, or implementing components with @nqlib/nqui. Enforces ToggleGroup for inline/toolbar selection (never RadioGroup).
---

# nqui Components

Reference `./README.md` for the full component index and implementation rules.

## When to Load

- Implementing UI with nqui components
- Adding or modifying a component in packages/nqui
- Choosing the right component for a use case
- Debugging component behavior

## App Design Rule: Inline Selection → ToggleGroup

When designing app UI (toolbars, headers, inline controls):

| Context | Use | NOT |
|---------|-----|-----|
| View mode (List/Grid/Table), scale (Linear/Log), size (S/M/L) | **ToggleGroup** `type="single"` | RadioGroup |
| Format toolbar (Bold/Italic/Underline), multi-toggle | **ToggleGroup** `type="multiple"` | Multiple Checkboxes |
| Toolbar actions (Undo/Redo, align) | **ButtonGroup** | — |
| Single on/off (Bold, Mute) | **Toggle** | — |

**Rule:** Inline/toolbar selection = ToggleGroup. Use RadioGroup only for form context (settings page, modal form, stacked list).

## App Design Rule: Tabs in scrollable pages → InlineTabs

When `Tabs` sit inside a **page-level** vertical scroller (`overflow-y-auto` on the view, expanded cards, guide pages):

| Use | NOT |
|-----|-----|
| `InlineTabsList` + `InlineTabsTrigger` from `@nqlib/nqui` | Raw `TabsList` + `TabsTrigger` |
| `inlineTabsPanelsClass` around all `TabsContent` when panel heights differ | Unwrapped panels |

**Rule:** Tab switches must only change panel content — never jump page scroll. SSOT: `packages/nqui/src/components/custom/inline-tabs.tsx`. Do not duplicate in consumer apps.

**Docs:** `docs/components/nqui-tabs.md` § Inline tabs in scrollable pages.

## App Design Rule: Context-First (Toolbar in Real Environment)

**Rule:** Never show Toggle/ToggleGroup/ButtonGroup in isolation. Always place them in realistic app context.

| Context | Layout | Reference |
|---------|--------|-----------|
| Document editor | Toolbar above content; `bg-muted/30` container; `Separator` between groups | `/catalog` → Toggle & ToggleGroup |
| Chart/settings | Label + inline controls; `rounded-lg border bg-muted/30 p-3` | `/catalog` → Chart settings |
| Standalone | Inline with related UI | `/catalog` → Standalone toggle |

**Canonical implementation:** `/catalog` Toggle section, or full pages at `/patterns` and `/recipes/settings`.

## Composition (product UI)

Before picking components, read **`../COMPOSITION.md`** (or `docs/nqui-skills/COMPOSITION.md`). Dev app: **Recipes** at `/`, catalog at `/catalog`.

### Pre-ship checklist

- [ ] One user goal and primary action on the screen
- [ ] ≤3 major surfaces (chrome + primary + optional secondary)
- [ ] Toolbars use ToggleGroup in context (`bg-muted/30`), not isolated in Cards
- [ ] Forms use FieldSet + FieldGroup (not a card per field)
- [ ] Cards only for bounded topics, not every control
- [ ] Loading / empty / error states use Skeleton, Empty, Alert

## Quick Reference

1. **Composition:** `../COMPOSITION.md` – when to assemble, not just which component
2. **Main index:** `./README.md` – all components, use cases, prerequisites
3. **Per-component:** `./nqui-<name>.md` – import, examples, variants
4. **Design system:** `.cursor/skills/nqui-design-system/SKILL.md` – sizing, grouped controls, **Card + ScrollArea** (any bounded panel)
5. **Scroll / flex / overflow:** `docs/components/nqui-scroll-area.md` – **§0** symptom routing, §1–§6 pitfalls, **`viewportStyle`**, **`orientation`**
6. **Layout index:** `./README.md` – custom scroll container, sticky z-index, momentum scroll prevention
7. **Tabs on scrollable pages:** `docs/components/nqui-tabs.md` — `InlineTabsList` / `InlineTabsTrigger` / `inlineTabsPanelsClass`

## Key Conventions

- React 18+ and 19 supported
- **cmdk list rows:** nqui ≥ 0.6.1 uses `aria-selected:bg-accent` in `floatingListItemInteractive`. Do not add custom `data-selected:bg-accent` on `CommandItem` (React 19 + `[data-selected]` highlights every row). See `docs/components/nqui-command-palette.md`.
- Control sizes: sm=h-6, default=h-7, lg=h-8
- Enhanced vs Core: default is enhanced; use Core* for plain
- Z-index: CSS vars from elevation.css only

## Layout Pattern: Card + ScrollArea + flex min-h-0 scroll

When a component demo is placed inside a `Card` (which itself lives in a responsive grid), the card content must not overflow its boundary. **If scroll is stuck, the footer overlaps, or `h-full` does nothing**, read **`docs/components/nqui-scroll-area.md` §0** (symptom routing) and **§1** — almost always a **`min-h-0`** / finite-height chain issue, not ScrollArea itself.

For **stubborn** Radix viewports in deep flex trees, add **`viewportStyle`** with **`position: "absolute"`, `inset: 0`, `minHeight: 0`, `minWidth: 0`** (see **§6**). For **wide** native tables or **`min-w-*`** grids, use **`orientation="both"`** (default vertical hides horizontal scroll).

Use this exact pattern for **simple** wide horizontal areas (pagination, etc.):

```tsx
<Card>
  <CardHeader>...</CardHeader>
  {/* Scrollable content: min-h-0 lets flex children shrink; overflow-x-auto handles wide content */}
  <CardContent className="min-h-0 flex flex-col gap-3 overflow-x-auto">
    <Pagination>
      <PaginationContent>
        <PaginationPrevious href="#" />
        <PaginationItem><button className="h-8 w-8 rounded-md bg-background border border-input">1</button></PaginationItem>
        {/* ... */}
        <PaginationNext href="#" />
      </PaginationContent>
    </Pagination>
  </CardContent>
</Card>
```

**Why `min-h-0`?** A flex column child defaults to `min-height: auto`, meaning it won't shrink below its content height — so `overflow-x-auto` never activates. Setting `min-h-0` overrides this and lets the flex child take its bounded size from the parent, triggering overflow scroll.

**When to use which overflow:**
- `overflow-x-auto` — horizontal scroll for wide content (pagination items, code blocks, table rows)
- `overflow-y-auto` — vertical scroll for tall content (logs, feeds, lists)
- `overflow-hidden` — when you want to clip visible overflow without scrolling

## Data tables (TanStack + ScrollArea)

For **bounded card tables** with sticky headers, **horizontal + vertical** scroll, flex height chain, and optional infinite scroll or paging, follow **`nqui-data-tables`** (`../nqui-data-tables/SKILL.md`) and read **`docs/components/nqui-scroll-area.md`** (**§0**–**§6**) first.

