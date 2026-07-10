---
name: nqui-theming
description: How to customize nqui's brand color, density, radius, and dark/light tokens without breaking the design rules. Use when a consumer asks "how do I make nqui match my brand?" or when adding a custom theme.
---

# nqui Theming — Brand Customization Without Breaking the Rules

nqui's defaults are opinionated. They are NOT the limit of what the kit can look like. This file is how you customize the kit while keeping the design rules (elevation, motion, hierarchy) intact.

## What you can change (safely)

| Token group | Where | Safe to override |
|-------------|-------|------------------|
| **Brand color** | `--primary-*` scale + `--primary` mapping | ✅ Full hue/chroma shift |
| **Radius scale** | `--radius` (base) | ✅ Affects all radius tokens |
| **Density** (control sizes) | `nqui-design-system/SKILL.md` size scale | ✅ via prop, NOT by changing token sizes |
| **Dark/light surface lightness** | `--background`, `--muted`, `--popover` | ✅ Within the 2+1 rule constraints |
| **Foreground softness** | `--foreground` (dark mode soft 0.92) | ✅ Per brand preference |
| **Sidebar direction** | `--sidebar` | ⚠️ Pick one direction for both modes |
| **Border weight** | `--border` lightness | ✅ Subtle adjustments |
| **Chart palette** | `--chart-1` through `--chart-5` | ✅ Categorical or sequential — your call |

## What you CANNOT change without breaking the philosophy

| Token | Why locked |
|-------|------------|
| **Surface count** (2+1 inline + 1 elevated) | Adding a `--surface-c` defeats `ELEVATION.md`'s entire premise |
| **Z-index scale** (`--z-*`) | Stacking conflicts cascade. Keep the semantic scale. |
| **Motion principle** (default: no motion, restrained when present) | Adding default transitions to everything = busy UI |
| **Shadow philosophy** (only on elevated surfaces) | Inline shadows turn flat surfaces into decorative noise |
| **The decision rules** (ToggleGroup vs RadioGroup, Dialog vs AlertDialog) | These are semantic, not aesthetic. Locked. |

If your brand "needs" a third surface or default shadows on cards, the brand expression should happen via **color + typography + radius**, not by relaxing the rules.

---

## How to override safely

### Brand color (the most common ask)

Override the primary scale in your app's CSS, after nqui's import:

```css
@import "@nqlib/nqui/index.css";

:root {
  /* Replace nqui's blue (hue 240) with your brand hue */
  --primary-100: oklch(0.655 0.11 30);   /* your hue */
  --primary-200: oklch(0.655 0.135 30);
  --primary-300: oklch(0.655 0.155 30);
  --primary-400: oklch(0.655 0.172 30);
  --primary-500: oklch(0.605 0.215 30);
  --primary-600: oklch(0.575 0.238 30);
  --ring: var(--primary-500);
}

.dark {
  --primary-100: oklch(0.30 0.14 30);
  --primary-200: oklch(0.34 0.165 30);
  --primary-300: oklch(0.385 0.185 30);
  --primary-400: oklch(0.435 0.198 30);
  --primary-500: oklch(0.515 0.168 30);
  --primary-600: oklch(0.565 0.185 30);
}
```

**Rules for picking your brand hue:**
- One hue. Don't override into two hues alternating — that breaks the focus + selection consistency.
- Match the L (lightness) values of nqui's defaults to keep contrast guarantees.
- OKLCH only — don't mix HSL/RGB here.

### Radius (rounder or sharper)

Change the single base — the scale derives from it:

```css
:root {
  --radius: 0.25rem;   /* sharper — closer to Stripe/GitHub */
  /* OR */
  --radius: 0.75rem;   /* rounder — closer to Vercel/Linear */
}
```

`--radius-sm/md/lg/xl/2xl` automatically follow.

### Density (compact vs comfortable)

**Don't change the token sizes** (h-6/h-7/h-8 are the design system contract). Instead, **default to a different size globally** via your component wrappers OR pass `size="sm"` as the project convention.

For an ultra-compact app: build a tiny `<UiProvider>` that defaults all interactive components to `size="sm"`. For a comfortable app, use defaults.

### Surface palette (warm paper vs cool gray vs pure)

```css
:root {
  /* Cool gray (instead of warm paper) */
  --background: oklch(0.985 0.002 250);   /* hue 250 = cool, instead of 95 warm */
  --muted: oklch(0.92 0.003 250);
  --border: oklch(0.89 0.004 250);
}
```

