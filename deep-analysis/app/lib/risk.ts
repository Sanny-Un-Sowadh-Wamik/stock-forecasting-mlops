// Cluster C — Position sizing & risk math. Pure, deterministic, verifiable.
// Implements: 1% rule, ATR-based stop, R:R, Kelly Criterion. NO LLM, NO API.

export interface SizingInput {
  accountSize: number;
  riskPct: number; // e.g. 1 for 1%
  entry: number;
  stopPrice: number;
  target: number;
}

export interface SizingResult {
  riskAmount: number; // dollars at risk
  stopDistance: number; // per-share dollar risk
  stopPctOfEntry: number;
  shares: number;
  positionValue: number;
  positionPctOfAccount: number;
  riskReward: number; // R:R to target
  rewardAmount: number; // dollars if target hit
  warning?: string; // set when the result is degenerate (e.g. 0 shares)
}

export function computeSizing(input: SizingInput): SizingResult {
  const { accountSize, riskPct, entry, stopPrice, target } = input;
  const riskAmount = accountSize * (riskPct / 100);
  const stopDistance = Math.abs(entry - stopPrice);
  const shares = stopDistance > 0 ? Math.floor(riskAmount / stopDistance) : 0;
  const positionValue = shares * entry;
  const rewardPerShare = Math.abs(target - entry);
  let warning: string | undefined;
  if (stopDistance <= 0) {
    warning = "Stop must differ from entry to size a position.";
  } else if (shares < 1) {
    warning = "Stop too wide for this risk budget — 0 whole shares. Tighten the stop or raise risk %.";
  }
  return {
    riskAmount,
    stopDistance,
    stopPctOfEntry: entry > 0 ? (stopDistance / entry) * 100 : 0,
    shares,
    positionValue,
    positionPctOfAccount: accountSize > 0 ? (positionValue / accountSize) * 100 : 0,
    riskReward: stopDistance > 0 ? rewardPerShare / stopDistance : 0,
    rewardAmount: shares * rewardPerShare,
    warning,
  };
}

// Suggest a stop: the WIDER of an ATR-based stop and a level just below support.
export function suggestStop(
  entry: number,
  atr: number,
  atrMult: number,
  support?: number
): { stop: number; basis: string } {
  const atrStop = entry - atr * atrMult;
  if (support && support < entry) {
    const supportStop = support * 0.99; // 1% below support
    if (supportStop < atrStop) {
      return { stop: round2(supportStop), basis: `1% below support $${support.toFixed(2)}` };
    }
  }
  return { stop: round2(atrStop), basis: `${atrMult}× ATR ($${atr.toFixed(2)})` };
}

// Kelly fraction = W - (1-W)/R, where W = win prob, R = win/loss ratio.
export function kellyFraction(winProb: number, winLossRatio: number): number {
  if (winLossRatio <= 0) return 0;
  const f = winProb - (1 - winProb) / winLossRatio;
  return Math.max(0, f);
}

// Derive an implied win probability from LLM conviction (1-10), conservatively.
// Conviction 5 → 50%, each point ≈ ±4%, capped 30%..78%.
export function winProbFromConviction(conviction: number): number {
  const p = 0.5 + (conviction - 5) * 0.04;
  return Math.max(0.3, Math.min(0.78, p));
}

export interface KellyResult {
  winProb: number;
  winLossRatio: number;
  fullKelly: number; // fraction of capital
  halfKelly: number; // recommended (less variance)
  note: string;
}

export function kellyFromTrade(
  conviction: number,
  riskReward: number
): KellyResult {
  const winProb = winProbFromConviction(conviction);
  const full = kellyFraction(winProb, riskReward || 1);
  return {
    winProb,
    winLossRatio: riskReward,
    fullKelly: full,
    halfKelly: full / 2,
    note:
      full <= 0
        ? "Negative edge — Kelly says do not bet."
        : "Half-Kelly recommended; full Kelly assumes a perfectly calibrated edge.",
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
