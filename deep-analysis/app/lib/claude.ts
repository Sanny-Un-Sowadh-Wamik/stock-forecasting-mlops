import type { TechnicalSummary } from "./analytics";
import type { SentimentResult, RagResult } from "./apify";
import type { FundamentalMetrics, CompanyInfo } from "./fundamentals";
import type { QualScores, ThesisBlock } from "./scoring";
import { llmComplete, parseJSONLoose, type LLMConfig } from "./llm";

export interface AnalysisVerdict {
  verdict: "BUY" | "HOLD" | "WATCH" | "AVOID";
  conviction: number;
  entry_zone: { low: number; high: number };
  stop_loss: number;
  target_6mo: number;
  target_3yr: number;
  expected_return_6mo: string;
  bull_case: string;
  bear_case: string;
  key_catalyst: string;
  historical_pattern: string;
  risk_level: "LOW" | "MED" | "HIGH" | "VERY HIGH";
  summary: string;
  // Framework outputs
  scores: QualScores;
  thesis: ThesisBlock;
  industry_outlook: string;
}

function fmtBig(n: number | null): string {
  if (n == null) return "N/A";
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toFixed(0)}`;
}

const num = (n: number | null, suffix = ""): string =>
  n == null ? "N/A" : `${n.toFixed(1)}${suffix}`;

export async function synthesizeVerdict(
  llm: LLMConfig,
  ticker: string,
  company: CompanyInfo,
  tech: TechnicalSummary,
  fundamentals: FundamentalMetrics,
  sentiment: SentimentResult,
  rag: RagResult[]
): Promise<AnalysisVerdict> {
  const ragSummary = rag
    .map((r) => `[${r.title}]: ${r.text.slice(0, 400)}`)
    .join("\n\n");

  const topBull =
    sentiment.articles
      .filter((a) => a.sentimentLabel === "bullish")
      .sort((a, b) => b.sentimentScore - a.sentimentScore)[0]?.title ?? "None";
  const topBear =
    sentiment.articles
      .filter((a) => a.sentimentLabel === "bearish")
      .sort((a, b) => a.sentimentScore - b.sentimentScore)[0]?.title ?? "None";

  const prompt = `You are a senior long-term equity analyst applying a fundamentals-first framework. Weight business quality over price action. Respond ONLY with valid JSON.

COMPANY: ${company.name} (${ticker})
Sector: ${company.sector}
Market cap: ${fmtBig(company.marketCap)}
${company.employees ? `Employees: ${company.employees.toLocaleString()}` : ""}
${company.description ? `Profile: ${company.description.slice(0, 500)}` : ""}

=== FUNDAMENTALS (5yr) ===
Revenue CAGR: ${num(fundamentals.revenueCagr, "%")}
Net income CAGR: ${num(fundamentals.netIncomeCagr, "%")}
Operating cash flow CAGR: ${num(fundamentals.ocfCagr, "%")}
Profit growing faster than revenue: ${fundamentals.profitGrowsFasterThanRevenue ?? "N/A"}
Gross margin: ${num(fundamentals.grossMargin, "%")}
Net margin: ${num(fundamentals.netMargin, "%")}
Operating margin: ${num(fundamentals.operatingMargin, "%")}
Debt-to-equity: ${num(fundamentals.debtToEquity, "×")}
Current ratio: ${num(fundamentals.currentRatio)}
Positive cash flow: ${fundamentals.positiveCashFlow ?? "N/A"}
Latest revenue: ${fmtBig(fundamentals.latestRevenue)}
Latest net income: ${fmtBig(fundamentals.latestNetIncome)}
P/E: ${num(fundamentals.pe, "×")} | PEG: ${num(fundamentals.peg)} | P/S: ${num(fundamentals.ps, "×")}

=== PRICE / TECHNICALS ===
Current: $${tech.current.toFixed(2)} | ATH $${tech.ath.toFixed(2)} (${tech.pctFromAth.toFixed(0)}% from ATH)
3mo momentum: ${tech.momentum3m.toFixed(1)}% | Support $${tech.support1.toFixed(0)} | Resistance $${tech.resistance.toFixed(0)}

=== SENTIMENT (${sentiment.articles.length} articles) ===
Net: ${sentiment.netScore.toFixed(2)} (${sentiment.netLabel}) | Bull ${sentiment.bullCount} / Bear ${sentiment.bearCount}
Top bull: "${topBull}"
Top bear: "${topBear}"

=== KEY FACTS (web scrape) ===
${ragSummary || "No additional data available."}

Score these three qualitative dimensions 1-10 (10 = best). Be critical and evidence-based:
- business_quality: how the company makes money, simplicity, durability, demand
- moat: brand, network effects, switching costs, patents, scale advantages
- management: capital allocation, execution vs promises, insider alignment

Respond ONLY with valid JSON, no markdown:
{
  "verdict": "BUY|HOLD|WATCH|AVOID",
  "conviction": <1-10>,
  "entry_zone": {"low": <price>, "high": <price>},
  "stop_loss": <price>,
  "target_6mo": <price>,
  "target_3yr": <price>,
  "expected_return_6mo": "<X%>",
  "bull_case": "<one sentence>",
  "bear_case": "<one sentence>",
  "key_catalyst": "<event + approx date>",
  "historical_pattern": "<what price history shows>",
  "risk_level": "LOW|MED|HIGH|VERY HIGH",
  "industry_outlook": "<one sentence on sector growth + disruption risk>",
  "scores": {
    "business_quality": {"score": <1-10>, "rationale": "<one sentence>"},
    "moat": {"score": <1-10>, "rationale": "<one sentence>"},
    "management": {"score": <1-10>, "rationale": "<one sentence>"}
  },
  "thesis": {
    "thesis": "<2-3 sentence investment thesis>",
    "biggest_risk": "<one sentence>",
    "worst_case": "<one sentence>"
  },
  "summary": "<2-3 sentences max>"
}`;

  const text = await llmComplete(llm, prompt, 1536);
  return parseJSONLoose<AnalysisVerdict>(text);
}
