# nqui — composition (putting UI together)

Use this after **HUMAN_GUIDE.md** (task routing) and before opening many `nqui-*.md` files. Components are documented individually; this file explains **how to assemble them** into calm, product-quality screens.

## Named Layout Patterns

Pick the pattern that matches the user’s job before choosing components. These are blueprints, not templates — adapt them.

### App Shell (sidebar + content)
**When:** Multi-section app, persistent navigation, route-based views.
```
SidebarProvider
  Sidebar (collapsible, h-full)
    SidebarHeader (h-12, branding + workspace picker)
    SidebarContent (nav groups, ScrollArea)
    SidebarFooter (user avatar + menu)
  main (flex flex-col, overflow-y-auto)
    sticky header (h-12, breadcrumb + page actions)
    page content (p-6, max-w-screen-xl)
```
Components: `Sidebar`, `SidebarProvider`, `Breadcrumb`, `DropdownMenu` for workspace/user.

### Settings Page
**When:** User-controlled preferences, profile, account — organized by topic.
```
Page header (h1 + description, border-b)
Two-column: nav (sticky, ScrollArea) | form area
  FieldSet per section (border-b, pb-8)
    FieldLegend (section title)
    FieldGroup (max-w-lg, flex flex-col gap-4)
      Field (label + input + description)
  Footer row (Save + Cancel buttons)
```
Components: `FieldSet`, `FieldGroup`, `Field`, `Input`, `Select`, `Switch`, `Button`. Nav uses `Tabs` (vertical) or plain `nav` with `Item`.

### Dashboard (metrics + table/chart)
**When:** Overview screen, monitoring, analytics — data-first.
```
Page header (h1 + date range picker + export button)
Metric row (3-4 Cards, key numbers only — real data, not decorative)
Primary region: DataTable or Chart (Card, full-width)
Optional secondary: filter Sheet or side panel (Resizable)
```
Anti-pattern: fake KPI cards, hero metric layout, card grids of every component. Use `Empty` when data is absent.
Components: `Card`, `DataTable`, `Select`/`Combobox` for filters, `Sheet` for filter panel, `Skeleton` for loading.

### Master-Detail Split
**When:** List of items + contextual detail (email, files, tickets, settings rows).
```
Resizable (direction="horizontal", defaultSize=[35, 65])
  ResizablePanel: item list (ScrollArea, Item components)
  ResizableHandle  ← provides the visible divider
  ResizablePanel: detail view (sticky header + ScrollArea content)
```
Components: `Resizable`, `Item`, `ScrollArea`, `Breadcrumb` in detail header.

