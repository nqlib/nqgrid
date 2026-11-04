import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Library `src/` and Node packages under `packages/` — the playground (`apps/`) uses its own Vite/tsconfig; `integrations/` is Python. */
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "packages/*/dist/**",
      "packages/*/*.config.ts",
      "apps/**",
      "integrations/**",
      "**/.venv/**",
      ".cursor/**",
      "**/*.test.ts",
      "eslint.config.mjs",
      "tsup.config.ts",
      "vitest.config.ts",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Intentionally-unused params/vars use a leading underscore.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // The engine is HEADLESS: logic + geometry only. It must never import the
      // UI kit or bake in design-system styling — all look/feel lives in the demo
      // (apps/playground) or the consumer's app. See skills/engine-only/SKILL.md.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@nqlib/nqui", "@nqlib/nqui/*"],
              message:
                "Engine is headless — do not import the nqui UI kit in src/. Compose UI in apps/playground or the consumer app.",
            },
          ],
        },
      ],
      // nqui/shadcn semantic Tailwind tokens are styling, not geometry.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/\\b(bg|text|border|ring|fill|stroke|shadow|rounded|divide|outline)-(background|foreground|card|muted|popover|primary|secondary|accent|destructive|border|input|ring)\\b/]",
          message:
            "Engine is headless — no design-system class strings in src/. Move styling to apps/playground (nqgrid-styling) or the consumer.",
        },
      ],
    },
  },
  {
    // `@nqlib/nqgrid/styles` is the opt-in styled layer (Tailwind class tokens for
    // table shells and the pivot renderer). Class strings are its purpose; the
    // headless rule still covers every other `src/` entry.
    files: ["src/styles/**/*.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // Node tooling scripts (publish/verify) — plain ESM with Node globals.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // `packages/*` are Node tools (e.g. the `nqgrid-export` CLI).
    files: ["packages/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    // `@nqlib/nqgrid/core` runs in Node (PDF/XLSX export) and any webview: keep it framework-free.
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react-dom", "react/*", "@tanstack/*"], message: "src/core must stay framework-free." },
            { group: ["../engine/*", "../advanced/*", "../sheet/*", "../spreadsheet/*", "../components/*", "../styles/*"], message: "src/core must not depend on React layers." },
          ],
        },
      ],
    },
  },
);
