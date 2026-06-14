import type { FullAnalysis } from "~/lib/pipeline";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";

interface Props {
  analyses: FullAnalysis[];
  onSelect: (ticker: string) => void;
}

const VERDICT_COLORS: Record<string, string> = {
  BUY: "#22c55e",
  HOLD: "#3b82f6",
  WATCH: "#f59e0b",
  AVOID: "#ef4444",
};

export function CompareTable({ analyses, onSelect }: Props) {
  const sorted = [...analyses].sort(
    (a, b) => b.scorecard.weighted - a.scorecard.weighted
  );

  return (
    <div
      style={{
        background: "#111118",
        border: "1px solid #2a2a3a",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid #2a2a3a",
          color: "#9ca3af",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        COMPARISON — {analyses.length} TICKERS RANKED
      </div>

      {/* Table header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "28px 80px 90px 80px 80px 90px 80px 1fr 32px",
          gap: 8,
          padding: "8px 20px",
          borderBottom: "1px solid #1e1e2e",
          color: "#4b5563",
          fontSize: 10,
          fontWeight: 700,
        }}
      >
        <span>#</span>
        <span>TICKER</span>
        <span>PRICE</span>
        <span>SCORE</span>
        <span>VERDICT</span>
        <span>6MO TARGET</span>
        <span>RISK</span>
        <span>CATALYST</span>
        <span />
      </div>

      {/* Rows */}
      {sorted.map((a, i) => {
        const color = VERDICT_COLORS[a.verdict.verdict] ?? "#6b7280";
        const ret6m =
          ((a.verdict.target_6mo - a.tech.current) / a.tech.current) * 100;

        return (
          <div
            key={a.ticker}
            onClick={() => onSelect(a.ticker)}
            style={{
              display: "grid",
              gridTemplateColumns: "28px 80px 90px 80px 80px 90px 80px 1fr 32px",
              gap: 8,
              padding: "12px 20px",
              borderBottom: "1px solid #1a1a26",
              cursor: "pointer",
              transition: "background 0.15s",
              alignItems: "center",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = "#1a1a26";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = "transparent";
            }}
          >
            <span style={{ color: "#6b7280", fontSize: 12 }}>{i + 1}</span>

            <span style={{ color: "#e8e8f0", fontWeight: 700, fontSize: 14 }}>
              {a.ticker}
            </span>

            <span style={{ color: "#e8e8f0", fontSize: 13 }}>
              ${a.tech.current.toFixed(2)}
            </span>

            {/* Framework score bar */}
            <div>
              <div
                style={{
                  background: "#1a1a26",
                  borderRadius: 3,
                  height: 6,
                  overflow: "hidden",
                  marginBottom: 2,
                }}
              >
                <div
                  style={{
                    width: `${(a.scorecard.weighted / 10) * 100}%`,
                    height: "100%",
                    background:
                      a.scorecard.weighted >= 8
                        ? "#22c55e"
                        : a.scorecard.weighted >= 6.5
                          ? "#3b82f6"
                          : a.scorecard.weighted >= 5
                            ? "#f59e0b"
                            : "#ef4444",
                    borderRadius: 3,
                  }}
                />
              </div>
              <span style={{ color: "#6b7280", fontSize: 10 }}>
                {a.scorecard.weighted.toFixed(1)}/10
              </span>
            </div>

            <span
              style={{
                color,
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {a.verdict.verdict}
            </span>

            <span>
              <span style={{ color: "#e8e8f0", fontSize: 12 }}>
                ${a.verdict.target_6mo.toFixed(0)}
              </span>
              <span
                style={{
                  color: ret6m >= 0 ? "#22c55e" : "#ef4444",
                  fontSize: 11,
                  marginLeft: 4,
                }}
              >
                {ret6m >= 0 ? "+" : ""}
                {ret6m.toFixed(0)}%
              </span>
            </span>

            <span
              style={{
                color:
                  a.verdict.risk_level === "LOW"
                    ? "#22c55e"
                    : a.verdict.risk_level === "MED"
                      ? "#f59e0b"
                      : "#ef4444",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {a.verdict.risk_level}
            </span>

            <span
              style={{
                color: "#6b7280",
                fontSize: 11,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {a.verdict.key_catalyst}
            </span>

            <ArrowRight size={14} color="#4b5563" />
          </div>
        );
      })}
    </div>
  );
}
