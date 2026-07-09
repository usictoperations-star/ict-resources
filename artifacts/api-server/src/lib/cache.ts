interface CacheEntry<T> {
  value: T;
  cachedAt: string;
  expiresAt: number;
}

class TtlCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): { value: T; cachedAt: string } | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return { value: entry.value, cachedAt: entry.cachedAt };
  }

  set<T>(key: string, value: T, ttlMs: number): string {
    const cachedAt = new Date().toISOString();
    this.store.set(key, { value, cachedAt, expiresAt: Date.now() + ttlMs });
    return cachedAt;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export const cache = new TtlCache();
export const DASHBOARD_TTL_MS = 60 * 1000;
