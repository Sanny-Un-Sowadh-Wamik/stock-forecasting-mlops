import { fetchMonthlyBars, fetchDailyBars } from "./mmd";
import { computeTechnicals, type TechnicalSummary } from "./analytics";
import {
  fetchCompanyInfo,
  fetchFundamentals,
  type FundamentalMetrics,
  type CompanyInfo,
} from "./fundamentals";
import {
  fetchSentiment,
  fetchRagScrape,
  type SentimentResult,
  type RagResult,
} from "./apify";
import { fetchNewsPolygon } from "./news";
import type { NewsSource } from "./llm";
import { synthesizeVerdict, type AnalysisVerdict } from "./claude";
import { buildScorecard, type Scorecard } from "./scoring";
import { fetchPolymarket, type PolySnapshot } from "./polymarket";
import { runDeepDive, type DeepDive } from "./deepdive";
import type { LLMConfig } from "./llm";
import { cacheGet, cacheSet, cacheAge } from "./storage";

export interface FullAnalysis {
  ticker: string;
  company: CompanyInfo;
  tech: TechnicalSummary;
  fundamentals: FundamentalMetrics;
  sentiment: SentimentResult;
  rag: RagResult[];
  verdict: AnalysisVerdict;
  scorecard: Scorecard;
  polymarket: PolySnapshot;
  deepDive?: DeepDive; // on-demand (extra LLM calls)
  compositeScore: number; // legacy 0-1 momentum/sentiment/llm blend
  runAt: string;
}

export interface PipelineConfig {
  mmdKey: string;
  apifyKey: string;
  llm: LLMConfig;
  newsSource: NewsSource; // "polygon" = free, "apify" = paid richer
}

export type PipelineStep =
  | "cache"
  | "company"
  | "mmd"
  | "fundamentals"
  | "sentiment"
  | "rag"
  | "polymarket"
  | "claude"
  | "score"
  | "done"
  | "error";

export interface PipelineStatus {
  step: PipelineStep;
  detail: string;
}

export async function runPipeline(
  ticker: string,
  config: PipelineConfig,
  onStatus?: (s: PipelineStatus) => void,
  forceRefresh = false
): Promise<FullAnalysis> {
  const cacheKey = `analysis:${ticker.toUpperCase()}`;

  if (!forceRefresh) {
    const cached = cacheGet<FullAnalysis>(cacheKey);
    if (isCacheComplete(cached)) {
      const age = cacheAge(cacheKey);
      onStatus?.({ step: "cache", detail: `Using cached data (${age}m old)` });
      return cached;
    }
  }

  const T = ticker.toUpperCase();

  // Step 1: Company profile (name, sector, market cap)
  onStatus?.({ step: "company", detail: `Loading ${T} profile…` });
  const company = await fetchCompanyInfo(config.mmdKey, T);

  // Step 2: MMD historic OHLC
  onStatus?.({ step: "mmd", detail: `Fetching OHLC data for ${T}…` });
  const [monthly, daily] = await Promise.all([
    fetchMonthlyBars(config.mmdKey, T, 2),
    fetchDailyBars(config.mmdKey, T, 60),
  ]);
  const tech = computeTechnicals(monthly, daily);

  // Step 3: Fundamentals (financial statements)
  onStatus?.({ step: "fundamentals", detail: `Pulling 5yr financials for ${T}…` });
  const fundamentals = await fetchFundamentals(
    config.mmdKey,
    T,
    tech.current,
    company.marketCap
  );

  // Steps 4-5: News + sentiment. Default = free Polygon news ($0 Apify); opt-in Apify.
  let sentiment: SentimentResult;
  let rag: RagResult[];
  if (config.newsSource === "apify") {
    onStatus?.({ step: "sentiment", detail: `Fetching Apify sentiment for ${T}…` });
    sentiment = await fetchSentiment(config.apifyKey, T);
    onStatus?.({ step: "rag", detail: `Deep-scraping articles for ${T}…` });
    rag = await fetchRagScrape(config.apifyKey, T);
  } else {
    onStatus?.({ step: "sentiment", detail: `Fetching free Polygon news for ${T}…` });
    ({ sentiment, rag } = await fetchNewsPolygon(config.mmdKey, T));
  }

  // Step 5b: Polymarket prediction-market cross-reference (free, no key)
  onStatus?.({ step: "polymarket", detail: `Checking prediction markets for ${T}…` });
  const polymarket = await fetchPolymarket(T, company.name);

  // Step 6: Claude synthesis (qualitative scores + thesis + verdict)
  onStatus?.({ step: "claude", detail: `Synthesizing with Claude…` });
  const verdict = await synthesizeVerdict(
    config.llm,
    T,
    company,
    tech,
    fundamentals,
    sentiment,
    rag
  );

  // Step 7: Weighted scorecard
  onStatus?.({ step: "score", detail: `Scoring ${T}…` });
  const scorecard = buildScorecard(fundamentals, verdict.scores, verdict.thesis);

  const compositeScore = computeComposite(tech, sentiment, verdict.conviction);

  const result: FullAnalysis = {
    ticker: T,
    company,
    tech,
    fundamentals,
    sentiment,
    rag,
    verdict,
    scorecard,
    polymarket,
    compositeScore,
    runAt: new Date().toISOString(),
  };

  cacheSet(cacheKey, result);
  onStatus?.({ step: "done", detail: `Analysis complete for ${T}` });
  return result;
}

