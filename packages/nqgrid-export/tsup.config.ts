import { defineConfig } from "tsup";

/** Run `pnpm build` at the repo root first: the library (`@nqlib/nqgrid`) is consumed from its `dist/`. */
export default defineConfig({
  entry: { index: "src/index.ts", cli: "src/cli.ts" },
  format: ["esm"],
  platform: "node",
  target: "node20",
  tsconfig: "tsconfig.build.json",
  dts: { entry: { index: "src/index.ts" } },
  sourcemap: true,
  clean: true,
  splitting: true,
  external: [/^@nqlib\/nqgrid(\/.*)?$/, "exceljs", "playwright", "react", "react-dom"],
});
