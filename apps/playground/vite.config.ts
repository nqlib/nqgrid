import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@nqlib/nqgrid": path.resolve(__dirname, "../../src"),
    },
    // Vite 8 dep pre-bundle resolves optional peers from inside .vite/deps and
    // can miss pnpm-linked packages; dedupe forces resolution from the app root.
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
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
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
