import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

// Lints the library `src` and the publishable sibling packages' sources.
// The playground under `apps` uses its own Vite/tsconfig and is ignored here.
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "apps/**",
      "**/*.test.ts",
      "eslint.config.mjs",
      "**/tsup.config.ts",
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
    // Sibling packages (e.g. nqgantt) — browser DOM globals for the headless React engine.
    files: ["packages/*/src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
