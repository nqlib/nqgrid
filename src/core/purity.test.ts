import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const coreDir = join(__dirname);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [p] : [];
  });
}

/** `@nqlib/nqgrid/core` must run in Node (export CLI) and any webview — no React, TanStack or DOM. */
describe("core purity", () => {
  it.each(sourceFiles(coreDir).map((f) => [f.slice(coreDir.length + 1), f]))("%s", (_rel, file) => {
    const src = readFileSync(file, "utf8");
    expect(src).not.toMatch(/from\s+["'](react|react-dom|@tanstack\/[^"']+)["']/);
    expect(src).not.toMatch(/\b(document|window|navigator|localStorage)\./);
    expect(file.endsWith(".tsx")).toBe(false);
  });
});
