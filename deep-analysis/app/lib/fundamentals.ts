// Pillar 4 — Fundamental analysis from Polygon financial statements.
// Drives the quantitative half of the weighted scorecard (financials + valuation).

let lastCallTime = 0;
const MIN_INTERVAL_MS = 12_000; // shares the 5 calls/min budget

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastCallTime);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallTime = Date.now();
  return fetch(url);
}

export interface FinancialYear {
  year: string;
  revenue: number | null;
  netIncome: number | null;
  operatingCashFlow: number | null;
  eps: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  assets: number | null;
  liabilities: number | null;
  equity: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
}

export interface CompanyInfo {
  name: string;
  sector: string;
  marketCap: number | null;
  description: string;
  employees: number | null;
  homepage: string;
}

export interface FundamentalMetrics {
  years: FinancialYear[]; // oldest → newest
  // Growth
  revenueCagr: number | null;
  netIncomeCagr: number | null;
  ocfCagr: number | null;
  profitGrowsFasterThanRevenue: boolean | null;
  // Margins (latest)
  grossMargin: number | null;
  netMargin: number | null;
  operatingMargin: number | null;
  // Health
  debtToEquity: number | null;
  currentRatio: number | null;
  positiveCashFlow: boolean | null;
  cashFlowGrowing: boolean | null;
  // Valuation
  pe: number | null;
  peg: number | null;
  ps: number | null;
  evToEbitda: number | null;
  // Latest absolute values
  latestRevenue: number | null;
  latestNetIncome: number | null;
  marketCap: number | null;
}

const v = (node: { value?: number } | undefined): number | null =>
  node && typeof node.value === "number" ? node.value : null;