When you change the bg hue, **shift the semantic colors with it**:
- success hue 135 → maybe 130 (closer to cool palette)
- warning hue 80 → keep
- destructive hue 25 → maybe 20
- info hue 200 → keep or cut

See `colors.css` for the full set.

### Chart palette

Default is **categorical** (5 distinct hues). If your product visualizes ordinal data instead (severity, intensity), override with shades of primary:

```css
:root {
  /* Sequential (intensity gradient) — use for ordinal data */
  --chart-1: oklch(0.85 0.10 240);   /* lightest blue */
  --chart-2: oklch(0.75 0.14 240);
  --chart-3: oklch(0.65 0.18 240);
  --chart-4: oklch(0.55 0.22 240);
  --chart-5: oklch(0.45 0.25 240);   /* deepest blue */
}
```

Document which type your project uses so consumers don't mix them.

---

## Theme audit before shipping

Before publishing a custom-themed nqui app:

- [ ] Contrast check: `--foreground` on `--background` ≥ 4.5:1 (AA), `--muted-foreground` on `--muted` ≥ 4.5:1
- [ ] Hover state visible: `--accent` clearly distinct from `--muted` AND `--border`
- [ ] Focus ring visible: `--ring` clearly visible on `--background` and `--muted`
- [ ] Primary button readable: `--primary-foreground` on `--primary` ≥ 4.5:1
- [ ] Destructive button readable: `--destructive-foreground` on `--destructive` ≥ 4.5:1
- [ ] Dark mode flipped: every check above passes in `.dark` too
- [ ] Sidebar direction consistent: same relative-to-page direction in both modes
- [ ] Chart palette appropriate: categorical for categories, sequential for intensity — not mixed

Run `/audit` (or whatever your eval is) after the theme is in place.

---

## Common branding requests + the nqui-friendly answer

| Request | Nqui-friendly answer |
|---------|----------------------|
| "Make it more colorful" | Use brand color in MORE places (active states, badges, accents) — don't add MORE colors |
| "Make cards stand out more" | More space + uppercase labels. Not shadow + border + hue shift. |
| "Make it feel premium" | Larger spacing scale, smaller font sizes, single restrained accent. NOT more flair. |
| "Make it more playful" | Rounder radius (`--radius: 0.75rem`), warmer hue, slightly more saturated accent. NOT bouncy motion. |
| "Make it feel like Linear / Notion / Stripe" | Pick ONE; study their actual choices (hue, density, surface use). Don't try to be all three. |
| "Add brand gradient backgrounds" | No. nqui doesn't do decorative gradients. If you need brand expression on a marketing page, do it there, not in product UI. |

---

## What NOT to do when theming

- ❌ Override component CSS directly (`button.nqui-button { background: red; }`). Use tokens.
- ❌ Add new surface tokens beyond the 3 (`--surface-d` etc.)
- ❌ Add default shadows to Card / Input / Button
- ❌ Replace `var(--radius-*)` with hardcoded `border-radius: 12px` in component overrides
- ❌ Add motion (transitions, animations) that wasn't there by default
- ❌ Override the focus ring to be invisible "for design" — accessibility violation
- ❌ Use `!important` to fight component styles — there's a better way (tokens or composition)

If you're tempted to do any of the above, the kit isn't right for your use case. That's fine — fork or use a different kit. Don't bend nqui out of shape.

---

## Building a theme variant pack

If you want a true alternative theme (e.g., "Brand A theme" / "Brand B theme"), structure as:

```
your-app/themes/
├── brand-a.css       /* :root + .dark overrides */
├── brand-b.css
└── default.css       /* explicit default */
```

Load one at a time via `<link>` swap or `@import` based on environment. Don't try to ship all themes in one CSS file — token cascades get unpredictable.

---

## Tracking customizations

Document every token your team overrides in a `THEME_OVERRIDES.md` in your project. Future engineers (and AI agents) need to know WHY a token is overridden, not just WHAT.

Example:
```md
## THEME_OVERRIDES

- `--primary-*`: hue 30 (orange) — match brand identity
- `--radius`: 0.25rem — sharper, more "fintech" feel
- `--background`: cool gray hue 250 — better contrast with brand orange
- `--info`: removed (we don't use info semantically)
```

This is what makes a customized nqui maintainable.
