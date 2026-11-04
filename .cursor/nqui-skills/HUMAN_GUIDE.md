# nqui — task → docs (for designers & humans)

Use this file for **wayfinding** before diving into `README.md` (long) or dozens of `nqui-*.md` files. Paths below are from the **nqui package**; after `npx @nqlib/nqui init-skills`, the same files live under **`.cursor/nqui-skills/components/`**.

## Composition first (product UI)

**Read:** [`COMPOSITION.md`](./COMPOSITION.md) — when to use Card, ToggleGroup vs RadioGroup, three-surface cap, anti-patterns.

**Dev app (`npm run dev` in `packages/nqui`):**

| Route | Purpose |
|-------|---------|
| `/` | **Recipes hub** — start here |
| `/patterns` | Commerce dashboard recipe |
| `/recipes/settings` | Settings form recipe |
| `/catalog` | Component variant catalog |
| `/design-system` | Tokens |

Do **not** learn layout from the catalog alone — it is API reference, not composition guidance.

---

| I’m building… | Start here | Then open |
|---------------|------------|-----------|
| **Forms** (login, settings, checkout) | `docs/components/README.md` → Forms sections | One of `nqui-field.md`, `nqui-input.md`, `nqui-select.md`, `nqui-combobox.md`, … |
| **Toolbar / editor** (bold, view mode, align) | `nqui-skills/nqui-components/SKILL.md` (ToggleGroup rules) | `nqui-toggle-group.md`, `nqui-button-group.md` |
| **“Choose one” in a form** (stacked options, survey) | **RadioGroup** may be correct — see `nqui-components/SKILL.md` vs ToggleGroup | `nqui-radio-group.md` |
| **Dashboard / cards / lists** | `README.md` → Display | `nqui-card.md`, `nqui-item.md`, `nqui-table.md` or `nqui-data-table.md` |
| **Empty / loading / error** | Skeleton + Empty + Alert | `nqui-skeleton.md`, `nqui-empty.md`, `nqui-alert.md` |
| **Confirm destructive action** | Modal pattern | `nqui-alert-dialog.md` |
| **Navigation** | `README.md` → Navigation | `nqui-tabs.md`, `nqui-breadcrumb.md`, `nqui-sidebar.md`, … |
| **Touch-heavy or mobile** | Prefer **default/lg** controls; avoid **only** hover for critical info | `nqui-tooltip.md` (hover limits), `nqui-components/SKILL.md` (hit area) |

**Cross-cutting UX**

- **Accessibility:** Prefer components’ built-in Radix semantics; **don’t** put required instructions only in **Tooltip** (see `nqui-tooltip.md`). See `nqui-shadcn/SKILL.md` + rules for forms and dialogs.
- **States:** **Loading** → Skeleton / Spinner; **empty** → Empty; **error** → Field + Alert + validation patterns in `nqui-shadcn/rules/forms.md`.

**Agents:** For token-efficient routing, use **`COMPONENTS_INDEX.md`** first, then **one** `nqui-<name>.md`.
