import { describe, expect, it } from "vitest";

import {
  resolveSortableDropTarget,
  sortableDropInputFromDndEvent,
  sortableDropPointerFromDndEvent,
  type SortableDropDndEventLike,
} from "./sortable-drop-indicator";

function dndEvent(overrides: Partial<SortableDropDndEventLike> = {}): SortableDropDndEventLike {
  return {
    active: {
      id: "a",
      rect: { current: { translated: null } },
      data: { current: { sortable: { index: 0 } } },
    },
    over: null,
    delta: { x: 0, y: 0 },
    activatorEvent: { clientX: 100, clientY: 100 } as PointerEvent,
    ...overrides,
  };
}

describe("sortableDropPointerFromDndEvent", () => {
  it("tracks cursor via activator + delta", () => {
    const pointer = sortableDropPointerFromDndEvent(
      dndEvent({
        delta: { x: 12, y: -8 },
        activatorEvent: { clientX: 50, clientY: 200 } as PointerEvent,
      }),
    );
    expect(pointer).toEqual({ x: 62, y: 192 });
  });
});

describe("resolveSortableDropTarget", () => {
  it("uses cursor Y for vertical before/after", () => {
    const overRect = { top: 100, left: 0, width: 400, height: 28 };
    const input = {
      activeId: "a",
      overId: "b",
      pointer: { x: 200, y: 110 },
      overRect,
    };

    expect(resolveSortableDropTarget(input, "vertical")).toEqual({
      overId: "b",
      edge: "before",
    });

    expect(
      resolveSortableDropTarget({ ...input, pointer: { x: 200, y: 120 } }, "vertical"),
    ).toEqual({
      overId: "b",
      edge: "after",
    });
  });

  it("uses cursor X for horizontal before/after", () => {
    const overRect = { top: 0, left: 100, width: 80, height: 32 };
    const input = {
      activeId: "a",
      overId: "col",
      pointer: { x: 130, y: 10 },
      overRect,
    };

    expect(resolveSortableDropTarget(input, "horizontal")).toEqual({
      overId: "col",
      edge: "before",
    });

    expect(
      resolveSortableDropTarget({ ...input, pointer: { x: 150, y: 10 } }, "horizontal"),
    ).toEqual({
      overId: "col",
      edge: "after",
    });
  });

  it("falls back to sortable index when pointer is unavailable", () => {
    expect(
      resolveSortableDropTarget(
        {
          activeId: "a",
          overId: "b",
          pointer: null,
          overRect: { top: 0, left: 0, width: 10, height: 10 },
          activeSortableIndex: 0,
          overSortableIndex: 2,
        },
        "vertical",
      ),
    ).toEqual({ overId: "b", edge: "after" });
  });
});

describe("sortableDropInputFromDndEvent", () => {
  it("returns null when not over a target", () => {
    expect(sortableDropInputFromDndEvent(dndEvent({ over: null }))).toBeNull();
  });

  it("returns null when active equals over", () => {
    expect(
      sortableDropInputFromDndEvent(
        dndEvent({
          over: {
            id: "a",
            rect: { top: 0, left: 0, width: 10, height: 10 },
            data: { current: { sortable: { index: 0 } } },
          },
        }),
      ),
    ).toBeNull();
  });
});
