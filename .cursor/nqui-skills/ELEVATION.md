---
name: nqui-elevation
description: The 2-surface + spacing hybrid model for elevation. Caps inline nesting at 2 surfaces; past that, spacing + type weight do the work. One additional "elevated" surface reserved for modals/popovers/sheets. Read before designing any layered UI.
---

# nqui Elevation — The 2+1 Surface Hybrid

The single most consequential design-system decision is **how you express elevation** (this-is-deeper-than-that). nqui's answer is the **hybrid model**: 2 alternating inline surfaces + 1 elevated surface for overlays + spacing for everything else.

This file is the rule. Apply it to every layered UI.

## The model in one diagram

```
┌─ Surface A (page) ──────────────────────────────┐
│                                                 │
│  ┌─ Surface B (card) ─────────────────────────┐ │
│  │                                            │ │
│  │   Section title (uppercase label)          │ │
│  │   ──spacing--                              │ │
│  │   Section content                          │ │
│  │                                            │ │
│  │   ────── Separator (optional) ──────       │ │
│  │                                            │ │
│  │   Another section                          │ │
│  │   ──spacing--                              │ │
│  │   Sub-detail (indent + smaller text)       │ │
│  │                                            │ │
│  │   ⛔ NO third nested surface                │ │
│  │                                            │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘

      ┌─ Surface Elevated (modal / popover) ─┐
      │   Only for overlays, never inline.   │
      └──────────────────────────────────────┘
```

## The 3 tokens (and only 3)

| Token | Tailwind class | When to use |
|-------|---------------|-------------|
| `surface-a` | `bg-background` | Page background, alternates with B |
| `surface-b` | `bg-muted/40` (or `bg-muted/30` for a subtler step) | Cards, panels, regions that need to read as a distinct topic |
| `surface-elevated` | `bg-popover` + `shadow-lg` | Modals, sheets, popovers, dropdowns — anything physically "above" the page |

**These are the only legitimate inline surface tokens.** If you find yourself wanting a fourth, the answer is *not* a new shade — the answer is more spacing, a stronger label, or a different layout.

## The depth rule

**Maximum 2 inline surfaces. Period.**

| Depth | Carrier | Example |
|-------|---------|---------|
| Page → card | Surface flip (A → B) | Page is `bg-background`, card is `bg-muted/40` |
| Inside card → sub-section | **Spacing only** (`gap-6` between sections + uppercase label) | No new surface. `<h3 className="text-xs uppercase tracking-wider">Section</h3>` + content |
| Section → detail group | **Spacing only** (`gap-4`) or one horizontal `Separator` | No new surface |
| Sub-detail | **Type weight + indentation** | `text-sm` → `text-xs text-muted-foreground` |
| Modal over content | `surface-elevated` (the ONLY third allowed) | `Dialog`, `Sheet`, `Popover` |

## When you want a third inline surface — the decision tree

You almost never want this. When the impulse hits, walk this tree:

1. **Is this a genuinely separate topic from its parent?**
   - **No** → use spacing + a label. (Most cases land here.)
   - **Yes** → continue.

2. **Could this content move to its own route, sheet, or popover?**
   - **Yes** → move it. The hierarchy will be cleaner.
   - **No** → continue.

3. **Does this content benefit from being closed by default?**
   - **Yes** → use `Accordion` or `Collapsible`. The closed state IS the separation; no surface needed.
   - **No** → continue.

4. **Are you building a stacked-modal or genuinely physical depth metaphor?**
   - **Yes** → use `surface-elevated`. This is the legitimate exception.
   - **No** → STOP. Flatten. Your hierarchy is over-engineered.

## What spacing/typography do instead of color

The discipline is: **make spacing, weight, and indentation do the work that color was doing**. The hierarchy is preserved; it just expresses through different signals.

| Old (color-based) | New (space + type) |
|-------------------|-------------------|
| Nested card with `bg-muted/60` | `<section className="mt-6"><h3 className="text-xs uppercase">Title</h3>...</section>` |
| Card-inside-card with border | Outer card + horizontal `Separator` between sections |
| Three-color metadata strip | One surface, columns laid out with `gap-6`, label text in muted color |
| Deep nested settings groups | `<FieldSet>` with `<FieldLegend>` — no extra surface |

**Spacing scale to use as the hierarchy signal:**
- `gap-2` (8px) — within a row, between tight related elements (label + value)
- `gap-4` (16px) — between fields in a form, between cards in a grid
- `gap-6` (24px) — between sub-sections within a single surface
- `gap-8` (32px) — between major sections within a surface
- `gap-12` (48px) — between top-level page regions

The *variation* of spacing IS the hierarchy. Don't make everything the same gap.

## When continuous (5-shade) elevation is the right call

This rule has principled exceptions. Continuous is correct when:

1. **Stacked modals** — modal opening from modal. Each must feel physically above. (iOS does this; macOS does this.)
2. **Bloomberg-class data UIs** — when you genuinely have 4+ semantic depth levels and density is the dominant design constraint. Most products don't have this.
3. **File-system metaphors** — where depth IS the content (Finder columns, tree views with visualized hierarchy).

