export interface OHLCBar {
  t: number;   // timestamp ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface TechnicalSummary {
  ath: number; // high over the ~24-month window (NOT all-time)
  athDate: string;
  atl: number; // low over the ~24-month window (NOT all-time)
  atlDate: string;
  current: number;
  asOf: string; // date of the current price (latest daily bar)
  pctFromAth: number;
  pctFromAtl: number;
  support1: number;
  support2: number;
  resistance: number;
  volumeTrend: "rising" | "falling" | "flat";
  recentTrend: "up" | "down" | "sideways";
  monthlyReturns: number[];
  volatility: number;
  momentum3m: number;
  monthlyCloses: { date: string; close: number }[];
  dailyBars: { date: string; close: number; volume: number }[];
  // Technical indicators (Cluster C)
  atr14: number;
  atrPct: number;
  rsi14: number;
  realizedVol: number; // annualized %
  regime: "trending-up" | "trending-down" | "range-bound";
  volRegime: "calm" | "normal" | "volatile";
}

// True Range average over the last `period` daily bars.
function computeATR(bars: OHLCBar[], period = 14): number {
  if (bars.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].h, l = bars[i].l, pc = bars[i - 1].c;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const window = trs.slice(-period);
  return window.reduce((s, x) => s + x, 0) / (window.length || 1);
}

// Wilder-style RSI over `period` daily closes.
function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const recent = closes.slice(-(period + 1));
  let gains = 0, losses = 0;
  for (let i = 1; i < recent.length; i++) {
    const d = recent[i] - recent[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function fmt(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function computeTechnicals(
  monthly: OHLCBar[],
  daily: OHLCBar[]
): TechnicalSummary {
  const sorted = [...monthly].sort((a, b) => a.t - b.t);
  const recentDaily = [...daily].sort((a, b) => a.t - b.t);

  // ATH / ATL
  let athIdx = 0, atlIdx = 0;
  sorted.forEach((b, i) => {
    if (b.h > sorted[athIdx].h) athIdx = i;
    if (b.l < sorted[atlIdx].l) atlIdx = i;
  });

  // Use the latest DAILY close as "current" (fresher than the monthly bar) and record
  // its date for provenance. Falls back to the latest monthly close if no daily bars.
  const latestDaily = recentDaily[recentDaily.length - 1];
  const latestMonthly = sorted[sorted.length - 1];
  const current = latestDaily?.c ?? latestMonthly?.c ?? 0;
  const asOf = latestDaily ? fmt(latestDaily.t) : latestMonthly ? fmt(latestMonthly.t) : "";
  const ath = sorted[athIdx].h;
  const atl = sorted[atlIdx].l;

  // Monthly returns
  const closes = sorted.map((b) => b.c);
  const monthlyReturns = closes
    .slice(1)
    .map((c, i) => (c - closes[i]) / closes[i]);

  // Volatility (std dev of monthly returns) — guard against <2 bars
  const n = monthlyReturns.length;
  const avg = n ? monthlyReturns.reduce((s, r) => s + r, 0) / n : 0;
  const variance = n
    ? monthlyReturns.reduce((s, r) => s + (r - avg) ** 2, 0) / n
    : 0;
  const volatility = Math.sqrt(variance) * 100;

  // 3-month momentum: last 3 closes vs prior 3 closes
  const last3 = closes.slice(-3).reduce((s, c) => s + c, 0) / 3;
  const prev3 = closes.slice(-6, -3).reduce((s, c) => s + c, 0) / 3;
  const momentum3m = prev3 > 0 ? ((last3 - prev3) / prev3) * 100 : 0;

  // Support / resistance from daily bars
  const dailyHighs = recentDaily.map((b) => b.h);
  const dailyLows = recentDaily.map((b) => b.l);
  const resistance = dailyHighs.length ? Math.max(...dailyHighs) : ath;
  const support1 = dailyLows.length
    ? dailyLows.sort((a, b) => a - b)[Math.floor(dailyLows.length * 0.1)]
    : atl;
  const support2 = dailyLows.length
    ? dailyLows.sort((a, b) => a - b)[Math.floor(dailyLows.length * 0.25)]
    : atl;

  // Volume trend (compare last 10 vs prior 10 daily bars)
  const vols = recentDaily.map((b) => b.v);
  const recentVol = vols.slice(-10).reduce((s, v) => s + v, 0);
  const priorVol = vols.slice(-20, -10).reduce((s, v) => s + v, 0);
  const volumeTrend =
    recentVol > priorVol * 1.1
      ? "rising"
      : recentVol < priorVol * 0.9
        ? "falling"
        : "flat";

  // Recent trend (last 5 daily closes)
  const dc = recentDaily.map((b) => b.c);
  const firstHalf = dc.slice(0, Math.floor(dc.length / 2));
  const secondHalf = dc.slice(Math.floor(dc.length / 2));
  const fAvg = firstHalf.reduce((s, c) => s + c, 0) / (firstHalf.length || 1);
  const sAvg = secondHalf.reduce((s, c) => s + c, 0) / (secondHalf.length || 1);
  const recentTrend =
    sAvg > fAvg * 1.02 ? "up" : sAvg < fAvg * 0.98 ? "down" : "sideways";

  // Indicators
  const atr14 = computeATR(recentDaily, 14);
  const atrPct = current > 0 ? (atr14 / current) * 100 : 0;
  const rsi14 = computeRSI(dc, 14);

  // Realized vol (annualized) from daily returns
  const dailyRets: number[] = [];
  for (let i = 1; i < dc.length; i++) {
    if (dc[i - 1] > 0) dailyRets.push((dc[i] - dc[i - 1]) / dc[i - 1]);
  }
  const retAvg = dailyRets.reduce((s, r) => s + r, 0) / (dailyRets.length || 1);
  const retVar =
    dailyRets.reduce((s, r) => s + (r - retAvg) ** 2, 0) / (dailyRets.length || 1);
  const realizedVol = Math.sqrt(retVar) * Math.sqrt(252) * 100;

  // Regime: price vs 20-day SMA + slope
  const sma20 = dc.slice(-20);
  const smaNow = sma20.reduce((s, c) => s + c, 0) / (sma20.length || 1);
  const smaPrev =
    dc.slice(-40, -20).reduce((s, c) => s + c, 0) / (dc.slice(-40, -20).length || 1);
  const regime: TechnicalSummary["regime"] =
    current > smaNow && smaNow >= smaPrev
      ? "trending-up"
      : current < smaNow && smaNow <= smaPrev
        ? "trending-down"
        : "range-bound";
  const volRegime: TechnicalSummary["volRegime"] =
    atrPct < 2 ? "calm" : atrPct <= 4 ? "normal" : "volatile";

  return {
    ath,
    athDate: fmt(sorted[athIdx].t),
    atl,
    atlDate: fmt(sorted[atlIdx].t),
    current,
    asOf,
    pctFromAth: ath > 0 ? ((current - ath) / ath) * 100 : 0,
    pctFromAtl: atl > 0 ? ((current - atl) / atl) * 100 : 0,
    support1,
    support2,
    resistance,
    volumeTrend,
    recentTrend,
    monthlyReturns,
    volatility,
    momentum3m,
    monthlyCloses: sorted.map((b) => ({ date: fmt(b.t), close: b.c })),
    dailyBars: recentDaily.map((b) => ({
      date: fmt(b.t),
      close: b.c,
      volume: b.v,
    })),
    atr14,
    atrPct,
    rsi14,
    realizedVol,
    regime,
    volRegime,
  };
}
