import { describe, expect, it } from "vitest";

import { generatePlanningPivotRows, planningPivotSpec } from "../../fixtures/planning-pivot-mock";
import { buildPivotModel } from "./build-model";
import { pivotModelToSheet } from "./to-sheet";

/**
 * Golden files under `contract/pivot/v1/examples` are the cross-language contract:
 * a producer (e.g. the Python MCP backend) can send `*.spec.json` + `*.rows.json` and expect
 * exactly `*.model.json` / `*.sheet.json` back. Update with `pnpm test -u` and review the diff.
 */
const dir = "../../../contract/pivot/v1/examples";
const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

describe("pivot golden contract", () => {
  const rows = generatePlanningPivotRows();
  const model = buildPivotModel(planningPivotSpec, rows);

  it("planning example inputs", async () => {
    await expect(json(planningPivotSpec)).toMatchFileSnapshot(`${dir}/planning.spec.json`);
    await expect(json(rows)).toMatchFileSnapshot(`${dir}/planning.rows.json`);
  });

  it("planning example outputs", async () => {
    await expect(json(model)).toMatchFileSnapshot(`${dir}/planning.model.json`);
    await expect(json(pivotModelToSheet(model))).toMatchFileSnapshot(`${dir}/planning.sheet.json`);
  });

  it("model is plain JSON (round-trips losslessly)", () => {
    expect(JSON.parse(JSON.stringify(model))).toEqual(model);
  });
});
