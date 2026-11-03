import { describe, expect, it } from "vitest";

import {
  generatePlanningPivotRows,
  planningCalcPivotSpec,
  planningDatesPivotSpec,
  planningFieldsPivotSpec,
  planningFilteredPivotSpec,
  planningMultiColumnPivotSpec,
  planningPivotSpec,
} from "../../fixtures/planning-pivot-mock";
import { buildPivotModel } from "./build-model";
import { inferPivotFields, pivotFieldListState, resolvePivotFields } from "./fields";
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

  // Filters, label filter, Top N with "Other", sort by value and facets (same rows as planning).
  const filtered = buildPivotModel(planningFilteredPivotSpec, rows);

  it("planning-filtered example (filters, Top N, sort by value, facets)", async () => {
    await expect(json(planningFilteredPivotSpec)).toMatchFileSnapshot(`${dir}/planning-filtered.spec.json`);
    await expect(json(filtered)).toMatchFileSnapshot(`${dir}/planning-filtered.model.json`);
    await expect(json(pivotModelToSheet(filtered))).toMatchFileSnapshot(`${dir}/planning-filtered.sheet.json`);
    expect(JSON.parse(JSON.stringify(filtered))).toEqual(filtered);
  });

  // Field list: extra fields (region, channel, units), a field catalogue, Σ Values outermost and a
  // report filter on a field that is not a row / column (rows: generatePlanningPivotRows(7, { extraFields: true })).
  const fieldsRows = generatePlanningPivotRows(7, { extraFields: true });
  const fieldsModel = buildPivotModel(planningFieldsPivotSpec, fieldsRows);

  it("planning-fields example (field catalogue, rearranged layout)", async () => {
    await expect(json(planningFieldsPivotSpec)).toMatchFileSnapshot(`${dir}/planning-fields.spec.json`);
    await expect(json(fieldsRows)).toMatchFileSnapshot(`${dir}/planning-fields.rows.json`);
    await expect(json(fieldsModel)).toMatchFileSnapshot(`${dir}/planning-fields.model.json`);
    await expect(json(pivotModelToSheet(fieldsModel))).toMatchFileSnapshot(`${dir}/planning-fields.sheet.json`);
    // What a producer gets from inference (Python mirrors inferPivotFields) and the field-list state.
    const catalog = {
      inferred: inferPivotFields(fieldsRows),
      resolved: resolvePivotFields(planningFieldsPivotSpec, fieldsRows),
      state: pivotFieldListState(planningFieldsPivotSpec, resolvePivotFields(planningFieldsPivotSpec, fieldsRows)),
    };
    await expect(json(catalog)).toMatchFileSnapshot(`${dir}/planning-fields.catalog.json`);
  });

  // Several column fields: Region › Σ Values › Channel, region subtotals, a grand total column and
  // "% of parent column" (rows: the planning-fields rows).
  const multiModel = buildPivotModel(planningMultiColumnPivotSpec, fieldsRows);

  it("planning-multicol example (column hierarchy, subtotals, percentOfParentColumn)", async () => {
    await expect(json(planningMultiColumnPivotSpec)).toMatchFileSnapshot(`${dir}/planning-multicol.spec.json`);
    await expect(json(multiModel)).toMatchFileSnapshot(`${dir}/planning-multicol.model.json`);
    await expect(json(pivotModelToSheet(multiModel))).toMatchFileSnapshot(`${dir}/planning-multicol.sheet.json`);
    expect(JSON.parse(JSON.stringify(multiModel))).toEqual(multiModel);
  });

  // Date grouping: fiscal Year → Quarter of an ISO `orderDate` over two fiscal years, FY25 collapsed
  // (rows: generatePlanningPivotRows(7, { extraFields: true, orderDates: true })).
  const datesRows = generatePlanningPivotRows(7, { extraFields: true, orderDates: true });
  const datesModel = buildPivotModel(planningDatesPivotSpec, datesRows);

  it("planning-dates example (date grouping, fiscal years, collapsed column group)", async () => {
    await expect(json(planningDatesPivotSpec)).toMatchFileSnapshot(`${dir}/planning-dates.spec.json`);
    await expect(json(datesRows)).toMatchFileSnapshot(`${dir}/planning-dates.rows.json`);
    await expect(json(datesModel)).toMatchFileSnapshot(`${dir}/planning-dates.model.json`);
    await expect(json(pivotModelToSheet(datesModel))).toMatchFileSnapshot(`${dir}/planning-dates.sheet.json`);
    expect(JSON.parse(JSON.stringify(datesModel))).toEqual(datesModel);
  });

  // Excel parity step 4 (rows: the planning-dates rows): a calculated measure (also heat, KPI and
  // sort key), % difference from the previous fiscal year, % running total along Line, a distinct
  // count of regions and department subtotals at the bottom.
  const calcModel = buildPivotModel(planningCalcPivotSpec, datesRows);

  it("planning-calc example (calculated measure, show-as differences, running total, distinct count, subtotal rows)", async () => {
    await expect(json(planningCalcPivotSpec)).toMatchFileSnapshot(`${dir}/planning-calc.spec.json`);
    await expect(json(calcModel)).toMatchFileSnapshot(`${dir}/planning-calc.model.json`);
    await expect(json(pivotModelToSheet(calcModel))).toMatchFileSnapshot(`${dir}/planning-calc.sheet.json`);
    expect(JSON.parse(JSON.stringify(calcModel))).toEqual(calcModel);
    expect(calcModel.rows.filter((r) => r.kind === "subtotal").map((r) => r.label)).toEqual(["Camp Total", "Packs Total"]);
  });
});
