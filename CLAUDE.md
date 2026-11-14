# nqgrid — contributor guide

`@nqlib/nqgrid` is a **headless table/grid engine**. The golden rule:

> **Develop the engine and the demo separately. The engine is always headless.**

## The boundary (non-negotiable)

| | Lives in | Ships in npm tarball | May contain |
|---|---|---|---|
| **Engine** | `src/**` | ✅ yes | logic + geometry only — `CSSProperties` for layout (`position/left/top/width/height/zIndex`), state, hooks, pure functions |
| **Demo / styling** | `apps/playground/**` | ❌ no (reference app) | all look/feel — Tailwind/nqui classes, tokens, styled cell renderers, `@nqlib/nqui` components |

The engine **must never** import `@nqlib/nqui` or contain design-system class
strings (`bg-*`, `text-muted-foreground`, `rounded-*`, pill colors, font sizes,
…). This is enforced by an ESLint guard in `eslint.config.mjs` — a violation
fails the build. Styling decisions belong to the consuming app; the engine
returns numbers and geometry, never a look. See `skills/engine-only/SKILL.md`.

## Where things live

- Engine features are grouped under `src/engine/{pinning,freeze,virtualization,selection,reorder,outline,data}/`, each behind a sub-barrel, re-exported by one curated `src/engine/index.ts`. Add to the matching subfolder; don't flatten.
- Styling (tokens, presets, `buildTableClasses`, styled rich cells, percent battery) lives in `apps/playground/src/lib/nqgrid-styling/`.
- The demo imports nqgrid through **public entry points only** (`@nqlib/nqgrid`, `/engine`, `/grid`, …). Deep imports of engine internals don't resolve — keep the public barrel the only surface.

## Tests

- Engine: `pnpm test` (vitest, `src/**/*.test.ts`). Co-locate the test next to the source it covers.
- Demo / styling: `pnpm --filter nqgrid-playground test` (`apps/playground/**/*.test.{ts,tsx}`).

## Before you finish

Run `pnpm lint && pnpm test && pnpm build` for engine changes;
`pnpm --filter nqgrid-playground exec tsc --noEmit && pnpm --filter nqgrid-playground test`
for demo changes. Removing or renaming a public export is a breaking change —
note it in `CHANGELOG.md`.

## Releases and models (same in every nqlib repo)

- **Versions, `dev`, tags and the changelog:** `docs/development/nqlib-release-rules.md`. Check
  `npm view` before any version work. Keep `dev` equal to `origin/dev`. `package.json` on `dev`
  carries the next version, under a `## [X.Y.Z] - Unreleased` changelog section. Ask the
  version questionnaire (`AskUserQuestion`) before you set or change a version, tag or publish.
- **Subagents and models:** `docs/development/agent-models.md`. Use `haiku` for search, test runs
  and mechanical changes; `sonnet` for scoped fixes and docs; `opus` for features, bugs with an
  unknown cause, public API and review. Ask before you use `fable`.
