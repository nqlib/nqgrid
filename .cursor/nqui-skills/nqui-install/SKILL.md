---
name: nqui-install
description: Install and setup @nqlib/nqui. Use when the user wants to install nqui, set up a project, fix missing peers, or run setup commands. Execute these commands in the consumer project root.
---

# nqui Install & Setup

**When to load:** User asks to install nqui, set up a new project, fix "module not found" or missing peer deps, or run setup.

**Action:** Run the relevant command(s) below in the **consumer project root**, in order when doing full setup.

## 1. Install nqui + peers

**Minimal (icons only):**

```bash
pnpm add @nqlib/nqui @hugeicons/react @hugeicons/core-free-icons
```

(npm: `npm install @nqlib/nqui @hugeicons/react @hugeicons/core-free-icons`)

**Full (all optional components):**

```bash
npx @nqlib/nqui install-peers
```

Or manually:

```bash
pnpm add @nqlib/nqui @hugeicons/react @hugeicons/core-free-icons cmdk @dnd-kit/core @dnd-kit/modifiers @dnd-kit/sortable @dnd-kit/utilities embla-carousel-react @tanstack/react-table react-day-picker date-fns sonner vaul react-resizable-panels
```

## 2. Setup CSS (required)

```bash
npx @nqlib/nqui init-css
```

Then add to main CSS (`app/globals.css` or `src/index.css`): `@import "@nqlib/nqui/styles";`

Or copy contents of `nqui/nqui-setup.css` to the top of main CSS.

## 3. Cursor skills (optional)

```bash
npx @nqlib/nqui init-cursor
```

Copies `docs/nqui-skills` to `.cursor/nqui-skills/`, copies **`docs/components`** to **`.cursor/nqui-skills/components/`**, and may add rules. For skills only:

```bash
npx @nqlib/nqui init-skills
npx @nqlib/nqui init-claude-skills
```

Use **`HUMAN_GUIDE.md`** for task-based wayfinding; **`COMPONENTS_INDEX.md`** to pick **one** `nqui-*.md` at a time (saves tokens).

## File locations (after install)

- Task → docs: `node_modules/@nqlib/nqui/docs/nqui-skills/HUMAN_GUIDE.md`
- Docs index: `node_modules/@nqlib/nqui/docs/components/README.md`
- Per component: `node_modules/@nqlib/nqui/docs/components/nqui-<name>.md`
- Skills (source in repo): `docs/nqui-skills/` inside the package
- Check setup: `npx nqui-setup` (or `npx @nqlib/nqui setup`)

