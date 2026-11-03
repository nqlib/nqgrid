import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { beforeAll, describe, expect, it } from "vitest";

import { chromiumAvailable, examples, pdfPageCount, planningRows, planningSpec } from "./helpers";

/**
 * End-to-end: bundle `src/cli.ts` (library sources aliased, deps external) into this package's
 * `node_modules/.cache`, then spawn it with Node like the installed `nqgrid-export` bin.
 */
const pkg = fileURLToPath(new URL("..", import.meta.url));
const lib = (p: string) => fileURLToPath(new URL(`../../../src/${p}`, import.meta.url));
const outDir = join(pkg, "node_modules", ".cache", "nqgrid-export-test");
const cli = join(outDir, "cli.mjs");
const work = mkdtempSync(join(tmpdir(), "nqgrid-export-"));

const run = (args: string[], input?: string) => {
  const r = spawnSync(process.execPath, [cli, ...args], { input, cwd: work, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr.toString("utf8") };
};
const errorJson = (stderr: string) => JSON.parse(stderr.trim().split("\n").pop()!) as { error: { code: string; message: string; details?: string[] } };

beforeAll(async () => {
  mkdirSync(outDir, { recursive: true });
  await build({
    entryPoints: [join(pkg, "src/cli.ts")],
    outfile: cli,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    jsx: "automatic",
    logLevel: "silent",
    alias: {
      "@nqlib/nqgrid/core": lib("core/index.ts"),
      "@nqlib/nqgrid/render-static": lib("render-static/index.ts"),
    },
    external: ["react", "react/*", "react-dom", "react-dom/*", "exceljs", "playwright"],
  });
});

describe("nqgrid-export CLI (spawned)", () => {
  it("exit 2 + JSON error on stderr for an invalid spec", () => {
    const bad = join(work, "bad.json");
    writeFileSync(bad, JSON.stringify({ spec: { version: 3, rows: [], measures: [] }, rows: {} }));
    const r = run(["--input", bad, "--format", "html"]);
    expect(r.code).toBe(2);
    expect(r.stdout.length).toBe(0);
    const e = errorJson(r.stderr);
    expect(e.error.code).toBe("invalid_input");
    expect(e.error.details).toEqual(
      expect.arrayContaining(["spec: version must be 1 (got 3)", "spec: rows must be a non-empty array of dimensions", "rows must be an array of objects"]),
    );
  });

  it("exit 2 for unreadable files, bad JSON on stdin, unknown flags and formats", () => {
    expect(run(["--spec", "missing.json", "--rows", "missing.json", "--format", "pdf"]).code).toBe(2);
    const stdin = run(["--input", "-", "--format", "html"], "{not json");
    expect(stdin.code).toBe(2);
    expect(errorJson(stdin.stderr).error.message).toContain("--input (stdin) is not valid JSON");
    expect(run(["--input", "-", "--format", "docx"], "{}").code).toBe(2);
    expect(run(["--input", "-", "--wat"], "{}").code).toBe(2);
    expect(run(["--input", "-"], "{}").code).toBe(2); // no --format and no --out extension
    expect(run([]).code).toBe(2);
  });

  it("exit 0: html to stdout from stdin; xlsx / sheet files from --spec + --rows", () => {
    const request = JSON.stringify({ spec: planningSpec, rows: planningRows, options: { generatedAt: "2026-01-15 09:30 UTC" } });
    const html = run(["--input", "-", "--format", "html", "--out", "-"], request);
    expect(html.code).toBe(0);
    expect(html.stdout.toString("utf8")).toBe(readFileSync(examples("planning.html"), "utf8"));

    const xlsx = join(work, "plan.xlsx");
    const r = run(["--spec", examples("planning.spec.json"), "--rows", examples("planning.rows.json"), "--out", xlsx, "--title", "Plan"]);
    expect(r.code).toBe(0);
    expect(readFileSync(xlsx).subarray(0, 2).toString("latin1")).toBe("PK");

    const sheet = run(["--spec", examples("planning.spec.json"), "--rows", examples("planning.rows.json"), "-f", "sheet"]);
    expect(sheet.stdout.toString("utf8")).toBe(readFileSync(examples("planning.sheet.json"), "utf8"));
  });

  it.skipIf(!chromiumAvailable)("exit 0: pdf file (Letter portrait via flags)", () => {
    const pdf = join(work, "plan.pdf");
    const r = run(["--spec", examples("planning.spec.json"), "--rows", examples("planning.rows.json"), "--out", pdf, "--page-size", "Letter", "--orientation", "portrait"]);
    expect(r.code).toBe(0);
    const bytes = readFileSync(pdf);
    expect(bytes.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(pdfPageCount(bytes)).toBe(2); // 12 months → 2 column chunks on portrait
  });

  it("--help and --version", () => {
    expect(run(["--help"]).stdout.toString()).toContain("nqgrid-export serve");
    expect(run(["--version"]).stdout.toString().trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