If your screen isn't one of these three, you don't need continuous.

## Mode 3: Single-surface refinement (not just an "exception")

The most refined surface model: ONE inline surface (`bg-background`) for everything — page, sidebar, header, content — with structure carried entirely by spacing, type weight, and the occasional uppercase label. The `bg-popover` overlay surface (Mode 2's "+1") still exists for modals/sheets/popovers, but inline surfaces collapse to a single canvas.

This is **not a rare special case** — it's a deliberate mode used by a meaningful slice of modern product / docs UIs. Recognize it as the third recognized model alongside continuous and 2+1 hybrid.

### When single-surface is the right mode

1. **Focus-mode editors** — iA Writer, Apple Notes detail, Things 3 task detail. Sustained-attention contexts.
2. **Reading views** — long-form text, documentation, blog posts, changelogs.
3. **Marketing / landing pages** — Linear's homepage, Vercel's docs, Boneyard's overview. One canvas, generous space, type does all the hierarchy.
4. **Docs sites** — Stripe docs, Tailwind docs. Content > chrome.
5. **Content-first apps** — note-taking, journaling, writing tools. The reader/writer needs uninterrupted visual flow.
6. **Single-concept product surfaces** — a page that does one thing, deeply, without branching sub-regions.

### How structure works without surfaces

Without surface contrast, hierarchy comes from:
- **Spacing rhythm** — vary gaps deliberately (gap-2 within a row, gap-6 between sections, gap-12 between major regions). Variation IS the structure.
- **Type weight + size** — bold display headlines, regular body, muted secondary text. A 3-step type ladder replaces 3 surfaces.
- **Uppercase labels** — `text-xs uppercase tracking-wider text-muted-foreground` to mark sections without drawing boxes around them.
- **Active-nav indicator as an inset bar** — not `bg-accent` pill. See `RECIPES.md` #23 "Active nav indicator."
- **One bordered/contained element per page** at most — the place that genuinely needs to feel "lifted" (a callout, a code block, a primary action area).

### Trade-offs (be honest about them)

| Use single-surface when… | Use 2+1 hybrid when… |
|--------------------------|----------------------|
| The page has ONE primary content stream | The page has SEPARATE sub-regions that need to feel like distinct topics (e.g. a card grid of metrics) |
| Reading/writing/scanning content is the task | Navigating between distinct workspaces / tools / lists is the task |
| Density is moderate-to-low | Density is high (data tables, kanban boards, dashboards) |
| The product personality is calm/editorial | The product personality is operational/dense |

### Anti-pattern within single-surface mode

The biggest failure mode: removing surfaces but keeping every horizontal divider. You then have NO surface contrast AND a stack of `border-b` lines, which reads as "broken" not "refined." Either commit to surfaces+borders (2+1) or commit to single-surface+spacing — don't mix.

## Anti-patterns this rule eliminates

| ❌ Old pattern | ✅ Hybrid pattern |
|---------------|-------------------|
| `<Card><Card><Card>...</Card></Card></Card>` (nested) | Outer Card → sections separated by `gap-6` + label, no inner cards |
| 5-token elevation scale (`bg-1` through `bg-5`) | 2 alternating + 1 elevated, total 3 tokens |
| "Slightly darker shade for the sub-region" | More space, uppercase label, no shade |
| `border-l-4 border-accent` on a sub-section | Uppercase label + spacing |
| `shadow-md` on a flat inline card | No shadow — shadows are for elevated surfaces only |
| `bg-muted/20` inside `bg-muted/40` inside `bg-background` | `bg-background` (A) → `bg-muted/40` (B) → spacing for the third level |

## The check before shipping any layered UI

Walk the screen from outside in. Count surface changes.

- [ ] Did I use more than 2 distinct inline surface colors? If yes, collapse to 2.
- [ ] Did I nest a card inside a card inside a card? If yes, flatten one level.
- [ ] Did I add a shade just because "this section needed to feel distinct"? If yes, use spacing + label instead.
- [ ] Is my elevated surface (Modal/Sheet/Popover) using `shadow-lg` + `bg-popover`? If not, fix.
- [ ] Are my section gaps varied (some `gap-4`, some `gap-6`, some `gap-8`)? If everything is the same, the hierarchy is monotonous.

## Why this works (the principle)

Color is a heavy signal. The eye uses it for category ("this is selected", "this is destructive", "this is a warning"). When you use color to signal **depth**, you're spending a category-signaling slot on a hierarchy job that spacing handles for free.

The hybrid model frees color to do what color is best at:
- Brand/accent: one primary
- Semantic: success / warning / error
- State: selected / hover / focus

And spacing does what spacing is best at: rhythm, grouping, breathing room — which is what makes UI feel calm and intentional.

This is why Linear, Things 3, Apple Notes feel different from Material Design dashboards. Not because they have prettier colors. Because they spent fewer signals on hierarchy, leaving more bandwidth for the content.
