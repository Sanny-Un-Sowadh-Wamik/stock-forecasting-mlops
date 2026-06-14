// Pillar 5 — Prediction-market cross-reference (Polymarket Gamma API).
// Real-money crowd odds, distinct from news sentiment. CORS-open public API — no key, no proxy.
// Verified endpoints: /public-search?q=  and  /markets

const GAMMA = "https://gamma-api.polymarket.com";

export interface PolyOutcome {
  name: string;
  prob: number; // 0..1 implied probability
}

export interface PolyMarket {
  question: string;
  outcomes: PolyOutcome[];
  topOutcome: PolyOutcome | null; // highest-probability outcome
  volume: number;
  weekChange: number; // oneWeekPriceChange of the primary outcome (crowd momentum)
  endDate: string;
  url: string;
  eventTitle: string;
}

export interface PolySnapshot {
  direct: PolyMarket[]; // markets naming the ticker / company
  macro: PolyMarket[]; // recession / rate / economy backdrop
  fetchedAt: string;
}

function parseJsonArray(s: unknown): string[] {
  if (Array.isArray(s)) return s as string[];
  if (typeof s !== "string") return [];
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function toMarket(m: any, eventTitle: string, eventSlug: string): PolyMarket | null {
  if (!m || m.active === false || m.closed === true) return null;
  const names = parseJsonArray(m.outcomes);
  const prices = parseJsonArray(m.outcomePrices).map((p) => parseFloat(p));
  if (!names.length || names.length !== prices.length) return null;
  // If any price is unparseable, skip the market rather than show a fake 0%.
  if (prices.some((p) => !isFinite(p))) return null;
  const outcomes: PolyOutcome[] = names.map((name, i) => ({
    name,
    prob: prices[i],
  }));
  const topOutcome = [...outcomes].sort((a, b) => b.prob - a.prob)[0] ?? null;
  const volume =
    typeof m.volumeNum === "number"
      ? m.volumeNum
      : parseFloat(m.volume ?? "0") || 0;
  return {
    question: String(m.question ?? eventTitle),
    outcomes,
    topOutcome,
    volume,
    weekChange: typeof m.oneWeekPriceChange === "number" ? m.oneWeekPriceChange : 0,
    endDate: String(m.endDate ?? m.endDateIso ?? ""),
    url: `https://polymarket.com/event/${m.slug ?? eventSlug}`,
    eventTitle,
  };
}

async function searchEvents(query: string): Promise<PolyMarket[]> {
  try {
    const res = await fetch(
      `${GAMMA}/public-search?q=${encodeURIComponent(query)}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const events: any[] = data.events ?? [];
    const markets: PolyMarket[] = [];
    for (const ev of events) {
      const evMarkets: any[] = ev.markets ?? [];
      for (const m of evMarkets) {
        const parsed = toMarket(m, ev.title ?? "", ev.slug ?? "");
        if (parsed) markets.push(parsed);
      }
    }
    return markets;
  } catch {
    return []; // network / CORS failure is non-fatal
  }
}

function dedupeByQuestion(markets: PolyMarket[]): PolyMarket[] {
  const seen = new Set<string>();
  const out: PolyMarket[] = [];
  for (const m of markets) {
    const key = m.question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

export async function fetchPolymarket(
  ticker: string,
  companyName?: string
): Promise<PolySnapshot> {
  // Direct: search the ticker and the company's first word (e.g. "NVIDIA")
  const queries = [ticker];
  if (companyName) {
    const firstWord = companyName.split(/[\s,]+/)[0];
    if (firstWord && firstWord.toUpperCase() !== ticker) queries.push(firstWord);
  }
  const directResults = await Promise.all(queries.map((q) => searchEvents(q)));
  const direct = dedupeByQuestion(directResults.flat())
    .filter((m) => m.volume > 0)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 6);

  // Macro backdrop — affects every equity
  const macroResults = await Promise.all([
    searchEvents("recession 2026"),
    searchEvents("fed rate cut"),
  ]);
  const macro = dedupeByQuestion(macroResults.flat())
    .filter((m) => m.volume > 5000)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 4);

  return {
    direct,
    macro,
    fetchedAt: new Date().toISOString(),
  };
}

// Compact text summary fed to the Deep Dive LLM for cross-referencing.
export function polymarketToPrompt(snap: PolySnapshot): string {
  const line = (m: PolyMarket) => {
    const top = m.topOutcome
      ? `${m.topOutcome.name} ${(m.topOutcome.prob * 100).toFixed(0)}%`
      : "n/a";
    const mom =
      m.weekChange > 0.01
        ? ` (↑${(m.weekChange * 100).toFixed(0)}pt/wk)`
        : m.weekChange < -0.01
          ? ` (↓${(Math.abs(m.weekChange) * 100).toFixed(0)}pt/wk)`
          : "";
    return `- "${m.question}": ${top}${mom}, $${(m.volume / 1000).toFixed(0)}k vol`;
  };
  const parts: string[] = [];
  if (snap.direct.length) {
    parts.push("Direct markets:\n" + snap.direct.map(line).join("\n"));
  }
  if (snap.macro.length) {
    parts.push("Macro backdrop:\n" + snap.macro.map(line).join("\n"));
  }
  return parts.join("\n\n") || "No relevant prediction markets found.";
}