**CSS-flex fallback** (when `Resizable` won't size inside `overflow-y-auto` scroll containers):
```tsx
<div className="flex flex-1 min-h-0 overflow-hidden bg-muted/20">
  <div className="flex flex-col border-r border-border bg-background"
       style={{ width: 260, flexShrink: 0, overflow: "hidden" }}>
    {/* list panel */}
  </div>
  <div className="flex-1 min-w-0 overflow-hidden bg-background">
    {/* detail panel */}
  </div>
</div>
```

**Required for both versions — visual separation rules (these are mandatory, not aesthetic):**

1. **Three-layer divider**, not just `border-r`:
   - Panels: `bg-background` (or a flat panel color)
   - Outer wrapper: `bg-muted/20` (slightly darker) — peeks through as a subtle gutter
   - Border: `border-r border-border` on the list panel
   - The combination of border + background contrast is what reads as "separated." A lone `border-r` against same-color panels reads as "overlapping" — especially in dark mode where borders are subtle.

2. **List items must use minimal chrome.** In a narrow list panel:
   - Use `Item variant="ghost"` (or pass `variant` such that border is transparent) — never `outline` or `muted`
   - Selected state: `bg-accent/70`, not a bordered/elevated card
   - Hover: `hover:bg-muted/40` only
   - Bordered/card-style items in a 260px panel look like they bleed into the detail panel even when text-truncation is correct.

3. **Both panels need `overflow: hidden`** on their root container. Without this, item backgrounds and focus rings can paint past the panel boundary.

4. **Detail content needs `max-w-2xl` and `p-6`** (or similar) so it doesn't hug the divider — breathing room from the boundary reinforces separation.

5. **Don't put borders on list items AND between panels.** Pick one source of separation per axis. Bordered items + bordered panels = visual noise that reads as overlap.

**Responsive: switch to Sheet below ~900px container width (mandatory).**

A 260px list + flex-1 detail split below ~900px leaves the detail under ~640px — metadata rows wrap, description loses reading flow, the layout feels squeezed. **Don't try to shrink both panels.** Switch the detail to a Sheet instead.

```tsx
// Measure the master-detail container, not the viewport.
// The viewport includes sidebars; what matters is space available to the split.
const [splitRef, splitWidth] = useContainerWidth<HTMLDivElement>()
const isCompact = splitWidth > 0 && splitWidth < 900

<div ref={splitRef} className="flex flex-1 min-h-0 overflow-hidden bg-muted/20">
  {/* List: full-width in compact, 260px sidebar when split */}
  <div style={{ width: isCompact ? "100%" : 260, flexShrink: 0 }}>
    {/* items */}
  </div>
  {/* Detail: inline panel only when wide */}
  {!isCompact && <div className="flex-1 min-w-0">{detail}</div>}
</div>

{/* Detail: Sheet when compact, driven off the same selectedId */}
{isCompact && (
  <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
    <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col gap-0">
      <SheetHeader className="sr-only">
        <SheetTitle>{selected?.title}</SheetTitle>
      </SheetHeader>
      {selected && <DetailContent item={selected} />}
    </SheetContent>
  </Sheet>
)}
```

**Why container width, not `useIsMobile`/viewport:** the available split width depends on sidebars (primary sidebar, TOC sidebar, collapsible filter panels). A 1400px viewport with two open sidebars can still leave you under 900px — at which point Sheet is correct. Measure the container with `ResizeObserver`, not the window.

**Reusable hook** (drop into your project — does not require a library):

```tsx
function useContainerWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = React.useRef<T>(null)
  const [width, setWidth] = React.useState(0)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}
```

**Selection state lives on the parent**, not inside either panel. Same `selectedId` state drives both the inline detail render and the Sheet's `open` prop. Don't duplicate state across modes.

**Reference: Linear, GitHub Issues, Things 3** all use this exact pattern. Sheet → split is the standard transition, not split → smaller-split.

### Wizard / Stepper
**When:** Multi-step flow with mandatory sequence (onboarding, checkout, ATP procedure).
```
Page layout (centered, max-w-lg)
  Progress indicator (step count or Progress bar)
  Card (current step content)
    CardHeader (step title + description)
    CardContent (form fields or instructions)
    CardFooter (Back + Continue buttons, primary right)
```
**Rule:** One primary action per step (Continue/Submit). Back is always `variant="outline"`. Never skip validation before advancing.
Components: `Card`, `Progress`, `Button`, `Field`, `Alert` for step errors.

### Command / Search Interface
**When:** Power-user navigation, global search, quick actions (Cmd+K pattern).
```
CommandPalette (modal, triggered by keyboard shortcut)
  CommandInput (search)
  CommandList (ScrollArea)
    CommandGroup per category
      CommandItem (icon + label + shortcut)
```
Components: `CommandPalette`, `Command`, `CommandInput`, `CommandGroup`, `CommandItem`, `Kbd` for shortcuts.

### Form Dialog
**When:** Inline creation or editing without leaving the page (create record, edit field).
```
Dialog (not AlertDialog — that’s for destructive confirms only)
  DialogHeader (DialogTitle required, DialogDescription optional)
  DialogContent (FieldGroup, max-w-sm or md)
  DialogFooter (Cancel outline + Submit primary)
```
**Rule:** Keep forms short. >5 fields → use Sheet or a dedicated page. Always include `DialogTitle` (use `sr-only` if visually hidden).
Components: `Dialog`, `Field`, `Input`, `Select`, `Button`.

---

## Three modes (don’t mix them on one page)

| Mode | Question it answers | Where in the dev app |
|------|---------------------|----------------------|
| **Recipes** | How do I build a real screen? | `/`, `/patterns`, `/recipes/settings` |
| **Catalog** | What props/variants exist? | `/catalog` (+ Storybook) |
| **Tokens** | What are the colors, radius, type? | `/design-system` |

**Rule:** Product work starts in **Recipes**. Use **Catalog** to look up a single component. Use **Tokens** when theming.

## Start from the user’s job

```text
1. What is the one outcome on this screen?
2. What is the single primary action?
3. What can move to a secondary surface (tab, sheet, another route)?
4. Only then: pick components (HUMAN_GUIDE → one nqui-*.md).
```

## The “three surfaces” cap

Per viewport, avoid more than **three** competing regions:

1. **Chrome** — sidebar + page header (`h-12`, breadcrumbs).
2. **Primary** — table, form, editor, or dashboard focus.
3. **Secondary** — filters, TOC, inspector (collapse on small screens).

If everything is a Card, you already have too many surfaces.

## When to use a Card

| Use Card | Don’t use Card |
|----------|----------------|
| One bounded topic (“Shipping”, “Team members”) | Every control in a grid |
| A chart or table block on a dashboard | Toolbar buttons |
| Settings group with footer actions | Page-level layout |

Prefer **sections** (`border-b`, `gap-6`, `h2`) for page structure. One Card per topic, not per widget.

## Selection vs action (quick)

| Job | Component |
|-----|-----------|
| Toolbar mode (list/grid, linear/log) | **ToggleGroup** `single` |
| Multi format (bold/italic) | **ToggleGroup** `multiple` |
| Commands (save, export) | **Button** / **ButtonGroup** |
| Form choice (plan, role) | **RadioGroup** or **Select** |
| Searchable list | **Combobox** |
| Settings on/off | **Switch** |

**RadioGroup in a horizontal toolbar = wrong default** (OK in catalog to show variants).

## Forms recipe

```tsx
<FieldSet>
  <FieldLegend>Profile</FieldLegend>
  <FieldGroup className="flex flex-col gap-4 max-w-lg">
    <Field>
      <FieldLabel htmlFor="name">Name</FieldLabel>
      <Input id="name" />
      <FieldDescription>Shown on invoices.</FieldDescription>
    </Field>
    {/* … */}
  </FieldGroup>
</FieldSet>
<div className="flex gap-2 pt-4">
  <Button type="submit">Save</Button>
  <Button type="button" variant="outline">Cancel</Button>
</div>
```

Use **FieldGroup + Field**, not raw `div` + `space-y-*`. See `rules/forms.md`.

## Toolbar recipe (context-first)

```tsx
<div className="rounded-lg border border-input bg-muted/30 p-3">
  <div className="flex flex-wrap items-center gap-1">
    <ToggleGroup type="multiple" …>…</ToggleGroup>
    <Separator orientation="vertical" className="mx-2 h-5" />
    <ToggleGroup type="single" …>…</ToggleGroup>
  </div>
  <div className="mt-3 rounded border border-input/50 bg-background px-3 py-2 text-sm text-muted-foreground">
    {/* content the toolbar affects */}
  </div>
</div>
```

Reference: `/catalog` → Toggle & ToggleGroup, or `/patterns` overview.

## Page shell recipe

```text
SidebarProvider
  sticky header (h-12, --z-sticky-page)
  main (#main)
    h1 + short description
    optional Alert (one per page)
    primary region (tabs | form | table)
```

Scroll: custom main scroll container — see `README.md` → Layout & Scroll Patterns.

## Anti-patterns (busy UI)

| Anti-pattern | Fix |
|--------------|-----|
| Card grid of every component | Catalog route or Storybook |
| Fake KPI cards (12,345 users) on a reference page | Real metrics only in product demos |
| Mail-app nav for a component library | Task-based nav (Recipes / Catalog) |
| Command palette items that don’t navigate | Wire only real routes |
| `space-y-*` on flex layouts | `flex flex-col gap-*` |
| Tooltip as only label for required fields | Visible `FieldLabel` |
| Nested Cards | Section + one Card, or `calc(radius)` nesting rules |
| Raw `bg-blue-500` chrome | Semantic tokens |

## Pre-ship checklist

- [ ] One clear user goal and primary action
- [ ] ≤3 major surfaces on screen
- [ ] Toolbars in context (`bg-muted/30`), not isolated in Cards
- [ ] Forms use FieldSet + FieldGroup
- [ ] Cards only for real topics
- [ ] States: Skeleton / Empty / Alert (not placeholder lorem boxes)
- [ ] Z-index from `elevation.css` only

## Dev app map

| Route | Recipe |
|-------|--------|
| `/` | Hub — start here |
| `/patterns` | Commerce dashboard (dense product UI) |
| `/recipes/settings` | Workspace settings (forms) |
| `/catalog` | Full variant catalog |
| `/design-system` | Tokens |
