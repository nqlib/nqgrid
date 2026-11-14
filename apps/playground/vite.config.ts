import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveLocalNquiDist(): string | undefined {
  if (process.env.USE_LOCAL_NQUI !== "true") return undefined;

  const nquiBase = process.env.NQUI_DIR ?? path.resolve(__dirname, "../../../../nqui");
  const monorepoPkg = path.join(nquiBase, "packages", "nqui");
  const pkgRoot = existsSync(path.join(monorepoPkg, "package.json")) ? monorepoPkg : nquiBase;
  const dist = path.join(pkgRoot, "dist");

  if (!existsSync(dist)) {
    console.warn(
      `[nqgrid-playground] USE_LOCAL_NQUI=true but no dist at ${dist}. ` +
        "Run `npm run build:lib` in nqui or use published nqui.",
    );
    return undefined;
  }

  console.info(`[nqgrid-playground] @nqlib/nqui → ${dist}`);
  return dist;
}

const localNquiDist = resolveLocalNquiDist();

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Anchored finds so the demo can only import nqgrid's PUBLIC entry points —
    // deep imports like `@nqlib/nqgrid/engine/freeze/x` deliberately fail to
    // resolve, keeping the engine's curated barrel the only consumer surface.
    alias: [
      // becocharts copied source imports via `@/...` — resolve those to the
      // local `src/beecharts` copy. Must come BEFORE the nqui/nqgrid entries.
      { find: "@/lib/utils", replacement: path.resolve(__dirname, "src/beecharts/lib-utils.ts") },
      { find: "@/registry", replacement: path.resolve(__dirname, "src/beecharts/registry") },
      { find: /^@nqlib\/nqgrid$/, replacement: path.resolve(__dirname, "../../src/index.ts") },
      { find: /^@nqlib\/nqgrid\/engine$/, replacement: path.resolve(__dirname, "../../src/engine/index.ts") },
      { find: /^@nqlib\/nqgrid\/grid$/, replacement: path.resolve(__dirname, "../../src/grid/index.ts") },
      { find: /^@nqlib\/nqgrid\/sheet$/, replacement: path.resolve(__dirname, "../../src/sheet/index.ts") },
      { find: /^@nqlib\/nqgrid\/spreadsheet$/, replacement: path.resolve(__dirname, "../../src/spreadsheet/index.ts") },
      { find: /^@nqlib\/nqgrid\/advanced$/, replacement: path.resolve(__dirname, "../../src/advanced/index.ts") },
      { find: /^@nqlib\/nqgrid\/configurator$/, replacement: path.resolve(__dirname, "../../src/configurator/index.ts") },
      { find: /^@nqlib\/nqgrid\/fixtures$/, replacement: path.resolve(__dirname, "../../src/fixtures/index.ts") },
      // Pivot entries resolve to source too, so the pivot showcase runs on the engine in this checkout
      // (the built `dist/` can lag behind `src/`).
      { find: /^@nqlib\/nqgrid\/core$/, replacement: path.resolve(__dirname, "../../src/core/index.ts") },
      { find: /^@nqlib\/nqgrid\/pivot$/, replacement: path.resolve(__dirname, "../../src/pivot/index.ts") },
      { find: /^@nqlib\/nqgrid\/render-static$/, replacement: path.resolve(__dirname, "../../src/render-static/index.ts") },
      { find: /^@nqlib\/nqgrid\/styles$/, replacement: path.resolve(__dirname, "../../src/styles/index.ts") },
      ...(localNquiDist
        ? [
            { find: "@nqlib/nqui/styles", replacement: path.join(localNquiDist, "styles.css") },
            { find: "@nqlib/nqui", replacement: localNquiDist },
          ]
        : []),
    ],
    dedupe: [
      "@dnd-kit/core",
      "@dnd-kit/modifiers",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "@tanstack/react-table",
      "cmdk",
      "date-fns",
      "embla-carousel-react",
      "react-day-picker",
      "react-resizable-panels",
      "sonner",
      "vaul",
      ...(localNquiDist ? ["@nqlib/nqui"] : []),
    ],
  },
  server: {
    host: "127.0.0.1",
    // Honor a port assigned via the env (e.g. the preview manager / autoPort);
    // fall back to 5174 for a plain `pnpm dev`. Not strict, so it can pick a
    // free port when 5174 is already taken.
    port: process.env.PORT ? Number(process.env.PORT) : 5174,
    strictPort: false,
    // Planning pivot "Export": run with VITE_NQGRID_EXPORT_URL=/nqgrid-export to reach
    // `nqgrid-export serve` (no CORS headers) through this proxy.
    proxy: {
      "/nqgrid-export": {
        target: process.env.NQGRID_EXPORT_PROXY_TARGET ?? "http://127.0.0.1:8787",
        rewrite: (p) => p.replace(/^\/nqgrid-export/, ""),
      },
    },
  },
});
