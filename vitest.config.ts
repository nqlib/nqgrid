import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolve workspace package imports to source so tests need no prior build step.
    // Order matters: the more specific subpath alias must come first.
    alias: [
      {
        find: "@nqlib/nqgrid/advanced",
        replacement: fileURLToPath(new URL("./src/advanced/index.ts", import.meta.url)),
      },
      {
        find: "@nqlib/nqgrid",
        replacement: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "packages/*/src/**/*.test.ts"],
  },
});
