---
name: nqui-bundle-size-best-practices
description: Bundle size best practices for @nqlib/nqui. Use when adding dependencies, creating packages that depend on nqui, or optimizing build output.
---

# nqui Bundle Size Best Practices

Guidelines for keeping **@nqlib/nqui** bundles small and maintainable.

## Principle

Keep the main bundle small. Externalize heavy optional dependencies so consumers install only what they use.

## When Adding a Dependency

Before adding a dependency, ask:

1. **Is it heavy (>50KB)?** Large libs (motion, @dnd-kit, embla-carousel, etc.) bloat the bundle.
2. **Is it optional?** Only some components use it (e.g. Sortable uses @dnd-kit). If yes, add as optional peer + external in Vite.

If both answers are yes, externalize it.

## Externalization Checklist

1. Add to `vite.config.ts` (package root) → `rollupOptions.external`:
   ```ts
   "package-name",
   ```
2. Add to `package.json`:
   - `peerDependencies`: `"package-name": "^x.y.0"`
   - `peerDependenciesMeta`: `"package-name": { "optional": true }`
3. Keep in `dependencies` if the nqui dev app (showcase, Storybook) needs it.
4. Document in `internal-notes/PEER_DEPENDENCIES.md` which component(s) require it.

## Avoid Bundling

Do not add large dependencies as regular dependencies when they are feature-specific:

- **Animations**: motion, framer-motion
- **Drag and drop**: @dnd-kit/*
- **Carousels**: embla-carousel-react
- **Tables**: @tanstack/react-table
- **Resizable panels**: react-resizable-panels
- **Combobox**: `cmdk` (optional peer, shared with Command)
- **Syntax highlighting**: shiki, @shikijs/transformers
- **Sandboxes**: @codesandbox/sandpack-react
- **Command palettes**: cmdk
- **Date pickers**: react-day-picker, date-fns
- **Toasts**: sonner
- **Drawers**: vaul
- **Icons**: @hugeicons/react, @hugeicons/core-free-icons

## Subpath Exports

Consumers can import from subpaths for smaller bundles when using only specific component groups:

- `@nqlib/nqui/code` — CodeBlock
- `@nqlib/nqui/carousel` — Carousel
- `@nqlib/nqui/command` — Command, CommandPalette
- `@nqlib/nqui/sortable` — Sortable
- `@nqlib/nqui/calendar` — Calendar
- `@nqlib/nqui/sonner` — Toaster, Sonner
- `@nqlib/nqui/drawer` — Drawer

See `internal-notes/PEER_DEPENDENCIES.md` for peer requirements per subpath.

## Reference

- **Component-to-peer mapping:** `internal-notes/PEER_DEPENDENCIES.md`
- **Installation notes:** `internal-notes/INSTALLATION.md` (Optional components section)

## Other libraries in a monorepo

Packages that wrap or extend nqui should follow the same pattern:

- `peerDependencies`: `react`, `react-dom`, `@nqlib/nqui` (or workspace version)
- In Vite library build: externalize `react`, `react-dom`, `@nqlib/nqui`
- Keep heavy optional deps as peers when consumers may not need them
