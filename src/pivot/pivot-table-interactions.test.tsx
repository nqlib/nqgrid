// @vitest-environment jsdom
import axe from "axe-core";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildPivotModel } from "../core/pivot/build-model";
import type { PivotSpec } from "../core/pivot/types";
import { generatePlanningPivotRows, planningPivotSpec } from "../fixtures/planning-pivot-mock";
import type { PivotResizeInfo } from "./design";
import { PivotTable, type PivotTableProps } from "./pivot-table";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const spec: PivotSpec = { ...planningPivotSpec, values: ["actual", "plan", "growth"], heat: null, headerCharts: null };
const model = buildPivotModel(spec, generatePlanningPivotRows());

type Call = readonly [string, ...unknown[]];

/** A host that stores the design and passes it back (the controlled pattern). */
function Host({ calls, extra }: { calls: Call[]; extra?: Partial<PivotTableProps> }) {
  const [valueWidths, setValueWidths] = useState<Record<string, number>>({});
  const [dimensionWidths, setDimensionWidths] = useState<number[]>([208, 172]);
  const [rowHeight, setRowHeight] = useState(36);
  const [measureOrder, setMeasureOrder] = useState<readonly string[] | undefined>(undefined);
  return (
    <div style={{ overflow: "auto", height: 400 }}>
      <PivotTable
        model={model}
        valueWidths={valueWidths}
        dimensionWidths={dimensionWidths}
        rowHeight={rowHeight}
        measureOrder={measureOrder}
        onValueWidthChange={(key, width, info) => {
          calls.push(["value", key, width, info]);
          setValueWidths((w) => ({ ...w, [key]: width }));
        }}
        onDimensionWidthChange={(index, width, info) => {
          calls.push(["dimension", index, width, info]);
          setDimensionWidths((w) => w.map((x, i) => (i === index ? width : x)));
        }}
        onRowHeightChange={(height, info) => {
          calls.push(["row", height, info]);
          setRowHeight(height);
        }}
        onMeasureOrderChange={(order) => {
          calls.push(["order", order]);
          setMeasureOrder(order);
        }}
        {...extra}
      />
    </div>
  );
}

let container: HTMLDivElement;
let root: Root;
let calls: Call[];

const PointerCtor: typeof MouseEvent = (globalThis as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? MouseEvent;
const pointer = (target: EventTarget, type: string, clientX: number, clientY = 0) =>
  act(() => {
    target.dispatchEvent(new PointerCtor(type, { bubbles: true, cancelable: true, clientX, clientY, button: 0 }));
  });
const key = (target: EventTarget, k: string, init: KeyboardEventInit = {}) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }));
  });
const nextFrame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
const $ = <T extends Element = HTMLElement>(selector: string) => container.querySelector<T>(selector)!;
const colWidth = (i: number) => container.querySelectorAll<HTMLTableColElement>("col")[i]!.style.width;
const measureHeads = () => Array.from(container.querySelectorAll<HTMLElement>('th[data-nq-run="1:0"]'));

