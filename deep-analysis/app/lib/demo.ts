// Sample analyses so the dashboard + reports are explorable before API keys are set.
// Fundamentals/qual scores run through the REAL buildScorecard, so demo == live logic.

import type { FullAnalysis } from "./pipeline";
import type { FundamentalMetrics, FinancialYear } from "./fundamentals";
import type { TechnicalSummary } from "./analytics";
import type { AnalysisVerdict } from "./claude";
import type { PolySnapshot, PolyMarket } from "./polymarket";
import type { DeepDive } from "./deepdive";
import { buildScorecard } from "./scoring";

function genCloses(start: number, end: number, n: number): { date: string; close: number }[] {
  const out: { date: string; close: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // smooth-ish growth with mild noise via sine
    const base = start + (end - start) * t;
    const wobble = Math.sin(i * 1.3) * (end - start) * 0.04;
    const d = new Date(2024, 5 + i, 1);
    out.push({ date: d.toISOString().slice(0, 10), close: Math.max(1, base + wobble) });
  }
  return out;
}

function makeTech(
  current: number,
  ath: number,
  atl: number,
  mom: number
): TechnicalSummary {
  const closes = genCloses(atl * 1.1, current, 24);
  return {
    ath,
    athDate: "2025-11-01",
    atl,
    atlDate: "2024-06-01",
    current,
    asOf: "2026-06-12",
    pctFromAth: ((current - ath) / ath) * 100,
    pctFromAtl: ((current - atl) / atl) * 100,
    support1: current * 0.9,
    support2: current * 0.82,
    resistance: ath,
    volumeTrend: "rising",
    recentTrend: mom > 0 ? "up" : "down",
    monthlyReturns: [],
    volatility: 8.4,
    momentum3m: mom,
    monthlyCloses: closes,
    dailyBars: [],
    atr14: current * 0.025,
    atrPct: 2.5,
    rsi14: mom > 0 ? 58 : 42,
    realizedVol: 42,
    regime: mom > 5 ? "trending-up" : mom < -5 ? "trending-down" : "range-bound",
    volRegime: "normal",
  };
}

function demoPoly(direct: PolySnapshot["direct"]): PolySnapshot {
  return {
    direct,
    macro: [
      {
        question: "US recession by end of 2026?",
        outcomes: [
          { name: "Yes", prob: 0.255 },
          { name: "No", prob: 0.745 },
        ],
        topOutcome: { name: "No", prob: 0.745 },
        volume: 1_240_000,
        weekChange: -0.04,
        endDate: "2026-12-31T00:00:00Z",
        url: "https://polymarket.com/event/us-recession-by-end-of-2026",
        eventTitle: "US recession by end of 2026?",
      },
      {
        question: "Fed rate cut by July 2026 meeting?",
        outcomes: [
          { name: "Yes", prob: 0.62 },
          { name: "No", prob: 0.38 },
        ],
        topOutcome: { name: "Yes", prob: 0.62 },
        volume: 596_000,
        weekChange: 0.05,
        endDate: "2026-07-31T00:00:00Z",
        url: "https://polymarket.com/event/fed-rate-cut-by-july-2026",
        eventTitle: "Fed rate cut by...?",
      },
    ],
    fetchedAt: "2026-06-13T09:00:00.000Z",
  };
}

