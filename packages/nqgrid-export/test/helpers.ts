import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { PivotDataRow, PivotSpec } from "@nqlib/nqgrid/core";

import { launchPivotBrowser } from "../src/pdf";

export const examples = (name: string) => fileURLToPath(new URL(`../../../contract/pivot/v1/examples/${name}`, import.meta.url));
export const readExample = (name: string) => readFileSync(examples(name), "utf8");

export const planningSpec = JSON.parse(readExample("planning.spec.json")) as PivotSpec;
export const planningRows = JSON.parse(readExample("planning.rows.json")) as PivotDataRow[];
/** Same timestamp as the golden `planning.html` (see `src/render-static/render-static.test.ts`). */
export const GOLDEN_GENERATED_AT = "2026-01-15 09:30 UTC";

/** PDF tests skip cleanly where Chromium cannot launch (no Playwright / browsers). */
export const chromiumAvailable: boolean = await launchPivotBrowser().then(
  async (b) => {
    await b.close();
    return true;
  },
  () => false,
);

/** Pages in a PDF (`/Type /Page` objects, not `/Pages`). */
export const pdfPageCount = (bytes: Uint8Array) => (Buffer.from(bytes).toString("latin1").match(/\/Type\s*\/Page(?![a-z])/g) ?? []).length;
