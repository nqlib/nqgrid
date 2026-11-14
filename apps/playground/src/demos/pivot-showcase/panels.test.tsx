import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildPivotModel } from "@nqlib/nqgrid/core";
import { generatePlanningPivotRows, planningPivotSpec, statementPivotSpec, generateStatementPivotRows } from "@nqlib/nqgrid/fixtures";
import { DiagnosticsList } from "./panels/diagnostics-panel";
import { ValidationResult } from "./panels/validate-panel";
import { BAD_VALUES, badSpecFrom, badValueFieldOf, changedSpecKeys, checkSpecText, formatSpec, injectBadValues } from "./spec-tools";

describe("Validate panel", () => {
  it("accepts the scenario spec", () => {
    const check = checkSpecText(formatSpec(planningPivotSpec));
    expect(check.kind).toBe("ok");
    const html = renderToStaticMarkup(<ValidationResult check={check} />);
    expect(html).toContain('data-state="ok"');
    expect(html).toContain("Valid spec");
  });

  it("reports JSON syntax errors before validating", () => {
    const check = checkSpecText('{ "version": 1, ');
    expect(check.kind).toBe("parse");
    expect(renderToStaticMarkup(<ValidationResult check={check} />)).toContain("Not JSON");
  });

  it("treats blank input as empty, not invalid", () => {
    expect(checkSpecText("   ").kind).toBe("empty");
  });

  it("“Try a bad spec” fails strict validation on the unknown key, the unknown option and keepEmpty on rows", () => {
    const check = checkSpecText(formatSpec(badSpecFrom(planningPivotSpec)));
    expect(check.kind).toBe("invalid");
    if (check.kind !== "invalid") return;
    const all = check.errors.join("\n");
    expect(all).toMatch(/colour/);
    expect(all).toMatch(/thousands/);
    expect(all).toMatch(/keepEmpty/);
    const html = renderToStaticMarkup(<ValidationResult check={check} />);
    expect(html).toContain(`${check.errors.length} validation errors`);
    expect(html.match(/<li/g)).toHaveLength(check.errors.length);
  });

  it("leaves the source spec untouched", () => {
    const before = formatSpec(planningPivotSpec);
    badSpecFrom(planningPivotSpec);
    expect(formatSpec(planningPivotSpec)).toBe(before);
  });
});

describe("Diagnostics panel", () => {
  const rows = generatePlanningPivotRows(7);
  const field = badValueFieldOf(planningPivotSpec)!;

  it("picks the first summed measure field", () => {
    expect(field).toBe("actual");
    expect(badValueFieldOf(statementPivotSpec)).toBe("AMOUNT");
  });

  it("shows the empty state for clean data", () => {
    const model = buildPivotModel(planningPivotSpec, rows);
    expect(model.diagnostics ?? []).toEqual([]);
    expect(renderToStaticMarkup(<DiagnosticsList diagnostics={model.diagnostics ?? []} />)).toContain('data-testid="diagnostics-empty"');
  });

  it("injected values surface as unparsedNumbers with samples, without mutating the rows", () => {
    const injected = injectBadValues(rows, field);
    expect(rows[0]![field]).toEqual(expect.any(Number));
    expect(injected.slice(0, 3).map((r) => r[field])).toEqual([...BAD_VALUES]);
    const diagnostics = buildPivotModel(planningPivotSpec, injected).diagnostics ?? [];
    const unparsed = diagnostics.find((d) => d.code === "unparsedNumbers" && d.field === field);
    expect(unparsed?.count).toBe(BAD_VALUES.length);
    const html = renderToStaticMarkup(<DiagnosticsList diagnostics={diagnostics} />);
    expect(html).toContain('data-testid="diagnostics-list"');
    expect(html).toContain("unparsedNumbers");
    expect(html).toContain("1,234.50");
  });

  it("works on statement data (AMOUNT)", () => {
    const injected = injectBadValues(generateStatementPivotRows(), "AMOUNT");
    const diagnostics = buildPivotModel(statementPivotSpec, injected).diagnostics ?? [];
    expect(diagnostics.some((d) => d.code === "unparsedNumbers" && d.field === "AMOUNT")).toBe(true);
  });
});

describe("Spec panel", () => {
  it("lists the top-level keys changed since load", () => {
    expect(changedSpecKeys(planningPivotSpec, planningPivotSpec)).toEqual([]);
    expect(changedSpecKeys(planningPivotSpec, { ...planningPivotSpec, expanded: [], layout: "compact" })).toEqual(["expanded", "layout"]);
  });
});