function makeFin(rows: Partial<FinancialYear>[]): FundamentalMetrics {
  const years: FinancialYear[] = rows.map((r, i) => ({
    year: String(2020 + i),
    revenue: r.revenue ?? null,
    netIncome: r.netIncome ?? null,
    operatingCashFlow: r.operatingCashFlow ?? null,
    eps: r.eps ?? null,
    grossProfit: r.grossProfit ?? null,
    operatingIncome: r.operatingIncome ?? null,
    assets: r.assets ?? null,
    liabilities: r.liabilities ?? null,
    equity: r.equity ?? null,
    currentAssets: r.currentAssets ?? null,
    currentLiabilities: r.currentLiabilities ?? null,
  }));
  const latest = years[years.length - 1];
  const oldest = years[0];
  const span = years.length - 1;
  const cagr = (a: number | null, b: number | null) =>
    a && b && a > 0 && b > 0 ? (Math.pow(b / a, 1 / span) - 1) * 100 : null;
  const revenueCagr = cagr(oldest.revenue, latest.revenue);
  const netIncomeCagr = cagr(oldest.netIncome, latest.netIncome);
  const ocfCagr = cagr(oldest.operatingCashFlow, latest.operatingCashFlow);
  return {
    years,
    revenueCagr,
    netIncomeCagr,
    ocfCagr,
    profitGrowsFasterThanRevenue:
      netIncomeCagr != null && revenueCagr != null ? netIncomeCagr > revenueCagr : null,
    grossMargin: latest.grossProfit && latest.revenue ? (latest.grossProfit / latest.revenue) * 100 : null,
    netMargin: latest.netIncome && latest.revenue ? (latest.netIncome / latest.revenue) * 100 : null,
    operatingMargin: latest.operatingIncome && latest.revenue ? (latest.operatingIncome / latest.revenue) * 100 : null,
    debtToEquity: latest.liabilities && latest.equity ? latest.liabilities / latest.equity : null,
    currentRatio: latest.currentAssets && latest.currentLiabilities ? latest.currentAssets / latest.currentLiabilities : null,
    positiveCashFlow: latest.operatingCashFlow != null ? latest.operatingCashFlow > 0 : null,
    cashFlowGrowing: latest.operatingCashFlow != null && oldest.operatingCashFlow != null ? latest.operatingCashFlow > oldest.operatingCashFlow : null,
    pe: latest.eps && latest.eps > 0 ? 0 : null, // set per-stock below
    peg: null,
    ps: null,
    evToEbitda: null,
    latestRevenue: latest.revenue,
    latestNetIncome: latest.netIncome,
    marketCap: null,
  };
}

function emptySentiment(ticker: string, net: number, bull: number, bear: number) {
  return {
    ticker,
    articles: [
      { title: "Analyst raises price target on strong AI demand", url: "", publishedAt: "2026-06-10", source: "demo", sentimentLabel: "bullish" as const, sentimentScore: 0.7 },
      { title: "Quarterly earnings beat estimates across segments", url: "", publishedAt: "2026-06-08", source: "demo", sentimentLabel: "bullish" as const, sentimentScore: 0.6 },
      { title: "Valuation concerns flagged after recent rally", url: "", publishedAt: "2026-06-05", source: "demo", sentimentLabel: "bearish" as const, sentimentScore: -0.3 },
    ],
    netScore: net,
    netLabel: (net > 0.15 ? "bullish" : net < -0.15 ? "bearish" : "neutral") as "bullish" | "bearish" | "neutral",
    bullCount: bull,
    bearCount: bear,
  };
}

function build(
  ticker: string,
  company: FullAnalysis["company"],
  tech: TechnicalSummary,
  fundamentals: FundamentalMetrics,
  pe: number,
  verdict: AnalysisVerdict,
  net: number,
  bull: number,
  bear: number,
  polymarket: PolySnapshot,
  deepDive?: DeepDive
): FullAnalysis {
  // set valuation now that we know pe + growth
  fundamentals.pe = pe;
  fundamentals.peg = fundamentals.netIncomeCagr && fundamentals.netIncomeCagr > 0 ? pe / fundamentals.netIncomeCagr : null;
  fundamentals.ps = company.marketCap && fundamentals.latestRevenue ? company.marketCap / fundamentals.latestRevenue : null;
  fundamentals.evToEbitda = pe * 0.7;
  fundamentals.marketCap = company.marketCap;

  const scorecard = buildScorecard(fundamentals, verdict.scores, verdict.thesis);
  return {
    ticker,
    company,
    tech,
    fundamentals,
    sentiment: emptySentiment(ticker, net, bull, bear),
    rag: [],
    verdict,
    scorecard,
    polymarket,
    deepDive,
    compositeScore: scorecard.weighted / 10,
    runAt: "2026-06-13T09:00:00.000Z",
  };
}

function pm(
  question: string,
  yes: number,
  vol: number,
  week: number,
  slug: string
): PolyMarket {
  return {
    question,
    outcomes: [
      { name: "Yes", prob: yes },
      { name: "No", prob: 1 - yes },
    ],
    topOutcome: yes >= 0.5 ? { name: "Yes", prob: yes } : { name: "No", prob: 1 - yes },
    volume: vol,
    weekChange: week,
    endDate: "2026-09-30T00:00:00Z",
    url: `https://polymarket.com/event/${slug}`,
    eventTitle: question,
  };
}

