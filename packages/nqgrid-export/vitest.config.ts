import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(`../../src/${p}`, import.meta.url));

/** Tests run against the library sources (no root build needed). */
export default defineConfig({
  resolve: {
    alias: {
      "@nqlib/nqgrid/core": src("core/index.ts"),
      "@nqlib/nqgrid/render-static": src("render-static/index.ts"),
      "@nqlib/nqgrid/fixtures": src("fixtures/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
