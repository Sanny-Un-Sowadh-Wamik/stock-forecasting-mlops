// Deep Dive — the LLM "tireless analyst" layer from the two master plans.
// Two focused Claude calls:
//   1. Multi-axis sentiment + narrative timeline + forward catalysts + red flags  (Plan A Phase 3-4)
//   2. Bull/Bear Investment Committee + conviction + black-swan scenarios + Polymarket cross-ref (Plan A Phase 6 / Plan B agents)

import type { TechnicalSummary } from "./analytics";
import type { FundamentalMetrics } from "./fundamentals";
import type { SentimentResult, RagResult } from "./apify";
import type { AnalysisVerdict } from "./claude";
import type { PolySnapshot } from "./polymarket";
import { polymarketToPrompt } from "./polymarket";
import { llmComplete, parseJSONLoose, type LLMConfig } from "./llm";

export interface SentimentAxes {
  optimism: number; // -2..+2
  fear: number;
  certainty: number;
  greed: number;
}

export interface CatalystItem {
  event: string;
  date: string;
  surprise: string;
  magnitude: string;
  sellNewsRisk: "low" | "med" | "high";
}

export interface ScenarioItem {
  name: string;
  probability: string;
  impact: string;
  resilience: string;
}

export interface DeepDive {
  sentiment: {
    axes: SentimentAxes;
    bullishPct: number;
    bearishPct: number;
    consensusFlag: string;
  };
  narrative: string;
  timeline: { date: string; event: string; reaction: string }[];
  catalysts: CatalystItem[];
  redFlags: string[];
  committee: {
    bullPoints: string[];
    bearPoints: string[];
    chairVerdict: string;
    conviction: number; // 1-10
    swingFactor: string;
  };
  scenarios: ScenarioItem[];
  crowdCrossRef: string;
  runAt: string;
}

async function callLLM(
  llm: LLMConfig,
  prompt: string,
  maxTokens: number
): Promise<any> {
  const text = await llmComplete(llm, prompt, maxTokens);
  // parseJSONLoose returns {} on malformed output so per-section fallbacks kick in.
  return parseJSONLoose(text);
}

export interface DeepDiveInput {
  llm: LLMConfig;
  ticker: string;
  companyName: string;
  tech: TechnicalSummary;
  fundamentals: FundamentalMetrics;
  sentiment: SentimentResult;
  rag: RagResult[];
  verdict: AnalysisVerdict;
  polymarket: PolySnapshot;
}

