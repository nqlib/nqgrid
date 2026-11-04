import type { SyntheticEvent } from "react";

/** Stop parent `SortableItem asHandle` from capturing pointer/keyboard for nested controls. */
export function stopSortableChain(e: SyntheticEvent) {
  e.stopPropagation();
}

/** Spread onto sort/menu/resize controls inside a sortable header or row handle. */
export const sortableNestedControlProps = {
  onPointerDown: stopSortableChain,
  onMouseDown: stopSortableChain,
  onTouchStart: stopSortableChain,
  onClick: stopSortableChain,
  onKeyDown: stopSortableChain,
} as const;
