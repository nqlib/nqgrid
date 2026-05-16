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

/** Document RTL inline direction for pinned `left` math (callers flip offsets). */
export function getDirectionDocument(): "ltr" | "rtl" {
  if (typeof document === "undefined") return "ltr";
  const dir = document.documentElement.getAttribute("dir");
  return dir === "rtl" ? "rtl" : "ltr";
}
