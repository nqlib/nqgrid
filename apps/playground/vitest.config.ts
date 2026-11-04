import { mergeConfig } from "vite";
import { defineConfig } from "vitest/config";
import viteConfig from "./vite.config";

/**
 * Demo-side tests. The engine-only split moved the styling/rich-cell logic
 * (tokens compose, rich column/status cells, configurator derive) into the demo,
 * so their tests live here — the root `vitest.config.ts` only scans library `src/`.
 * Reuses the Vite resolver so `@nqlib/nqgrid` resolves to library source.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ["src/**/*.test.{ts,tsx}"],
      environment: "node",
    },
  }),
);
