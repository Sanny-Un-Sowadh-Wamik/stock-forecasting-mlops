import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  BookOpen,
  Trash2,
  Sparkles,
  Loader,
  TrendingUp,
  TrendingDown,
  Lightbulb,
} from "lucide-react";
import {
  loadTrades,
  upsertTrade,
  deleteTrade,
  computePnl,
  debriefTrade,
  buildPlaybook,
  type TradeEntry,
} from "~/lib/journal";
import { loadAppConfig, llmReady } from "~/lib/llm";

export const Route = createFileRoute("/journal")({
  component: JournalPage,
});

function JournalPage() {
  const navigate = useNavigate();
  const [trades, setTrades] = useState<TradeEntry[]>([]);

  useEffect(() => {
    setTrades(loadTrades());
  }, []);

  const playbook = buildPlaybook(trades);

  if (trades.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px", maxWidth: 460, margin: "0 auto" }}>
        <div
          style={{
            width: 56,
            height: 56,
            background: "#6366f120",
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <BookOpen size={26} color="#818cf8" />
        </div>
        <h2 style={{ color: "#e8e8f0", fontWeight: 800, fontSize: 22, margin: "0 0 8px" }}>
          No trades logged yet
        </h2>
        <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
          Open any analysis and hit <strong>Log Trade</strong> to track it here. After it closes,
          the LLM debriefs it into checklist lessons.
        </p>
        <button
          onClick={() => navigate({ to: "/" })}
          style={{
            background: "linear-gradient(135deg, #6366f1, #818cf8)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "11px 22px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Analyze a Stock
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2
          style={{
            color: "#e8e8f0",
            fontWeight: 800,
            fontSize: 24,
            margin: "0 0 4px",
            letterSpacing: -0.5,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <BookOpen size={22} color="#818cf8" /> Trade Journal
        </h2>
        <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
          {trades.length} trade{trades.length === 1 ? "" : "s"} · LLM-facilitated debriefs build
          your playbook
        </p>
      </div>

      {/* Playbook */}
      {playbook.length > 0 && (
        <div
          style={{
            background: "linear-gradient(135deg, #f59e0b0e, #111118)",
            border: "1px solid #f59e0b30",
            borderRadius: 12,
            padding: 18,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "#f59e0b",
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            <Lightbulb size={14} /> YOUR PLAYBOOK — {playbook.length} LESSONS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {playbook.map((l, i) => (
              <div
                key={i}
                style={{ color: "#fcd34d", fontSize: 13, lineHeight: 1.5, paddingLeft: 14, position: "relative" }}
              >
                <span style={{ position: "absolute", left: 0 }}>·</span>
                {l}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trades */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {trades.map((t) => (
          <TradeCard
            key={t.id}
            trade={t}
            onChange={() => setTrades(loadTrades())}
            onOpenTicker={(tk) => navigate({ to: "/analysis/$ticker", params: { ticker: tk } })}
          />
        ))}
      </div>
    </div>
  );
}

function TradeCard({
  trade,
  onChange,
  onOpenTicker,
}: {
  trade: TradeEntry;
  onChange: () => void;
  onOpenTicker: (t: string) => void;
}) {
  const [exitPrice, setExitPrice] = useState(trade.exitPrice ?? 0);
  const [exitDate, setExitDate] = useState(
    trade.exitDate || new Date().toISOString().slice(0, 10)
  );
  const [shares, setShares] = useState(trade.shares ?? 0);
  const [catalyst, setCatalyst] = useState(trade.catalystOutcome);
  const [debriefing, setDebriefing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pnl = computePnl(trade);

  const closeAndDebrief = async () => {
    const llm = loadAppConfig().llm;
    const closed: TradeEntry = {
      ...trade,
      exitPrice: exitPrice || trade.exitPrice,
      exitDate,
      shares: shares || trade.shares,
      catalystOutcome: catalyst,
      status: "closed",
    };
    upsertTrade(closed);
    onChange();
    if (!llmReady(llm)) {
      setErr("LLM not configured for debrief (set model + key on Analyze page). Trade saved as closed.");
      return;
    }
    setDebriefing(true);
    setErr(null);
    try {
      const lessons = await debriefTrade(llm, closed);
      upsertTrade({ ...closed, lessons });
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDebriefing(false);
    }
  };

  const verdictColor =
    pnl == null ? "#6b7280" : pnl.dollar >= 0 ? "#22c55e" : "#ef4444";

  return (
    <div
      style={{
        background: "#111118",
        border: "1px solid #2a2a3a",
        borderRadius: 12,
        padding: 18,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <button
          onClick={() => onOpenTicker(trade.ticker)}
          style={{
            background: "none",
            border: "none",
            color: "#e8e8f0",
            fontWeight: 800,
            fontSize: 18,
            cursor: "pointer",
            padding: 0,
          }}
        >
          {trade.ticker}
        </button>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 4,
            background: trade.status === "open" ? "#3b82f622" : "#6b728022",
            color: trade.status === "open" ? "#3b82f6" : "#9ca3af",
          }}
        >
          {trade.status.toUpperCase()}
        </span>
        {trade.convictionAtEntry != null && (
          <span style={{ color: "#6b7280", fontSize: 11 }}>
            conviction {trade.convictionAtEntry}/10
          </span>
        )}
        {pnl && (
          <span
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: verdictColor,
              fontWeight: 800,
              fontSize: 16,
            }}
          >
            {pnl.dollar >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
            {pnl.dollar >= 0 ? "+" : ""}
            {pnl.pct.toFixed(1)}%
          </span>
        )}
        <button
          onClick={() => {
            deleteTrade(trade.id);
            onChange();
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#4b5563",
            marginLeft: pnl ? 8 : "auto",
            display: "flex",
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Thesis */}
      <div style={{ color: "#9ca3af", fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>
        {trade.thesis}
      </div>

      {/* Meta grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
          marginBottom: trade.status === "open" ? 12 : 0,
        }}
      >
        <Meta label="Entry" value={`${trade.entryDate} · $${trade.entryPrice?.toFixed(2) ?? "?"}`} />
        <Meta label="Exit" value={trade.exitPrice ? `${trade.exitDate} · $${trade.exitPrice.toFixed(2)}` : "—"} />
        <Meta label="Sentiment@entry" value={trade.sentimentAtEntry} />
        <Meta label="Technical" value={trade.technicalNote} />
      </div>

      {/* Close form for open trades */}
      {trade.status === "open" && (
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
            flexWrap: "wrap",
            background: "#1a1a26",
            borderRadius: 8,
            padding: 12,
          }}
        >
          <Inp label="Exit price" value={exitPrice} onChange={setExitPrice} />
          <Inp label="Shares" value={shares} onChange={setShares} />
          <DateInp label="Exit date" value={exitDate} onChange={setExitDate} />
          <TextInp label="Catalyst outcome" value={catalyst} onChange={setCatalyst} />
          <button
            onClick={closeAndDebrief}
            disabled={debriefing}
            style={{
              background: debriefing ? "#1a1a26" : "linear-gradient(135deg, #6366f1, #818cf8)",
              color: debriefing ? "#6b7280" : "#fff",
              border: "none",
              borderRadius: 8,
              padding: "9px 16px",
              fontSize: 12,
              fontWeight: 700,
              cursor: debriefing ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {debriefing ? <Loader size={13} className="spin" /> : <Sparkles size={13} />}
            Close & Debrief
          </button>
        </div>
      )}

      {/* Lessons */}
      {trade.lessons.length > 0 && (
        <div
          style={{
            marginTop: 12,
            background: "#22c55e0a",
            border: "1px solid #22c55e22",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          <div style={{ color: "#22c55e", fontSize: 10, fontWeight: 700, marginBottom: 6 }}>
            LESSONS LEARNED
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
            {trade.lessons.map((l, i) => (
              <li key={i} style={{ color: "#86efac", fontSize: 12, lineHeight: 1.5 }}>
                {l}
              </li>
            ))}
          </ul>
        </div>
      )}

      {err && (
        <div style={{ color: "#fca5a5", fontSize: 11, marginTop: 8, fontFamily: "monospace" }}>
          {err}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#1a1a26", borderRadius: 6, padding: "8px 10px" }}>
      <div style={{ color: "#6b7280", fontSize: 9, marginBottom: 2 }}>{label.toUpperCase()}</div>
      <div
        style={{
          color: "#d1d5db",
          fontSize: 11,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Inp({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label style={{ color: "#6b7280", fontSize: 10, display: "block", marginBottom: 3 }}>{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={inpStyle(90)}
      />
    </div>
  );
}

function DateInp({ label, value, onChange }: { label: string; value: string; onChange: (s: string) => void }) {
  return (
    <div>
      <label style={{ color: "#6b7280", fontSize: 10, display: "block", marginBottom: 3 }}>{label}</label>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} style={inpStyle(130)} />
    </div>
  );
}

function TextInp({ label, value, onChange }: { label: string; value: string; onChange: (s: string) => void }) {
  return (
    <div style={{ flex: 1, minWidth: 140 }}>
      <label style={{ color: "#6b7280", fontSize: 10, display: "block", marginBottom: 3 }}>{label}</label>
      <input
        type="text"
        value={value}
        placeholder="happened / missed / no-effect"
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inpStyle(0), width: "100%" }}
      />
    </div>
  );
}

function inpStyle(width: number): React.CSSProperties {
  return {
    width: width || undefined,
    background: "#0a0a0f",
    border: "1px solid #2a2a3a",
    borderRadius: 7,
    padding: "8px 10px",
    color: "#e8e8f0",
    fontSize: 12,
    fontWeight: 600,
    outline: "none",
    boxSizing: "border-box",
  };
}