const NVDA_DEEPDIVE: DeepDive = {
  sentiment: {
    axes: { optimism: 1.4, fear: 0.6, certainty: 0.9, greed: 1.1 },
    bullishPct: 72,
    bearishPct: 14,
    consensusFlag:
      "Strongly bullish consensus — crowded trade; watch for a contrarian unwind on any demand wobble.",
  },
  narrative:
    "AI infrastructure super-cycle: NVIDIA remains the default compute layer as hyperscaler capex keeps climbing.",
  timeline: [
    { date: "2026-02", event: "Record data-center quarter", reaction: "+12% on the print" },
    { date: "2026-04", event: "Export-rule headlines", reaction: "−8% intraday, recovered" },
    { date: "2026-06", event: "Multiple analyst PT raises", reaction: "Drift to new highs" },
  ],
  catalysts: [
    { event: "Q2 earnings", date: "late Aug 2026", surprise: "lean positive (~65%)", magnitude: "±10%", sellNewsRisk: "med" },
    { event: "Next-gen GPU ramp", date: "H2 2026", surprise: "positive", magnitude: "±6%", sellNewsRisk: "low" },
  ],
  redFlags: [
    "Customer concentration: a handful of hyperscalers drive most data-center revenue.",
    "Bullish news flow vs. a recession-odds uptick on Polymarket — mild divergence.",
  ],
  committee: {
    bullPoints: [
      "CUDA software moat compounds with each hardware generation.",
      "Demand still exceeds supply; backlog visibility into next year.",
      "Operating leverage pushing margins to record levels.",
    ],
    bearPoints: [
      "Priced for perfection — any capex digestion re-rates the multiple hard.",
      "In-house silicon from top customers is a multi-year threat.",
      "Cyclical, not secular, if AI ROI disappoints.",
    ],
    chairVerdict:
      "The bull case is better-supported by current data, but the asymmetry narrows at this valuation. Accumulate on weakness rather than chase.",
    conviction: 8,
    swingFactor: "Concrete evidence that hyperscaler AI capex is being cut or pushed out.",
  },
  scenarios: [
    { name: "Capex air-pocket", probability: "med", impact: "Data-center revenue stalls a quarter", resilience: "Strong balance sheet absorbs it; multiple compresses temporarily." },
    { name: "China export ban", probability: "med", impact: "Loss of a revenue slice", resilience: "Already partially priced; demand reroutes elsewhere." },
    { name: "Customer in-house chip wins", probability: "low", impact: "Slower long-term growth", resilience: "CUDA lock-in buys years of transition time." },
  ],
  crowdCrossRef:
    "Prediction markets price recession odds falling and a rate cut more likely — a supportive macro backdrop that confirms the bullish equity narrative.",
  runAt: "2026-06-13T09:00:00.000Z",
};

