import type { OHLCBar } from "./analytics";

// Rate limiter: max 5 calls/min → 12s between calls, with 429 backoff.
let lastCallTime = 0;
const MIN_INTERVAL_MS = 12_000;
const BACKOFF_MS = 20_000; // wait past the 1-minute window on a 429

async function rateLimitedFetch(url: string, retries = 2): Promise<Response> {
  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastCallTime);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastCallTime = Date.now();
  const res = await fetch(url);
  if (res.status === 429 && retries > 0) {
    await new Promise((r) => setTimeout(r, BACKOFF_MS));
    return rateLimitedFetch(url, retries - 1);
  }
  return res;
}

export interface MMDAggsResponse {
  ticker: string;
  results?: {
    t: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
    vw?: number;
    n?: number;
  }[];
  status: string;
  resultsCount?: number;
}

async function fetchAggs(
  apiKey: string,
  ticker: string,
  multiplier: number,
  timespan: "day" | "week" | "month",
  from: string,
  to: string
): Promise<OHLCBar[]> {
  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=5000&apiKey=${apiKey}`;
  const res = await rateLimitedFetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MMD ${ticker} ${timespan}: ${res.status} ${text}`);
  }
  const data: MMDAggsResponse = await res.json();
  return (data.results ?? []).map((r) => ({
    t: r.t,
    o: r.o,
    h: r.h,
    l: r.l,
    c: r.c,
    v: r.v,
  }));
}

export async function fetchMonthlyBars(
  apiKey: string,
  ticker: string,
  years = 2
): Promise<OHLCBar[]> {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - years * 365 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
  return fetchAggs(apiKey, ticker, 1, "month", from, to);
}

export async function fetchDailyBars(
  apiKey: string,
  ticker: string,
  days = 60
): Promise<OHLCBar[]> {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - days * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
  return fetchAggs(apiKey, ticker, 1, "day", from, to);
}

export async function fetchPrevClose(
  apiKey: string,
  ticker: string
): Promise<number> {
  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${apiKey}`;
  const res = await rateLimitedFetch(url);
  if (!res.ok) throw new Error(`MMD prev close ${ticker}: ${res.status}`);
  const data = await res.json();
  return data.results?.[0]?.c ?? 0;
}

export interface PolygonNewsArticle {
  title?: string;
  description?: string;
  article_url?: string;
  published_utc?: string;
  publisher?: { name?: string };
  tickers?: string[];
  insights?: { ticker: string; sentiment: string; sentiment_reasoning?: string }[];
}

// Free news (included in the MMD plan) with per-ticker sentiment insights — $0 Apify.
export async function fetchPolygonNews(
  apiKey: string,
  ticker: string,
  limit = 10
): Promise<PolygonNewsArticle[]> {
  const url = `https://api.polygon.io/v2/reference/news?ticker=${ticker}&limit=${limit}&order=desc&sort=published_utc&apiKey=${apiKey}`;
  const res = await rateLimitedFetch(url);
  if (!res.ok) throw new Error(`MMD news ${ticker}: ${res.status}`);
  const data = await res.json();
  return (data.results ?? []) as PolygonNewsArticle[];
}

export interface GroupedBar {
  T: string; // ticker
  c: number; // close
  o: number;
  h: number;
  l: number;
  v: number; // volume
  vw?: number; // VWAP
  n?: number; // trade count
}

// Whole US stock market for one day in a SINGLE call (~12k tickers). EOD data.
export async function fetchGroupedDaily(
  apiKey: string,
  date: string
): Promise<GroupedBar[]> {
  const url = `https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/${date}?adjusted=true&apiKey=${apiKey}`;
  const res = await rateLimitedFetch(url);
  if (!res.ok) {
    if (res.status === 403)
      throw new Error("Grouped market data is not authorized on this API plan.");
    throw new Error(`MMD grouped ${date}: ${res.status}`);
  }
  const data = await res.json();
  return (data.results ?? []) as GroupedBar[];
}