// On-demand Deep Dive (Committee + Sentiment 2.0 + Catalysts + Scenarios + crowd cross-ref).
// Runs extra Claude calls, merges into the cached analysis, returns the updated copy.
export async function runDeepDiveForAnalysis(
  analysis: FullAnalysis,
  llm: LLMConfig
): Promise<FullAnalysis> {
  const deepDive = await runDeepDive({
    llm,
    ticker: analysis.ticker,
    companyName: analysis.company.name,
    tech: analysis.tech,
    fundamentals: analysis.fundamentals,
    sentiment: analysis.sentiment,
    rag: analysis.rag,
    verdict: analysis.verdict,
    polymarket: analysis.polymarket,
  });
  const updated: FullAnalysis = { ...analysis, deepDive };
  cacheSet(`analysis:${analysis.ticker.toUpperCase()}`, updated);
  return updated;
}

function computeComposite(
  tech: TechnicalSummary,
  sentiment: SentimentResult,
  conviction: number
): number {
  const pctAboveAtl = Math.min(tech.pctFromAtl / 200, 1);
  const entryQuality = Math.max(0, 1 + tech.pctFromAth / 100);
  const momScore = Math.min(Math.max((tech.momentum3m + 20) / 40, 0), 1);
  const historicScore = pctAboveAtl * 0.1 + entryQuality * 0.2 + momScore * 0.1;
  const sentScore = Math.min(Math.max((sentiment.netScore + 1) / 2, 0), 1) * 0.3;
  const llmScore = (conviction / 10) * 0.3;
  return Math.min(historicScore + sentScore + llmScore, 1);
}

export async function runBatch(
  tickers: string[],
  config: PipelineConfig,
  onStatus?: (ticker: string, s: PipelineStatus) => void
): Promise<FullAnalysis[]> {
  const results: FullAnalysis[] = [];
  for (const ticker of tickers) {
    try {
      const analysis = await runPipeline(ticker, config, (s) =>
        onStatus?.(ticker, s)
      );
      results.push(analysis);
    } catch (err) {
      console.error(`Pipeline failed for ${ticker}:`, err);
    }
  }
  return results;
}

// A cache entry is only usable if it has the current schema (scorecard,
// fundamentals, the technical indicators, and the polymarket snapshot).
// Stale-shape entries are treated as misses so they re-run with full data.
export function isCacheComplete(a: FullAnalysis | null | undefined): a is FullAnalysis {
  return !!(
    a &&
    a.scorecard &&
    a.fundamentals &&
    a.tech &&
    a.tech.atr14 != null &&
    a.tech.asOf != null && // added with the data-quality fixes — forces stale caches to re-run
    a.polymarket
  );
}

// Load all cached analyses (for the dashboard).
export function loadAllCached(): FullAnalysis[] {
  const out: FullAnalysis[] = [];
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith("das:analysis:")) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(k)!);
      const data = entry.data as FullAnalysis;
      if (isCacheComplete(data)) out.push(data);
    } catch {
      // skip
    }
  }
  return out.sort((a, b) => b.scorecard.weighted - a.scorecard.weighted);
}
