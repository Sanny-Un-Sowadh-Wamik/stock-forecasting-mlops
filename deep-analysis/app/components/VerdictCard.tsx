import type { AnalysisVerdict } from "~/lib/claude";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

const VERDICT_COLORS: Record<string, string> = {
  BUY: "#22c55e",
  HOLD: "#3b82f6",
  WATCH: "#f59e0b",
  AVOID: "#ef4444",
};

const RISK_COLORS: Record<string, string> = {
  LOW: "#22c55e",
  MED: "#f59e0b",
  HIGH: "#ef4444",
  "VERY HIGH": "#dc2626",
};

interface Props {
  verdict: AnalysisVerdict;
  ticker: string;
  current: number;
}

export function VerdictCard({ verdict, ticker, current }: Props) {
  const color = VERDICT_COLORS[verdict.verdict] ?? "#6b7280";
  const riskColor = RISK_COLORS[verdict.risk_level] ?? "#6b7280";
  const ret6m = ((verdict.target_6mo - current) / current) * 100;
  const ret3y = ((verdict.target_3yr - current) / current) * 100;

  return (
    <div
      style={{
        background: "#111118",
        border: `1px solid ${color}44`,
        borderRadius: 12,
        padding: 20,
        boxShadow: `0 0 24px ${color}18`,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div
          style={{
            background: color,
            color: "#000",
            fontWeight: 800,
            fontSize: 13,
            padding: "4px 12px",
            borderRadius: 6,
            letterSpacing: 1,
          }}
        >
          {verdict.verdict}
        </div>
        <div style={{ color: "#9ca3af", fontSize: 13 }}>
          Conviction{" "}
          <span style={{ color, fontWeight: 700 }}>{verdict.conviction}/10</span>
        </div>
        <div
          style={{
            marginLeft: "auto",
            background: riskColor + "22",
            color: riskColor,
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 4,
            letterSpacing: 0.5,
          }}
        >
          {verdict.risk_level} RISK
        </div>
      </div>

      {/* Price targets grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <PriceBox label="Entry Low" value={`$${verdict.entry_zone.low.toFixed(2)}`} color="#9ca3af" />
        <PriceBox label="Entry High" value={`$${verdict.entry_zone.high.toFixed(2)}`} color="#9ca3af" />
        <PriceBox
          label="6mo Target"
          value={`$${verdict.target_6mo.toFixed(2)}`}
          sub={`${ret6m >= 0 ? "+" : ""}${ret6m.toFixed(1)}%`}
          color={ret6m >= 0 ? "#22c55e" : "#ef4444"}
        />
        <PriceBox
          label="3yr Target"
          value={`$${verdict.target_3yr.toFixed(2)}`}
          sub={`${ret3y >= 0 ? "+" : ""}${ret3y.toFixed(1)}%`}
          color={ret3y >= 0 ? "#22c55e" : "#ef4444"}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 14,
        }}
      >
        {/* Bull case */}
        <div
          style={{
            background: "#22c55e0e",
            border: "1px solid #22c55e2a",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          <div style={{ color: "#22c55e", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
            BULL CASE
          </div>
          <div style={{ color: "#d1fae5", fontSize: 12, lineHeight: 1.5 }}>
            {verdict.bull_case}
          </div>
        </div>
        {/* Bear case */}
        <div
          style={{
            background: "#ef44440e",
            border: "1px solid #ef44442a",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          <div style={{ color: "#ef4444", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
            BEAR CASE
          </div>
          <div style={{ color: "#fee2e2", fontSize: 12, lineHeight: 1.5 }}>
            {verdict.bear_case}
          </div>
        </div>
      </div>

      {/* Catalyst + pattern */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <InfoRow label="Key Catalyst" value={verdict.key_catalyst} />
        <InfoRow label="Historical Pattern" value={verdict.historical_pattern} />
      </div>

      {/* Summary */}
      <div
        style={{
          background: "#1a1a26",
          borderRadius: 8,
          padding: "10px 14px",
          color: "#9ca3af",
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        {verdict.summary}
      </div>

      {/* Stop loss */}
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <AlertTriangle size={13} color="#f59e0b" />
        <span style={{ color: "#9ca3af", fontSize: 12 }}>
          Stop loss: <span style={{ color: "#ef4444", fontWeight: 700 }}>
            ${verdict.stop_loss.toFixed(2)}
          </span>
          <span style={{ color: "#6b7280", marginLeft: 8 }}>
            ({(((verdict.stop_loss - current) / current) * 100).toFixed(1)}% from current)
          </span>
        </span>
      </div>
    </div>
  );
}

function PriceBox({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "#1a1a26",
        borderRadius: 8,
        padding: "10px 12px",
        textAlign: "center",
      }}
    >
      <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ color, fontWeight: 700, fontSize: 14 }}>{value}</div>
      {sub && (
        <div style={{ color, fontSize: 11, marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#1a1a26",
        borderRadius: 8,
        padding: "10px 12px",
      }}
    >
      <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 600, marginBottom: 4 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ color: "#e8e8f0", fontSize: 12, lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}
