const APIFY_BASE = "https://api.apify.com/v2";

export interface SentimentArticle {
  title: string;
  url: string;
  publishedAt: string;
  source: string;
  sentimentLabel: "bullish" | "bearish" | "neutral";
  sentimentScore: number;
  summary?: string;
  currentPrice?: number;
  peRatio?: number;
  shortRatio?: number;
  earningsDate?: string;
}

export interface SentimentResult {
  ticker: string;
  articles: SentimentArticle[];
  netScore: number;
  netLabel: "bullish" | "bearish" | "neutral";
  bullCount: number;
  bearCount: number;
  livePrice?: number;
  peRatio?: number;
  shortRatio?: number;
  earningsDate?: string;
}

export interface RagResult {
  title: string;
  url: string;
  text: string;
}

async function runActor(
  apiKey: string,
  actorId: string,
  input: Record<string, unknown>,
  timeoutMs = 120_000
): Promise<unknown[]> {
  // Start run
  const startRes = await fetch(
    `${APIFY_BASE}/acts/${actorId}/runs?token=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  if (!startRes.ok) {
    const t = await startRes.text();
    throw new Error(`Apify start ${actorId}: ${startRes.status} ${t}`);
  }
  const startBody = await startRes.json();
  const runData = startBody?.data;
  const runId: string | undefined = runData?.id;
  const datasetId: string | undefined = runData?.defaultDatasetId;
  if (!runId || !datasetId) {
    throw new Error(`Apify ${actorId}: response missing run/dataset IDs`);
  }

  // Poll until done
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const statusRes = await fetch(
      `${APIFY_BASE}/actor-runs/${runId}?token=${apiKey}`
    );
    if (!statusRes.ok) {
      throw new Error(`Apify status ${runId}: ${statusRes.status}`);
    }
    const statusBody = await statusRes.json();
    const status: string | undefined = statusBody?.data?.status;
    if (status === "SUCCEEDED") break;
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify run ${runId} ${status}`);
    }
  }

  // Fetch dataset
  const itemsRes = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${apiKey}&format=json&limit=50`
  );
  if (!itemsRes.ok) throw new Error(`Apify dataset fetch: ${itemsRes.status}`);
  const body = await itemsRes.json();
  // Normalize: Apify returns a bare array, but guard against {items:[...]} shapes.
  return Array.isArray(body) ? body : (body?.items ?? []);
}

const pick = (item: any, keys: string[]): any => {
  for (const k of keys) {
    if (item[k] != null) return item[k];
  }
  return undefined;
};

function normalizeLabel(
  label: string | undefined,
  score: number
): "bullish" | "bearish" | "neutral" {
  const l = (label ?? "").toLowerCase();
  if (l.includes("bull") || l === "positive") return "bullish";
  if (l.includes("bear") || l === "negative") return "bearish";
  if (l === "neutral") return "neutral";
  return score > 0.2 ? "bullish" : score < -0.2 ? "bearish" : "neutral";
}

// Primary: purpose-built actor scionic_dev/financial-news-sentiment.
// Gives real article sentiment + live market data (price, P/E, short ratio, earnings).
// Falls back to the rag-web-browser heuristic if the actor errors or returns nothing.
export async function fetchSentiment(
  apiKey: string,
  ticker: string
): Promise<SentimentResult> {
  try {
    const items = await runActor(apiKey, "scionic_dev~financial-news-sentiment", {
      tickers: [ticker],
      sources: ["yahoo_finance", "google_news"],
      maxArticles: 8,
      sentimentModel: "vader", // cheap baseline; Claude re-scores multi-axis in Deep Dive
      enrichWithMarketData: true,
      includeRawText: true,
    });

    if (!Array.isArray(items) || items.length === 0) {
      return fetchSentimentRag(apiKey, ticker);
    }

    // Market data may live on each article record or a separate enrichment record.
    let livePrice: number | undefined;
    let peRatio: number | undefined;
    let shortRatio: number | undefined;
    let earningsDate: string | undefined;

    const articles: SentimentArticle[] = [];
    for (const item of items as any[]) {
      livePrice = livePrice ?? toNum(pick(item, ["current_price", "price", "currentPrice"]));
      peRatio = peRatio ?? toNum(pick(item, ["pe_ratio", "peRatio", "pe"]));
      shortRatio = shortRatio ?? toNum(pick(item, ["short_ratio", "shortRatio"]));
      earningsDate = earningsDate ?? toStr(pick(item, ["earnings_date", "earningsDate"]));

      const title = toStr(pick(item, ["title", "headline"]));
      if (!title) continue; // skip pure market-data records
      const rawScore = toNum(pick(item, ["sentiment_score", "score", "compound", "sentimentScore"]));
      const score = rawScore != null ? Math.max(-1, Math.min(1, rawScore)) : 0;
      const label = toStr(pick(item, ["sentiment_label", "sentiment", "label"]));
      const url = toStr(pick(item, ["url", "link"])) ?? "";
      articles.push({
        title,
        url,
        publishedAt: toStr(pick(item, ["published_at", "publishedAt", "date"])) ?? "",
        source: url ? extractDomain(url) : "financial-news",
        sentimentLabel: normalizeLabel(label, score),
        sentimentScore: score,
        summary: toStr(pick(item, ["summary", "text", "description"]))?.slice(0, 300),
      });
    }

    if (articles.length === 0) return fetchSentimentRag(apiKey, ticker);

    const scores = articles.map((a) => a.sentimentScore);
    const netScore = scores.reduce((s, x) => s + x, 0) / scores.length;
    return {
      ticker,
      articles,
      netScore,
      netLabel: netScore > 0.15 ? "bullish" : netScore < -0.15 ? "bearish" : "neutral",
      bullCount: articles.filter((a) => a.sentimentLabel === "bullish").length,
      bearCount: articles.filter((a) => a.sentimentLabel === "bearish").length,
      livePrice,
      peRatio,
      shortRatio,
      earningsDate,
    };
  } catch {
    return fetchSentimentRag(apiKey, ticker);
  }
}

function toNum(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isFinite(n) ? n : undefined;
}
function toStr(v: unknown): string | undefined {
  return v == null ? undefined : String(v);
}

// Fallback: rag-web-browser scrape + keyword heuristic.
async function fetchSentimentRag(
  apiKey: string,
  ticker: string
): Promise<SentimentResult> {
  const items = await runActor(apiKey, "apify~rag-web-browser", {
    query: `${ticker} stock news analysis earnings analyst price target 2025 2026`,
    maxResults: 8,
  });

  const articles: SentimentArticle[] = (items as any[])
    .slice(0, 8)
    .map((item) => {
      const text = String(item.text ?? item.markdown ?? item.description ?? "");
      const title = String(item.title ?? item.metadata?.title ?? "No title");
      const url = String(item.url ?? "");
      const score = scoreSentiment(text + " " + title);
      return {
        title,
        url,
        publishedAt: String(item.createdAt ?? item.metadata?.date ?? ""),
        source: extractDomain(url),
        sentimentLabel:
          score > 0.25 ? "bullish" : score < -0.25 ? "bearish" : "neutral",
        sentimentScore: score,
        summary: text.slice(0, 300),
      } as SentimentArticle;
    });

  const scores = articles.map((a) => a.sentimentScore);
  const netScore = scores.length
    ? scores.reduce((s, x) => s + x, 0) / scores.length
    : 0;

  return {
    ticker,
    articles,
    netScore,
    netLabel:
      netScore > 0.15 ? "bullish" : netScore < -0.15 ? "bearish" : "neutral",
    bullCount: articles.filter((a) => a.sentimentLabel === "bullish").length,
    bearCount: articles.filter((a) => a.sentimentLabel === "bearish").length,
  };
}

// Optional social layer (apidojo/tweet-scraper). Ready to wire into Deep Dive.
// NOT called by default — costs ~$0.40/1000 tweets. Enable explicitly.
export async function fetchSocialPosts(
  apiKey: string,
  ticker: string,
  maxItems = 30
): Promise<{ text: string; likes: number; author: string }[]> {
  try {
    const items = await runActor(apiKey, "apidojo~tweet-scraper", {
      searchTerms: [`$${ticker}`, `${ticker} stock`],
      maxItems,
      sort: "Latest",
      tweetLanguage: "en",
    });
    return (items as any[]).map((t) => ({
      text: String(t.text ?? t.full_text ?? ""),
      likes: Number(t.likeCount ?? t.favorite_count ?? 0) || 0,
      author: String(t.author?.userName ?? t.username ?? ""),
    }));
  } catch {
    return [];
  }
}

export async function fetchRagScrape(
  apiKey: string,
  ticker: string
): Promise<RagResult[]> {
  const queries = [
    `${ticker} earnings results analyst upgrade price target`,
    `${ticker} company news revenue guidance 2026`,
  ];

  const results: RagResult[] = [];
  for (const query of queries) {
    try {
      const items = await runActor(apiKey, "apify~rag-web-browser", {
        query,
        maxResults: 2,
      });
      for (const item of items as any[]) {
        results.push({
          title: String(item.title ?? item.metadata?.title ?? ""),
          url: String(item.url ?? ""),
          text: String(item.text ?? item.markdown ?? item.description ?? "").slice(
            0,
            1500
          ),
        });
      }
    } catch {
      // non-fatal
    }
  }
  return results.slice(0, 4);
}

// Keyword-based heuristic score: -1.0 to +1.0
function scoreSentiment(text: string): number {
  const t = text.toLowerCase();
  const bullish = [
    { w: "raised price target", s: 0.7 },
    { w: "price target raised", s: 0.7 },
    { w: "strong buy", s: 0.65 },
    { w: "outperform", s: 0.5 },
    { w: "beat estimates", s: 0.6 },
    { w: "earnings beat", s: 0.6 },
    { w: "record revenue", s: 0.55 },
    { w: "upgraded", s: 0.5 },
    { w: "buy rating", s: 0.5 },
    { w: "bullish", s: 0.45 },
    { w: "growth", s: 0.2 },
    { w: "guidance raised", s: 0.55 },
    { w: "insider buying", s: 0.6 },
    { w: "accelerating", s: 0.3 },
    { w: "momentum", s: 0.2 },
  ];
  const bearish = [
    { w: "missed estimates", s: -0.6 },
    { w: "revenue miss", s: -0.6 },
    { w: "downgraded", s: -0.55 },
    { w: "sell rating", s: -0.55 },
    { w: "bearish", s: -0.45 },
    { w: "guidance cut", s: -0.6 },
    { w: "layoffs", s: -0.4 },
    { w: "sec investigation", s: -0.7 },
    { w: "regulatory", s: -0.35 },
    { w: "insider selling", s: -0.3 },
    { w: "declining", s: -0.3 },
    { w: "weakness", s: -0.25 },
    { w: "competition", s: -0.2 },
    { w: "slowing", s: -0.3 },
    { w: "lowered price target", s: -0.6 },
  ];

  let score = 0;
  let hits = 0;
  for (const { w, s } of bullish) {
    if (t.includes(w)) {
      score += s;
      hits++;
    }
  }
  for (const { w, s } of bearish) {
    if (t.includes(w)) {
      score += s;
      hits++;
    }
  }
  if (hits === 0) return 0;
  return Math.max(-1, Math.min(1, score / Math.max(1, hits * 0.5)));
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url.slice(0, 30);
  }
}
