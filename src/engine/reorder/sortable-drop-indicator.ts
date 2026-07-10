import type { CSSProperties } from "react";

/** Data attribute for resolving a sortable item's DOM node during drop-line measurement. */
export const SORTABLE_DROP_TARGET_ATTR = "data-nqgrid-sortable-id";

/** Mark a sortable item root (`<tr>`, `<th>`, etc.) for drop-line geometry lookup. */
export function sortableDropTargetProps(id: string): { [SORTABLE_DROP_TARGET_ATTR]: string } {
  return { [SORTABLE_DROP_TARGET_ATTR]: id };
}

export type SortableDropEdge = "before" | "after";

export type SortableDropOrientation = "vertical" | "horizontal";

export type SortableDropClientRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type SortableDropPointer = {
  x: number;
  y: number;
};

export type SortableDropTarget = {
  overId: string;
  edge: SortableDropEdge;
};

export type SortableDropDragInput = {
  activeId: string;
  overId: string;
  pointer: SortableDropPointer | null;
  overRect: SortableDropClientRect;
  activeSortableIndex?: number;
  overSortableIndex?: number;
};

/** Duck-typed @dnd-kit/core drag event (no runtime dependency). */
export type SortableDropDndEventLike = {
  active: {
    id: unknown;
    rect: { current: { translated: SortableDropClientRect | null } };
    data: { current?: { sortable?: { index?: number } } };
  };
  over: {
    id: unknown;
    rect: SortableDropClientRect;
    data: { current?: { sortable?: { index?: number } } };
  } | null;
  delta: { x: number; y: number };
  activatorEvent: Event;
};

/** Live pointer position during drag — activator + delta tracks the cursor naturally. */
export function sortableDropPointerFromDndEvent(
  event: Pick<SortableDropDndEventLike, "activatorEvent" | "delta" | "active">,
): SortableDropPointer | null {
  const activator = event.activatorEvent;
  if (
    activator &&
    "clientX" in activator &&
    "clientY" in activator &&
    typeof activator.clientX === "number" &&
    typeof activator.clientY === "number"
  ) {
    return {
      x: activator.clientX + event.delta.x,
      y: activator.clientY + event.delta.y,
    };
  }

  const translated = event.active.rect.current.translated;
  if (!translated) return null;

  return {
    x: translated.left + translated.width / 2,
    y: translated.top + translated.height / 2,
  };
}

/** Normalize a dnd-kit drag move/over event into engine drop-indicator input. */
export function sortableDropInputFromDndEvent(
  event: SortableDropDndEventLike,
): SortableDropDragInput | null {
  const { active, over } = event;
  if (!over || active.id === over.id) return null;

  return {
    activeId: String(active.id),
    overId: String(over.id),
    pointer: sortableDropPointerFromDndEvent(event),
    overRect: over.rect,
    activeSortableIndex: active.data.current?.sortable?.index,
    overSortableIndex: over.data.current?.sortable?.index,
  };
}

/** Resolve insert-before vs insert-after from cursor position over the target rect. */
export function resolveSortableDropTarget(
  input: SortableDropDragInput,
  orientation: SortableDropOrientation,
): SortableDropTarget {
  const { pointer, overRect, activeSortableIndex, overSortableIndex } = input;

  if (pointer) {
    if (orientation === "vertical") {
      const midY = overRect.top + overRect.height / 2;
      return {
        overId: input.overId,
        edge: pointer.y < midY ? "before" : "after",
      };
    }

    const midX = overRect.left + overRect.width / 2;
    return {
      overId: input.overId,
      edge: pointer.x < midX ? "before" : "after",
    };
  }

  if (activeSortableIndex != null && overSortableIndex != null) {
    return {
      overId: input.overId,
      edge: activeSortableIndex < overSortableIndex ? "after" : "before",
    };
  }

  return { overId: input.overId, edge: "before" };
}