function cagr(start: number | null, end: number | null, years: number): number | null {
  if (start == null || end == null || start <= 0 || years <= 0) return null;
  if (end <= 0) return ((end - start) / start) * 100; // can't take root of negative
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

export async function fetchCompanyInfo(
  apiKey: string,
  ticker: string
): Promise<CompanyInfo> {
  const url = `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${apiKey}`;
  const res = await rateLimitedFetch(url);
  if (!res.ok) {
    return {
      name: ticker,
      sector: "Unknown",
      marketCap: null,
      description: "",
      employees: null,
      homepage: "",
    };
  }
  const data = await res.json();
  const r = data.results ?? {};
  return {
    name: r.name ?? ticker,
    sector: r.sic_description ?? "Unknown",
    marketCap: typeof r.market_cap === "number" ? r.market_cap : null,
    description: r.description ?? "",
    employees: typeof r.total_employees === "number" ? r.total_employees : null,
    homepage: r.homepage_url ?? "",
  };
}

export async function fetchFundamentals(
  apiKey: string,
  ticker: string,
  currentPrice: number,
  marketCap: number | null
): Promise<FundamentalMetrics> {
  const url = `https://api.polygon.io/vX/reference/financials?ticker=${ticker}&timeframe=annual&order=desc&limit=5&apiKey=${apiKey}`;
  const res = await rateLimitedFetch(url);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Polygon financials ${ticker}: ${res.status} ${t}`);
  }
  const data = await res.json();
  const raw: Record<string, unknown>[] = data.results ?? [];

  const years: FinancialYear[] = raw
    .map((row) => {
      const f = (row.financials ?? {}) as Record<string, Record<string, { value?: number }>>;
      const inc = f.income_statement ?? {};
      const bal = f.balance_sheet ?? {};
      const cf = f.cash_flow_statement ?? {};
      return {
        year: String(row.fiscal_year ?? row.fiscal_period ?? ""),
        revenue: v(inc.revenues),
        netIncome: v(inc.net_income_loss),
        operatingCashFlow: v(cf.net_cash_flow_from_operating_activities),
        eps: v(inc.diluted_earnings_per_share) ?? v(inc.basic_earnings_per_share),
        grossProfit: v(inc.gross_profit),
        operatingIncome: v(inc.operating_income_loss),
        assets: v(bal.assets),
        liabilities: v(bal.liabilities),
        equity: v(bal.equity),
        currentAssets: v(bal.current_assets),
        currentLiabilities: v(bal.current_liabilities),
      };
    })
    .reverse(); // oldest → newest

  const latest = years[years.length - 1];
  const oldest = years[0];
  const span = Math.max(years.length - 1, 1);

  // Growth
  const revenueCagr = cagr(oldest?.revenue ?? null, latest?.revenue ?? null, span);
  const netIncomeCagr = cagr(oldest?.netIncome ?? null, latest?.netIncome ?? null, span);
  const ocfCagr = cagr(
    oldest?.operatingCashFlow ?? null,
    latest?.operatingCashFlow ?? null,
    span
  );

  // Margins
  const grossMargin =
    latest?.grossProfit != null && latest?.revenue
      ? (latest.grossProfit / latest.revenue) * 100
      : null;
  const netMargin =
    latest?.netIncome != null && latest?.revenue
      ? (latest.netIncome / latest.revenue) * 100
      : null;
  const operatingMargin =
    latest?.operatingIncome != null && latest?.revenue
      ? (latest.operatingIncome / latest.revenue) * 100
      : null;

  // Health
  const debtToEquity =
    latest?.liabilities != null && latest?.equity && latest.equity > 0
      ? latest.liabilities / latest.equity
      : null;
  const currentRatio =
    latest?.currentAssets != null &&
    latest?.currentLiabilities &&
    latest.currentLiabilities > 0
      ? latest.currentAssets / latest.currentLiabilities
      : null;
  const positiveCashFlow =
    latest?.operatingCashFlow != null ? latest.operatingCashFlow > 0 : null;
  const cashFlowGrowing =
    latest?.operatingCashFlow != null && oldest?.operatingCashFlow != null
      ? latest.operatingCashFlow > oldest.operatingCashFlow
      : null;

  // Valuation
  const pe =
    latest?.eps != null && latest.eps > 0 ? currentPrice / latest.eps : null;
  const peg =
    pe != null && netIncomeCagr != null && netIncomeCagr > 0
      ? pe / netIncomeCagr
      : null;
  const ps =
    marketCap != null && latest?.revenue && latest.revenue > 0
      ? marketCap / latest.revenue
      : null;
  // EV/EBIT (approx): normalized data has no clean debt/cash or D&A line, so we use
  // EV ≈ market cap and EBIT ≈ operating income. For amortization-heavy names (e.g.
  // MRVL) operating income is tiny, which makes the ratio explode and meaningless —
  // suppress to N/M when operating margin is thin or the ratio is implausibly high.
  let evToEbitda: number | null = null;
  if (
    marketCap != null &&
    latest?.operatingIncome != null &&
    latest.operatingIncome > 0 &&
    operatingMargin != null &&
    operatingMargin >= 5
  ) {
    const raw = marketCap / latest.operatingIncome;
    evToEbitda = raw <= 60 ? raw : null; // >60x ⇒ not meaningful
  }

  const profitGrowsFasterThanRevenue =
    netIncomeCagr != null && revenueCagr != null
      ? netIncomeCagr > revenueCagr
      : null;

  return {
    years,
    revenueCagr,
    netIncomeCagr,
    ocfCagr,
    profitGrowsFasterThanRevenue,
    grossMargin,
    netMargin,
    operatingMargin,
    debtToEquity,
    currentRatio,
    positiveCashFlow,
    cashFlowGrowing,
    pe,
    peg,
    ps,
    evToEbitda,
    latestRevenue: latest?.revenue ?? null,
    latestNetIncome: latest?.netIncome ?? null,
    marketCap,
  };
}

// ---- Deterministic scoring (financials + valuation) ----

export interface ScoreDetail {
  score: number; // 0-10
  signals: { label: string; good: boolean | null; detail: string }[];
}

export function scoreFinancials(m: FundamentalMetrics): ScoreDetail {
  const signals: ScoreDetail["signals"] = [];
  let pts = 0;
  let max = 0;

  // Revenue growth (10%+ = good) — weight 2.5
  max += 2.5;
  if (m.revenueCagr != null) {
    const good = m.revenueCagr >= 10;
    pts += m.revenueCagr >= 20 ? 2.5 : m.revenueCagr >= 10 ? 2.0 : m.revenueCagr >= 0 ? 1.0 : 0;
    signals.push({
      label: "Revenue growth",
      good,
      detail: `${m.revenueCagr.toFixed(1)}% CAGR`,
    });
  } else {
    signals.push({ label: "Revenue growth", good: null, detail: "N/A" });
  }

  // Profit growth faster than revenue — weight 2.5
  max += 2.5;
  if (m.netIncomeCagr != null) {
    const good = m.profitGrowsFasterThanRevenue === true;
    pts += good ? 2.5 : m.netIncomeCagr >= 10 ? 1.8 : m.netIncomeCagr >= 0 ? 1.0 : 0;
    signals.push({
      label: "Profit growth",
      good,
      detail: `${m.netIncomeCagr.toFixed(1)}% CAGR${good ? " (beats revenue)" : ""}`,
    });
  } else {
    signals.push({ label: "Profit growth", good: null, detail: "N/A" });
  }

  // Free / operating cash flow positive & growing — weight 2.0
  max += 2.0;
  if (m.positiveCashFlow != null) {
    const good = m.positiveCashFlow && m.cashFlowGrowing === true;
    pts += m.positiveCashFlow ? (m.cashFlowGrowing ? 2.0 : 1.2) : 0;
    signals.push({
      label: "Operating cash flow",
      good,
      detail: m.positiveCashFlow
        ? m.cashFlowGrowing
          ? "Positive & growing"
          : "Positive"
        : "Negative",
    });
  } else {
    signals.push({ label: "Operating cash flow", good: null, detail: "N/A" });
  }

  // Debt-to-equity (low = good) — weight 1.5
  max += 1.5;
  if (m.debtToEquity != null) {
    const good = m.debtToEquity < 1.5;
    pts += m.debtToEquity < 1 ? 1.5 : m.debtToEquity < 2 ? 1.0 : m.debtToEquity < 3 ? 0.5 : 0;
    signals.push({
      label: "Debt-to-equity",
      good,
      detail: `${m.debtToEquity.toFixed(2)}×`,
    });
  } else {
    signals.push({ label: "Debt-to-equity", good: null, detail: "N/A" });
  }

  // Current ratio (>1) — weight 1.5
  max += 1.5;
  if (m.currentRatio != null) {
    const good = m.currentRatio > 1;
    pts += m.currentRatio >= 2 ? 1.5 : m.currentRatio >= 1.2 ? 1.2 : m.currentRatio >= 1 ? 0.8 : 0.2;
    signals.push({
      label: "Current ratio",
      good,
      detail: `${m.currentRatio.toFixed(2)}`,
    });
  } else {
    signals.push({ label: "Current ratio", good: null, detail: "N/A" });
  }

  const score = max > 0 ? (pts / max) * 10 : 5;
  return { score: Math.round(score * 10) / 10, signals };
}

export function scoreValuation(m: FundamentalMetrics): ScoreDetail {
  const signals: ScoreDetail["signals"] = [];
  let pts = 0;
  let max = 0;

  // P/E — weight 3 (lower = better, but context matters)
  max += 3;
  if (m.pe != null) {
    const good = m.pe < 25;
    pts += m.pe < 15 ? 3 : m.pe < 25 ? 2.2 : m.pe < 40 ? 1.3 : m.pe < 60 ? 0.6 : 0.2;
    signals.push({ label: "P/E (GAAP)", good, detail: `${m.pe.toFixed(1)}×` });
  } else {
    signals.push({ label: "P/E (GAAP)", good: null, detail: "N/M (no GAAP profit)" });
  }

  // PEG — weight 4 (best single valuation signal: <1 great, <1.5 fair)
  max += 4;
  if (m.peg != null) {
    const good = m.peg < 1.5;
    pts += m.peg < 1 ? 4 : m.peg < 1.5 ? 3 : m.peg < 2 ? 1.8 : m.peg < 3 ? 0.8 : 0.2;
    signals.push({ label: "PEG ratio", good, detail: `${m.peg.toFixed(2)}` });
  } else {
    signals.push({ label: "PEG ratio", good: null, detail: "N/A" });
  }

  // EV/EBIT (approx) — weight 3. Suppressed to N/M for amortization-distorted names.
  max += 3;
  if (m.evToEbitda != null) {
    const good = m.evToEbitda < 20;
    pts += m.evToEbitda < 12 ? 3 : m.evToEbitda < 20 ? 2 : m.evToEbitda < 35 ? 1 : 0.3;
    signals.push({
      label: "EV/EBIT*",
      good,
      detail: `${m.evToEbitda.toFixed(1)}×`,
    });
  } else {
    signals.push({ label: "EV/EBIT*", good: null, detail: "N/M" });
  }

  const score = max > 0 ? (pts / max) * 10 : 5;
  return { score: Math.round(score * 10) / 10, signals };
}
