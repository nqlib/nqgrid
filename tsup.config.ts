import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    styles: "src/styles/index.ts",
    fixtures: "src/fixtures/index.ts",
    core: "src/core/index.ts",
    engine: "src/engine/index.ts",
    sheet: "src/sheet/index.ts",
    spreadsheet: "src/spreadsheet/index.ts",
    advanced: "src/advanced/index.ts",
    configurator: "src/configurator/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-table"],
});
