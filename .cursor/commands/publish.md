# Publish `@nqlib/nqgrid` to npm

Repo root **is** the published package. The playground (`apps/playground`) is not published.

## Package

- Path: `.` (repo root)
- Name: `@nqlib/nqgrid`
- Registry: `https://registry.npmjs.com`

## Steps

1. Read `package.json` `version`. If that version is already on npm, bump patch/minor first.

2. Check npm auth:
   ```bash
   make whoami
   ```
   If unauthorized, web login and **wait for the user to finish in the browser**:
   ```bash
   make login
   ```

3. Optional full gate (publish runs this via `prepublishOnly` too):
   ```bash
   make verify
   ```

4. Publish:
   ```bash
   make publish
   ```
   If publish fails with `EOTP`:
   ```bash
   make publish OTP=CODE
   ```

5. Confirm:
   ```bash
   make version
   ```

6. After publish, bump `@nqlib/nqgrid` in consumer apps (nqui-showcase, factory) and remove dev-only tsconfig path aliases if applicable.

## Do not

- Publish `apps/playground` or other workspace apps
- Skip `verify:publish` / `prepublishOnly`

## Reference

- Gate: `scripts/verify-publish.mjs`
- Publish script: `scripts/publish-npm.mjs`
- Changelog: `CHANGELOG.md`