export async function runDeepDive(input: DeepDiveInput): Promise<DeepDive> {
  const { llm, ticker, companyName } = input;

  const articleText = input.sentiment.articles
    .map((a) => `[${a.sentimentLabel}] ${a.title} — ${a.summary ?? ""}`)
    .join("\n")
    .slice(0, 4000);
  const ragText = input.rag.map((r) => `${r.title}: ${r.text}`).join("\n\n").slice(0, 3000);

  // ---- Call 1: sentiment axes + narrative + catalysts + red flags ----
  const p1 = `You are a financial sentiment & narrative analyst for ${companyName} (${ticker}). Use the articles below. Respond ONLY with valid JSON.

ARTICLES:
${articleText || "Limited article data."}

KEY FACTS:
${ragText || "None."}

Score sentiment on four axes from -2 (extremely negative) to +2 (extremely positive): optimism (growth/earnings outlook), fear (risk/safety — negative = fearful), certainty (clarity vs hedging — negative = uncertain), greed (speculative frenzy vs prudence — positive = greedy). Estimate the % of coverage that is bullish vs bearish, and flag any extreme one-sided consensus (a contrarian warning).

Build a 3-month narrative thread, a timeline of major events with how the stock reacted, the forward catalyst calendar with surprise odds + likely magnitude + sell-the-news risk, and any red flags / contradictions in the coverage.

Respond ONLY with JSON:
{
  "sentiment": {
    "axes": {"optimism": <n>, "fear": <n>, "certainty": <n>, "greed": <n>},
    "bullishPct": <0-100>, "bearishPct": <0-100>,
    "consensusFlag": "<one sentence; note contrarian risk if extreme>"
  },
  "narrative": "<one-sentence dominant narrative thread>",
  "timeline": [{"date": "<approx>", "event": "<short>", "reaction": "<stock reaction>"}],
  "catalysts": [{"event": "<short>", "date": "<approx>", "surprise": "<lean positive/negative + rough odds>", "magnitude": "<expected % move>", "sellNewsRisk": "low|med|high"}],
  "redFlags": ["<contradiction or risk>"]
}`;

  // ---- Call 2: committee + scenarios + crowd cross-reference ----
  const f = input.fundamentals;
  const t = input.tech;
  const num = (n: number | null, s = "") => (n == null ? "N/A" : `${n.toFixed(1)}${s}`);
  const p2 = `You are an investment committee deciding on ${companyName} (${ticker}). Respond ONLY with valid JSON.

SNAPSHOT:
Price $${t.current.toFixed(2)} | ${t.pctFromAth.toFixed(0)}% from ATH | regime ${t.regime} | RSI ${t.rsi14.toFixed(0)} | realized vol ${t.realizedVol.toFixed(0)}%
Revenue CAGR ${num(f.revenueCagr, "%")} | Net margin ${num(f.netMargin, "%")} | D/E ${num(f.debtToEquity, "×")} | P/E ${num(f.pe, "×")} | PEG ${num(f.peg)}
Base verdict: ${input.verdict.verdict} (conviction ${input.verdict.conviction}/10)
News sentiment: ${input.sentiment.netLabel} (${input.sentiment.netScore.toFixed(2)})

PREDICTION MARKETS (real-money crowd odds — cross-reference against the news/fundamentals):
${polymarketToPrompt(input.polymarket)}

Step 1: Build the strongest BULL case (specific points). Step 2: Build the strongest BEAR / red-team short case (specific points). Step 3: As chair, give a balanced verdict, a conviction 1-10, and the single piece of new information that would move conviction most. Then generate 3 black-swan scenarios and rate the stock's resilience to each. Finally, write one cross-reference note: do the prediction-market odds CONFIRM or DIVERGE from the news sentiment and fundamentals?

Respond ONLY with JSON:
{
  "committee": {
    "bullPoints": ["<point>"], "bearPoints": ["<point>"],
    "chairVerdict": "<2 sentences>", "conviction": <1-10>,
    "swingFactor": "<single most decision-relevant unknown>"
  },
  "scenarios": [{"name": "<black-swan>", "probability": "<low/med/high>", "impact": "<short>", "resilience": "<how well it survives>"}],
  "crowdCrossRef": "<1-2 sentences: prediction markets confirm or diverge, and what that implies>"
}`;

  const [r1, r2] = await Promise.all([
    callLLM(llm, p1, 1536),
    callLLM(llm, p2, 1536),
  ]);

  return {
    sentiment: r1.sentiment ?? {
      axes: { optimism: 0, fear: 0, certainty: 0, greed: 0 },
      bullishPct: 50,
      bearishPct: 50,
      consensusFlag: "n/a",
    },
    narrative: r1.narrative ?? "",
    timeline: Array.isArray(r1.timeline) ? r1.timeline : [],
    catalysts: Array.isArray(r1.catalysts) ? r1.catalysts : [],
    redFlags: Array.isArray(r1.redFlags) ? r1.redFlags : [],
    committee: r2.committee ?? {
      bullPoints: [],
      bearPoints: [],
      chairVerdict: "",
      conviction: input.verdict.conviction,
      swingFactor: "",
    },
    scenarios: Array.isArray(r2.scenarios) ? r2.scenarios : [],
    crowdCrossRef: r2.crowdCrossRef ?? "",
    runAt: new Date().toISOString(),
  };
}
