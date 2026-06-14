// Weighted 5-category scorecard — operationalizes the long-term investing framework.
//   Business quality 30% · Financials 25% · Moat 20% · Valuation 15% · Management 10%
// A stock scoring 8/10+ is flagged as a candidate.

import type { FundamentalMetrics, ScoreDetail } from "./fundamentals";
import { scoreFinancials, scoreValuation } from "./fundamentals";

export interface QualScore {
  score: number; // 1-10
  rationale: string;
}

export interface QualScores {
  business_quality: QualScore;
  moat: QualScore;
  management: QualScore;
}

export interface CategoryScore {
  key: string;
  label: string;
  weight: number; // 0..1
  score: number; // 0..10
  rationale: string;
  detail?: ScoreDetail; // for quantitative categories
}

export interface ChecklistItem {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface Scorecard {
  categories: CategoryScore[];
  weighted: number; // 0..10
  isCandidate: boolean; // >= 8
  checklist: ChecklistItem[];
  checklistPassed: number;
  checklistTotal: number;
}

export const WEIGHTS = {
  business_quality: 0.3,
  financials: 0.25,
  moat: 0.2,
  valuation: 0.15,
  management: 0.1,
};

export interface ThesisBlock {
  thesis: string;
  biggest_risk: string;
  worst_case: string;
}

export function buildScorecard(
  metrics: FundamentalMetrics,
  qual: QualScores,
  thesis: ThesisBlock
): Scorecard {
  const finDetail = scoreFinancials(metrics);
  const valDetail = scoreValuation(metrics);

  const categories: CategoryScore[] = [
    {
      key: "business_quality",
      label: "Business Quality",
      weight: WEIGHTS.business_quality,
      score: clamp(qual.business_quality.score),
      rationale: qual.business_quality.rationale,
    },
    {
      key: "financials",
      label: "Financials",
      weight: WEIGHTS.financials,
      score: finDetail.score,
      rationale: financialsSummary(metrics),
      detail: finDetail,
    },
    {
      key: "moat",
      label: "Competitive Moat",
      weight: WEIGHTS.moat,
      score: clamp(qual.moat.score),
      rationale: qual.moat.rationale,
    },
    {
      key: "valuation",
      label: "Valuation",
      weight: WEIGHTS.valuation,
      score: valDetail.score,
      rationale: valuationSummary(metrics),
      detail: valDetail,
    },
    {
      key: "management",
      label: "Management",
      weight: WEIGHTS.management,
      score: clamp(qual.management.score),
      rationale: qual.management.rationale,
    },
  ];

  const weighted = categories.reduce((s, c) => s + c.score * c.weight, 0);

  const checklist = buildChecklist(metrics, qual, thesis, valDetail.score);
  const checklistPassed = checklist.filter((c) => c.passed).length;

  return {
    categories,
    weighted: Math.round(weighted * 10) / 10,
    isCandidate: weighted >= 8,
    checklist,
    checklistPassed,
    checklistTotal: checklist.length,
  };
}

function buildChecklist(
  m: FundamentalMetrics,
  qual: QualScores,
  thesis: ThesisBlock,
  valScore: number
): ChecklistItem[] {
  return [
    {
      key: "understand_business",
      label: "Understand the business",
      passed: qual.business_quality.score >= 5,
      detail: qual.business_quality.score >= 5 ? "Clear model" : "Unclear / complex",
    },
    {
      key: "growing_revenue",
      label: "Growing revenue",
      passed: m.revenueCagr != null && m.revenueCagr > 0,
      detail: m.revenueCagr != null ? `${m.revenueCagr.toFixed(1)}% CAGR` : "N/A",
    },
    {
      key: "growing_profits",
      label: "Growing profits",
      passed: m.netIncomeCagr != null && m.netIncomeCagr > 0,
      detail: m.netIncomeCagr != null ? `${m.netIncomeCagr.toFixed(1)}% CAGR` : "N/A",
    },
    {
      key: "strong_balance_sheet",
      label: "Strong balance sheet",
      passed:
        (m.currentRatio == null || m.currentRatio > 1) &&
        (m.debtToEquity == null || m.debtToEquity < 2) &&
        (m.currentRatio != null || m.debtToEquity != null),
      detail: balanceSheetDetail(m),
    },
    {
      key: "competitive_moat",
      label: "Competitive moat",
      passed: qual.moat.score >= 7,
      detail: `Moat ${qual.moat.score}/10`,
    },
    {
      key: "fair_valuation",
      label: "Fair valuation",
      passed: valScore >= 5,
      detail: m.peg != null ? `PEG ${m.peg.toFixed(2)}` : `Val ${valScore.toFixed(1)}/10`,
    },
    {
      key: "good_management",
      label: "Good management",
      passed: qual.management.score >= 6,
      detail: `Mgmt ${qual.management.score}/10`,
    },
    {
      key: "clear_thesis",
      label: "Clear thesis",
      passed: thesis.thesis.trim().length > 20,
      detail: thesis.thesis.trim().length > 20 ? "Defined" : "Missing",
    },
    {
      key: "understand_risks",
      label: "Understand risks",
      passed: thesis.biggest_risk.trim().length > 5,
      detail: thesis.biggest_risk.trim().length > 5 ? "Identified" : "Missing",
    },
  ];
}

function balanceSheetDetail(m: FundamentalMetrics): string {
  const parts: string[] = [];
  if (m.currentRatio != null) parts.push(`CR ${m.currentRatio.toFixed(1)}`);
  if (m.debtToEquity != null) parts.push(`D/E ${m.debtToEquity.toFixed(1)}`);
  return parts.length ? parts.join(" · ") : "N/A";
}

function financialsSummary(m: FundamentalMetrics): string {
  const parts: string[] = [];
  if (m.revenueCagr != null) parts.push(`Rev ${m.revenueCagr.toFixed(0)}%/yr`);
  if (m.netMargin != null) parts.push(`${m.netMargin.toFixed(0)}% net margin`);
  if (m.positiveCashFlow != null)
    parts.push(m.positiveCashFlow ? "positive FCF" : "burning cash");
  return parts.join(", ") || "Limited financial data";
}

function valuationSummary(m: FundamentalMetrics): string {
  const parts: string[] = [];
  if (m.pe != null) parts.push(`P/E ${m.pe.toFixed(0)}×`);
  if (m.peg != null) parts.push(`PEG ${m.peg.toFixed(2)}`);
  return parts.join(", ") || "Valuation data limited";
}

function clamp(n: number): number {
  return Math.max(0, Math.min(10, n));
}

// Map weighted score (0-10) to a verdict tier color/label for dashboard chips.
export function scoreTier(score: number): { label: string; color: string } {
  if (score >= 8) return { label: "Candidate", color: "#22c55e" };
  if (score >= 6.5) return { label: "Watch", color: "#3b82f6" };
  if (score >= 5) return { label: "Neutral", color: "#f59e0b" };
  return { label: "Pass", color: "#ef4444" };
}
