# Claude Code slash commands shipped with nqui

This folder contains the **slash command entry points** that the `init-claude-skills` CLI installs into `~/.claude/skills/` on a consumer machine. These become invocable as `/design` and `/edit` inside Claude Code and Claude Desktop after install.

## How a consumer installs (once they `pnpm install`)

```bash
pnpm install @nqlib/nqui                # install the library
npx @nqlib/nqui init-claude-skills      # install Claude Code skills to ~/.claude/skills
```

What that command does:
1. Copies all 15 root docs (SKILL.md, AGENT_PROMPT.md, ELEVATION.md, MOTION.md, RECIPES.md, STATES.md, WRITING.md, EVAL.md, THEMING.md, MIGRATION.md, COMPOSITION.md, COMPONENTS_INDEX.md, HUMAN_GUIDE.md, READ_BUDGET.md, README.md) → `~/.claude/skills/nqui/`
2. Copies all subdirectory skills (nqui-composition, nqui-components, nqui-design-system, nqui-shadcn, impeccable, audit, layout, polish, etc.) → `~/.claude/skills/<skill-name>/`
3. Copies all 68 per-component docs → `~/.claude/skills/nqui/components/`
4. Copies the slash command skills (this folder) → `~/.claude/skills/design/` and `~/.claude/skills/edit/`

After install, the consumer restarts Claude Code, and `/design` and `/edit` become available as tools.

## What `/design` does

When the user types `/design [a login form]` (or any UI build request), the agent:

1. Loads `AGENT_PROMPT.md` (the non-negotiable rules)
2. Loads design context from `.impeccable.md` (or asks the user if missing)
3. Picks a named layout pattern from `COMPOSITION.md`
4. Pulls combos from `RECIPES.md`
5. Applies the elevation rule (2+1 surfaces), state matrix, writing rules
6. Runs the 30-second Linear designer self-review
7. Ships work that's reliably 8/10 or better

## What `/edit` does

When the user points at existing UI (`/edit the sprint tracker page`), the agent:

1. Reads the target file(s)
2. Diagnoses against the design rules (elevation / states / writing / motion / composition / anti-patterns)
3. Names findings as P0/P1/P2 with file:line locations
4. Proposes minimum-viable fixes
5. Applies them via Edit tool, citing which rule each fix maps to

Different from `/design` (which builds from scratch).

## Updating the slash commands

The source of truth lives in this folder (`docs/nqui-skills/_claude-commands/`). Edit `design/SKILL.md` or `edit/SKILL.md` here; the next `init-claude-skills` run propagates changes.

## Why both files live in the package, not just in `~/.claude/skills/`

So consumers get the same versioned slash commands every install. The local `~/.claude/skills/` copy can drift (manual edits, partial deletes); the package source is the canonical version that ships with each nqui release.
