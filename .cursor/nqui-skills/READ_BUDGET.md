---
name: read-budget
description: Minimal-read routing for nqui agent tasks. Tells you which files to load (and which NOT to) for common tasks. Read this FIRST when the task is unclear — it will route you to ~1-3 files instead of bulk-reading the whole skills folder.
---

# Read Budget — load only what you need

The skills folder has ~50 files totaling ~5000 lines. Bulk reading wastes context. Use this table to load 1–3 files per task.

## Routing

| Task | Read THIS | Then maybe | Do NOT read |
|------|-----------|------------|-------------|
| **Build a new view from scratch** | `SKILL.md` (Agent Build Protocol — 10 steps) → `nqui-composition/SKILL.md` (craft) → `COMPOSITION.md` (pattern) → `RECIPES.md` (combos) | `STATES.md` (state matrix), `WRITING.md` (copy), one `components/nqui-<name>.md` per component | MOTION.md unless you're adding animation, full component README |
| **"How do I compose X?"** (status, bulk action, toolbar, loading state) | `RECIPES.md` (one numbered recipe) | The component(s) the recipe names | nqui-composition (philosophy, not needed for combo lookup) |
| **Make UI feel more Apple / refined** | `nqui-composition/SKILL.md` (three principles + hierarchy rules) | `RECIPES.md` to replace busy combos | Refinement skills — fix the composition first |
| **Make sure I've covered all states** | `STATES.md` (audit checklist) | — | nqui-composition (covered separately) |
| **Write copy / labels / error messages / empty states** | `WRITING.md` | — | nqui-composition, components |
| **Add transitions or animations** | `MOTION.md` (timing scale + easing) | The specific component's doc if it has motion-related props | All refinement skills |
| **Layered UI / nested cards / "this needs more depth"** | `ELEVATION.md` (the 2+1 rule + decision tree) | `nqui-design-system/SKILL.md` for the token names | Refinement skills until depth is right |
| **Run pre-ship review** | `SKILL.md` 30-second Linear designer test → `STATES.md` audit → `WRITING.md` audit → `MOTION.md` audit | `/audit` for technical/accessibility check | Refinement skills until the audits pass |
| **Set up an AI agent to use nqui** | `AGENT_PROMPT.md` (paste into agent system prompt) | `SKILL.md` Agent Build Protocol | Skills folder — agent will discover via routing |
| **Customize brand color / radius / palette** | `THEMING.md` | `colors.css` for the actual token names | Refinement skills, recipes |
| **Verify a release before publishing** | `EVAL.md` (run the 12-prompt eval) | `MIGRATION.md` to note breaking changes | All other skills — eval drives the priority |
| **Update consumer app after upgrade** | `MIGRATION.md` (latest section) | `THEMING.md` if customizations need re-verification | — |
| **Build auth / login / signup / OAuth / OTP / SSO** | `RECIPES.md` recipes 16-22 | One component doc per Field used | `Dialog`-related docs (auth is page-level, not modal) |
| **Choose between similar components** (Select vs Combobox, Dialog vs Sheet) | `COMPONENTS_INDEX.md` (inline decision tables) | One winner doc | Other component docs, COMPOSITION.md |
| **Fix a specific component's behavior** | `components/nqui-<name>.md` (single file) | `nqui-design-system/SKILL.md` only if sizing/spacing | `impeccable/`, refinement skills |
| **Card + ScrollArea / flex height bug** | `components/nqui-scroll-area.md` §0 (symptom routing) | §1 if §0 doesn't match | Other §, COMPOSITION.md |
| **Data table with sticky header / paging** | `nqui-data-tables/SKILL.md` | `components/nqui-scroll-area.md` §0–§6 | `nqui-table.md` (different component) |
| **Form (login, settings, checkout)** | `nqui-shadcn/rules/forms.md` | `components/nqui-field.md`, `nqui-input.md` | COMPOSITION.md form recipe is enough alone |
| **Toolbar selection (mode, format)** | `nqui-components/SKILL.md` (ToggleGroup rules section only) | `components/nqui-toggle-group.md` | `nqui-radio-group.md` (wrong default) |
| **Tabs on scrollable page (scroll jumps on click)** | `components/nqui-tabs.md` § Inline tabs | `nqui-components/SKILL.md` (InlineTabs rule) | Raw `TabsList`/`TabsTrigger` in app code |
| **Audit / review existing UI** | `audit/SKILL.md` | One specific reference IF a finding needs depth (see `impeccable/reference/INDEX.md`) | Full `impeccable/SKILL.md` if `.impeccable.md` exists |
| **Apply a refinement** (`/layout`, `/colorize`, etc.) | The specific skill `SKILL.md` | `.impeccable.md` (project context, NOT the full impeccable skill) | Other refinement skills, full `impeccable/SKILL.md` |
| **Design philosophy / anti-patterns** | `impeccable/SKILL.md` (one time, then trust it's loaded) | `impeccable/reference/<topic>.md` for one specific topic | All reference files at once |
| **Install / setup / version migration** | `nqui-install/SKILL.md` OR `nqui-local-published-toggle/SKILL.md` | — | impeccable, components |

## Rules of thumb

1. **One-and-done lookups** (component prop, when-to-use): `COMPONENTS_INDEX.md` first, then ONE file. Stop.
2. **Build tasks**: `SKILL.md` Agent Build Protocol → never deviate from its step order.
3. **Don't reload `impeccable/SKILL.md`** if the conversation has already touched a design skill — its context persists.
4. **`reference/` subdirectories** require an index — see `impeccable/reference/INDEX.md`. Do NOT bulk-read references.
5. **`.impeccable.md` in project root** is the project's design context. Refinement skills should check it, not reload the full impeccable skill.

## File-size hints (for picking the cheapest read)

- Per-component docs: typically 15–70 lines. Largest: `nqui-scroll-area.md` (175), `nqui-combobox.md` (158).
- `impeccable/SKILL.md`: ~360 lines — expensive. Load once per conversation.
- `impeccable/reference/*`: 70–195 lines each. Use the index, never all.
- `COMPOSITION.md`: ~220 lines. Contains all named layout patterns + checklist.
- Refinement skill `SKILL.md` files: typically 100–150 lines.

## Token-saving anti-patterns

- ❌ Loading `components/README.md` (large index file) when `COMPONENTS_INDEX.md` answers the question
- ❌ Bulk-reading `impeccable/reference/*` to "be thorough"
- ❌ Re-invoking `/impeccable` mid-conversation when context is already loaded
- ❌ Reading multiple refinement skills before choosing one — pick based on description
- ❌ Reading all 65 component docs to "discover" what's available — use `COMPONENTS_INDEX.md` area tables
