const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  ts: number;
}

export function cacheSet<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, ts: Date.now() };
    localStorage.setItem(`das:${key}`, JSON.stringify(entry));
  } catch {
    // storage quota — ignore
  }
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`das:${key}`);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.ts > TTL_MS) {
      localStorage.removeItem(`das:${key}`);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function cacheClear(ticker?: string): void {
  if (ticker) {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`das:`) && k.includes(ticker.toUpperCase()))
      .forEach((k) => localStorage.removeItem(k));
  } else {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("das:"))
      .forEach((k) => localStorage.removeItem(k));
  }
}

export function cacheAge(key: string): number | null {
  try {
    const raw = localStorage.getItem(`das:${key}`);
    if (!raw) return null;
    const entry: CacheEntry<unknown> = JSON.parse(raw);
    return Math.round((Date.now() - entry.ts) / 60000); // minutes
  } catch {
    return null;
  }
}
