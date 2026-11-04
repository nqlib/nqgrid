---
name: nqui-migration
description: Breaking changes consumers must be aware of when updating. Each entry includes what changed, why, and how to migrate. Keep this file additive — never edit historical entries, only append new ones.
---

# nqui Migration Notes

When upgrading nqui, scan the latest version section for breaking changes BEFORE running `pnpm install`. Visual regressions disguise themselves as "the new design"; they aren't.

---

## v0.6 (current) — Design system rebuild

This release applies the **2+1 elevation rule** to the token system, fixes several real bugs in color tokens, and tightens motion. Most changes are visual — runtime behavior is unchanged.

### 🔴 Breaking visual changes

#### 1. Card lost its default shadow
**What:** `.nqui-card` no longer applies `box-shadow`. Card surfaces now rely on border + background contrast for separation.

**Why:** The 2+1 elevation rule (see `ELEVATION.md`) reserves shadows for ELEVATED surfaces only (Dialog, Sheet, Popover, DropdownMenu). Inline cards with shadows produced template-y, decorative depth that competed with content.

**Migration:**
- If your app depends on Card lift, wrap with `.nqui-elevated` instead — but ask first whether you actually need elevation. Most "needs a shadow" instincts are better solved with `bg-muted/40` (surface B).
- If you have custom CSS adding shadow to Card, remove it — that's now the system default.

#### 2. Chart palette changed from 5-blues to categorical
**What:** `--chart-1` through `--chart-5` used to be 5 shades of blue (hue 251-265). Now they're distinct hues: blue / orange / green / purple / amber.

**Why:** 5 shades of blue is useless for categorical data — you can't tell series apart. The new palette is for *categorical* (different categories, different statuses). For *sequential* (ordinal intensity) data, override per the `THEMING.md` guide.

**Migration:**
- Audit any chart that depended on the old blue palette. Visualizations may look completely different now.
- If you specifically need sequential blues, override `--chart-*` in your project (see `THEMING.md` → Chart palette).
- This may shift the visual identity of dashboards — review screenshots before deploying.

#### 3. Light mode sidebar flipped direction
**What:** `--sidebar` in light mode was `oklch(0.953)` (DARKER than the `0.982` page background). Now `oklch(0.988)` (LIGHTER than page).

**Why:** macOS, Linear, Vercel all do "sidebar lighter than page" — the sidebar lifts forward. Dark mode already did this. Light mode was inverted. Now they match.

**Migration:**
- Sidebar will look subtly different — lighter, more lifted. Verify your custom sidebar content still has enough contrast.
- `--sidebar-accent` and `--sidebar-border` also adjusted to remain visible against the lighter sidebar.

#### 4. Accent token darker in light mode
**What:** `--accent` was `oklch(0.895)`, lighter than `--muted` (`0.914`). Now `oklch(0.880)`, properly darker for hover/selection contrast.

**Why:** Real bug — accent was LIGHTER than the muted surface, so hover states *reduced* contrast instead of increasing it. Now hover is properly visible.

**Migration:**
- Hover and selection states on Items, list rows, etc. will appear darker than before. This is correct behavior. Don't override back to the old value.

#### 5. Warning hue shifted (65 → 80)
**What:** Warning was OKLCH hue 65 (olive/khaki, despite the comment claiming "orange"). Now hue 80 (true amber).

**Why:** Bug. Warning badges and alerts looked slightly sickly. Now they read as amber/warning.

**Migration:**
- Visual shift, no API change. Verify warning states still read as intended in your theme.

#### 6. Success hue shifted (142 → 135)
**What:** Subtle 7° hue shift to harmonize with warm-paper background.

**Why:** Hue 142 was cool emerald — clashed with the warm light-mode palette. Hue 135 is a slightly warmer green that fits.

**Migration:**
- Subtle. Existing green badges will look very slightly warmer. No action needed unless you've customized success colors.

#### 7. Dark mode border softened (0.34 → 0.27)
**What:** `--border` in dark mode was `oklch(0.34)` (drawn lines). Now `oklch(0.27)` (subtle folds).

