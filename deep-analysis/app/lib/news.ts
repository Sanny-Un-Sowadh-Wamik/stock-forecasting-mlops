// Free news + sentiment via Polygon (no Apify cost). Polygon's news `insights`
// field carries an LLM sentiment label + reasoning per ticker, so we get the same
// shape as the paid Apify sentiment actor for $0.

import { fetchPolygonNews } from "./mmd";
import type { SentimentArticle, SentimentResult, RagResult } from "./apify";

function mapSentiment(label: string | undefined): {
  label: "bullish" | "bearish" | "neutral";
  score: number;
} {
  if (label === "positive") return { label: "bullish", score: 0.6 };
  if (label === "negative") return { label: "bearish", score: -0.6 };
  return { label: "neutral", score: 0 };
}

export async function fetchNewsPolygon(
  apiKey: string,
  ticker: string
): Promise<{ sentiment: SentimentResult; rag: RagResult[] }> {
  const T = ticker.toUpperCase();
  const articles = await fetchPolygonNews(apiKey, T, 12);

  const mapped: SentimentArticle[] = articles.slice(0, 8).map((a) => {
    const insight = a.insights?.find((i) => i.ticker?.toUpperCase() === T);
    const { label, score } = mapSentiment(insight?.sentiment);
    return {
      title: a.title ?? "Untitled",
      url: a.article_url ?? "",
      publishedAt: a.published_utc ?? "",
      source: a.publisher?.name ?? "news",
      sentimentLabel: label,
      sentimentScore: score,
      summary: (insight?.sentiment_reasoning || a.description || "").slice(0, 300),
    };
  });

  const scores = mapped.map((m) => m.sentimentScore);
  const netScore = scores.length
    ? scores.reduce((s, x) => s + x, 0) / scores.length
    : 0;

  const sentiment: SentimentResult = {
    ticker: T,
    articles: mapped,
    netScore,
    netLabel: netScore > 0.15 ? "bullish" : netScore < -0.15 ? "bearish" : "neutral",
    bullCount: mapped.filter((m) => m.sentimentLabel === "bullish").length,
    bearCount: mapped.filter((m) => m.sentimentLabel === "bearish").length,
  };

  // RAG facts = the article descriptions / sentiment reasoning (no separate scrape).
  const rag: RagResult[] = articles
    .slice(0, 4)
    .map((a) => {
      const insight = a.insights?.find((i) => i.ticker?.toUpperCase() === T);
      return {
        title: a.title ?? "",
        url: a.article_url ?? "",
        text: (a.description || insight?.sentiment_reasoning || "").slice(0, 1500),
      };
    })
    .filter((r) => r.text.length > 0);

  return { sentiment, rag };
}
