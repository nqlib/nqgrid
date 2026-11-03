import { describe, expect, it } from "vitest";

import vectors from "../../../contract/pivot/v1/calc-expressions.json";
import {
  compilePivotCalc,
  evaluatePivotCalc,
  findPivotCalcCycles,
  parsePivotCalc,
  PIVOT_CALC_FUNCTIONS,
  PIVOT_CALC_MAX_ARGS,
  PIVOT_CALC_MAX_DEPTH,
  PIVOT_CALC_MAX_LENGTH,
} from "./calc";

type Part = string | { readonly repeat: string; readonly times: number };
type Expr = string | number | null | { readonly concat: readonly Part[] };

/** Expand a vector's `expr` (`{ concat: [...] }` builds long inputs). */
function build(expr: Expr): unknown {
  if (expr === null || typeof expr !== "object") return expr;
  return expr.concat.map((p) => (typeof p === "string" ? p : p.repeat.repeat(p.times))).join("");
}

const close = (a: number | null, b: number | null) =>
  a === null || b === null ? a === b : a === b || Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));

describe("calc expressions: shared vectors (contract/pivot/v1/calc-expressions.json)", () => {
  it("limits and functions match the contract", () => {
    expect(vectors.limits).toEqual({ maxLength: PIVOT_CALC_MAX_LENGTH, maxDepth: PIVOT_CALC_MAX_DEPTH, maxArgs: PIVOT_CALC_MAX_ARGS });
    expect(vectors.functions).toEqual(Object.keys(PIVOT_CALC_FUNCTIONS));
  });

  it.each(vectors.valid.map((v, i) => [i, v] as const))("valid #%i", (_i, v) => {
    const src = build(v.expr as Expr) as string;
    const parsed = parsePivotCalc(src);
    expect(parsed.ok ? null : parsed.error).toBeNull();
    if ("references" in v && v.references) expect(parsed.ok && parsed.references).toEqual(v.references);
    const result = evaluatePivotCalc(src, v.values as Record<string, number | null>);
    expect(close(result, v.result as number | null), `${JSON.stringify(src)} → ${result}, expected ${v.result}`).toBe(true);
  });

  it.each(vectors.invalid.map((v, i) => [i, v] as const))("invalid #%i", (_i, v) => {
    const src = build(v.expr as Expr);
    const measures = "measures" in v ? (v.measures as string[]) : undefined;
    const parsed = parsePivotCalc(src, measures ? { references: measures } : {});
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error.code, `${JSON.stringify(src)}: ${parsed.error.message}`).toBe(v.code);
    if ("position" in v) expect(parsed.error.position).toBe(v.position);
    expect(parsed.error.message.length).toBeGreaterThan(0);
  });
});

describe("calc expressions: safety", () => {
  it("rejects hostile input quickly without throwing", () => {
    const hostile = [
      "(".repeat(100_000),
      "-".repeat(100_000) + "1",
      "1+".repeat(400_000) + "1",
      "[".repeat(5000),
      "a".repeat(2_000_000),
      "‮".repeat(10),
      "constructor.constructor('return process')()",
      "this",
      "globalThis",
      "__proto__",
      "x['constructor']",
    ];
    const t0 = Date.now();
    for (const src of hostile) {
      const r = parsePivotCalc(src);
      if (src === "this" || src === "globalThis") {
        // Plain references: harmless names, rejected only when unknown.
        expect(r.ok).toBe(true);
        expect(parsePivotCalc(src, { references: ["actual"] }).ok).toBe(false);
      } else {
        expect(r.ok).toBe(false);
      }
    }
    expect(Date.now() - t0).toBeLessThan(500);
  });

  it("never resolves references through object prototypes", () => {
    expect(evaluatePivotCalc("toString + 1", {})).toBeNull();
    expect(evaluatePivotCalc("hasOwnProperty", {})).toBeNull();
    expect(evaluatePivotCalc("valueOf * 2", { valueOf: 3 } as unknown as Record<string, number>)).toBe(6);
  });

  it("compiles once into closures that read slots (NaN = no value)", () => {
    const parsed = parsePivotCalc("a / b - 1");
    if (!parsed.ok) throw new Error("parse");
    const program = compilePivotCalc(parsed.ast, (n) => parsed.references.indexOf(n));
    expect(program([110, 100])).toBeCloseTo(0.1, 12);
    expect(Number.isNaN(program([1, 0]))).toBe(true);
    expect(Number.isNaN(program([NaN, 1]))).toBe(true);
  });

  it("finds reference cycles", () => {
    expect(findPivotCalcCycles(new Map([["a", ["b"]], ["b", ["a"]], ["c", ["a"]]]))).toEqual([["a", "b", "a"]]);
    expect(findPivotCalcCycles(new Map([["a", ["a"]]]))).toEqual([["a", "a"]]);
    expect(findPivotCalcCycles(new Map([["a", ["b", "x"]], ["b", ["c"]], ["c", []]]))).toEqual([]);
  });
});
