---
name: nqui-local-published-toggle
description: Enables switching between local (development) and published (npm) versions of @nqlib/nqui in consumer projects. Use when adding nqui to Vite, Next.js, or TypeScript projects; when user asks to "toggle nqui", "use local nqui", "npm link nqui", or "switch between local and published" nqui.
---

# nqui Local/Published Toggle

Enables any consumer project (Vite, Next.js, TypeScript) to switch between local nqui development and the published npm package via `npm link` and env-driven scripts.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `USE_LOCAL_NQUI=true` | Use local nqui via `npm link` |
| `USE_LOCAL_NQUI=false` | Use published `@nqlib/nqui` from registry |
| `NQUI_DIR` | Path to nqui **repo root** (default: sibling `../nqui` or customize in script) |
| `SKIP_BUILD=true` | Skip `npm run build:lib` when already linked (local only) |

## Setup Steps

### 1. Add the script

Copy [scripts/toggle-nqui.js](./scripts/toggle-nqui.js) into the consumer project's `scripts/` directory. Customize in the script:

- `root` – Resolved from `__dirname` (parent of `scripts/`)
- `nquiBaseDir` – Default `NQUI_DIR`; use `resolve(root, '..', 'nqui')` or absolute path
- `PUBLISHED_VERSION` – Semver for published mode (e.g. `^0.5.0`)

### 2. Add package.json scripts

Replace `<framework-dev-command>` with the appropriate command:

```json
{
  "scripts": {
    "dev": "node scripts/toggle-nqui.js && <framework-dev-command>",
    "dev:local": "USE_LOCAL_NQUI=true node scripts/toggle-nqui.js && <framework-dev-command>",
    "dev:local:fast": "USE_LOCAL_NQUI=true SKIP_BUILD=true node scripts/toggle-nqui.js && <framework-dev-command>",
    "dev:published": "USE_LOCAL_NQUI=false node scripts/toggle-nqui.js && <framework-dev-command>",
    "toggle-nqui": "node scripts/toggle-nqui.js",
    "nqui:status": "node scripts/toggle-nqui.js --check"
  }
}
```

### 3. Framework dev commands

| Framework | `<framework-dev-command>` |
|-----------|--------------------------|
| Vite | `vite` |
| Next.js | `next dev` or `next dev --webpack` (see Next.js note) |
| Create React App | `react-scripts start` |

### 4. Ensure dependency

`@nqlib/nqui` must be in `dependencies` with semver:

```json
{
  "dependencies": {
    "@nqlib/nqui": "^0.5.0"
  }
}
```

## Framework-Specific Notes

### Vite

Works out of the box. No special config.

### Next.js

Use `next dev --webpack` when running with local nqui. Turbopack (Next.js 16+ default) has limited symlink support.

Options:

- Set `"dev": "next dev --webpack"` if you always want Webpack for dev
- Or add `"dev:webpack": "next dev --webpack"` and use it in `dev:local` / `dev:local:fast`:

```json
"dev:local": "USE_LOCAL_NQUI=true node scripts/toggle-nqui.js && next dev --webpack",
"dev:local:fast": "USE_LOCAL_NQUI=true SKIP_BUILD=true node scripts/toggle-nqui.js && next dev --webpack",
"dev:published": "USE_LOCAL_NQUI=false node scripts/toggle-nqui.js && next dev"
```

### Monorepos

Each app that uses nqui needs its own `scripts/toggle-nqui.js` and package.json scripts. Root can proxy:

```json
"dev:admin:local": "USE_LOCAL_NQUI=true npm --prefix client-saas run dev",
"dev:admin:local:fast": "USE_LOCAL_NQUI=true SKIP_BUILD=true npm --prefix client-saas run dev",
"dev:admin:published": "USE_LOCAL_NQUI=false npm --prefix client-saas run dev",
"nqui:status": "npm --prefix client-saas run nqui:status"
```

## How It Works

**Local mode** (`USE_LOCAL_NQUI=true`):

1. Verify nqui exists at `NQUI_DIR/packages/nqui` (layout of the nqui **repository**)
2. Run `npm run build:lib` in that package (unless `SKIP_BUILD=true` and already linked)
3. Run `npm link` in the nqui package directory
4. Run `npm unlink @nqlib/nqui` (if needed), then `npm link @nqlib/nqui` in consumer
5. Update consumer `package.json` with `^${nqui.version}`

**Published mode** (`USE_LOCAL_NQUI=false`):

1. Run `npm unlink @nqlib/nqui`
2. Set `package.json` to `"@nqlib/nqui": "^x.y.z"`
3. Run `npm install @nqlib/nqui@^x.y.z` (add `--legacy-peer-deps` if needed)

## Status Check

```bash
npm run nqui:status
# or
node scripts/toggle-nqui.js --check
```

Shows: Source (LOCAL/PUBLISHED), Version, Symlink status, Location.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Next.js 16+ Turbopack symlink issues | Use `next dev --webpack` for dev when using local nqui |
| pnpm | Script uses `npm link` for consistency; `npm link` works in pnpm projects |
| Version mismatch | Update `PUBLISHED_VERSION` in script to match latest @nqlib/nqui release |
| Peer dependency conflicts | Add `NPM_CONFIG_LEGACY_PEER_DEPS=true` to link env, or `--legacy-peer-deps` to install |
| nqui dir not found | Set `NQUI_DIR` to absolute path of nqui **repository** root |
