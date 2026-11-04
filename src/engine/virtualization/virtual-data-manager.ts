export interface VirtualDataSource {
  rowCount: number;
  columnCount: number;
  pageSize?: number;
  /** Fetch rows [offset, offset+limit). Returns string[][] where outer index is row. */
  fetchRows(offset: number, limit: number): Promise<string[][]>;
  /** Enable adjacent-page prefetch. Default true. */
  prefetch?: boolean;
}

export interface DataPage {
  offset: number;
  limit: number;
  data: string[][];
  timestamp: number;
  isLoading: boolean;
  error?: Error;
}

export interface VirtualDataManagerOptions {
  /** Max pages to keep in cache (LRU by timestamp). Default 50. */
  cacheSize?: number;
  /** Evict pages older than this (ms). Default 5 min. */
  maxCacheAge?: number;
}

export class VirtualDataManager {
  private source: VirtualDataSource;
  private pages = new Map<number, DataPage>();
  private loading = new Set<number>();
  private listeners = new Set<() => void>();
  private cacheSize: number;
  private maxCacheAge: number;

  constructor(source: VirtualDataSource, opts: VirtualDataManagerOptions = {}) {
    this.source = source;
    this.cacheSize = opts.cacheSize ?? 50;
    this.maxCacheAge = opts.maxCacheAge ?? 5 * 60 * 1000;
  }

  updateSource(source: VirtualDataSource): void {
    this.source = source;
    this.clearCache();
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  /** Ensure all pages covering [startRow, endRow) are loaded. Prefetches ±1 page. */
  async ensureLoaded(startRow: number, endRow: number): Promise<void> {
    const size = this.source.pageSize ?? 500;
    const first = Math.floor(startRow / size);
    const last = Math.floor(Math.max(0, endRow - 1) / size);
    const maxPage = Math.ceil(this.source.rowCount / size) - 1;

    const required: Promise<void>[] = [];
    for (let p = first; p <= last; p++) {
      if (!this.hasPage(p) && !this.loading.has(p)) {
        required.push(this.loadPage(p));
      }
    }

    if (this.source.prefetch !== false) {
      for (const p of [first - 1, last + 1]) {
        if (p >= 0 && p <= maxPage && !this.hasPage(p) && !this.loading.has(p)) {
          this.loadPage(p).catch(() => undefined);
        }
      }
    }

    if (required.length > 0) {
      await Promise.allSettled(required);
      this.notify();
    }
  }

  private async loadPage(pageIndex: number): Promise<void> {
    const size = this.source.pageSize ?? 500;
    const offset = pageIndex * size;
    const limit = Math.min(size, this.source.rowCount - offset);
    if (limit <= 0) return;

    this.loading.add(pageIndex);
    const page: DataPage = { offset, limit, data: [], timestamp: Date.now(), isLoading: true };
    this.pages.set(pageIndex, page);

    try {
      page.data = await this.source.fetchRows(offset, limit);
      page.isLoading = false;
      page.timestamp = Date.now();
      this.loading.delete(pageIndex);
      this.evict();
    } catch (err) {
      page.error = err instanceof Error ? err : new Error(String(err));
      page.isLoading = false;
      this.loading.delete(pageIndex);
      this.evict();
    }
  }

  private hasPage(idx: number): boolean {
    const p = this.pages.get(idx);
    return !!p && !p.isLoading && !p.error;
  }

  getCell(row: number, col: number): string | null {
    const size = this.source.pageSize ?? 500;
    const page = this.pages.get(Math.floor(row / size));
    if (!page || page.isLoading || page.error) return null;
    return page.data[row % size]?.[col] ?? null;
  }

  getRow(row: number): string[] | null {
    const size = this.source.pageSize ?? 500;
    const page = this.pages.get(Math.floor(row / size));
    if (!page || page.isLoading || page.error) return null;
    return page.data[row % size] ?? null;
  }

  isLoadingRange(startRow: number, endRow: number): boolean {
    const size = this.source.pageSize ?? 500;
    for (let p = Math.floor(startRow / size); p <= Math.floor(Math.max(0, endRow - 1) / size); p++) {
      const page = this.pages.get(p);
      if (!page || page.isLoading || this.loading.has(p)) return true;
    }
    return false;
  }

  getError(startRow: number, endRow: number): Error | null {
    const size = this.source.pageSize ?? 500;
    for (let p = Math.floor(startRow / size); p <= Math.floor(Math.max(0, endRow - 1) / size); p++) {
      const err = this.pages.get(p)?.error;
      if (err) return err;
    }
    return null;
  }

  clearCache(): void {
    this.pages.clear();
    this.loading.clear();
  }

  /** A page occupies cache only when it holds real data (loaded, no error). */
  private isLoaded(page: DataPage): boolean {
    return !page.isLoading && !page.error;
  }

  private loadedPageCount(): number {
    let count = 0;
    for (const page of this.pages.values()) {
      if (this.isLoaded(page)) count++;
    }
    return count;
  }

  private evict(): void {
    const now = Date.now();

    // Prune errored pages once they age out. They carry no data but their Map
    // entries would otherwise accumulate forever across a long session of
    // intermittent fetch failures — loadedPageCount() ignores them and the LRU
    // pass below only ever deletes loaded pages. A still-visible errored page is
    // reloaded by ensureLoaded (hasPage() is false for errors), so pruning an
    // aged-out one is safe.
    for (const [idx, page] of this.pages) {
      if (page.error && now - page.timestamp > this.maxCacheAge) {
        this.pages.delete(idx);
      }
    }

    // Only successfully-loaded pages count toward cache occupancy. Early-return
    // before sorting when we're within budget so eviction stays cheap per load.
    if (this.loadedPageCount() <= this.cacheSize) return;

    const entries = [...this.pages.entries()]
      .filter(([, page]) => this.isLoaded(page))
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);
    let loaded = entries.length;
    for (const [idx, page] of entries) {
      if (loaded <= this.cacheSize && now - page.timestamp <= this.maxCacheAge) break;
      this.pages.delete(idx);
      loaded--;
    }
  }

  getStats() {
    const size = this.source.pageSize ?? 500;
    return {
      totalPages: Math.ceil(this.source.rowCount / size),
      loadedPages: this.loadedPageCount(),
      loadingPages: this.loading.size,
      cacheSize: this.cacheSize,
      prefetch: this.source.prefetch !== false,
    };
  }
}
