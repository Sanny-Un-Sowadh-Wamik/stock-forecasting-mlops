// Cluster D — Trade journal + post-trade LLM debrief. localStorage-backed.

import { llmComplete, parseJSONLoose, type LLMConfig } from "./llm";

export interface TradeEntry {
  id: string;
  ticker: string;
  thesis: string;
  convictionAtEntry: number | null;
  entryDate: string;
  entryPrice: number | null;
  exitDate: string;
  exitPrice: number | null;
  shares: number | null;
  sentimentAtEntry: string;
  catalystOutcome: string; // happened / missed / no-effect
  technicalNote: string;
  status: "open" | "closed";
  lessons: string[]; // filled by debrief
  createdAt: string;
}

const KEY = "das:journal";

export function loadTrades(): TradeEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveAll(trades: TradeEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(trades));
  } catch {
    // quota — ignore
  }
}

export function upsertTrade(trade: TradeEntry): TradeEntry[] {
  const trades = loadTrades();
  const idx = trades.findIndex((t) => t.id === trade.id);
  if (idx >= 0) trades[idx] = trade;
  else trades.unshift(trade);
  saveAll(trades);
  return trades;
}

export function deleteTrade(id: string): TradeEntry[] {
  const trades = loadTrades().filter((t) => t.id !== id);
  saveAll(trades);
  return trades;
}

export function newTradeId(): string {
  // Date.now()/Math.random() are fine here (browser runtime, not a workflow script)
  return `t_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function computePnl(t: TradeEntry): { dollar: number; pct: number } | null {
  if (t.entryPrice == null || t.exitPrice == null) return null;
  const shares = t.shares ?? 1;
  const dollar = (t.exitPrice - t.entryPrice) * shares;
  const pct = t.entryPrice > 0 ? ((t.exitPrice - t.entryPrice) / t.entryPrice) * 100 : 0;
  return { dollar, pct };
}

// LLM debrief → 3 actionable lessons.
export async function debriefTrade(
  llm: LLMConfig,
  trade: TradeEntry
): Promise<string[]> {
  const pnl = computePnl(trade);
  const prompt = `You are a trading coach. Debrief this closed trade and return ONLY a JSON array of exactly 3 short, actionable lessons (strings) for the trader's checklist.

Ticker: ${trade.ticker}
Thesis: ${trade.thesis}
Conviction at entry: ${trade.convictionAtEntry ?? "n/a"}/10
Entry: ${trade.entryDate} @ $${trade.entryPrice ?? "?"}
Exit: ${trade.exitDate} @ $${trade.exitPrice ?? "?"}
P&L: ${pnl ? `$${pnl.dollar.toFixed(2)} (${pnl.pct.toFixed(1)}%)` : "n/a"}
Sentiment at entry: ${trade.sentimentAtEntry}
Catalyst outcome: ${trade.catalystOutcome}
Technical note: ${trade.technicalNote}

What went right/wrong? Could a sentiment shift have been caught earlier? Was risk sized correctly? Respond ONLY with: ["lesson 1", "lesson 2", "lesson 3"]`;

  const text = await llmComplete(llm, prompt, 512);
  const lessons = parseJSONLoose<unknown>(text);
  return Array.isArray(lessons) ? lessons.map(String).slice(0, 3) : [];
}

// Aggregate every lesson across closed trades into a personal playbook.
export function buildPlaybook(trades: TradeEntry[]): string[] {
  return trades.flatMap((t) => t.lessons ?? []);
}