function escapeSelectorValue(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Nearest scrollable ancestor used to re-measure the line while the viewport moves. */
export function findSortableDropScrollRoot(container: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = container.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(style.overflowY) || /(auto|scroll|overlay)/.test(style.overflowX)) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/** Absolute drop-line geometry inside `container` — consumer owns color/thickness classes. */
export function getSortableDropIndicatorStyle(
  container: HTMLElement,
  target: SortableDropTarget,
  orientation: SortableDropOrientation,
): CSSProperties | null {
  const node = container.querySelector<HTMLElement>(
    `[${SORTABLE_DROP_TARGET_ATTR}="${escapeSelectorValue(target.overId)}"]`,
  );
  if (!node) return null;

  const targetRect = node.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  if (orientation === "vertical") {
    const top =
      targetRect.top - containerRect.top + (target.edge === "after" ? targetRect.height : 0);
    return {
      position: "absolute",
      pointerEvents: "none",
      top,
      left: 0,
      width: container.scrollWidth,
      height: 2,
      zIndex: 60,
    };
  }

  const left =
    targetRect.left - containerRect.left + (target.edge === "after" ? targetRect.width : 0);
  return {
    position: "absolute",
    pointerEvents: "none",
    left,
    top: 0,
    width: 2,
    height: container.scrollHeight,
    zIndex: 60,
  };
}

export type SortableDragGhostStyles = {
  /** Placeholder over the item's original slot while dragging. */
  source: CSSProperties | null;
  /** Preview slot at the cursor-aligned insert position. */
  landing: CSSProperties | null;
};

function getSortableDropTargetElement(
  container: HTMLElement,
  id: string,
): HTMLElement | null {
  return container.querySelector<HTMLElement>(
    `[${SORTABLE_DROP_TARGET_ATTR}="${escapeSelectorValue(id)}"]`,
  );
}

/** Source + landing ghost geometry for table row/column reorder previews. */
export function getSortableDragGhostStyles(
  container: HTMLElement,
  activeId: string,
  dropTarget: SortableDropTarget | null,
  orientation: SortableDropOrientation,
): SortableDragGhostStyles {
  const activeEl = getSortableDropTargetElement(container, activeId);
  if (!activeEl) return { source: null, landing: null };

  const containerRect = container.getBoundingClientRect();
  const activeRect = activeEl.getBoundingClientRect();

  const base: CSSProperties = {
    position: "absolute",
    pointerEvents: "none",
    zIndex: 55,
  };

  const source: CSSProperties =
    orientation === "horizontal"
      ? {
          ...base,
          top: 0,
          left: activeRect.left - containerRect.left + container.scrollLeft,
          width: activeRect.width,
          height: container.scrollHeight,
        }
      : {
          ...base,
          left: 0,
          top: activeRect.top - containerRect.top + container.scrollTop,
          width: container.scrollWidth,
          height: activeRect.height,
        };

  if (!dropTarget) return { source, landing: null };

  const overEl = getSortableDropTargetElement(container, dropTarget.overId);
  if (!overEl) return { source, landing: null };

  const overRect = overEl.getBoundingClientRect();

  const landing: CSSProperties =
    orientation === "horizontal"
      ? {
          ...base,
          zIndex: 56,
          top: 0,
          left:
            (dropTarget.edge === "before" ? overRect.left : overRect.right) -
            containerRect.left +
            container.scrollLeft,
          width: activeRect.width,
          height: container.scrollHeight,
        }
      : {
          ...base,
          zIndex: 56,
          left: 0,
          top:
            (dropTarget.edge === "before" ? overRect.top : overRect.bottom) -
            containerRect.top +
            container.scrollTop,
          width: container.scrollWidth,
          height: activeRect.height,
        };

  return { source, landing };
}

/** Bind engine drop tracking to @nqlib/nqui `Sortable` / dnd-kit `DndContext` handler props. */
export function sortableDropDndKitProps(handlers: {
  onDragStart: (activeId: string) => void;
  onDragMove: (input: SortableDropDragInput | null) => void;
  onDragEnd: () => void;
  onDragCancel: () => void;
}) {
  const ingest = (event: unknown) => {
    handlers.onDragMove(sortableDropInputFromDndEvent(event as SortableDropDndEventLike));
  };

  return {
    onDragStart: (event: unknown) => {
      handlers.onDragStart(String((event as { active: { id: unknown } }).active.id));
    },
    onDragMove: ingest,
    onDragOver: ingest,
    onDragEnd: handlers.onDragEnd,
    onDragCancel: handlers.onDragCancel,
  };
}