beforeEach(async () => {
  calls = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(() => root.render(<Host calls={calls} />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("PivotTable resize handles", () => {
  it("drag-resize: one call per frame while dragging, a final call on release; clamped to 48–800", async () => {
    const handle = $('[aria-label="Resize column Nov Actual"]');
    await pointer(handle, "pointerdown", 100);
    await pointer(window, "pointermove", 130);
    await pointer(window, "pointermove", 150);
    await nextFrame();
    expect(calls).toEqual([["value", "c:Nov:actual", 134, { source: "pointer", final: false } satisfies PivotResizeInfo]]);
    expect(colWidth(2)).toBe("134px");
    expect(handle.getAttribute("aria-valuenow")).toBe("134");
    await pointer(window, "pointermove", 5000);
    await pointer(window, "pointerup", 5000);
    expect(calls.at(-1)).toEqual(["value", "c:Nov:actual", 800, { source: "pointer", final: true }]);
    expect(colWidth(2)).toBe("800px");
    // Released: further moves do nothing.
    await pointer(window, "pointermove", 0);
    await nextFrame();
    expect(calls.at(-1)![2]).toBe(800);
  });

  it("Escape during a drag restores the original width", async () => {
    await pointer($('[aria-label="Resize column Nov Plan"]'), "pointerdown", 100);
    await pointer(window, "pointermove", 40);
    await nextFrame();
    expect(colWidth(3)).toBe("48px");
    await key(window, "Escape");
    expect(calls.at(-1)).toEqual(["value", "c:Nov:plan", 84, { source: "pointer", final: true }]);
    expect(colWidth(3)).toBe("84px");
    await pointer(window, "pointerup", 40);
    expect(calls.filter((c) => c[3] && (c[3] as PivotResizeInfo).final)).toHaveLength(1);
  });

  it("keyboard resize: ArrowLeft / ArrowRight 8 px, Shift 32 px, Home / End to the limits", async () => {
    const handle = $('[aria-label="Resize column Nov Growth on FY25"]');
    handle.focus();
    expect(document.activeElement).toBe(handle);
    await key(handle, "ArrowRight");
    await key(handle, "ArrowRight", { shiftKey: true });
    await key(handle, "ArrowLeft");
    expect(calls.map((c) => c[2])).toEqual([92, 124, 116]);
    expect(calls.every((c) => (c[3] as PivotResizeInfo).source === "keyboard" && (c[3] as PivotResizeInfo).final)).toBe(true);
    await key(handle, "Home");
    expect(colWidth(4)).toBe("48px");
    await key(handle, "End");
    expect(colWidth(4)).toBe("800px");
    // Focus survives the re-render (the handle keeps its place).
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Resize column Nov Growth on FY25");
  });

  it("dimension and row handles", async () => {
    await key($('[aria-label="Resize column Department"]'), "ArrowLeft");
    expect(calls.at(-1)).toEqual(["dimension", 0, 200, { source: "keyboard", final: true }]);
    expect(colWidth(0)).toBe("200px");
    const row = $('[aria-label="Resize rows"]');
    await key(row, "ArrowDown");
    await key(row, "ArrowUp", { shiftKey: true });
    expect(calls.slice(-2).map((c) => c[1])).toEqual([40, 24]);
    expect($<HTMLTableRowElement>("tbody tr[data-kind]").style.height).toBe("24px");
    await pointer(row, "pointerdown", 0, 100);
    await pointer(window, "pointermove", 0, 500);
    await pointer(window, "pointerup", 0, 500);
    expect(calls.at(-1)).toEqual(["row", 96, { source: "pointer", final: true }]);
  });

  it("double-click fits the widest rendered cell of the column", async () => {
    // jsdom has no layout: give text a width of 7 px per character.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const w = (this.textContent ?? "").length * 7;
      return { x: 0, y: 0, left: 0, top: 0, right: w, bottom: 10, width: w, height: 10, toJSON: () => ({}) } as DOMRect;
    });
    const handle = $('[aria-label="Resize column Nov Growth on FY25"]');
    await act(() => {
      handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    });
    // Widest cell in the column is its header, "Growth on FY25" (14 chars → 98 px) + 1.
    expect(calls.at(-1)).toEqual(["value", "c:Nov:growth", 99, { source: "autofit", final: true }]);
  });
});

describe("PivotTable measure reorder", () => {
  /** Lay the run's headers out 100 px apart (jsdom has no layout). */
  const layoutHeads = () =>
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const run = this.dataset.nqRun;
      const i = run ? Array.from(container.querySelectorAll(`th[data-nq-run="${run}"]`)).indexOf(this) : 0;
      return { x: i * 100, y: 0, left: i * 100, top: 0, right: i * 100 + 100, bottom: 36, width: 100, height: 36, toJSON: () => ({}) } as DOMRect;
    });

  it("drag a measure header past its siblings: drop indicator, then the new order", async () => {
    layoutHeads();
    const [actual] = measureHeads();
    await pointer(actual!, "pointerdown", 50);
    await pointer(window, "pointermove", 52); // under the 4 px threshold: no drag yet
    expect(actual!.dataset.nqDragging).toBeUndefined();
    await pointer(window, "pointermove", 260);
    const [, , growth] = measureHeads();
    expect(growth!.dataset.nqDrop).toBe("after");
    expect(growth!.style.boxShadow).toContain("var(--nq-pivot-drop-indicator, currentColor)");
    await pointer(window, "pointermove", 160);
    expect(growth!.dataset.nqDrop).toBe("before");
    await pointer(window, "pointermove", 260);
    await pointer(window, "pointerup", 260);
    expect(calls).toEqual([["order", ["plan", "growth", "actual"]]]);
    expect(measureHeads().map((th) => th.dataset.nqMeasure)).toEqual(["plan", "growth", "actual"]);
    // Every month follows; column members (months) keep their order.
    expect(Array.from(container.querySelectorAll('th[data-nq-measure]')).slice(3, 6).map((th) => (th as HTMLElement).dataset.nqMeasure)).toEqual(["plan", "growth", "actual"]);
    expect(container.querySelectorAll("[data-nq-drop]")).toHaveLength(0);
  });

  it("Escape cancels a drag: no call, no indicator left", async () => {
    layoutHeads();
    const [actual] = measureHeads();
    await pointer(actual!, "pointerdown", 50);
    await pointer(window, "pointermove", 260);
    expect(container.querySelectorAll("[data-nq-drop]")).toHaveLength(1);
    await key(window, "Escape");
    await pointer(window, "pointerup", 260);
    expect(calls).toEqual([]);
    expect(container.querySelectorAll("[data-nq-drop]")).toHaveLength(0);
    expect(actual!.dataset.nqDragging).toBeUndefined();
  });

  it("Alt+ArrowRight / Alt+ArrowLeft move the focused measure; focus follows it", async () => {
    const [actual] = measureHeads();
    actual!.focus();
    await key(actual!, "ArrowRight", { altKey: true });
    expect(calls).toEqual([["order", ["plan", "actual", "growth"]]]);
    await nextFrame();
    expect((document.activeElement as HTMLElement).dataset.nqMeasure).toBe("actual");
    expect(measureHeads().indexOf(document.activeElement as HTMLElement)).toBe(1);
    await key(document.activeElement!, "ArrowLeft", { altKey: true });
    await key(document.activeElement!, "ArrowLeft", { altKey: true }); // already first: no call
    await nextFrame();
    expect(calls.map((c) => c[1])).toEqual([
      ["plan", "actual", "growth"],
      ["actual", "plan", "growth"],
    ]);
    // Plain arrows (no Alt) do nothing.
    await key(document.activeElement!, "ArrowRight");
    expect(calls).toHaveLength(2);
  });
});

describe("PivotTable accessibility", () => {
  it("every handle and reorderable header is reachable with Tab", () => {
    const handles = Array.from(container.querySelectorAll<HTMLElement>('[role="separator"]'));
    expect(handles.length).toBe(model.columns.length + 2 + 1);
    expect(handles.every((h) => h.tabIndex === 0 && h.getAttribute("aria-valuenow") !== null && h.getAttribute("aria-label")?.startsWith("Resize"))).toBe(true);
    expect(Array.from(container.querySelectorAll<HTMLElement>("th[data-nq-run]")).every((th) => th.tabIndex === 0)).toBe(true);
  });

  it("axe finds no violations with every design option on", async () => {
    await act(() =>
      root.render(
        <Host
          calls={calls}
          extra={{
            heat: [{ measure: "actual" }, { measure: "growth", scale: "diverging" }],
            bars: [{ measure: "plan" }],
            bandedRows: true,
            dataAttributes: true,
            measureLayout: { growth: { align: "center" } },
            onToggleGroup: () => {},
            "aria-label": "FY26 plan",
          }}
        />,
      ),
    );
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.help}`)).toEqual([]);
  });
});
