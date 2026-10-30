import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Library `src/` and Node packages under `packages/` — the playground (`apps/`) uses its own Vite/tsconfig. */
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "packages/*/dist/**",
      "packages/*/*.config.ts",
      "apps/**",
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