**Why:** Match Linear / Vercel dark-mode convention. Borders should read as "where surfaces meet," not as drawn lines.

**Migration:**
- Dark mode borders will be more subtle. Verify forms and panels still have enough definition. If a specific surface NEEDS a stronger border, opt in per-component.

#### 8. Semantic foreground tokens aligned with `--foreground`
**What:** `--primary-foreground`, `--success-foreground`, `--destructive-foreground`, etc. were all `oklch(0.98)` (near-pure white). Now `oklch(0.92)` (matching the global softened foreground).

**Why:** Eye-strain consistency. 0.98 white on saturated backgrounds was harsh.

**Migration:**
- Text on colored buttons (primary/destructive/success) is now slightly softer. If contrast looks too low against a custom brand color, re-verify per `THEMING.md` checklist.

#### 9. Tooltip z-index corrected (9998 → 70)
**What:** `--z-tooltip` was `9998` (extreme value, fighting other systems). Now `70` (matches documented scale).

**Why:** Was a patch that never got reconciled. The actual stacking scale documents tooltip at 70.

**Migration:**
- If you have custom z-index values above 70 that depended on tooltip being at 9998 to overlay them, they will now incorrectly cover tooltips. Refactor to use the `--z-*` semantic scale.

#### 10. Motion: checkbox bounce removed
**What:** Checkbox `transition` was `cubic-bezier(0.68, -0.55, 0.265, 1.55)` (elastic overshoot). Now standard ease-out.

**Why:** Elastic/overshoot curves are explicitly banned per `MOTION.md`. They feel dated and AI-flavored.

**Migration:**
- Checkboxes now snap rather than bounce. This is intentional. If you preferred the bounce, you preferred the wrong thing.

### 🟠 Internal restructuring (no API change, may affect overrides)

- `src/styles/elevation.css` renamed to `src/styles/z-index.css` — the file is z-index tokens only, not surface depth. Elevation now lives in `ELEVATION.md` (philosophy) + `shadows.css` (shadow tokens).
- New file `src/styles/motion.css` — duration + easing tokens + `prefers-reduced-motion` media query.
- New file `src/styles/shadows.css` — `--shadow-elevated`, `--shadow-modal`, `--shadow-focus` tokens.
- New semantic surface aliases: `--surface-a`, `--surface-b`, `--surface-elevated` (alias the existing `--background`, `--muted`, `--popover`).
- `--popover` is now `var(--card)` (was a duplicated value pretending to be a separate token).
- Sheet transitions changed from `duration-500`/`duration-300` to `duration-250`/`duration-200` for tighter feel.
- Navigation menu chevron animation: `duration-300` → `duration-200`.
- Enhanced progress bar: `duration-300` → `duration-200`.

### ✅ Additive (not breaking)

- New skill: `nqui-composition/SKILL.md` — Apple-inspired craft principles.
- New skill docs: `RECIPES.md`, `STATES.md`, `WRITING.md`, `MOTION.md`, `ELEVATION.md`, `READ_BUDGET.md`, `AGENT_PROMPT.md`, `EVAL.md`, `THEMING.md`, `MIGRATION.md` (this file).
- New showcase routes: `/recipes/tracker`, `/recipes/elevation`.
- Updated `SKILL.md` Agent Build Protocol (now 10 steps, plus the "30-second Linear designer test").

### Recommended migration path

1. **Read the breaking changes above.** Identify which apply to your app.
2. **Run your visual regression suite** if you have one. (If you don't — this release is a good reason to set one up.)
3. **Audit chart-using pages first** — palette change is the most visible.
4. **Audit Card-using pages** — shadow removal may reveal places that depended on lift.
5. **Verify dark mode** — multiple dark token changes, easier to miss than light.
6. **Run the eval** (see `EVAL.md`) against your most important pages — make sure the kit still produces good output for your common patterns.

---

## Earlier versions

(Append entries for prior versions above this line, newest first, as future releases land.)
