import { describe, expect, it } from "vitest";

import { VirtualDataManager, type VirtualDataSource } from "./virtual-data-manager";

function makeSource(
  overrides: Partial<VirtualDataSource> & Pick<VirtualDataSource, "fetchRows">,
): VirtualDataSource {
  return {
    rowCount: 1000,
    columnCount: 2,
    pageSize: 10,
    prefetch: false,
    ...overrides,
  };
}

describe("VirtualDataManager stats and eviction", () => {
  it("does not count loading or errored pages toward loadedPages", async () => {
    let resolveHang: () => void = () => undefined;
    const source = makeSource({
      async fetchRows(offset) {
        // page 1 (offset 10) errors; page 2 (offset 20) hangs forever.
        if (offset === 10) throw new Error("boom");
        if (offset === 20) {
          await new Promise<void>((res) => {
            resolveHang = res;
          });
          return [];
        }
        return Array.from({ length: 10 }, (_, r) => [`r${offset + r}`, "x"]);
      },
    });

    const mgr = new VirtualDataManager(source);

    // Load page 0 (real), page 1 (error), and start page 2 (loading).
    await mgr.ensureLoaded(0, 10); // page 0
    await mgr.ensureLoaded(10, 20); // page 1 -> errors
    void mgr.ensureLoaded(20, 30); // page 2 -> hangs, stays loading

    const stats = mgr.getStats();
    // Only the one genuinely-loaded page counts.
    expect(stats.loadedPages).toBe(1);

    resolveHang();
  });

  it("evicts only real pages and keeps loaded neighbors under cacheSize pressure", async () => {
    const source = makeSource({
      rowCount: 1000,
      pageSize: 10,
      async fetchRows(offset) {
        if (offset === 10) throw new Error("boom"); // page 1 errors
        return Array.from({ length: 10 }, (_, r) => [`r${offset + r}`, "x"]);
      },
    });

    // cacheSize 2: an errored page must not push a genuinely-loaded page out.
    const mgr = new VirtualDataManager(source, { cacheSize: 2 });

    await mgr.ensureLoaded(0, 10); // page 0 (loaded)
    await mgr.ensureLoaded(10, 20); // page 1 (errored, must not occupy a slot)
    await mgr.ensureLoaded(20, 30); // page 2 (loaded)

    // Two real pages, both under the cacheSize=2 budget: neither evicted.
    expect(mgr.getStats().loadedPages).toBe(2);
    expect(mgr.getCell(0, 0)).toBe("r0");
    expect(mgr.getCell(20, 0)).toBe("r20");
  });
});
