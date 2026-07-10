---
name: nqui-composition
description: Compose nqui components into calm, product-quality screens. Use when building pages, layouts, or flows — not when looking up a single component's props. Apple-inspired craft (clarity, deference, depth). Pair with COMPOSITION.md patterns and RECIPES.md combos. Invoke before nqui-components for new views.
---

# nqui Composition — Apple-inspired Craft

This skill is for **putting components together**, not for picking variants of one component (that's `nqui-components`). Read this *before* writing JSX for a new view. The goal is to make screens that feel deliberate, calm, and trustworthy — not busy, generic, or AI-flavored.

## Three Apple principles, translated to nqui

These come from Apple's Human Interface Guidelines but applied concretely to React + Tailwind component work.

### 1. Clarity — content leads, chrome defers

Everything on screen exists to serve the content. If chrome (borders, shadows, decorative panels, hover effects) competes with the content, the chrome loses.

**Apply it:**
- One typeface for UI text. Use weight and size for hierarchy, not extra families.
- Borders are 1px and use `border-border` (subtle), never a 2-3px decorative accent.
- The most prominent thing on screen should be the user's content, not the navigation.
- Color is scarce. One accent (`primary`), one each for success/warning/error semantic tokens. That's it.
- Icons are 16-20px in product UI. Bigger only when they ARE the content (empty states, hero illustrations).

**Don't:**
- Wrap every region in a Card "to give it structure" — structure comes from spacing and type, not from boxes.
- Use multiple competing accent colors. A second "look at me" color cannibalizes the first.
- Set body text below 14px or above 16px in product UI.

### 2. Deference — UI yields to data

The interface should disappear once the user understands it. After the first second, the user should be looking at *their stuff*, not at *your buttons*.

**Apply it:**
- Toolbars sit in `bg-muted/30` containers, not floating on `bg-background` (a floating toolbar is louder than the content below it).
- Secondary actions are `variant="ghost"` or `variant="outline"`. Never two primaries.
- Filter chips and segmented controls use the subtlest treatment that still reads — `bg-muted` for off-state, `bg-accent` for on-state, no shadows.
- Empty states are quiet. A small icon, one sentence, one action. Not a marketing illustration.
- Loading states (`Skeleton`) match the shape of the content they replace — not a generic spinner that demands attention.

**Don't:**
- Animate everything. Motion that doesn't serve comprehension is noise.
- Apply `shadow-lg` to flat surfaces. Shadows imply elevation; on a flat element they read as decoration, not affordance.
- Use `font-bold` on labels, metadata, or supporting text. Bold is for the thing the user came to read.

### 3. Depth — layers must mean something

Apple uses depth (translucency, layering, motion) to signal hierarchy: which surface is closer, which is further, what's modal vs ambient. nqui uses the same logic with `z-index` tokens and surface backgrounds.

**Apply it:**
- Z-index comes from `elevation.css` semantic tokens (`--z-sticky-page`, `--z-modal`, `--z-popover`). Never raw numbers.
- Three-layer surface logic in master-detail or split views: outer wrapper (`bg-muted/20`), panels (`bg-background`), inside cards or selected items (`bg-accent/70`). The contrast IS the separation.
- Modals, sheets, and popovers cast subtle shadows because they're physically "above" the page. Inline cards don't, because they're flat.
- Motion conveys depth: a Sheet slides in from the edge (it came from outside), a Dialog fades + scales (it appeared in place).

**Don't:**
- Use `backdrop-blur` on inline content (it's a depth signal — reserve for overlays and sticky headers over scroll).
- Nest cards inside cards. If you need a sub-region, use spacing and a `Separator`, not another bordered box.
- Apply z-index tokens for ordering elements that aren't elevated — they cause stacking-context bugs.

## The composition checklist (run before writing JSX)

1. **What is the one outcome on this screen?** Write it down in five words.
2. **What is the single primary action?** Everything else is secondary.
3. **What can move off this view?** A sheet, a route, a hover card, an "advanced" section.
4. **How many surfaces?** Cap at three (chrome + primary + optional secondary). If you have more, you have too many.
5. **What is the canonical empty state?** What is the loading state? What is the error state? Skip this and the UI will leak placeholder lorem text.
6. **What's the responsive breakdown?** Below what container width does this collapse to a single column / Sheet?

If you can't answer all six in under a minute, you don't understand the screen yet. Don't start coding.

## Decision rules baked in

These are not stylistic suggestions — they are rules:

| Situation | Rule |
|-----------|------|
| Inline selection (mode, format, view-type) | `ToggleGroup`, never `RadioGroup` |
| Form with >5 fields | Use `Sheet` or a dedicated route, never a `Dialog` |
| Destructive confirm | `AlertDialog`, never `Dialog` |
| Master-detail under ~900px container width | Switch detail to `Sheet`, don't shrink both panels |
| Status indicator | `Badge` (or a 6-8px colored dot), never `border-left: 4px` stripe |
| Loading | `Skeleton` shaped like the content, not a `Spinner` |
| Empty | `Empty` component, not a stylized div |
| Toolbar | `bg-muted/30` container with internal `Separator` for groups |
| Page chrome height | `h-12` (48px) — for header bars and section headers |
| Default control size | `sm` for dense product UI, `default` for marketing/forms |

## Hierarchy without dependence on color

Apple's interfaces look intentional largely because they get hierarchy from **type weight, size, spacing, and proximity** before reaching for color. nqui defaults support this:

- **Most important**: `text-base font-semibold text-foreground` (or `text-lg`/`text-xl` for page H1)
- **Standard reading**: `text-sm text-foreground`
- **Supporting / metadata**: `text-xs text-muted-foreground` or `text-sm text-muted-foreground`
- **Labels / categories**: `text-xs uppercase tracking-wider text-muted-foreground font-semibold`
- **Numeric data**: add `tabular-nums` so numbers align

Spacing rhythm: 8 → 12 → 16 → 24 → 32 → 48. Tight inside related groups (8-12), generous between sections (24-48). The variation IS the hierarchy.

## Elevation — the 2+1 surface rule

**Cap inline nesting at 2 surfaces.** Past that, spacing + type weight + occasional Separator carry the hierarchy. One additional `surface-elevated` is reserved for overlays (modals, sheets, popovers). This is the entire elevation system — see `../ELEVATION.md` for the full rule + decision tree.

| Depth | Carrier |
|-------|---------|
| Page → card | Surface flip (A → B) |
| Card → sub-section | Spacing + uppercase label, NOT a new shade |
| Section → sub-detail | More spacing + type weight, NOT a new shade |
| Modal over content | `surface-elevated` (the only legitimate third) |

**When tempted to add a third inline surface:** more space, a stronger label, or move it to a sheet/route. Never a new shade.

## Surface vocabulary (when to use which container)

| Surface | When | Avoid for |
|---------|------|-----------|
| `Card` | Bounded topic with its own title (Team members, Shipping address, Chart) | A single button, a filter chip, page-level layout |
| `Item` (ghost variant) | A row in a list — issue, file, message, contact | Standalone content blocks |
| `Item` (outline variant) | A row that needs to read as a tappable card | Lists where rows share a topic and proximity already groups them |
| `Sheet` | Side panel for filters, detail view, inline forms | Confirmations, single-input prompts |
| `Dialog` | Focused task requiring input (create record, edit small form) | Anything destructive |
| `AlertDialog` | Destructive or irreversible confirmation only | Informational alerts |
| `Popover` | Quick contextual content tied to a trigger element | Long content, anything with its own scroll |
| `Drawer` | Mobile-first bottom sheet (gesture-heavy) | Desktop primary patterns |
| `HoverCard` | Optional preview information on hover (link preview, user card) | Anything critical to the task |

## What "Apple-quality" actually looks like in practice

The shorthand "make it look like Apple" usually means three things, in order:

1. **More space than you think you need.** Padding is generosity. Cramped UIs read as cheap.
2. **Fewer styles, applied more consistently.** Two button variants used everywhere beat six used inconsistently.
3. **Honest materials.** Glass surfaces over scroll. Solid surfaces in flat regions. Shadows for things that are physically above. Don't mix metaphors.

If you reach for `shadow-2xl`, `bg-gradient-to-br`, `backdrop-blur`, or a fourth typeface — stop and revisit. None of those are necessary for a screen to look refined. Restraint is the technique.

## Files to load next

| Need | Open |
|------|------|
| A blueprint for the screen type (settings, dashboard, master-detail, wizard, command, dialog) | `../COMPOSITION.md` |
| Combos: "I need to do X, what components together?" | `../RECIPES.md` |
| Specific component props/variants | `../components/nqui-<name>.md` |
| Sizing, spacing tokens, scroll patterns | `../nqui-design-system/SKILL.md` |
| Brand voice / typography / color depth | `../impeccable/SKILL.md` (one time per conversation) |

Do not bulk-read. See `../READ_BUDGET.md`.
