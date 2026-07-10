---
name: nqui-component-docs-index
description: Token-efficient map for nqui per-component docs. Use BEFORE opening README or multiple nqui-*.md files. Tells which single file to load for a component.
---

# Component docs — load order (save tokens)

**Do not** bulk-read every file under `components/`. **Do not** load all of `README.md` unless you need full “when to use” tables.

1. **Pick one doc:** `nqui-<kebab-case>.md` for the component you are implementing (e.g. `nqui-toggle-group.md`). In this repo use **`docs/components/`**; after `init-skills` use **`.cursor/nqui-skills/components/`**.
2. **Unsure which component?** Skim **`README.md`** in that folder only for **“When to Use”** and the category table — or use **[HUMAN_GUIDE.md](./HUMAN_GUIDE.md)** (task → docs) or the **area → filenames** list below.
3. **Deep selection logic** (toolbar vs form, ToggleGroup vs RadioGroup): **`nqui-components/SKILL.md`** and **`nqui-design-system/SKILL.md`**. **Bounded data tables + ScrollArea:** **`nqui-data-tables/SKILL.md`** + **`nqui-scroll-area.md`**.

## Paths

| Where | Per-component docs | Routing / human wayfinding |
|-------|--------------------|----------------------------|
| nqui repo / package source | `docs/components/nqui-<kebab>.md` | `docs/nqui-skills/COMPONENTS_INDEX.md` · `HUMAN_GUIDE.md` |
| Consumer after `init-skills` | `.cursor/nqui-skills/components/nqui-<kebab>.md` | `.cursor/nqui-skills/COMPONENTS_INDEX.md` · `HUMAN_GUIDE.md` |
| Installed only (no init-skills) | `node_modules/@nqlib/nqui/docs/components/nqui-<kebab>.md` | `node_modules/@nqlib/nqui/docs/nqui-skills/COMPONENTS_INDEX.md` · `HUMAN_GUIDE.md` |

Filenames always: `nqui-<kebab>.md`.

## Area → doc files (open **one**)

Suffix every name with `.md` in the components folder you are using (`docs/components/` or `.cursor/nqui-skills/components/`).

**Actions & selection:** `nqui-button` · `nqui-button-group` · `nqui-toggle` · `nqui-toggle-group`

**Forms & inputs:** `nqui-input` · `nqui-textarea` · `nqui-select` · `nqui-native-select` · `nqui-checkbox` · `nqui-radio-group` · `nqui-switch` · `nqui-slider` · `nqui-rating` · `nqui-input-otp` · `nqui-field` · `nqui-combobox` · `nqui-color-picker` · `nqui-color-slider` · `nqui-label` · `nqui-input-group`

**Display:** `nqui-badge` · `nqui-avatar` · `nqui-alert` · `nqui-empty` · `nqui-skeleton` · `nqui-spinner` · `nqui-progress` · `nqui-separator` · `nqui-card` · `nqui-item` · `nqui-kbd` · `nqui-tracker` · `nqui-frosted-glass` · `nqui-logo`

**Data:** `nqui-table` · `nqui-data-table`

**Code / embed:** `nqui-code-block` · `nqui-snippet` · `nqui-code-editor` · `nqui-sandbox`

**Navigation:** `nqui-breadcrumb` · `nqui-tabs` · `nqui-dropdown-menu` · `nqui-context-menu` · `nqui-menubar` · `nqui-navigation-menu` · `nqui-pagination` · `nqui-command` · `nqui-command-palette` · `nqui-table-of-contents`

**Overlays:** `nqui-dialog` · `nqui-alert-dialog` · `nqui-drawer` · `nqui-sheet` · `nqui-popover` · `nqui-hover-card` · `nqui-tooltip` · `nqui-toaster`

**Layout:** `nqui-accordion` · `nqui-collapsible` · `nqui-scroll-area` · `nqui-aspect-ratio` · `nqui-carousel` · `nqui-resizable` · `nqui-sidebar` · `nqui-sortable`

**Advanced:** `nqui-calendar`

---

---

## Common "which component?" decisions

Use these before opening a doc. If the answer is clear, load just that one file.

### Selection input
| Situation | Use |
|-----------|-----|
| ≤6 options, known at build time, no search | `nqui-select` |
| Many options OR need search/filter | `nqui-combobox` |
| Inside a native form, progressive enhancement needed | `nqui-native-select` |
| Inline toolbar mode (list/grid, linear/log) | `nqui-toggle-group` (never RadioGroup here) |
| Stacked form options with descriptions | `nqui-radio-group` |

### Overlay / panel
| Situation | Use |
|-----------|-----|
| Focused task requiring input (create, edit) | `nqui-dialog` |
| Destructive action confirmation | `nqui-alert-dialog` |
| Side panel with details or filter controls | `nqui-sheet` |
| Mobile-first or gesture-heavy panel | `nqui-drawer` |
| Quick contextual info on click | `nqui-popover` |
| Quick info on hover (non-critical) | `nqui-hover-card` |
| Tiny label for icon-only controls | `nqui-tooltip` |

### Data display
| Situation | Use |
|-----------|-----|
| Static rows, no sorting/filtering | `nqui-table` |
| Sortable/filterable/paginated data | `nqui-data-table` (TanStack) |
| Key-value list, menu-style rows | `nqui-item` |
| Inline status tags | `nqui-badge` |
| Empty state (no data yet) | `nqui-empty` |
| Loading placeholder | `nqui-skeleton` |
| Inline feedback (warning, error, info) | `nqui-alert` |
| Transient notification | `nqui-toaster` (sonner) |

### Navigation
| Situation | Use |
|-----------|-----|
| Primary app sections | `nqui-sidebar` |
| Sub-views within a page | `nqui-tabs` |
| Page location trail | `nqui-breadcrumb` |
| Actions on right-click | `nqui-context-menu` |
| Actions on a trigger button | `nqui-dropdown-menu` |
| Power-user global search / actions | `nqui-command-palette` |

---

Full index + long-form guidance: `README.md` next to those files (large — use sections, not whole-file dump).
