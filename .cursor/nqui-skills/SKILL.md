---
name: nqui
description: Hub for nqui component library skills and impeccable design skills. Use /nqui-components, /nqui-design-system, /impeccable, /audit, or specific skill names to invoke them.
---

# nqui Skills (Hub)

SSOT: `packages/nqui/docs/nqui-skills/`

Installed into `.cursor/nqui-skills/` via `npx @nqlib/nqui init-skills`.

> **Token discipline:** Before loading multiple files, read **[READ_BUDGET.md](./READ_BUDGET.md)** — it routes any task to 1–3 files. The skills folder is ~5000 lines; don't bulk-read.

---

## Agent Build Protocol

When asked to **build a new view, page, or feature**, follow this order:

1. **Load design context** — Check `.impeccable.md` in project root. If missing, run `/impeccable teach` before any design work.
2. **Understand the user's job** — One outcome, one primary action. What moves to a secondary surface? (See `nqui-composition/SKILL.md` checklist.)
3. **Pick a layout pattern** — Read `COMPOSITION.md` (named patterns: app shell, settings, dashboard, wizard, master-detail). Match the pattern to the job.
4. **Look up combos** — Read `RECIPES.md` for the specific situations you need (status pill, bulk actions, filter toolbar, the three states, etc.). Don't reinvent.
5. **Select components** — Use `HUMAN_GUIDE.md` (task → doc) and `COMPONENTS_INDEX.md` decision tables. Load one `nqui-<name>.md` per component.
6. **Apply the design system** — Load `nqui-design-system/SKILL.md` for sizing, spacing, and scroll contracts.
7. **Cover all states** — Walk `STATES.md` for every interactive surface. Empty, loading, error are mandatory.
8. **Write the copy properly** — Apply `WRITING.md` rules to every button, label, error, empty state, and toast. No "Submit", no "An error occurred", no exclamation marks.
9. **Add motion only with intent** — If you animate anything, consult `MOTION.md` for timing/easing/choreography. Default to no motion unless it serves comprehension.
10. **Build, then verify** — Run the pre-ship checklist in `COMPOSITION.md`. Run `/audit` on complex views.

**Never skip step 1.** Generic output comes from missing design context, not missing components.
**Never skip step 4** for product UI. The recipes encode lessons learned — bypassing them produces busy, AI-flavored work.
**Never skip steps 7-9.** Missing states, lazy copy, and noisy motion are the three things that make AI-built UI feel AI-built.

## The 30-second Linear designer test (mandatory before declaring done)

Before saying "this is complete," do this thought experiment:

> *If I showed this view to a senior designer at Linear, Vercel, or Things 3 — someone who builds product UI all day — what would they change in the first 30 seconds?*

The honest answer is almost always one or more of these:

1. **Hierarchy is weak** — too many same-weight elements competing
2. **Empty/loading/error states are missing** or generic
3. **Copy is lazy** — "Submit", "An error occurred", "Are you sure?"
4. **Toolbar floats** instead of sitting in a `bg-muted/30` container
5. **Multiple primary buttons** competing for attention
6. **Spacing is monotonous** — same padding everywhere, no rhythm
7. **Cards wrap everything** including things that don't need a card
8. **No keyboard navigation** — buttons but no focus styles, no shortcuts
9. **Decorative shadows / gradients** on flat elements that don't need depth
10. **Motion is missing or busy** — either no transitions at all, or too many

If you can name 2+ items from that list, the view isn't done. Fix them BEFORE asking the user. The point is to ship work that doesn't trigger any of these — not to ask the user "is this OK?" when you already know it isn't.

---

## nqui Component Library

| Skill                           | When to use                                                        |
| ------------------------------- | ------------------------------------------------------------------ |
| **nqui-composition**            | Apple-inspired craft for composing screens (clarity / deference / depth). Read before building new views. |
| **COMPOSITION.md**              | Named layout patterns, three-surface cap, anti-patterns, pre-ship checklist — read before building any view |
| **RECIPES.md**                  | Component combos for common product situations (status pill, bulk actions, the three states, etc.) |
| **STATES.md**                   | The 12-state matrix every interactive surface must cover. Mandatory checklist per view. |
| **WRITING.md**                  | UX copy rules — buttons, errors, empty states, microcopy. The differentiator between AI-built and human-built. |
| **MOTION.md**                   | Motion as a system — timing scale, easing vocabulary, choreography, reduced-motion. Read before animating anything. |
| **ELEVATION.md**                | The 2+1 surface hybrid model — cap inline nesting at 2 surfaces, use spacing for the rest. Read before any layered UI. |
| **HUMAN_GUIDE.md**              | Task → component doc routing (forms, toolbar, dashboard, overlays, states) |
| **AGENT_PROMPT.md**             | Canonical system prompt for AI agents using nqui. Reference this in your agent setup. |
| **EVAL.md**                     | 12-prompt eval set + grading rubric. Run before releases. |
| **THEMING.md**                  | Brand customization without breaking the rules. |
| **MIGRATION.md**                | Breaking changes per release. Scan before upgrading. |
| **nqui-components**             | Implementing UI, choosing components, component props and examples |
| **nqui-design-system**          | Design token conventions, spacing, Card + ScrollArea / bounded panels (see `nqui-scroll-area.md` §0)      |
| **nqui-shadcn**                 | Managing nqui components (adding, fixing, styling, composing UI)   |
| **nqui-install**                | Install, setup peers, CSS init, CLI commands                       |
| **nqui-bundle-size**            | Bundle size best practices when adding deps or creating packages   |
| **nqui-data-tables**            | TanStack/native HTML tables + ScrollArea: bounded height, sticky header, HV scroll, IO or paging |
| **nqui-local-published-toggle** | Switching between local and published @nqlib/nqui                  |

---

## Impeccable Design Skills

Design quality and anti-pattern detection. Run `/impeccable teach` first to establish design context.

| Skill          | When to use                                                                   |
| -------------- | ----------------------------------------------------------------------------- |
| **impeccable** | Build distinctive, production-grade UI; avoid AI slop aesthetics              |
| **/audit**     | Systematic quality audit (accessibility, performance, theming, anti-patterns) |
| **/polish**    | Final cleanup — normalize inconsistencies                                     |
| **/layout**    | Fix spacing, alignment, overflow, and grid issues                             |
| **/colorize**  | Fix color token usage, dark mode consistency                                  |
| **/typeset**   | Fix typography, font usage, hierarchy                                         |
| **/shape**     | Fix border-radius, shadows, spatial layout                                    |
| **/animate**   | Fix or improve animations and transitions                                     |
| **/optimize**  | Performance issues (layout thrashing, bundle size)                            |
| **/adapt**     | Responsive design fixes                                                       |
| **/clarify**   | Improve accessibility and ARIA usage                                          |
| **/bolder**    | Strengthen weak UI elements                                                   |
| **/quieter**   | Reduce visual noise and clutter                                               |
| **/delight**   | Add purposeful polish and micro-interactions                                  |
| **/distill**   | Simplify complex UI                                                           |
| **/critique**  | Heuristic-based UI review                                                     |
| **/overdrive** | Push good UI to excellent                                                     |

---

## Usage

Skills are invoked by name — e.g. `/nqui-components`, `/impeccable`, `/audit input-group`.

For component questions, always read the relevant doc first:

- `.cursor/nqui-skills/components/nqui-<name>.md` (after init-skills)
- `node_modules/@nqlib/nqui/docs/components/nqui-<name>.md` (npm install)
