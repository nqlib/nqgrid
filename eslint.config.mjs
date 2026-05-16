import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

/** Library `src/` only — playground lives under `apps/` and uses its own Vite/tsconfig. */
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
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
);
