// Whole-market dashboard data. Polygon "grouped daily" returns the entire US stock
// market (~12k tickers) in ONE call, so the full dashboard costs just 2 calls
// (latest trading day + prior day for the day-over-day % change).

import { fetchGroupedDaily, type GroupedBar } from "./mmd";
import { lookupName } from "./tickers";
import { cacheGet, cacheSet, cacheAge } from "./storage";

export interface MarketRow {
  ticker: string;
  name: string | null;
  close: number;
  changePct: number | null;
  volume: number;
  dollarVolume: number;
}

export interface MarketSnapshot {
  rows: MarketRow[];
  date: string;
  prevDate: string | null;
  total: number;
  fetchedAt: string;
}

const CACHE_KEY = "market:all";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isWeekday(d: Date): boolean {
  const day = d.getUTCDay();
  return day !== 0 && day !== 6;
}

// Step back from `start` to the most recent weekday whose grouped data is non-empty.
// Weekends are skipped without an API call; holidays cost one empty call then step back.
async function findTradingDay(
  apiKey: string,
  start: Date,
  onStatus: ((m: string) => void) | undefined,
  maxBack = 6
): Promise<{ date: string; bars: GroupedBar[] } | null> {
  const d = new Date(start.getTime());
  for (let i = 0; i < maxBack; i++) {
    if (isWeekday(d)) {
      const date = ymd(d);
      onStatus?.(`Fetching market data for ${date}…`);
      const bars = await fetchGroupedDaily(apiKey, date);
      if (bars.length > 0) return { date, bars };
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return null;
}

export async function loadMarket(
  apiKey: string,
  onStatus?: (m: string) => void,
  force = false
): Promise<MarketSnapshot> {
  if (!force) {
    const cached = cacheGet<MarketSnapshot>(CACHE_KEY);
    if (cached && cached.rows?.length) {
      onStatus?.(`Loaded ${cached.total} stocks from cache.`);
      return cached;
    }
  }

  const latest = await findTradingDay(apiKey, new Date(), onStatus);
  if (!latest) throw new Error("No recent trading day with data was found.");

  // Prior trading day for % change (start one day before the latest).
  const priorStart = new Date(latest.date + "T00:00:00Z");
  priorStart.setUTCDate(priorStart.getUTCDate() - 1);
  onStatus?.("Fetching prior day for change %…");
  const prior = await findTradingDay(apiKey, priorStart, onStatus);

  const prevClose = new Map<string, number>();
  if (prior) for (const b of prior.bars) prevClose.set(b.T, b.c);

  const rows: MarketRow[] = latest.bars.map((b) => {
    const prev = prevClose.get(b.T);
    return {
      ticker: b.T,
      name: lookupName(b.T),
      close: b.c,
      volume: b.v,
      dollarVolume: b.c * b.v,
      changePct: prev && prev > 0 ? ((b.c - prev) / prev) * 100 : null,
    };
  });

  const snap: MarketSnapshot = {
    rows,
    date: latest.date,
    prevDate: prior?.date ?? null,
    total: rows.length,
    fetchedAt: new Date().toISOString(),
  };
  cacheSet(CACHE_KEY, snap);
  onStatus?.(`Loaded ${rows.length} stocks.`);
  return snap;
}

export function marketCacheAgeMin(): number | null {
  return cacheAge(CACHE_KEY);
}

// --- derived views ---

export interface MarketViews {
  gainers: MarketRow[];
  losers: MarketRow[];
  mostActive: MarketRow[];
}

// "Liquid" filter keeps real movers out of penny-stock noise.
export function deriveViews(
  rows: MarketRow[],
  minDollarVolume = 1_000_000,
  topN = 100
): MarketViews {
  const liquid = rows.filter((r) => r.dollarVolume >= minDollarVolume);
  const withChange = liquid.filter((r) => r.changePct != null);
  const gainers = [...withChange]
    .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))
    .slice(0, topN);
  const losers = [...withChange]
    .sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0))
    .slice(0, topN);
  const mostActive = [...liquid]
    .sort((a, b) => b.dollarVolume - a.dollarVolume)
    .slice(0, topN);
  return { gainers, losers, mostActive };
}

export function searchMarket(rows: MarketRow[], query: string, limit = 100): MarketRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: MarketRow[] = [];
  for (const r of rows) {
    if (
      r.ticker.toLowerCase().includes(q) ||
      (r.name && r.name.toLowerCase().includes(q))
    ) {
      out.push(r);
      if (out.length >= limit * 3) break; // gather extra, then rank
    }
  }
  // Rank: ticker exact > ticker prefix > rest, then by dollar volume.
  return out
    .sort((a, b) => {
      const score = (r: MarketRow) =>
        r.ticker.toLowerCase() === q
          ? 3
          : r.ticker.toLowerCase().startsWith(q)
            ? 2
            : 1;
      const d = score(b) - score(a);
      return d !== 0 ? d : b.dollarVolume - a.dollarVolume;
    })
    .slice(0, limit);
}