export function getDemoAnalyses(): FullAnalysis[] {
  const nvda = build(
    "NVDA",
    { name: "NVIDIA Corporation", sector: "Semiconductors", marketCap: 3.3e12, description: "Designs GPUs and accelerated computing platforms powering AI, data centers, and gaming.", employees: 29600, homepage: "https://nvidia.com" },
    makeTech(178, 195, 86, 14.2),
    makeFin([
      { revenue: 26.9e9, netIncome: 9.7e9, operatingCashFlow: 11.2e9, eps: 0.39, grossProfit: 17.5e9, operatingIncome: 10.0e9, currentAssets: 28e9, currentLiabilities: 11e9, liabilities: 17e9, equity: 26e9 },
      { revenue: 26.9e9, netIncome: 4.4e9, operatingCashFlow: 5.6e9, eps: 0.17, grossProfit: 15.4e9, operatingIncome: 5.6e9, currentAssets: 28e9, currentLiabilities: 10e9, liabilities: 19e9, equity: 22e9 },
      { revenue: 60.9e9, netIncome: 29.8e9, operatingCashFlow: 28.1e9, eps: 1.19, grossProfit: 44.3e9, operatingIncome: 33.0e9, currentAssets: 44e9, currentLiabilities: 10e9, liabilities: 22e9, equity: 43e9 },
      { revenue: 130.5e9, netIncome: 72.9e9, operatingCashFlow: 64.1e9, eps: 2.94, grossProfit: 97.9e9, operatingIncome: 81.5e9, currentAssets: 80e9, currentLiabilities: 18e9, liabilities: 32e9, equity: 79e9 },
    ]),
    48,
    {
      verdict: "BUY", conviction: 9,
      entry_zone: { low: 165, high: 178 }, stop_loss: 150, target_6mo: 215, target_3yr: 320,
      expected_return_6mo: "+21%",
      bull_case: "Dominant AI accelerator share with demand outstripping supply and expanding software moat.",
      bear_case: "Premium valuation leaves no room for a demand air-pocket or China export restrictions.",
      key_catalyst: "Data-center GPU cycle + earnings (late Aug 2026)",
      historical_pattern: "Pulls back 10-15% then makes new highs on each product cycle.",
      risk_level: "MED",
      industry_outlook: "AI infrastructure spend still in early innings; primary risk is customer concentration and cyclicality.",
      scores: {
        business_quality: { score: 9, rationale: "Clear model: sells the picks-and-shovels of the AI buildout at scale." },
        moat: { score: 9, rationale: "CUDA software lock-in plus generational hardware lead competitors can't easily replicate." },
        management: { score: 9, rationale: "Founder-led, consistently beats guidance, disciplined capital allocation." },
      },
      thesis: {
        thesis: "NVIDIA is the dominant arms dealer of the AI era. Revenue and profits are compounding faster than any megacap, margins are expanding, and the CUDA ecosystem locks customers in. At a PEG near 1 the growth is not yet fully priced.",
        biggest_risk: "Hyperscaler capex digestion or a faster-than-expected shift to in-house silicon.",
        worst_case: "AI capex pauses, data-center revenue halves, and the multiple compresses 50%.",
      },
      summary: "Best-in-class AI franchise with a durable software moat and reasonable PEG. Accumulate on pullbacks toward support.",
    },
    0.55, 6, 1,
    demoPoly([
      pm("Will NVIDIA close above $200 by end of Q3?", 0.34, 412_000, 0.03, "nvda-above-200-q3"),
      pm("NVIDIA largest company before Sept 15?", 0.58, 188_000, 0.06, "nvidia-largest-company"),
      pm("Will Google or NVIDIA be worth more on Sept 1?", 0.47, 69_000, -0.02, "google-or-nvidia-sept-1"),
    ]),
    NVDA_DEEPDIVE
  );

  const crdo = build(
    "CRDO",
    { name: "Credo Technology Group", sector: "Semiconductors", marketCap: 38e9, description: "High-speed connectivity solutions (AECs, SerDes) for data-center and AI networking.", employees: 950, homepage: "https://credosemi.com" },
    makeTech(228, 261, 32, 22.5),
    makeFin([
      { revenue: 0.106e9, netIncome: -0.012e9, operatingCashFlow: -0.02e9, eps: -0.08, grossProfit: 0.06e9, operatingIncome: -0.015e9, currentAssets: 0.4e9, currentLiabilities: 0.08e9, liabilities: 0.12e9, equity: 0.5e9 },
      { revenue: 0.184e9, netIncome: -0.016e9, operatingCashFlow: -0.01e9, eps: -0.10, grossProfit: 0.11e9, operatingIncome: -0.02e9, currentAssets: 0.42e9, currentLiabilities: 0.09e9, liabilities: 0.13e9, equity: 0.55e9 },
      { revenue: 0.193e9, netIncome: 0.028e9, operatingCashFlow: 0.03e9, eps: 0.16, grossProfit: 0.12e9, operatingIncome: 0.03e9, currentAssets: 0.45e9, currentLiabilities: 0.09e9, liabilities: 0.14e9, equity: 0.62e9 },
      { revenue: 0.437e9, netIncome: 0.052e9, operatingCashFlow: 0.09e9, eps: 0.30, grossProfit: 0.28e9, operatingIncome: 0.06e9, currentAssets: 0.6e9, currentLiabilities: 0.1e9, liabilities: 0.16e9, equity: 0.78e9 },
    ]),
    95,
    {
      verdict: "WATCH", conviction: 6,
      entry_zone: { low: 195, high: 215 }, stop_loss: 178, target_6mo: 270, target_3yr: 400,
      expected_return_6mo: "+18%",
      bull_case: "AEC adoption inflecting as AI clusters scale, revenue tripling with operating leverage kicking in.",
      bear_case: "Customer concentration and a triple-digit multiple amplify any single-quarter miss.",
      key_catalyst: "Next earnings + hyperscaler design wins (Sep 2026)",
      historical_pattern: "High-beta; ±25% swings around earnings are normal.",
      risk_level: "HIGH",
      industry_outlook: "AI networking is a strong secular tailwind, but Credo is a small player versus larger incumbents.",
      scores: {
        business_quality: { score: 7, rationale: "Picks-and-shovels for AI networking, but narrow product line and customer concentration." },
        moat: { score: 6, rationale: "Real IP edge in AECs, yet larger rivals could compress the lead over time." },
        management: { score: 7, rationale: "Executing well on the growth ramp; capital allocation still unproven at scale." },
      },
      thesis: {
        thesis: "Credo rides the AI-networking buildout with explosive revenue growth and improving margins. The technology lead in active electrical cables is real, but the rich valuation and concentration mean it belongs on a watchlist until a better entry appears.",
        biggest_risk: "Loss of a top customer or a faster-moving competitor eroding the AEC niche.",
        worst_case: "Order push-outs stall the growth story and the multiple halves.",
      },
      summary: "Exciting AI-networking growth story trading at a steep multiple. Watch for pullbacks into the entry zone before committing.",
    },
    0.5, 6, 1,
    demoPoly([
      pm("Will CRDO close above $250 by end of Q3?", 0.41, 42_000, 0.07, "crdo-above-250-q3"),
    ])
  );

  const intc = build(
    "INTC",
    { name: "Intel Corporation", sector: "Semiconductors", marketCap: 95e9, description: "Designs and manufactures microprocessors and is building a foundry business.", employees: 124800, homepage: "https://intel.com" },
    makeTech(22, 51, 18, -8.0),
    makeFin([
      { revenue: 77.9e9, netIncome: 20.9e9, operatingCashFlow: 35.4e9, eps: 4.94, grossProfit: 43.8e9, operatingIncome: 23.7e9, currentAssets: 47e9, currentLiabilities: 32e9, liabilities: 81e9, equity: 81e9 },
      { revenue: 79.0e9, netIncome: 19.9e9, operatingCashFlow: 30.0e9, eps: 4.86, grossProfit: 43.8e9, operatingIncome: 19.5e9, currentAssets: 58e9, currentLiabilities: 32e9, liabilities: 89e9, equity: 95e9 },
      { revenue: 63.1e9, netIncome: 8.0e9, operatingCashFlow: 15.4e9, eps: 1.94, grossProfit: 26.9e9, operatingIncome: 2.3e9, currentAssets: 50e9, currentLiabilities: 30e9, liabilities: 92e9, equity: 103e9 },
      { revenue: 54.2e9, netIncome: 1.7e9, operatingCashFlow: 11.5e9, eps: 0.40, grossProfit: 21.7e9, operatingIncome: -0.1e9, currentAssets: 43e9, currentLiabilities: 32e9, liabilities: 96e9, equity: 105e9 },
    ]),
    33,
    {
      verdict: "AVOID", conviction: 4,
      entry_zone: { low: 18, high: 21 }, stop_loss: 16, target_6mo: 24, target_3yr: 35,
      expected_return_6mo: "+9%",
      bull_case: "Foundry turnaround and government support could re-rate the stock if execution lands.",
      bear_case: "Revenue and margins are shrinking while capex stays massive — cash flow is under pressure.",
      key_catalyst: "Foundry milestone updates (2026 H2)",
      historical_pattern: "Multi-year downtrend with failed rallies at resistance.",
      risk_level: "HIGH",
      industry_outlook: "Sector is healthy, but Intel is losing share to TSMC, AMD, and Nvidia.",
      scores: {
        business_quality: { score: 4, rationale: "Eroding competitive position and a costly, unproven foundry pivot." },
        moat: { score: 4, rationale: "Manufacturing edge has eroded versus TSMC; share losses ongoing." },
        management: { score: 5, rationale: "New strategy is credible but execution has repeatedly disappointed." },
      },
      thesis: {
        thesis: "Intel is a turnaround bet, not a compounder. Revenue and profit are declining, free cash flow is strained by heavy foundry capex, and the competitive moat has eroded. Until the foundry shows real traction, the risk/reward favors waiting.",
        biggest_risk: "Foundry ramp keeps burning cash without winning marquee external customers.",
        worst_case: "Continued share loss forces a dividend cut and dilutive capital raises.",
      },
      summary: "Declining fundamentals and an unproven pivot keep this below the candidate threshold despite a low valuation.",
    },
    -0.2, 1, 4,
    demoPoly([
      pm("Will Intel close above $25 by end of Q3?", 0.38, 31_000, -0.03, "intc-above-25-q3"),
    ])
  );

  return [nvda, crdo, intc];
}

export function loadDemoIntoCache(): void {
  const demos = getDemoAnalyses();
  for (const d of demos) {
    try {
      localStorage.setItem(
        `das:analysis:${d.ticker}`,
        JSON.stringify({ data: d, ts: Date.now() })
      );
    } catch {
      // ignore
    }
  }
}
