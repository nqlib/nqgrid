/** Shared ARIA helpers for table vs grid hosts. */

export type TableDensityRole = "table" | "grid";

export function getTableWrapperAria(
  mode: TableDensityRole,
  opts: { ariaLabel?: string; ariaRowCount?: number },
): {
  role: TableDensityRole;
  "aria-label"?: string;
  "aria-rowcount"?: number;
} {
  if (mode === "grid") {
    return {
      role: "grid",
      ...(opts.ariaLabel ? { "aria-label": opts.ariaLabel } : {}),
      ...(opts.ariaRowCount != null ? { "aria-rowcount": opts.ariaRowCount } : {}),
    };
  }
  return {
    role: "table",
    ...(opts.ariaLabel ? { "aria-label": opts.ariaLabel } : {}),
  };
}

/**
 * Row-level ARIA for `role=row`. `index` is 0-based; emitted `aria-rowindex` is
 * 1-based per spec (header row is 1). Pass `headerOffset` if a sticky header row
 * occupies index 1 (defaults to 1 so the first body row reports 2).
 */
export function getRowAria(opts: {
  index: number;
  selected?: boolean;
  expanded?: boolean;
  /** Active keyboard reorder grab. Emits `aria-grabbed`. */
  grabbed?: boolean;
  /** 1-based offset for the first body row. Default 2 (header at 1). */
  headerOffset?: number;
}): {
  "aria-rowindex": number;
  "aria-selected"?: boolean;
  "aria-expanded"?: boolean;
  "aria-grabbed"?: boolean;
} {
  const offset = opts.headerOffset ?? 2;
  return {
    "aria-rowindex": opts.index + offset,
    ...(opts.selected != null ? { "aria-selected": opts.selected } : {}),
    ...(opts.expanded != null ? { "aria-expanded": opts.expanded } : {}),
    ...(opts.grabbed != null ? { "aria-grabbed": opts.grabbed } : {}),
  };
}

/**
 * Cell-level ARIA for `role=gridcell` / `role=columnheader`. `colIndex` is
 * 0-based; emitted `aria-colindex` is 1-based per spec.
 */
export function getCellAria(opts: {
  colIndex: number;
  selected?: boolean;
}): {
  "aria-colindex": number;
  "aria-selected"?: boolean;
} {
  return {
    "aria-colindex": opts.colIndex + 1,
    ...(opts.selected != null ? { "aria-selected": opts.selected } : {}),
  };
}

/**
 * ARIA for the select-column grip when it doubles as a reorder handle. Surfaces
 * `aria-grabbed`/`aria-dropeffect` so AT announces drag state during a keyboard
 * or pointer move. Pair with `useRowKeyboardReorder`.
 */
export function getDragHandleAria(opts: {
  label: string;
  grabbed?: boolean;
}): {
  role: "button";
  "aria-label": string;
  "aria-grabbed": boolean;
  "aria-dropeffect": "move" | "none";
} {
  const grabbed = opts.grabbed ?? false;
  return {
    role: "button",
    "aria-label": opts.label,
    "aria-grabbed": grabbed,
    "aria-dropeffect": grabbed ? "move" : "none",
  };
}

/** Document RTL inline direction for pinned `left` math (callers flip offsets). */
export function getDirectionDocument(): "ltr" | "rtl" {
  if (typeof document === "undefined") return "ltr";
  const dir = document.documentElement.getAttribute("dir");
  return dir === "rtl" ? "rtl" : "ltr";
}
