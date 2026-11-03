/** Clamp zero-based page index to `[0, pageCount - 1]`. */
export function clampPageIndex(pageIndex: number, pageCount: number): number {
  if (pageCount <= 0) return 0;
  return Math.max(0, Math.min(pageIndex, pageCount - 1));
}

/** Number of pages for `total` rows and fixed `pageSize` (minimum 1). */
export function getPageCount(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Slice `rows` for zero-based `pageIndex` and `pageSize`. */
export function slicePage<T>(rows: readonly T[], pageIndex: number, pageSize: number): T[] {
  if (pageSize <= 0) return [];
  const start = pageIndex * pageSize;
  return rows.slice(start, start + pageSize);
}
